"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.PolicyModel = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const PolicySchema = new mongoose_1.Schema({
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
}, { versionKey: false, collection: "policies" });
PolicySchema.index({ chainId: 1, policyId: 1 }, { unique: true });
PolicySchema.index({ chainId: 1, buyer: 1, epochId: -1 });
PolicySchema.index({ chainId: 1, status: 1, epochId: 1 });
exports.PolicyModel = mongoose_1.default.model("Policy", PolicySchema);
//# sourceMappingURL=Policy.js.map