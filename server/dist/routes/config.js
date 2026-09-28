"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.configRouter = exports.DISCLOSURE = void 0;
const express_1 = require("express");
const chains_1 = require("../chains");
const config_1 = require("../config");
const tokens_1 = require("../market/tokens");
const time_1 = require("../util/time");
const util_1 = require("./util");
exports.DISCLOSURE = "Hackathon build on testnets only. The admin/deployer can pause the contracts, change parameters, void or force-settle policies and withdraw funds. Not available in restricted jurisdictions. Nothing here is investment advice.";
exports.configRouter = (0, express_1.Router)();
exports.configRouter.get("/config", (0, util_1.asyncHandler)(async (_req, res) => {
    const now = (0, time_1.nowSec)();
    const networks = await Promise.all((0, config_1.chainIds)().map(async (id) => {
        const c = (0, config_1.getChain)(id);
        const tokens = await (0, tokens_1.getTokens)(id);
        const epochs = (0, tokens_1.knownEpochs)(id).map((e) => ({ ...e, bellAt: (0, time_1.iso)(e.bindDeadline), opensAt: (0, time_1.iso)(e.expectedOpen), open: e.bindDeadline > now }));
        return {
            chainId: id,
            key: c.key,
            name: c.name,
            deployed: (0, config_1.isDeployed)(c),
            rpcSource: c.rpcSource,
            rpcUrl: (0, config_1.publicRpcUrl)(c),
            explorer: c.explorer,
            contracts: c.contracts,
            deployer: c.deployer ?? null,
            quoterOnDeployment: c.quoter ?? null,
            deployBlock: c.deployBlock ?? null,
            tokens,
            epochs,
            deploymentFile: c.deploymentFile ? c.deploymentFile.replace(/\\/g, "/").split("/").slice(-2).join("/") : null,
        };
    }));
    const currentEpochId = (0, time_1.nextFridayClose)(now, config_1.config.epochCloseHourUtc);
    res.json({
        quoter: (0, chains_1.quoterAddress)(),
        signerConfigured: !!(0, chains_1.quoterAddress)(),
        networks,
        currentEpochId,
        currentEpoch: { epochId: currentEpochId, bindDeadline: currentEpochId, expectedOpen: (0, time_1.expectedOpenFor)(currentEpochId), bellAt: (0, time_1.iso)(currentEpochId), opensAt: (0, time_1.iso)((0, time_1.expectedOpenFor)(currentEpochId)) },
        product: {
            barrierMenu: config_1.BARRIER_MENU,
            payoutCapBps: config_1.config.pricing.payoutCapBps,
            minBarrierBps: 100,
            maxBarrierBps: 2000,
            minNotionalUsd: config_1.config.pricing.minNotionalUsd.toString(),
            maxNotionalUsd: config_1.config.pricing.maxNotionalUsd.toString(),
            load: config_1.config.pricing.load,
            floorBp: 1,
            maxChargedBps: Math.round(config_1.config.pricing.maxChargedFraction * 1e4),
            quoteTtlSeconds: config_1.config.quoteTtlSeconds,
            usdtDecimals: 6,
            priceDecimals: 8,
        },
        eip712: { domainName: "afterhours.fi CoverMarket", version: "1", primaryType: "Quote" },
        disclosure: exports.DISCLOSURE,
    });
}));
//# sourceMappingURL=config.js.map