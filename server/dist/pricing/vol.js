"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.binanceBudget = void 0;
exports.spotSymbolsFor = spotSymbolsFor;
exports.getVol = getVol;
exports.volCacheState = volCacheState;
/**
 * Live 20-day realised vol from Binance spot daily klines of the bStock ({SYMBOL}USDT, e.g. NVDABUSDT),
 * cached 10 minutes, with a conservative request budget (~20/min) and 429/418 back-off.
 * Falls back to data/ticker_vol.json, then to DEFAULT_VOL (40% annualised) for unknown tickers.
 */
const config_1 = require("../config");
const data_1 = require("../data");
const logger_1 = require("../logger");
const http_1 = require("../util/http");
class BinanceBudget {
    windowStart = 0;
    count = 0;
    backoffUntil = 0;
    usedWeight1m = 0;
    canRequest() {
        const now = Date.now();
        if (now < this.backoffUntil)
            return false;
        if (now - this.windowStart >= 60_000) {
            this.windowStart = now;
            this.count = 0;
        }
        return this.count < config_1.config.binance.maxRequestsPerMinute;
    }
    note() {
        this.count++;
    }
    observe(status, headers) {
        const w = Number(headers.get("x-mbx-used-weight-1m"));
        if (Number.isFinite(w))
            this.usedWeight1m = w;
        if (status === 429 || status === 418) {
            const retry = Number(headers.get("retry-after"));
            const secs = Number.isFinite(retry) && retry > 0 ? retry : status === 418 ? 300 : 60;
            this.backoffUntil = Date.now() + secs * 1000;
            logger_1.logger.warn({ status, backoffSeconds: secs }, "binance rate limit hit, backing off");
        }
        else if (this.usedWeight1m > 1_000) {
            // stay far away from the 6000/min weight limit shared by everyone behind this IP
            this.backoffUntil = Date.now() + 30_000;
        }
    }
    state() {
        return { usedWeight1m: this.usedWeight1m, requestsThisMinute: this.count, backoffUntil: this.backoffUntil || null };
    }
}
exports.binanceBudget = new BinanceBudget();
const liveCache = new http_1.KeyedTtlCache(10 * 60_000, "klines");
const unknownSymbols = new Map(); // symbol -> expiry ms
async function fetchLiveVol(symbol) {
    if (!config_1.config.binance.klinesEnabled)
        return null;
    const exp = unknownSymbols.get(symbol);
    if (exp && Date.now() < exp)
        return null;
    if (!exports.binanceBudget.canRequest()) {
        logger_1.logger.debug({ symbol }, "binance budget exhausted, skipping live vol");
        return null;
    }
    exports.binanceBudget.note();
    const url = `${config_1.config.binance.spotBase}/api/v3/klines?symbol=${encodeURIComponent(symbol)}&interval=1d&limit=45`;
    const res = await (0, http_1.fetchJson)(url, { timeoutMs: 6_000 });
    exports.binanceBudget.observe(res.status, res.headers);
    if (!res.ok) {
        const body = res.data;
        if (res.status === 400 && body && body.code === -1121) {
            unknownSymbols.set(symbol, Date.now() + 6 * 3600_000);
            logger_1.logger.info({ symbol }, "binance spot symbol does not exist; using ticker_vol.json");
            return null;
        }
        logger_1.logger.warn({ symbol, status: res.status, body: res.text.slice(0, 200) }, "binance klines failed");
        return null;
    }
    const rows = Array.isArray(res.data) ? res.data : [];
    if (rows.length < 12)
        return null;
    // bStocks trade 24/7, so daily candles include quiet Saturdays and Sundays. The pricing engine was calibrated on
    // exchange close-to-close vol (252 trading days a year), so keep only weekday candles (UTC Mon-Fri, each closing at
    // 00:00 UTC, i.e. after the 16:00 New York bell) and measure returns between consecutive weekday closes. The Friday ->
    // Monday return then carries the whole weekend, exactly like an exchange close-to-close series.
    const closed = rows.filter((r) => Number(r[6]) < Date.now() && [1, 2, 3, 4, 5].includes(new Date(Number(r[0])).getUTCDay()));
    const closes = closed.slice(-21).map((r) => Number(r[4])).filter((x) => Number.isFinite(x) && x > 0);
    if (closes.length < 11)
        return null;
    const rets = [];
    for (let i = 1; i < closes.length; i++)
        rets.push(Math.log(closes[i] / closes[i - 1]));
    const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
    const varSum = rets.reduce((a, r) => a + (r - mean) ** 2, 0);
    const sd = Math.sqrt(varSum / (rets.length - 1));
    const rv20 = sd * Math.sqrt(252);
    if (!Number.isFinite(rv20) || rv20 <= 0)
        return null;
    const last = closed[closed.length - 1];
    return { rv20: Math.round(rv20 * 1e4) / 1e4, nObs: rets.length, asof: new Date(Number(last[6])).toISOString().slice(0, 10) };
}
/** Candidate spot symbols for a token: the bStock symbol itself, else the bStock of the same ticker. */
function spotSymbolsFor(symbol, ticker) {
    const out = [];
    if (symbol && symbol.endsWith("B"))
        out.push(`${symbol}USDT`);
    if (ticker && !out.includes(`${ticker}BUSDT`))
        out.push(`${ticker}BUSDT`);
    return out;
}
async function getVol(ticker, symbol) {
    const t = ticker ? ticker.toUpperCase() : null;
    for (const s of spotSymbolsFor(symbol, t)) {
        try {
            const live = await liveCache.get(s, () => fetchLiveVol(s));
            if (live)
                return { rv20: live.rv20, source: "binance_klines", ticker: t, symbol: s, asof: live.asof, nObs: live.nObs, rv60: null };
        }
        catch (e) {
            logger_1.logger.warn({ symbol: s, err: e.message }, "live vol lookup failed");
        }
    }
    const file = t ? (0, data_1.getTickerVol)()[t] : undefined;
    if (file && Number.isFinite(file.rv20) && file.rv20 > 0) {
        return { rv20: file.rv20, source: "ticker_vol", ticker: t, symbol: null, asof: file.asof, nObs: 20, rv60: file.rv60 ?? null };
    }
    return { rv20: config_1.config.pricing.defaultVol, source: "default", ticker: t, symbol: null, asof: new Date().toISOString().slice(0, 10), nObs: null, rv60: null };
}
function volCacheState() {
    return exports.binanceBudget.state();
}
//# sourceMappingURL=vol.js.map