import { Router } from "express";
import { quoterAddress } from "../chains";
import { BARRIER_MENU, chainIds, config, getChain, isDeployed, publicRpcUrl } from "../config";
import { getTokens, knownEpochs } from "../market/tokens";
import { expectedOpenFor, iso, nextFridayClose, nowSec } from "../util/time";
import { asyncHandler } from "./util";

export const DISCLOSURE =
  "Hackathon build on testnets only. The admin/deployer can pause the contracts, change parameters, void or force-settle policies and withdraw funds. Not available in restricted jurisdictions. Nothing here is investment advice.";

export const configRouter = Router();

configRouter.get(
  "/config",
  asyncHandler(async (_req, res) => {
    const now = nowSec();
    const networks = await Promise.all(
      chainIds().map(async (id) => {
        const c = getChain(id)!;
        const tokens = await getTokens(id);
        const epochs = knownEpochs(id).map((e) => ({ ...e, bellAt: iso(e.bindDeadline), opensAt: iso(e.expectedOpen), open: e.bindDeadline > now }));
        return {
          chainId: id,
          key: c.key,
          name: c.name,
          deployed: isDeployed(c),
          rpcSource: c.rpcSource,
          rpcUrl: publicRpcUrl(c),
          explorer: c.explorer,
          contracts: c.contracts,
          deployer: c.deployer ?? null,
          quoterOnDeployment: c.quoter ?? null,
          deployBlock: c.deployBlock ?? null,
          tokens,
          epochs,
          deploymentFile: c.deploymentFile ? c.deploymentFile.replace(/\\/g, "/").split("/").slice(-2).join("/") : null,
        };
      }),
    );
    const currentEpochId = nextFridayClose(now, config.epochCloseHourUtc);
    res.json({
      quoter: quoterAddress(),
      signerConfigured: !!quoterAddress(),
      networks,
      currentEpochId,
      currentEpoch: { epochId: currentEpochId, bindDeadline: currentEpochId, expectedOpen: expectedOpenFor(currentEpochId), bellAt: iso(currentEpochId), opensAt: iso(expectedOpenFor(currentEpochId)) },
      product: {
        barrierMenu: BARRIER_MENU,
        payoutCapBps: config.pricing.payoutCapBps,
        minBarrierBps: 100,
        maxBarrierBps: 2000,
        minNotionalUsd: config.pricing.minNotionalUsd.toString(),
        maxNotionalUsd: config.pricing.maxNotionalUsd.toString(),
        load: config.pricing.load,
        floorBp: 1,
        maxChargedBps: Math.round(config.pricing.maxChargedFraction * 1e4),
        quoteTtlSeconds: config.quoteTtlSeconds,
        usdtDecimals: 6,
        priceDecimals: 8,
      },
      eip712: { domainName: "afterhours.fi CoverMarket", version: "1", primaryType: "Quote" },
      disclosure: DISCLOSURE,
    });
  }),
);
