import mongoose, { Schema } from "mongoose";
import type { AgentEventDoc } from "./types";

const AgentEventSchema = new Schema<AgentEventDoc>(
  {
    chainId: { type: Number, required: true },
    kind: { type: String, required: true },
    payer: { type: String, default: null, lowercase: true },
    payee: { type: String, default: null, lowercase: true },
    amount: { type: String, default: null },
    tx: { type: String, default: null },
    policyId: { type: Number, default: null },
    note: { type: String, default: "" },
    meta: { type: Schema.Types.Mixed, default: {} },
    at: { type: Date, default: () => new Date(), index: true },
  },
  { versionKey: false, collection: "agent_events" },
);
AgentEventSchema.index({ chainId: 1, at: -1 });
// one row per (tx, kind) so re-indexing or retried settlements never duplicate the feed
AgentEventSchema.index({ tx: 1, kind: 1 }, { unique: true, partialFilterExpression: { tx: { $type: "string" } } });

export const AgentEventModel = mongoose.model<AgentEventDoc>("AgentEvent", AgentEventSchema);
