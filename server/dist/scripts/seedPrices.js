"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * One-shot: post live per-share prices to ReferenceOracle.setLastPrices on every deployed chain.
 *   npm run seed:prices                 # all deployed chains
 *   npm run seed:prices -- 97           # one chain
 *   npm run seed:prices -- 97 NVDAB=224.5 SPYB=690   # with overrides (symbol or ticker)
 */
const config_1 = require("../config");
const epoch_1 = require("../jobs/epoch");
const logger_1 = require("../logger");
async function main() {
    const args = process.argv.slice(2);
    const chainArg = args.find((a) => /^\d+$/.test(a));
    const overrides = {};
    for (const a of args) {
        const m = /^([A-Za-z0-9]+)=([\d.]+)$/.exec(a);
        if (m)
            overrides[m[1]] = Number(m[2]);
    }
    const chains = (0, config_1.deployedChains)().filter((c) => !chainArg || c.chainId === Number(chainArg));
    if (chains.length === 0) {
        logger_1.logger.error("no deployed chain found (deployments/<network>.json or CONTRACT_* env vars missing)");
        process.exit(1);
    }
    for (const c of chains) {
        const r = await (0, epoch_1.setLastPrices)(c.chainId, overrides);
        logger_1.logger.info({ chainId: c.chainId, tx: r.tx, prices: r.prices }, "seeded prices");
    }
    process.exit(0);
}
main().catch((e) => {
    logger_1.logger.error({ err: e.message }, "seed:prices failed");
    process.exit(1);
});
//# sourceMappingURL=seedPrices.js.map