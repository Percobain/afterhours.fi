"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.rwaEntryFor = rwaEntryFor;
exports.spotSymbolFor = spotSymbolFor;
exports.setPriceOverride = setPriceOverride;
exports.getPriceOverrides = getPriceOverrides;
exports.to8 = to8;
exports.getUnderlyingPrice = getUnderlyingPrice;
exports.getUnderlyingPrint = getUnderlyingPrint;
exports.refreshPrices = refreshPrices;
exports.lastKnownPrices = lastKnownPrices;
/**
 * Underlying live price per share (USD, 8 decimals on the wire).
 * Order: manual override -> Binance RWA dynamic endpoint (stockInfo.price, else tokenInfo.price / sharesMultiplier)
 *        -> Binance spot ticker/price for the bStock ({SYMBOL}USDT) -> last known -> ticker_vol.json close.
 */
const node_fs_1 = __importDefault(require("node:fs"));
const config_1 = require("../config");
const data_1 = require("../data");
const logger_1 = require("../logger");
const paths_1 = require("../paths");
const http_1 = require("../util/http");
const time_1 = require("../util/time");
const vol_1 = require("../pricing/vol");
let rwaList = null;
function loadRwaList() {
    if (rwaList)
        return rwaList;
    try {
        if (node_fs_1.default.existsSync(paths_1.RWA_TOKEN_LIST_PATH)) {
            const raw = JSON.parse(node_fs_1.default.readFileSync(paths_1.RWA_TOKEN_LIST_PATH, "utf8"));
            rwaList = Array.isArray(raw) ? raw : (raw.data ?? []);
            logger_1.logger.info({ n: rwaList.length }, "binance RWA token list loaded");
        }
        else {
            rwaList = [];
            logger_1.logger.warn({ path: paths_1.RWA_TOKEN_LIST_PATH }, "RWA token list not found; Ondo dynamic pricing disabled");
        }
    }
    catch (e) {
        rwaList = [];
        logger_1.logger.warn({ err: e.message }, "RWA token list unreadable");
    }
    return rwaList;
}
/** Find the BSC (chainId 56) RWA entry for a ticker, preferring the same wrapper as the token. */
function rwaEntryFor(ticker, wrapper) {
    const list = loadRwaList().filter((e) => e.chainId === "56" && e.ticker?.toUpperCase() === ticker.toUpperCase());
    if (list.length === 0)
        return null;
    const pref = wrapper === "bstock" ? 3 : wrapper === "xstock" ? 2 : 1;
    return list.find((e) => e.type === pref) ?? list.find((e) => e.type === 1) ?? list[0] ?? null;
}
function spotSymbolFor(ticker, symbol) {
    if (symbol && symbol.endsWith("B"))
        return `${symbol}USDT`;
    const e = loadRwaList().find((x) => x.chainId === "56" && x.type === 3 && x.ticker?.toUpperCase() === ticker.toUpperCase());
    return e?.cs ?? `${ticker.toUpperCase()}BUSDT`;
}
const overrides = new Map();
const lastKnown = new Map();
const cache = new http_1.KeyedTtlCache(60_000, "price");
function setPriceOverride(ticker, price) {
    const t = ticker.toUpperCase();
    if (price === null || !Number.isFinite(price) || price <= 0)
        overrides.delete(t);
    else
        overrides.set(t, price);
    cache.invalidateAll();
}
function getPriceOverrides() {
    return Object.fromEntries(overrides);
}
function to8(price) {
    return BigInt(Math.round(price * 1e8)).toString();
}
function result(ticker, price, source, extra = {}) {
    const r = {
        ticker,
        price,
        price8: to8(price),
        source,
        asof: (0, time_1.nowSec)(),
        stale: false,
        stockPrintNull: false,
        tokenPrice: null,
        sharesMultiplier: null,
        rwaContract: null,
        ...extra,
    };
    if (source !== "last_known" && source !== "ticker_vol")
        lastKnown.set(ticker, r);
    return r;
}
/** Ondo/bStock dynamic endpoint. Returns null on failure. `stockPrintNull` is set when only the token print is available. */
async function fetchRwaDynamic(ticker, entry) {
    const url = `${config_1.config.binance.web3Base}/bapi/defi/v2/public/wallet-direct/buw/wallet/market/token/rwa/dynamic/ai?chainId=56&contractAddress=${entry.contractAddress}`;
    const res = await (0, http_1.fetchJson)(url, {
        timeoutMs: 6_000,
        headers: { "Accept-Encoding": "identity", "User-Agent": "binance-web3/1.1 (Skill)", Accept: "application/json" },
    });
    if (!res.ok || !res.data)
        return null;
    const d = (res.data.data ?? res.data);
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
async function fetchSpot(ticker, symbol) {
    const spot = spotSymbolFor(ticker, symbol);
    if (!spot || !vol_1.binanceBudget.canRequest())
        return null;
    vol_1.binanceBudget.note();
    const res = await (0, http_1.fetchJson)(`${config_1.config.binance.spotBase}/api/v3/ticker/price?symbol=${spot}`, { timeoutMs: 5_000 });
    vol_1.binanceBudget.observe(res.status, res.headers);
    if (!res.ok || !res.data)
        return null;
    const p = Number(res.data.price);
    if (!Number.isFinite(p) || p <= 0)
        return null;
    const e = loadRwaList().find((x) => x.chainId === "56" && x.type === 3 && x.cs === spot);
    const mult = Number(e?.multiplier ?? 1) || 1;
    return result(ticker, p / mult, "binance_spot", { tokenPrice: p, sharesMultiplier: mult });
}
async function resolve(ticker, symbol, wrapper) {
    const t = ticker.toUpperCase();
    const ov = overrides.get(t);
    if (ov)
        return result(t, ov, "override");
    const entry = rwaEntryFor(t, wrapper);
    if (entry) {
        try {
            const r = await fetchRwaDynamic(t, entry);
            if (r && r.source === "rwa_stock")
                return r;
            // stock print null: prefer a spot print (24/7) if there is one, else the token-implied price
            const spot = await fetchSpot(t, symbol).catch(() => null);
            if (spot)
                return { ...spot, stockPrintNull: true };
            if (r)
                return r;
        }
        catch (e) {
            logger_1.logger.debug({ ticker: t, err: e.message }, "rwa dynamic failed");
        }
    }
    try {
        const spot = await fetchSpot(t, symbol);
        if (spot)
            return spot;
    }
    catch (e) {
        logger_1.logger.debug({ ticker: t, err: e.message }, "spot price failed");
    }
    const lk = lastKnown.get(t);
    if (lk)
        return { ...lk, source: "last_known", stale: true };
    const fv = (0, data_1.getTickerVol)()[t];
    if (fv && Number.isFinite(fv.close) && fv.close > 0) {
        return { ...result(t, fv.close, "ticker_vol"), asof: Math.floor(new Date(fv.asof).getTime() / 1000) || (0, time_1.nowSec)(), stale: true };
    }
    return null;
}
/** Cached (60s) live price for a token; null when nothing at all is known about the ticker. */
async function getUnderlyingPrice(t) {
    if (!t.ticker)
        return null;
    const key = `${t.ticker.toUpperCase()}:${t.wrapper}`;
    return cache.get(key, () => resolve(t.ticker, t.symbol, t.wrapper));
}
/**
 * The official underlying print only: `stockInfo.price` from the RWA endpoint (non-null only while the
 * underlying market is open). Used for the Monday open. Overrides count as prints for demos.
 */
async function getUnderlyingPrint(t) {
    const ticker = t.ticker.toUpperCase();
    const ov = overrides.get(ticker);
    if (ov)
        return result(ticker, ov, "override");
    const entry = rwaEntryFor(ticker, t.wrapper);
    if (!entry)
        return null;
    try {
        const r = await fetchRwaDynamic(ticker, entry);
        return r && r.source === "rwa_stock" ? r : null;
    }
    catch {
        return null;
    }
}
async function refreshPrices(tokens) {
    const out = {};
    const seen = new Set();
    for (const t of tokens) {
        const key = `${t.ticker}:${t.wrapper}`;
        if (seen.has(key))
            continue;
        seen.add(key);
        out[t.symbol] = await getUnderlyingPrice(t).catch(() => null);
    }
    return out;
}
function lastKnownPrices() {
    return Object.fromEntries(lastKnown);
}
//# sourceMappingURL=prices.js.map