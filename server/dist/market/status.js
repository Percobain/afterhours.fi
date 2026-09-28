"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMarketStatus = getMarketStatus;
/**
 * Binance public RWA market status proxy, cached 60s, with a computed fallback (next Friday 20:00 UTC bell,
 * next Monday 13:30 UTC open) when the endpoint is unreachable.
 */
const config_1 = require("../config");
const logger_1 = require("../logger");
const http_1 = require("../util/http");
const time_1 = require("../util/time");
const STATUS_URL = "/bapi/defi/v1/public/wallet-direct/buw/wallet/market/token/rwa/market/status/ai";
const cache = new http_1.TtlCache(60_000, "market-status");
function toSec(v) {
    if (v === null || v === undefined || v === "")
        return null;
    const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
    if (!Number.isFinite(n) || n <= 0)
        return null;
    return n > 1e12 ? Math.floor(n / 1000) : Math.floor(n);
}
function str(v) {
    if (v === null || v === undefined)
        return null;
    return String(v);
}
function fallback(error) {
    const now = (0, time_1.nowSec)();
    const bell = (0, time_1.nextFridayClose)(now, config_1.config.epochCloseHourUtc);
    const open = (0, time_1.nextMondayOpen)(now);
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
async function fetchUpstream() {
    const url = `${config_1.config.binance.web3Base}${STATUS_URL}`;
    try {
        const res = await (0, http_1.fetchJson)(url, {
            timeoutMs: 6_000,
            headers: { "Accept-Encoding": "identity", "User-Agent": "binance-web3/1.1 (Skill)", Accept: "application/json" },
        });
        if (!res.ok || !res.data)
            return fallback(`upstream ${res.status}`);
        const body = res.data;
        const data = (body.data ?? body);
        if (!data || typeof data !== "object")
            return fallback("upstream shape");
        return {
            openState: typeof data.openState === "boolean" ? data.openState : str(data.openState),
            marketStatus: str(data.marketStatus),
            reasonCode: str(data.reasonCode),
            reasonMsg: str(data.reasonMsg ?? data.reason),
            nextOpenTime: toSec(data.nextOpenTime),
            nextCloseTime: toSec(data.nextCloseTime),
            source: "binance",
            fetchedAt: (0, time_1.nowSec)(),
            raw: data,
        };
    }
    catch (e) {
        logger_1.logger.warn({ err: e.message }, "market status upstream unreachable, using computed fallback");
        return fallback(e.message);
    }
}
async function getMarketStatus(force = false) {
    const up = await cache.get(fetchUpstream, force);
    const now = (0, time_1.nowSec)();
    const currentEpochId = (0, time_1.nextFridayClose)(now, config_1.config.epochCloseHourUtc);
    const expectedOpen = (0, time_1.expectedOpenFor)(currentEpochId);
    const openAt = up.nextOpenTime ?? (0, time_1.nextMondayOpen)(now);
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
        bellAt: (0, time_1.iso)(currentEpochId),
        opensAt: (0, time_1.iso)(openAt),
        cachedAt: new Date(up.fetchedAt * 1000).toISOString(),
    };
}
//# sourceMappingURL=status.js.map