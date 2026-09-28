"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.policiesRouter = void 0;
exports.presentPolicy = presentPolicy;
const express_1 = require("express");
const zod_1 = require("zod");
const indexer_1 = require("../indexer");
const receipts_1 = require("../receipts");
const store_1 = require("../store");
const time_1 = require("../util/time");
const util_1 = require("./util");
exports.policiesRouter = (0, express_1.Router)();
function presentPolicy(p) {
    return {
        chainId: p.chainId,
        policyId: p.policyId,
        buyer: p.buyer,
        token: p.token,
        tokenSymbol: p.tokenSymbol,
        ticker: p.ticker,
        epochId: p.epochId,
        bellAt: (0, time_1.iso)(p.epochId),
        expectedOpenAt: (0, time_1.iso)((0, time_1.expectedOpenFor)(p.epochId)),
        notionalUsd: p.notionalUsd,
        notionalUsdDisplay: (0, receipts_1.fmtUsd)(p.notionalUsd),
        barrierBps: p.barrierBps,
        premiumUsd: p.premiumUsd,
        premiumUsdDisplay: (0, receipts_1.fmtUsd)(p.premiumUsd),
        lockedUsd: p.lockedUsd,
        payoutUsd: p.payoutUsd,
        payoutUsdDisplay: (0, receipts_1.fmtUsd)(p.payoutUsd || "0"),
        gapBps: p.gapBps,
        gapPct: p.gapBps === null ? null : p.gapBps / 100,
        status: p.status,
        outcome: p.status === "Settled" ? (BigInt(p.payoutUsd || "0") > 0n ? "floor_paid" : "floor_held") : p.status === "Refunded" ? "voided" : "open",
        refundReason: p.refundReason,
        boughtAt: p.boughtAt,
        settledAt: p.settledAt,
        buyTx: p.buyTx,
        settleTx: p.settleTx,
        receipt: (0, receipts_1.receiptFor)(p),
        statusText: (0, receipts_1.statusTextFor)(p),
    };
}
exports.policiesRouter.get("/policies/:address", (0, util_1.asyncHandler)(async (req, res) => {
    const { address } = (0, util_1.parseQuery)(zod_1.z.object({ address: util_1.zAddress }), req.params);
    const { chainId } = (0, util_1.parseQuery)(zod_1.z.object({ chainId: util_1.zChainId }), req.query);
    const c = (0, util_1.requireChain)(chainId);
    let policies = await store_1.store.policies.byBuyer(chainId, address);
    let source = policies.length > 0 ? "indexed" : "none";
    if (policies.length === 0 && c.contracts.CoverMarket) {
        policies = await (0, indexer_1.policiesFromChain)(chainId, address);
        if (policies.length > 0)
            source = "chain";
    }
    const stats = (await store_1.store.stats.get(chainId, address)) ?? (0, indexer_1.computeStats)(chainId, address, policies);
    if (source === "chain")
        Object.assign(stats, (0, indexer_1.computeStats)(chainId, address, policies));
    res.json({
        chainId,
        address: address.toLowerCase(),
        deployed: !!c.contracts.CoverMarket,
        source,
        store: store_1.store.mode(),
        policies: policies.map(presentPolicy),
        stats: {
            weekendsProtected: stats.weekendsProtected,
            currentStreak: stats.currentStreak,
            longestStreak: stats.longestStreak,
            premiumsPaid: stats.premiumsPaid,
            payoutsReceived: stats.payoutsReceived,
            floorsHeld: stats.floorsHeld,
            floorsPaid: stats.floorsPaid,
            premiumsPaidDisplay: (0, receipts_1.fmtUsd)(stats.premiumsPaid),
            payoutsReceivedDisplay: (0, receipts_1.fmtUsd)(stats.payoutsReceived),
        },
    });
}));
//# sourceMappingURL=policies.js.map