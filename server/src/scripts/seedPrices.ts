/**
 * One-shot: post live per-share prices to ReferenceOracle.setLastPrices on every deployed chain.
 *   npm run seed:prices                 # all deployed chains
 *   npm run seed:prices -- 97           # one chain
 *   npm run seed:prices -- 97 NVDAB=224.5 SPYB=690   # with overrides (symbol or ticker)
 */
import { deployedChains } from "../config";
import { setLastPrices } from "../jobs/epoch";
import { logger } from "../logger";

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const chainArg = args.find((a) => /^\d+$/.test(a));
  const overrides: Record<string, number> = {};
  for (const a of args) {
    const m = /^([A-Za-z0-9]+)=([\d.]+)$/.exec(a);
    if (m) overrides[m[1] as string] = Number(m[2]);
  }
  const chains = deployedChains().filter((c) => !chainArg || c.chainId === Number(chainArg));
  if (chains.length === 0) {
    logger.error("no deployed chain found (deployments/<network>.json or CONTRACT_* env vars missing)");
    process.exit(1);
  }
  for (const c of chains) {
    const r = await setLastPrices(c.chainId, overrides);
    logger.info({ chainId: c.chainId, tx: r.tx, prices: r.prices }, "seeded prices");
  }
  process.exit(0);
}

main().catch((e) => {
  logger.error({ err: (e as Error).message }, "seed:prices failed");
  process.exit(1);
});
