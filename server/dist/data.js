"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPooledZ = getPooledZ;
exports.getTickerVol = getTickerVol;
exports.getSummary = getSummary;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const paths_1 = require("./paths");
const logger_1 = require("./logger");
function readJson(name) {
    const fp = node_path_1.default.join(paths_1.DATA_DIR, name);
    return JSON.parse(node_fs_1.default.readFileSync(fp, "utf8"));
}
let pooledZ = null;
let tickerVol = null;
let summary = null;
function getPooledZ() {
    if (!pooledZ) {
        pooledZ = readJson("pooled_z.json");
        if (!Array.isArray(pooledZ.quantiles) || pooledZ.quantiles.length < 100)
            throw new Error("pooled_z.json: quantiles missing");
        logger_1.logger.info({ n: pooledZ.n, quantiles: pooledZ.quantiles.length }, "pooled z loaded");
    }
    return pooledZ;
}
function getTickerVol() {
    if (!tickerVol)
        tickerVol = readJson("ticker_vol.json");
    return tickerVol;
}
function getSummary() {
    if (!summary)
        summary = readJson("backtest_summary.json");
    return summary;
}
//# sourceMappingURL=data.js.map