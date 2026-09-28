import { Router } from "express";
import { z } from "zod";
import { computeStats, policiesFromChain } from "../indexer";
import type { PolicyDoc } from "../models/types";
import { fmtUsd, receiptFor, statusTextFor } from "../receipts";
import { store } from "../store";
import { expectedOpenFor, iso } from "../util/time";
import { asyncHandler, parseQuery, requireChain, zAddress, zChainId } from "./util";

export const policiesRouter = Router();

export function presentPolicy(p: PolicyDoc) {
  return {
    chainId: p.chainId,
    policyId: p.policyId,
    buyer: p.buyer,
    token: p.token,
    tokenSymbol: p.tokenSymbol,
    ticker: p.ticker,
    epochId: p.epochId,
    bellAt: iso(p.epochId),
    expectedOpenAt: iso(expectedOpenFor(p.epochId)),
    notionalUsd: p.notionalUsd,
    notionalUsdDisplay: fmtUsd(p.notionalUsd),
    barrierBps: p.barrierBps,
    premiumUsd: p.premiumUsd,
    premiumUsdDisplay: fmtUsd(p.premiumUsd),
    lockedUsd: p.lockedUsd,
    payoutUsd: p.payoutUsd,
    payoutUsdDisplay: fmtUsd(p.payoutUsd || "0"),
    gapBps: p.gapBps,
    gapPct: p.gapBps === null ? null : p.gapBps / 100,
    status: p.status,
    outcome: p.status === "Settled" ? (BigInt(p.payoutUsd || "0") > 0n ? "floor_paid" : "floor_held") : p.status === "Refunded" ? "voided" : "open",
    refundReason: p.refundReason,
    boughtAt: p.boughtAt,
    settledAt: p.settledAt,
    buyTx: p.buyTx,
    settleTx: p.settleTx,
    receipt: receiptFor(p),
    statusText: statusTextFor(p),
  };
}

policiesRouter.get(
  "/policies/:address",
  asyncHandler(async (req, res) => {
    const { address } = parseQuery(z.object({ address: zAddress }), req.params);
    const { chainId } = parseQuery(z.object({ chainId: zChainId }), req.query);
    const c = requireChain(chainId);
    let policies = await store.policies.byBuyer(chainId, address);
    let source: "indexed" | "chain" | "none" = policies.length > 0 ? "indexed" : "none";
    if (policies.length === 0 && c.contracts.CoverMarket) {
      policies = await policiesFromChain(chainId, address);
      if (policies.length > 0) source = "chain";
    }
    const stats = (await store.stats.get(chainId, address)) ?? computeStats(chainId, address, policies);
    if (source === "chain") Object.assign(stats, computeStats(chainId, address, policies));
    res.json({
      chainId,
      address: address.toLowerCase(),
      deployed: !!c.contracts.CoverMarket,
      source,
      store: store.mode(),
      policies: policies.map(presentPolicy),
      stats: {
        weekendsProtected: stats.weekendsProtected,
        currentStreak: stats.currentStreak,
        longestStreak: stats.longestStreak,
        premiumsPaid: stats.premiumsPaid,
        payoutsReceived: stats.payoutsReceived,
        floorsHeld: stats.floorsHeld,
        floorsPaid: stats.floorsPaid,
        premiumsPaidDisplay: fmtUsd(stats.premiumsPaid),
        payoutsReceivedDisplay: fmtUsd(stats.payoutsReceived),
      },
    });
  }),
);
