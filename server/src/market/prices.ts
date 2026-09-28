/**
 * Underlying live price per share (USD, 8 decimals on the wire).
 * Order: manual override -> Binance RWA dynamic endpoint (stockInfo.price, else tokenInfo.price / sharesMultiplier)
 *        -> Binance spot ticker/price for the bStock ({SYMBOL}USDT) -> last known -> ticker_vol.json close.
 */
import fs from "node:fs";
import { config, type TokenInfo } from "../config";
import { getTickerVol } from "../data";
import { logger } from "../logger";
import { RWA_TOKEN_LIST_PATH } from "../paths";
import { fetchJson, KeyedTtlCache } from "../util/http";
import { nowSec } from "../util/time";
import { binanceBudget } from "../pricing/vol";

export type PriceSource = "override" | "rwa_stock" | "rwa_token" | "binance_spot" | "last_known" | "ticker_vol";

export interface PriceResult {
  ticker: string;
  price: number; // USD per share
  price8: string; // 8-decimal integer string
  source: PriceSource;
  asof: number; // unix seconds
  stale: boolean;
  stockPrintNull: boolean; // true when the RWA endpoint answered but stockInfo.price was null (market closed)
  tokenPrice: number | null;
  sharesMultiplier: number | null;
  rwaContract: string | null;
}

interface RwaListEntry {
  chainId: string;
  contractAddress: string;
  symbol: string;
  ticker: string;
  type: number; // 1 Ondo, 2 xStock, 3 bStock
  multiplier: string;
  cs?: string; // spot symbol for bStocks
}

let rwaList: RwaListEntry[] | null = null;

function loadRwaList(): RwaListEntry[] {
  if (rwaList) return rwaList;
  try {
    if (fs.existsSync(RWA_TOKEN_LIST_PATH)) {
      const raw = JSON.parse(fs.readFileSync(RWA_TOKEN_LIST_PATH, "utf8")) as { data?: RwaListEntry[] } | RwaListEntry[];
      rwaList = Array.isArray(raw) ? raw : (raw.data ?? []);
      logger.info({ n: rwaList.length }, "binance RWA token list loaded");
    } else {
      rwaList = [];
      logger.warn({ path: RWA_TOKEN_LIST_PATH }, "RWA token list not found; Ondo dynamic pricing disabled");
    }
  } catch (e) {
    rwaList = [];
    logger.warn({ err: (e as Error).message }, "RWA token list unreadable");
  }
  return rwaList;
}

/** Find the BSC (chainId 56) RWA entry for a ticker, preferring the same wrapper as the token. */
export function rwaEntryFor(ticker: string, wrapper: string): RwaListEntry | null {
  const list = loadRwaList().filter((e) => e.chainId === "56" && e.ticker?.toUpperCase() === ticker.toUpperCase());
  if (list.length === 0) return null;
  const pref = wrapper === "bstock" ? 3 : wrapper === "xstock" ? 2 : 1;
  return list.find((e) => e.type === pref) ?? list.find((e) => e.type === 1) ?? list[0] ?? null;
}

export function spotSymbolFor(ticker: string, symbol: string | null): string | null {
  if (symbol && symbol.endsWith("B")) return `${symbol}USDT`;
  const e = loadRwaList().find((x) => x.chainId === "56" && x.type === 3 && x.ticker?.toUpperCase() === ticker.toUpperCase());
  return e?.cs ?? `${ticker.toUpperCase()}BUSDT`;
}

const overrides = new Map<string, number>();
const lastKnown = new Map<string, PriceResult>();
const cache = new KeyedTtlCache<PriceResult | null>(60_000, "price");

export function setPriceOverride(ticker: string, price: number | null): void {
  const t = ticker.toUpperCase();
  if (price === null || !Number.isFinite(price) || price <= 0) overrides.delete(t);
  else overrides.set(t, price);
  cache.invalidateAll();
}

export function getPriceOverrides(): Record<string, number> {
  return Object.fromEntries(overrides);
}

export function to8(price: number): string {
  return BigInt(Math.round(price * 1e8)).toString();
}

function result(ticker: string, price: number, source: PriceSource, extra: Partial<PriceResult> = {}): PriceResult {
  const r: PriceResult = {
    ticker,
    price,
    price8: to8(price),
    source,
    asof: nowSec(),
    stale: false,
    stockPrintNull: false,
    tokenPrice: null,
    sharesMultiplier: null,
    rwaContract: null,
    ...extra,
  };
  if (source !== "last_known" && source !== "ticker_vol") lastKnown.set(ticker, r);
  return r;
}

interface RwaDynamic {
  stockInfo?: { price?: string | number | null; [k: string]: unknown } | null;
  tokenInfo?: { price?: string | number | null; sharesMultiplier?: string | number | null; [k: string]: unknown } | null;
}

/** Ondo/bStock dynamic endpoint. Returns null on failure. `stockPrintNull` is set when only the token print is available. */
async function fetchRwaDynamic(ticker: string, entry: RwaListEntry): Promise<PriceResult | null> {
  const url = `${config.binance.web3Base}/bapi/defi/v2/public/wallet-direct/buw/wallet/market/token/rwa/dynamic/ai?chainId=56&contractAddress=${entry.contractAddress}`;
  const res = await fetchJson<{ data?: RwaDynamic } & RwaDynamic>(url, {
    timeoutMs: 6_000,
    headers: { "Accept-Encoding": "identity", "User-Agent": "binance-web3/1.1 (Skill)", Accept: "application/json" },
  });
  if (!res.ok || !res.data) return null;
  const d = (res.data.data ?? res.data) as RwaDynamic;
  const stockPrice = Number(d.stockInfo?.price);
  const tokenPrice = Number(d.tokenInfo?.price);
  const mult = Number(d.tokenInfo?.sharesMultiplier ?? entry.multiplier ?? 1) || 1;
  if (d.stockInfo && d.stockInfo.price !== null && d.stockInfo.price !== undefined && Number.isFinite(stockPrice) && stockPrice > 0) {
    return result(ticker, stockPrice, "rwa_stock", { tokenPrice: Number.isFinite(tokenPrice) ? tokenPrice : null, sharesMultiplier: mult, rwaContract: entry.contractAddress });
  }
  if (Number.isFinite(tokenPrice) && tokenPrice > 0) {
    return result(ticker, tokenPrice / mult, "rwa_token", { tokenPrice, sharesMultiplier: mult, stockPrintNull: true, rwaContract: entry.contractAddress });
  }
  return null;
}

async function fetchSpot(ticker: string, symbol: string | null): Promise<PriceResult | null> {
  const spot = spotSymbolFor(ticker, symbol);
  if (!spot || !binanceBudget.canRequest()) return null;
  binanceBudget.note();
  const res = await fetchJson<{ symbol: string; price: string }>(`${config.binance.spotBase}/api/v3/ticker/price?symbol=${spot}`, { timeoutMs: 5_000 });
  binanceBudget.observe(res.status, res.headers);
  if (!res.ok || !res.data) return null;
  const p = Number(res.data.price);
  if (!Number.isFinite(p) || p <= 0) return null;
  const e = loadRwaList().find((x) => x.chainId === "56" && x.type === 3 && x.cs === spot);
  const mult = Number(e?.multiplier ?? 1) || 1;
  return result(ticker, p / mult, "binance_spot", { tokenPrice: p, sharesMultiplier: mult });
}

async function resolve(ticker: string, symbol: string | null, wrapper: string): Promise<PriceResult | null> {
  const t = ticker.toUpperCase();
  const ov = overrides.get(t);
  if (ov) return result(t, ov, "override");
  const entry = rwaEntryFor(t, wrapper);
  if (entry) {
    try {
      const r = await fetchRwaDynamic(t, entry);
      if (r && r.source === "rwa_stock") return r;
      // stock print null: prefer a spot print (24/7) if there is one, else the token-implied price
      const spot = await fetchSpot(t, symbol).catch(() => null);
      if (spot) return { ...spot, stockPrintNull: true };
      if (r) return r;
    } catch (e) {
      logger.debug({ ticker: t, err: (e as Error).message }, "rwa dynamic failed");
    }
  }
  try {
    const spot = await fetchSpot(t, symbol);
    if (spot) return spot;
  } catch (e) {
    logger.debug({ ticker: t, err: (e as Error).message }, "spot price failed");
  }
  const lk = lastKnown.get(t);
  if (lk) return { ...lk, source: "last_known", stale: true };
  const fv = getTickerVol()[t];
  if (fv && Number.isFinite(fv.close) && fv.close > 0) {
    return { ...result(t, fv.close, "ticker_vol"), asof: Math.floor(new Date(fv.asof).getTime() / 1000) || nowSec(), stale: true };
  }
  return null;
}

/** Cached (60s) live price for a token; null when nothing at all is known about the ticker. */
export async function getUnderlyingPrice(t: { ticker: string | null; symbol: string | null; wrapper: string }): Promise<PriceResult | null> {
  if (!t.ticker) return null;
  const key = `${t.ticker.toUpperCase()}:${t.wrapper}`;
  return cache.get(key, () => resolve(t.ticker as string, t.symbol, t.wrapper));
}

/**
 * The official underlying print only: `stockInfo.price` from the RWA endpoint (non-null only while the
 * underlying market is open). Used for the Monday open. Overrides count as prints for demos.
 */
export async function getUnderlyingPrint(t: { ticker: string; symbol: string | null; wrapper: string }): Promise<PriceResult | null> {
  const ticker = t.ticker.toUpperCase();
  const ov = overrides.get(ticker);
  if (ov) return result(ticker, ov, "override");
  const entry = rwaEntryFor(ticker, t.wrapper);
  if (!entry) return null;
  try {
    const r = await fetchRwaDynamic(ticker, entry);
    return r && r.source === "rwa_stock" ? r : null;
  } catch {
    return null;
  }
}

export async function refreshPrices(tokens: TokenInfo[]): Promise<Record<string, PriceResult | null>> {
  const out: Record<string, PriceResult | null> = {};
  const seen = new Set<string>();
  for (const t of tokens) {
    const key = `${t.ticker}:${t.wrapper}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out[t.symbol] = await getUnderlyingPrice(t).catch(() => null);
  }
  return out;
}

export function lastKnownPrices(): Record<string, PriceResult> {
  return Object.fromEntries(lastKnown);
}
