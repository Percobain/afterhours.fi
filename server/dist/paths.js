"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RWA_TOKEN_LIST_PATH = exports.MONOREPO_ROOT = exports.DEPLOYMENTS_DIR = exports.DATA_DIR = exports.SERVER_ROOT = void 0;
const node_path_1 = __importDefault(require("node:path"));
/** server/ root: src/ when running under tsx, dist/ after tsc; both sit one level below the package root. */
exports.SERVER_ROOT = node_path_1.default.resolve(__dirname, "..");
exports.DATA_DIR = node_path_1.default.join(exports.SERVER_ROOT, "data");
exports.DEPLOYMENTS_DIR = node_path_1.default.join(exports.SERVER_ROOT, "deployments");
exports.MONOREPO_ROOT = node_path_1.default.resolve(exports.SERVER_ROOT, "..");
exports.RWA_TOKEN_LIST_PATH = node_path_1.default.join(exports.MONOREPO_ROOT, "backtest", "data", "binance_rwa_token_list_raw.json");
//# sourceMappingURL=paths.js.map