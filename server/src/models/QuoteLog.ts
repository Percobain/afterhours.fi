import mongoose, { Schema } from "mongoose";
import type { QuoteLogDoc } from "./types";

const QuoteLogSchema = new Schema<QuoteLogDoc>(
  {
    chainId: { type: Number, required: true },
    buyer: { type: String, required: true, lowercase: true },
    token: { type: String, required: true, lowercase: true },
    ticker: { type: String, default: null },
    epochId: { type: Number, required: true },
    notionalUsd: { type: String, required: true },
    barrierBps: { type: Number, required: true },
    premiumUsd: { type: String, required: true },
    nonce: { type: String, required: true },
    expiry: { type: Number, required: true },
    signed: { type: Boolean, default: false },
    rv20: { type: Number, default: 0 },
    volSource: { type: String, default: "" },
    fairBp: { type: Number, default: 0 },
    chargedBp: { type: Number, default: 0 },
    mode: { type: String, enum: ["barrier", "budget"], default: "barrier" },
    createdAt: { type: Date, default: () => new Date(), index: true },
  },
  { versionKey: false, collection: "quote_logs" },
);
QuoteLogSchema.index({ chainId: 1, buyer: 1, createdAt: -1 });

export const QuoteLogModel = mongoose.model<QuoteLogDoc>("QuoteLog", QuoteLogSchema);
