import { Router } from "express";
import { z } from "zod";
import { ReferenceOracleAbi } from "../abi";
import { getPublicClient } from "../chains";
import { getSummary } from "../data";
import { logger } from "../logger";
import { getUnderlyingPrice } from "../market/prices";
import { getMarketStatus } from "../market/status";
import { getTokens } from "../market/tokens";
import { priceBarrier } from "../pricing/engine";
import { getVol } from "../pricing/vol";
import { asyncHandler, parseQuery, requireChain, zChainId } from "./util";

export const marketRouter = Router();

marketRouter.get(
  "/market-status",
  asyncHandler(async (req, res) => {
    const force = req.query.refresh === "1";
    res.json(await getMarketStatus(force));
  }),
);

marketRouter.get(
  "/tokens",
  asyncHandler(async (req, res) => {
    const { chainId } = parseQuery(z.object({ chainId: zChainId }), req.query);
    const c = requireChain(chainId);
    const tokens = await getTokens(chainId);
    const summary = getSummary();

    let oraclePrices: (bigint | null)[] = tokens.map(() => null);
    let oracleAt: (number | null)[] = tokens.map(() => null);
    if (c.contracts.ReferenceOracle && tokens.length > 0) {
      try {
        const oracle = c.contracts.ReferenceOracle;
        const res2 = await getPublicClient(chainId).multicall({
          contracts: tokens.flatMap((t) => [
            { address: oracle, abi: ReferenceOracleAbi, functionName: "lastPrice", args: [t.address] } as const,
            { address: oracle, abi: ReferenceOracleAbi, functionName: "lastPriceAt", args: [t.address] } as const,
          ]),
          allowFailure: true,
        });
        oraclePrices = tokens.map((_, i) => {
          const r = res2[i * 2];
          return r?.status === "success" ? (r.result as bigint) : null;
        });
        oracleAt = tokens.map((_, i) => {
          const r = res2[i * 2 + 1];
          return r?.status === "success" ? Number(r.result) : null;
        });
      } catch (e) {
        logger.warn({ chainId, err: (e as Error).message }, "oracle lastPrice multicall failed");
      }
    }

    const out = await Promise.all(
      tokens.map(async (t, i) => {
        const [vol, live] = await Promise.all([getVol(t.ticker, t.symbol), getUnderlyingPrice(t).catch(() => null)]);
        const pt = summary.per_ticker[t.ticker];
        const p5 = priceBarrier(500, vol.rv20);
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
            const p = priceBarrier(b, vol.rv20);
            return { barrierBps: b, chargedBp: p.chargedBp, fairBp: p.fairBp, pricedOut: p.pricedOut };
          }),
        };
      }),
    );
    res.json({ chainId, deployed: !!c.contracts.CoverMarket, tokens: out });
  }),
);
