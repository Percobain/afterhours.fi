import { createApp } from "./app";
import { getQuoterAccount } from "./chains";
import { chainIds, config, getChain, isDeployed } from "./config";
import { getPooledZ, getSummary, getTickerVol } from "./data";
import { connectMongo, disconnectMongo } from "./db";
import { startJobs, stopJobs } from "./jobs/scheduler";
import { logger } from "./logger";

async function main(): Promise<void> {
  // fail fast on missing data files; everything else degrades gracefully
  getPooledZ();
  getTickerVol();
  getSummary();
  getQuoterAccount();
  for (const id of chainIds()) {
    const c = getChain(id)!;
    logger.info({ chainId: id, key: c.key, rpc: c.rpcSource, deployed: isDeployed(c), tokens: c.tokens.length, epochs: c.epochs.length, deploymentFile: c.deploymentFile ?? "(none)" }, "chain");
    if (!isDeployed(c)) logger.warn({ chainId: id }, `not deployed on ${c.name} yet: add server/deployments/${c.key}.json or CONTRACT_*_${id} env vars`);
  }

  await connectMongo();

  const app = createApp();
  const server = app.listen(config.port, () => {
    logger.info({ port: config.port, env: config.nodeEnv, clientOrigin: config.clientOrigin }, `afterhours.fi server listening on http://localhost:${config.port}/api/health`);
    startJobs();
  });

  const shutdown = (sig: string) => {
    logger.info({ sig }, "shutting down");
    stopJobs();
    server.close(() => {
      void disconnectMongo().finally(() => process.exit(0));
    });
    setTimeout(() => process.exit(0), 5_000).unref();
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("unhandledRejection", (e) => logger.error({ err: (e as Error)?.message ?? String(e) }, "unhandledRejection"));
}

main().catch((e) => {
  logger.fatal({ err: (e as Error).message }, "boot failed");
  process.exit(1);
});
