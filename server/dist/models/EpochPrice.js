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
exports.EpochPriceModel = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const EpochPriceSchema = new mongoose_1.Schema({
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
}, { versionKey: false, collection: "epoch_prices" });
EpochPriceSchema.index({ chainId: 1, epochId: 1, token: 1 }, { unique: true });
exports.EpochPriceModel = mongoose_1.default.model("EpochPrice", EpochPriceSchema);
//# sourceMappingURL=EpochPrice.js.map