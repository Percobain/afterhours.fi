"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.marketRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const abi_1 = require("../abi");
const chains_1 = require("../chains");
const data_1 = require("../data");
const logger_1 = require("../logger");
const prices_1 = require("../market/prices");
const status_1 = require("../market/status");
const tokens_1 = require("../market/tokens");
const engine_1 = require("../pricing/engine");
const vol_1 = require("../pricing/vol");
const util_1 = require("./util");
exports.marketRouter = (0, express_1.Router)();
exports.marketRouter.get("/market-status", (0, util_1.asyncHandler)(async (req, res) => {
    const force = req.query.refresh === "1";
    res.json(await (0, status_1.getMarketStatus)(force));
}));
exports.marketRouter.get("/tokens", (0, util_1.asyncHandler)(async (req, res) => {
    const { chainId } = (0, util_1.parseQuery)(zod_1.z.object({ chainId: util_1.zChainId }), req.query);
    const c = (0, util_1.requireChain)(chainId);
    const tokens = await (0, tokens_1.getTokens)(chainId);
    const summary = (0, data_1.getSummary)();
    let oraclePrices = tokens.map(() => null);
    let oracleAt = tokens.map(() => null);
    if (c.contracts.ReferenceOracle && tokens.length > 0) {
        try {
            const oracle = c.contracts.ReferenceOracle;
            const res2 = await (0, chains_1.getPublicClient)(chainId).multicall({
                contracts: tokens.flatMap((t) => [
                    { address: oracle, abi: abi_1.ReferenceOracleAbi, functionName: "lastPrice", args: [t.address] },
                    { address: oracle, abi: abi_1.ReferenceOracleAbi, functionName: "lastPriceAt", args: [t.address] },
                ]),
                allowFailure: true,
            });
            oraclePrices = tokens.map((_, i) => {
                const r = res2[i * 2];
                return r?.status === "success" ? r.result : null;
            });
            oracleAt = tokens.map((_, i) => {
                const r = res2[i * 2 + 1];
                return r?.status === "success" ? Number(r.result) : null;
            });
        }
        catch (e) {
            logger_1.logger.warn({ chainId, err: e.message }, "oracle lastPrice multicall failed");
        }
    }
    const out = await Promise.all(tokens.map(async (t, i) => {
        const [vol, live] = await Promise.all([(0, vol_1.getVol)(t.ticker, t.symbol), (0, prices_1.getUnderlyingPrice)(t).catch(() => null)]);
        const pt = summary.per_ticker[t.ticker];
        const p5 = (0, engine_1.priceBarrier)(500, vol.rv20);
        const oracle8 = oraclePrices[i];
        return {
            symbol: t.symbol,
            address: t.address,
            ticker: t.ticker,
            name: t.name,
            decimals: t.decimals,
            wrapper: t.wrapper,
            lastPrice: oracle8 && oracle8 > 0n ? oracle8.toString() : (live?.price8 ?? null),
            lastPriceSource: oracle8 && oracle8 > 0n ? "oracle" : (live?.source ?? null),
            lastPriceAt: oracle8 && oracle8 > 0n ? (oracleAt[i] ?? null) : (live?.asof ?? null),
            livePrice: live ? { price: live.price, price8: live.price8, source: live.source, asof: live.asof, stale: live.stale, stockPrintNull: live.stockPrintNull } : null,
            rv20: vol.rv20,
            rv20Source: vol.source,
            rv20Asof: vol.asof,
            breachProb5: pt?.breach_5_pct ?? p5.breachProbability,
            breachProb5Model: p5.breachProbability,
            worstWeekend: pt?.worst_weekend ?? null,
            worstWeekendDate: pt?.worst_weekend_date ?? null,
            weekendsInBacktest: pt?.n_weekends ?? null,
            menu: [100, 200, 300, 500, 700, 1000].map((b) => {
                const p = (0, engine_1.priceBarrier)(b, vol.rv20);
                return { barrierBps: b, chargedBp: p.chargedBp, fairBp: p.fairBp, pricedOut: p.pricedOut };
            }),
        };
    }));
    res.json({ chainId, deployed: !!c.contracts.CoverMarket, tokens: out });
}));
//# sourceMappingURL=market.js.map