import mongoose, { Schema } from "mongoose";
import type { EpochPriceDoc } from "./types";

const EpochPriceSchema = new Schema<EpochPriceDoc>(
  {
    chainId: { type: Number, required: true },
    epochId: { type: Number, required: true },
    token: { type: String, required: true, lowercase: true },
    symbol: { type: String, default: null },
    closePrice: { type: String, default: null },
    openPrice: { type: String, default: null },
    closeSource: { type: String, default: null },
    openSource: { type: String, default: null },
    closeTx: { type: String, default: null },
    openTx: { type: String, default: null },
    closePostedAt: { type: Number, default: null },
    openPostedAt: { type: Number, default: null },
    voided: { type: Boolean, default: false },
    voidReason: { type: String, default: null },
    updatedAt: { type: Date, default: () => new Date() },
  },
  { versionKey: false, collection: "epoch_prices" },
);
EpochPriceSchema.index({ chainId: 1, epochId: 1, token: 1 }, { unique: true });

export const EpochPriceModel = mongoose.model<EpochPriceDoc>("EpochPrice", EpochPriceSchema);
