import cron, { type ScheduledTask } from "node-cron";
import { quoterAddress } from "../chains";
import { config, deployedChains } from "../config";
import { startIndexer, stopIndexer } from "../indexer";
import { logger } from "../logger";
import { refreshPrices } from "../market/prices";
import { getTokens } from "../market/tokens";
import { tick } from "./epoch";

const tasks: ScheduledTask[] = [];

export async function refreshAllPrices(): Promise<void> {
  for (const c of deployedChains()) {
    const tokens = await getTokens(c.chainId);
    const r = await refreshPrices(tokens);
    const n = Object.values(r).filter(Boolean).length;
    logger.debug({ chainId: c.chainId, priced: n, of: tokens.length }, "price refresh");
  }
}

export function startJobs(): void {
  startIndexer();
  if (!config.jobsEnabled) {
    logger.warn("background jobs disabled (JOBS_ENABLED=false)");
    return;
  }
  // price refresh every 5 minutes
  tasks.push(cron.schedule(config.priceRefreshCron, () => void refreshAllPrices().catch((e) => logger.warn({ err: (e as Error).message }, "price refresh failed"))));
  setTimeout(() => void refreshAllPrices().catch(() => undefined), 5_000).unref();

  // epoch keeper tick every minute (close at the bell, open + settle on Monday, openEpoch on Mondays)
  if (quoterAddress() && deployedChains().length > 0) {
    tasks.push(cron.schedule("* * * * *", () => void tick()));
    logger.info("epoch keeper jobs scheduled (every minute)");
  } else {
    logger.warn("epoch keeper jobs idle: need QUOTER_PRIVATE_KEY and a deployed chain");
  }
}

export function stopJobs(): void {
  for (const t of tasks) t.stop();
  tasks.length = 0;
  stopIndexer();
}
