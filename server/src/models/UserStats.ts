import mongoose, { Schema } from "mongoose";
import type { UserStatsDoc } from "./types";

const UserStatsSchema = new Schema<UserStatsDoc>(
  {
    chainId: { type: Number, required: true },
    address: { type: String, required: true, lowercase: true },
    weekendsProtected: { type: Number, default: 0 },
    currentStreak: { type: Number, default: 0 },
    longestStreak: { type: Number, default: 0 },
    premiumsPaid: { type: String, default: "0" },
    payoutsReceived: { type: String, default: "0" },
    floorsHeld: { type: Number, default: 0 },
    floorsPaid: { type: Number, default: 0 },
    policies: { type: Number, default: 0 },
    updatedAt: { type: Date, default: () => new Date() },
  },
  { versionKey: false, collection: "user_stats" },
);
UserStatsSchema.index({ chainId: 1, address: 1 }, { unique: true });

export const UserStatsModel = mongoose.model<UserStatsDoc>("UserStats", UserStatsSchema);
