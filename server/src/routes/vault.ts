import { Router } from "express";
import { z } from "zod";
import { CoverMarketAbi, KeeperVaultAbi } from "../abi";
import { getPublicClient } from "../chains";
import { getSummary } from "../data";
import { logger } from "../logger";
import { asyncHandler, parseQuery, requireChain, zChainId } from "./util";

export const vaultRouter = Router();

function apyBand() {
  const k = getSummary().keeper;
  return {
    low: k.roc_pa,
    high: k.roc_pa_since_2015,
    sharpe: k.sharpe,
    lossRatio: getSummary().loss_ratio_v4,
    worstWeekend: k.worst_weekend,
    worstWeekendPctCapital: k.worst_weekend_pct_capital,
    shareWeekendsLosing: k.share_weekends_losing,
    ruinProbability1y: k.ruin_1y_10pct_capital,
    basis: "backtest 2005-2026, static pool at 10% capital; CPPI sizing (this vault) held the floor from every start date",
  };
}

vaultRouter.get(
  "/vault",
  asyncHandler(async (req, res) => {
    const { chainId } = parseQuery(z.object({ chainId: zChainId }), req.query);
    const c = requireChain(chainId);
    const vault = c.contracts.KeeperVault;
    const market = c.contracts.CoverMarket;
    if (!vault || !market) {
      res.json({ chainId, deployed: false, message: `afterhours.fi is not deployed on ${c.name} yet`, impliedApyBand: apyBand() });
      return;
    }
    try {
      const client = getPublicClient(chainId);
      const v = (fn: "totalAssets" | "lockedAssets" | "floorAssets" | "freeCushion" | "freeAssets" | "utilisationBps" | "totalPremiumsReceived" | "totalPayoutsPaid" | "totalRefundsPaid" | "depositCap" | "totalSupply") =>
        ({ address: vault, abi: KeeperVaultAbi, functionName: fn }) as const;
      const r = await client.multicall({
        contracts: [
          v("totalAssets"),
          v("lockedAssets"),
          v("floorAssets"),
          v("freeCushion"),
          v("freeAssets"),
          v("utilisationBps"),
          v("totalPremiumsReceived"),
          v("totalPayoutsPaid"),
          v("totalRefundsPaid"),
          v("depositCap"),
          v("totalSupply"),
          { address: vault, abi: KeeperVaultAbi, functionName: "floorBps" },
          { address: vault, abi: KeeperVaultAbi, functionName: "paused" },
          { address: vault, abi: KeeperVaultAbi, functionName: "convertToAssets", args: [1_000_000_000n] },
          { address: market, abi: CoverMarketAbi, functionName: "capacityNotional" },
          { address: market, abi: CoverMarketAbi, functionName: "payoutCapBps" },
          { address: market, abi: CoverMarketAbi, functionName: "totalOpenNotional" },
          { address: market, abi: CoverMarketAbi, functionName: "policyCount" },
          { address: market, abi: CoverMarketAbi, functionName: "paused" },
        ],
        allowFailure: true,
      });
      const big = (i: number): string | null => (r[i]?.status === "success" ? String(r[i]?.result) : null);
      const num = (i: number): number | null => (r[i]?.status === "success" ? Number(r[i]?.result) : null);
      const bool = (i: number): boolean | null => (r[i]?.status === "success" ? Boolean(r[i]?.result) : null);
      const totalAssets = big(0);
      const usd = (s: string | null) => (s === null ? null : Number(BigInt(s)) / 1e6);
      res.json({
        chainId,
        deployed: true,
        vault,
        market,
        asset: c.contracts.USDT ?? null,
        shareToken: { symbol: "kUSDT", decimals: 9 },
        totalAssets,
        lockedAssets: big(1),
        floorAssets: big(2),
        freeCushion: big(3),
        freeAssets: big(4),
        utilisationBps: num(5),
        totalPremiumsReceived: big(6),
        totalPayoutsPaid: big(7),
        totalRefundsPaid: big(8),
        depositCap: big(9),
        totalSupply: big(10),
        floorBps: num(11),
        paused: bool(12),
        sharePriceUsd: r[13]?.status === "success" ? Number(r[13].result) / 1e6 : null,
        capacityNotional: big(14),
        payoutCapBps: num(15),
        totalOpenNotional: big(16),
        policyCount: num(17),
        marketPaused: bool(18),
        display: {
          totalAssetsUsd: usd(totalAssets),
          lockedUsd: usd(big(1)),
          floorUsd: usd(big(2)),
          cushionUsd: usd(big(3)),
          capacityNotionalUsd: usd(big(14)),
          premiumsUsd: usd(big(6)),
          payoutsUsd: usd(big(7)),
          utilisationPct: num(5) === null ? null : (num(5) as number) / 100,
        },
        impliedApyBand: apyBand(),
      });
    } catch (e) {
      logger.warn({ chainId, err: (e as Error).message }, "vault reads failed");
      res.status(502).json({ error: "chain reads failed; the RPC may be down", code: "rpc_unavailable", chainId, impliedApyBand: apyBand() });
    }
  }),
);
