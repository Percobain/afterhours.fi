"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.vaultRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const abi_1 = require("../abi");
const chains_1 = require("../chains");
const data_1 = require("../data");
const logger_1 = require("../logger");
const util_1 = require("./util");
exports.vaultRouter = (0, express_1.Router)();
function apyBand() {
    const k = (0, data_1.getSummary)().keeper;
    return {
        low: k.roc_pa,
        high: k.roc_pa_since_2015,
        sharpe: k.sharpe,
        lossRatio: (0, data_1.getSummary)().loss_ratio_v4,
        worstWeekend: k.worst_weekend,
        worstWeekendPctCapital: k.worst_weekend_pct_capital,
        shareWeekendsLosing: k.share_weekends_losing,
        ruinProbability1y: k.ruin_1y_10pct_capital,
        basis: "backtest 2005-2026, static pool at 10% capital; CPPI sizing (this vault) held the floor from every start date",
    };
}
exports.vaultRouter.get("/vault", (0, util_1.asyncHandler)(async (req, res) => {
    const { chainId } = (0, util_1.parseQuery)(zod_1.z.object({ chainId: util_1.zChainId }), req.query);
    const c = (0, util_1.requireChain)(chainId);
    const vault = c.contracts.KeeperVault;
    const market = c.contracts.CoverMarket;
    if (!vault || !market) {
        res.json({ chainId, deployed: false, message: `afterhours.fi is not deployed on ${c.name} yet`, impliedApyBand: apyBand() });
        return;
    }
    try {
        const client = (0, chains_1.getPublicClient)(chainId);
        const v = (fn) => ({ address: vault, abi: abi_1.KeeperVaultAbi, functionName: fn });
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
                { address: vault, abi: abi_1.KeeperVaultAbi, functionName: "floorBps" },
                { address: vault, abi: abi_1.KeeperVaultAbi, functionName: "paused" },
                { address: vault, abi: abi_1.KeeperVaultAbi, functionName: "convertToAssets", args: [1000000000n] },
                { address: market, abi: abi_1.CoverMarketAbi, functionName: "capacityNotional" },
                { address: market, abi: abi_1.CoverMarketAbi, functionName: "payoutCapBps" },
                { address: market, abi: abi_1.CoverMarketAbi, functionName: "totalOpenNotional" },
                { address: market, abi: abi_1.CoverMarketAbi, functionName: "policyCount" },
                { address: market, abi: abi_1.CoverMarketAbi, functionName: "paused" },
            ],
            allowFailure: true,
        });
        const big = (i) => (r[i]?.status === "success" ? String(r[i]?.result) : null);
        const num = (i) => (r[i]?.status === "success" ? Number(r[i]?.result) : null);
        const bool = (i) => (r[i]?.status === "success" ? Boolean(r[i]?.result) : null);
        const totalAssets = big(0);
        const usd = (s) => (s === null ? null : Number(BigInt(s)) / 1e6);
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
                utilisationPct: num(5) === null ? null : num(5) / 100,
            },
            impliedApyBand: apyBand(),
        });
    }
    catch (e) {
        logger_1.logger.warn({ chainId, err: e.message }, "vault reads failed");
        res.status(502).json({ error: "chain reads failed; the RPC may be down", code: "rpc_unavailable", chainId, impliedApyBand: apyBand() });
    }
}));
//# sourceMappingURL=vault.js.map