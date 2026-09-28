/**
 * One-shot settle run: for every deployed chain, index recent logs, then settleBatch all open policies whose
 * epoch is settleable (close + open posted, or voided). Optional args: chainId, epochId.
 *   npm run settle
 *   npm run settle -- 97
 *   npm run settle -- 97 1759521600
 */
import { deployedChains } from "../config";
import { connectMongo, disconnectMongo } from "../db";
import { runIndexerOnce } from "../indexer";
import { settleEpoch } from "../jobs/epoch";
import { logger } from "../logger";

async function main(): Promise<void> {
  const [chainArg, epochArg] = process.argv.slice(2);
  await connectMongo();
  const chains = deployedChains().filter((c) => !chainArg || c.chainId === Number(chainArg));
  if (chains.length === 0) {
    logger.error("no deployed chain found");
    process.exit(1);
  }
  for (const c of chains) {
    await runIndexerOnce(c.chainId);
    const r = await settleEpoch(c.chainId, epochArg ? Number(epochArg) : undefined);
    logger.info(r, "settle run");
  }
  await disconnectMongo();
  process.exit(0);
}

main().catch((e) => {
  logger.error({ err: (e as Error).message }, "settle failed");
  process.exit(1);
});
