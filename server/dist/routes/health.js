"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.healthRouter = void 0;
const express_1 = require("express");
const chains_1 = require("../chains");
const config_1 = require("../config");
const db_1 = require("../db");
const indexer_1 = require("../indexer");
const epoch_1 = require("../jobs/epoch");
const vol_1 = require("../pricing/vol");
const started = Date.now();
exports.healthRouter = (0, express_1.Router)();
exports.healthRouter.get("/health", (_req, res) => {
    res.json({
        ok: true,
        service: "afterhours-server",
        version: process.env.npm_package_version ?? "0.1.0",
        now: new Date().toISOString(),
        uptimeSeconds: Math.floor((Date.now() - started) / 1000),
        store: (0, db_1.storeMode)(),
        mongoConfigured: !!config_1.config.mongoUri,
        signerConfigured: !!(0, chains_1.quoterAddress)(),
        quoter: (0, chains_1.quoterAddress)(),
        adminEnabled: !!config_1.config.adminSecret,
        chains: Object.fromEntries((0, config_1.chainIds)().map((id) => {
            const c = (0, config_1.getChain)(id);
            return [id, { key: c.key, deployed: (0, config_1.isDeployed)(c), rpc: c.rpcSource, tokens: c.tokens.length }];
        })),
        indexer: (0, indexer_1.indexerStatus)(),
        jobs: (0, epoch_1.jobsSummary)(),
        binance: (0, vol_1.volCacheState)(),
    });
});
//# sourceMappingURL=health.js.map