/**
 * Binance public RWA market status proxy, cached 60s, with a computed fallback (next Friday 20:00 UTC bell,
 * next Monday 13:30 UTC open) when the endpoint is unreachable.
 */
import { config } from "../config";
import { logger } from "../logger";
import { fetchJson, TtlCache } from "../util/http";
import { expectedOpenFor, iso, nextFridayClose, nextMondayOpen, nowSec } from "../util/time";

const STATUS_URL = "/bapi/defi/v1/public/wallet-direct/buw/wallet/market/token/rwa/market/status/ai";

export interface UpstreamStatus {
  openState: boolean | string | null;
  marketStatus: string | null;
  reasonCode: string | null;
  reasonMsg: string | null;
  nextOpenTime: number | null; // unix seconds
  nextCloseTime: number | null; // unix seconds
  source: "binance" | "fallback";
  fetchedAt: number;
  error?: string;
  raw?: unknown;
}

export interface MarketStatusResponse extends UpstreamStatus {
  currentEpochId: number;
  bindDeadline: number;
  expectedOpen: number;
  secondsToBell: number;
  secondsToOpen: number;
  isOpen: boolean;
  bellAt: string | null;
  opensAt: string | null;
  cachedAt: string;
}

const cache = new TtlCache<UpstreamStatus>(60_000, "market-status");

function toSec(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
  if (!Number.isFinite(n) || n <= 0) return null;
  return n > 1e12 ? Math.floor(n / 1000) : Math.floor(n);
}

function str(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  return String(v);
}

function fallback(error?: string): UpstreamStatus {
  const now = nowSec();
  const bell = nextFridayClose(now, config.epochCloseHourUtc);
  const open = nextMondayOpen(now);
  // Between Friday bell and Monday open the market is closed; otherwise assume it is open on weekdays.
  const day = new Date(now * 1000).getUTCDay();
  const closedWeekend = day === 6 || day === 0 || (day === 5 && now >= bell) || (day === 1 && now < open);
  return {
    openState: closedWeekend ? "CLOSED" : "OPEN",
    marketStatus: closedWeekend ? "MARKET_CLOSED" : "MARKET_OPEN",
    reasonCode: null,
    reasonMsg: null,
    nextOpenTime: open,
    nextCloseTime: bell,
    source: "fallback",
    fetchedAt: now,
    ...(error ? { error } : {}),
  };
}

async function fetchUpstream(): Promise<UpstreamStatus> {
  const url = `${config.binance.web3Base}${STATUS_URL}`;
  try {
    const res = await fetchJson<Record<string, unknown>>(url, {
      timeoutMs: 6_000,
      headers: { "Accept-Encoding": "identity", "User-Agent": "binance-web3/1.1 (Skill)", Accept: "application/json" },
    });
    if (!res.ok || !res.data) return fallback(`upstream ${res.status}`);
    const body = res.data;
    const data = (body.data ?? body) as Record<string, unknown>;
    if (!data || typeof data !== "object") return fallback("upstream shape");
    return {
      openState: typeof data.openState === "boolean" ? data.openState : str(data.openState),
      marketStatus: str(data.marketStatus),
      reasonCode: str(data.reasonCode),
      reasonMsg: str(data.reasonMsg ?? data.reason),
      nextOpenTime: toSec(data.nextOpenTime),
      nextCloseTime: toSec(data.nextCloseTime),
      source: "binance",
      fetchedAt: nowSec(),
      raw: data,
    };
  } catch (e) {
    logger.warn({ err: (e as Error).message }, "market status upstream unreachable, using computed fallback");
    return fallback((e as Error).message);
  }
}

export async function getMarketStatus(force = false): Promise<MarketStatusResponse> {
  const up = await cache.get(fetchUpstream, force);
  const now = nowSec();
  const currentEpochId = nextFridayClose(now, config.epochCloseHourUtc);
  const expectedOpen = expectedOpenFor(currentEpochId);
  const openAt = up.nextOpenTime ?? nextMondayOpen(now);
  const os = up.openState;
  const isOpen = typeof os === "boolean" ? os : typeof os === "string" ? ["OPEN", "TRUE"].includes(os.toUpperCase()) : (up.marketStatus ?? "").toLowerCase() === "open";
  return {
    ...up,
    currentEpochId,
    bindDeadline: currentEpochId,
    expectedOpen,
    secondsToBell: Math.max(0, currentEpochId - now),
    secondsToOpen: Math.max(0, openAt - now),
    isOpen,
    bellAt: iso(currentEpochId),
    opensAt: iso(openAt),
    cachedAt: new Date(up.fetchedAt * 1000).toISOString(),
  };
}
