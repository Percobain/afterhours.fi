import mongoose, { Schema } from "mongoose";
import type { PolicyDoc } from "./types";

const PolicySchema = new Schema<PolicyDoc>(
  {
    chainId: { type: Number, required: true },
    policyId: { type: Number, required: true },
    buyer: { type: String, required: true, lowercase: true, index: true },
    token: { type: String, required: true, lowercase: true },
    tokenSymbol: { type: String, default: null },
    ticker: { type: String, default: null },
    epochId: { type: Number, required: true, index: true },
    notionalUsd: { type: String, required: true },
    barrierBps: { type: Number, required: true },
    premiumUsd: { type: String, required: true },
    lockedUsd: { type: String, required: true },
    payoutUsd: { type: String, default: "0" },
    gapBps: { type: Number, default: null },
    status: { type: String, enum: ["Open", "Settled", "Refunded"], required: true, index: true },
    refundReason: { type: String, default: null },
    boughtAt: { type: Number, default: null },
    settledAt: { type: Number, default: null },
    buyTx: { type: String, default: null },
    settleTx: { type: String, default: null },
    blockNumber: { type: Number, default: 0 },
    updatedAt: { type: Date, default: () => new Date() },
  },
  { versionKey: false, collection: "policies" },
);
PolicySchema.index({ chainId: 1, policyId: 1 }, { unique: true });
PolicySchema.index({ chainId: 1, buyer: 1, epochId: -1 });
PolicySchema.index({ chainId: 1, status: 1, epochId: 1 });

export const PolicyModel = mongoose.model<PolicyDoc>("Policy", PolicySchema);
