import mongoose, { Schema } from "mongoose";
import type { CursorDoc } from "./types";

const CursorSchema = new Schema<CursorDoc>(
  {
    chainId: { type: Number, required: true },
    key: { type: String, required: true },
    block: { type: Number, required: true },
    updatedAt: { type: Date, default: () => new Date() },
  },
  { versionKey: false, collection: "cursors" },
);
CursorSchema.index({ chainId: 1, key: 1 }, { unique: true });

export const CursorModel = mongoose.model<CursorDoc>("Cursor", CursorSchema);
