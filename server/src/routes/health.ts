import { Router } from "express";
import { quoterAddress } from "../chains";
import { chainIds, config, getChain, isDeployed } from "../config";
import { storeMode } from "../db";
import { indexerStatus } from "../indexer";
import { jobsSummary } from "../jobs/epoch";
import { volCacheState } from "../pricing/vol";

const started = Date.now();

export const healthRouter = Router();

healthRouter.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "afterhours-server",
    version: process.env.npm_package_version ?? "0.1.0",
    now: new Date().toISOString(),
    uptimeSeconds: Math.floor((Date.now() - started) / 1000),
    store: storeMode(),
    mongoConfigured: !!config.mongoUri,
    signerConfigured: !!quoterAddress(),
    quoter: quoterAddress(),
    adminEnabled: !!config.adminSecret,
    chains: Object.fromEntries(
      chainIds().map((id) => {
        const c = getChain(id)!;
        return [id, { key: c.key, deployed: isDeployed(c), rpc: c.rpcSource, tokens: c.tokens.length }];
      }),
    ),
    indexer: indexerStatus(),
    jobs: jobsSummary(),
    binance: volCacheState(),
  });
});
