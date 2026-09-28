"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = require("./app");
const chains_1 = require("./chains");
const config_1 = require("./config");
const data_1 = require("./data");
const db_1 = require("./db");
const scheduler_1 = require("./jobs/scheduler");
const logger_1 = require("./logger");
async function main() {
    // fail fast on missing data files; everything else degrades gracefully
    (0, data_1.getPooledZ)();
    (0, data_1.getTickerVol)();
    (0, data_1.getSummary)();
    (0, chains_1.getQuoterAccount)();
    for (const id of (0, config_1.chainIds)()) {
        const c = (0, config_1.getChain)(id);
        logger_1.logger.info({ chainId: id, key: c.key, rpc: c.rpcSource, deployed: (0, config_1.isDeployed)(c), tokens: c.tokens.length, epochs: c.epochs.length, deploymentFile: c.deploymentFile ?? "(none)" }, "chain");
        if (!(0, config_1.isDeployed)(c))
            logger_1.logger.warn({ chainId: id }, `not deployed on ${c.name} yet: add server/deployments/${c.key}.json or CONTRACT_*_${id} env vars`);
    }
    // Open the port first so platform health checks (Render) pass while Mongo is still connecting;
    // requests are served from the in-memory store until the connection is up.
    const app = (0, app_1.createApp)();
    const server = app.listen(config_1.config.port, config_1.config.host, () => {
        logger_1.logger.info({ host: config_1.config.host, port: config_1.config.port, env: config_1.config.nodeEnv, clientOrigin: config_1.config.clientOrigin }, `afterhours.fi server listening on http://localhost:${config_1.config.port}/api/health`);
    });
    await (0, db_1.connectMongo)();
    (0, scheduler_1.startJobs)();
    const shutdown = (sig) => {
        logger_1.logger.info({ sig }, "shutting down");
        (0, scheduler_1.stopJobs)();
        server.close(() => {
            void (0, db_1.disconnectMongo)().finally(() => process.exit(0));
        });
        setTimeout(() => process.exit(0), 5_000).unref();
    };
    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("unhandledRejection", (e) => logger_1.logger.error({ err: e?.message ?? String(e) }, "unhandledRejection"));
}
main().catch((e) => {
    logger_1.logger.fatal({ err: e.message }, "boot failed");
    process.exit(1);
});
//# sourceMappingURL=index.js.map