"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * One-shot settle run: for every deployed chain, index recent logs, then settleBatch all open policies whose
 * epoch is settleable (close + open posted, or voided). Optional args: chainId, epochId.
 *   npm run settle
 *   npm run settle -- 97
 *   npm run settle -- 97 1759521600
 */
const config_1 = require("../config");
const db_1 = require("../db");
const indexer_1 = require("../indexer");
const epoch_1 = require("../jobs/epoch");
const logger_1 = require("../logger");
async function main() {
    const [chainArg, epochArg] = process.argv.slice(2);
    await (0, db_1.connectMongo)();
    const chains = (0, config_1.deployedChains)().filter((c) => !chainArg || c.chainId === Number(chainArg));
    if (chains.length === 0) {
        logger_1.logger.error("no deployed chain found");
        process.exit(1);
    }
    for (const c of chains) {
        await (0, indexer_1.runIndexerOnce)(c.chainId);
        const r = await (0, epoch_1.settleEpoch)(c.chainId, epochArg ? Number(epochArg) : undefined);
        logger_1.logger.info(r, "settle run");
    }
    await (0, db_1.disconnectMongo)();
    process.exit(0);
}
main().catch((e) => {
    logger_1.logger.error({ err: e.message }, "settle failed");
    process.exit(1);
});
//# sourceMappingURL=settle.js.map