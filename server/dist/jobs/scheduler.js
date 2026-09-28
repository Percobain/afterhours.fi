"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.refreshAllPrices = refreshAllPrices;
exports.startJobs = startJobs;
exports.stopJobs = stopJobs;
const node_cron_1 = __importDefault(require("node-cron"));
const chains_1 = require("../chains");
const config_1 = require("../config");
const indexer_1 = require("../indexer");
const logger_1 = require("../logger");
const prices_1 = require("../market/prices");
const tokens_1 = require("../market/tokens");
const epoch_1 = require("./epoch");
const tasks = [];
async function refreshAllPrices() {
    for (const c of (0, config_1.deployedChains)()) {
        const tokens = await (0, tokens_1.getTokens)(c.chainId);
        const r = await (0, prices_1.refreshPrices)(tokens);
        const n = Object.values(r).filter(Boolean).length;
        logger_1.logger.debug({ chainId: c.chainId, priced: n, of: tokens.length }, "price refresh");
    }
}
function startJobs() {
    (0, indexer_1.startIndexer)();
    if (!config_1.config.jobsEnabled) {
        logger_1.logger.warn("background jobs disabled (JOBS_ENABLED=false)");
        return;
    }
    // price refresh every 5 minutes
    tasks.push(node_cron_1.default.schedule(config_1.config.priceRefreshCron, () => void refreshAllPrices().catch((e) => logger_1.logger.warn({ err: e.message }, "price refresh failed"))));
    setTimeout(() => void refreshAllPrices().catch(() => undefined), 5_000).unref();
    // epoch keeper tick every minute (close at the bell, open + settle on Monday, openEpoch on Mondays)
    if ((0, chains_1.quoterAddress)() && (0, config_1.deployedChains)().length > 0) {
        tasks.push(node_cron_1.default.schedule("* * * * *", () => void (0, epoch_1.tick)()));
        logger_1.logger.info("epoch keeper jobs scheduled (every minute)");
    }
    else {
        logger_1.logger.warn("epoch keeper jobs idle: need QUOTER_PRIVATE_KEY and a deployed chain");
    }
}
function stopJobs() {
    for (const t of tasks)
        t.stop();
    tasks.length = 0;
    (0, indexer_1.stopIndexer)();
}
//# sourceMappingURL=scheduler.js.map