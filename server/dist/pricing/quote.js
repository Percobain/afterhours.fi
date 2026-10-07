"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.barrierMenu = exports.QUOTE_TYPES = void 0;
exports.buildQuote = buildQuote;
/**
 * Builds and signs the EIP-712 Quote the client submits to CoverMarket.buyCover.
 *   domain: { name: "afterhours.fi CoverMarket", version: "1", chainId, verifyingContract: CoverMarket }
 *   Quote(address buyer,address token,uint64 epochId,uint256 notionalUsd,uint16 barrierBps,uint256 premiumUsd,uint64 expiry,uint256 nonce)
 * nonce = random uint256, expiry = now + QUOTE_TTL_SECONDS (15 min). When QUOTER_PRIVATE_KEY is empty the quote is
 * returned unsigned with `signature: null, signerConfigured: false`.
 */
const node_crypto_1 = require("node:crypto");
const viem_1 = require("viem");
const abi_1 = require("../abi");
const chains_1 = require("../chains");
const config_1 = require("../config");
const logger_1 = require("../logger");
const prices_1 = require("../market/prices");
const tokens_1 = require("../market/tokens");
const store_1 = require("../store");
const errors_1 = require("../util/errors");
const time_1 = require("../util/time");
const engine_1 = require("./engine");
const vol_1 = require("./vol");
exports.QUOTE_TYPES = {
    Quote: [
        { name: "buyer", type: "address" },
        { name: "token", type: "address" },
        { name: "epochId", type: "uint64" },
        { name: "notionalUsd", type: "uint256" },
        { name: "barrierBps", type: "uint16" },
        { name: "premiumUsd", type: "uint256" },
        { name: "expiry", type: "uint64" },
        { name: "nonce", type: "uint256" },
    ],
};
function randomNonce() {
    return BigInt(`0x${(0, node_crypto_1.randomBytes)(32).toString("hex")}`);
}
async function chainReads(chainId, token, notionalUsd) {
    const c = (0, config_1.getChain)(chainId);
    if (!c?.contracts.CoverMarket || !c.contracts.ReferenceOracle)
        return null;
    try {
        const client = (0, chains_1.getPublicClient)(chainId);
        const [required, capacity, lastPrice, minNotional, maxNotional] = await client.multicall({
            contracts: [
                { address: c.contracts.CoverMarket, abi: abi_1.CoverMarketAbi, functionName: "requiredTokenBalance", args: [token, notionalUsd] },
                { address: c.contracts.CoverMarket, abi: abi_1.CoverMarketAbi, functionName: "capacityNotional" },
                { address: c.contracts.ReferenceOracle, abi: abi_1.ReferenceOracleAbi, functionName: "lastPrice", args: [token] },
                { address: c.contracts.CoverMarket, abi: abi_1.CoverMarketAbi, functionName: "minNotionalUsd" },
                { address: c.contracts.CoverMarket, abi: abi_1.CoverMarketAbi, functionName: "maxNotionalUsd" },
            ],
            allowFailure: true,
        });
        return {
            requiredTokenBalance: required.status === "success" ? required.result : null,
            capacityNotional: capacity.status === "success" ? capacity.result : null,
            lastPrice: lastPrice.status === "success" ? lastPrice.result : null,
            minNotional: minNotional.status === "success" ? minNotional.result : null,
            maxNotional: maxNotional.status === "success" ? maxNotional.result : null,
        };
    }
    catch (e) {
        logger_1.logger.warn({ chainId, err: e.message }, "chain reads for quote failed");
        return null;
    }
}
async function buildQuote(p) {
    const c = (0, config_1.getChain)(p.chainId);
    if (!c)
        throw new errors_1.ApiError(400, "unsupported_chain", `chainId ${p.chainId} is not supported`);
    if ((p.barrierBps === undefined) === (p.budgetBps === undefined)) {
        throw new errors_1.ApiError(400, "bad_request", "provide exactly one of barrierBps or budgetBps");
    }
    const notes = [];
    const buyer = (0, viem_1.getAddress)(p.buyer);
    const token = (0, viem_1.getAddress)(p.token);
    const known = await (0, tokens_1.findToken)(p.chainId, token);
    const tokenUnknown = !known;
    const ticker = known?.ticker ?? null;
    const symbol = known?.symbol ?? null;
    const wrapper = known?.wrapper ?? "unknown";
    if (tokenUnknown)
        notes.push("token is not in the allow-list for this chain; priced with the default 40% vol, the market will reject the purchase");
    const [vol, reads, epoch] = await Promise.all([(0, vol_1.getVol)(ticker, symbol), chainReads(p.chainId, token, p.notionalUsd), (0, tokens_1.currentEpoch)(p.chainId)]);
    const rv20 = vol.rv20;
    const minN = reads?.minNotional ?? config_1.config.pricing.minNotionalUsd;
    const maxN = reads?.maxNotional ?? config_1.config.pricing.maxNotionalUsd;
    if (p.notionalUsd < minN || p.notionalUsd > maxN) {
        throw new errors_1.ApiError(400, "notional_out_of_range", `notionalUsd must be between ${minN} and ${maxN} (USDT units, 6 decimals)`, { minNotionalUsd: minN.toString(), maxNotionalUsd: maxN.toString() });
    }
    let picked;
    let menu;
    let budgetShort = false;
    let mode;
    if (p.budgetBps !== undefined) {
        mode = "budget";
        const r = (0, engine_1.pickForBudget)(p.budgetBps, rv20);
        picked = r.pick;
        menu = r.menu;
        budgetShort = r.budgetShort;
        if (budgetShort)
            notes.push(`no barrier in the menu fits ${p.budgetBps}bp this week; showing the widest (10%) floor`);
    }
    else {
        mode = "barrier";
        menu = (0, engine_1.priceMenu)(rv20);
        picked = (0, engine_1.quoteBarrier)(p.barrierBps, rv20, p.notionalUsd);
    }
    const quoted = (0, engine_1.quoteBarrier)(picked.barrierBps, rv20, p.notionalUsd);
    const ev = (0, engine_1.estimatedValue)(quoted);
    if (quoted.pricedOut && !budgetShort) {
        throw new errors_1.ApiError(422, "priced_out", `Priced out: a ${quoted.barrierBps / 100}% floor on this name would cost ${quoted.chargedBp.toFixed(1)}bp this week, above the 2% cap.`, {
            estimatedValue: ev,
            pricing: { ticker, symbol, rv20, volSource: vol.source, menu, tokenUnknown },
            suggestion: menu.find((m) => !m.pricedOut) ? `try a ${menu.find((m) => !m.pricedOut).barrierBps / 100}% floor or budget mode` : "no barrier in the menu is priceable this week",
        });
    }
    const now = (0, time_1.nowSec)();
    const expiry = Math.min(now + config_1.config.quoteTtlSeconds, epoch.bindDeadline > now ? epoch.bindDeadline : now + config_1.config.quoteTtlSeconds);
    if (epoch.bindDeadline <= now)
        notes.push("the sale window for this epoch has closed; the quote is informational");
    if (epoch.openOnChain === false)
        notes.push("this epoch is not open on-chain yet (run openEpoch or POST /api/admin/epochs)");
    const nonce = randomNonce();
    const message = {
        buyer,
        token,
        epochId: BigInt(epoch.epochId),
        notionalUsd: p.notionalUsd,
        barrierBps: quoted.barrierBps,
        premiumUsd: quoted.premiumUsd,
        expiry: BigInt(expiry),
        nonce,
    };
    const account = (0, chains_1.getQuoterAccount)(p.chainId);
    const verifyingContract = c.contracts.CoverMarket ?? null;
    let signature = null;
    if (account && verifyingContract) {
        signature = await account.signTypedData({
            domain: { name: "afterhours.fi CoverMarket", version: "1", chainId: p.chainId, verifyingContract },
            types: exports.QUOTE_TYPES,
            primaryType: "Quote",
            message,
        });
    }
    else if (account && !verifyingContract) {
        notes.push("CoverMarket is not deployed on this chain; quote returned unsigned");
    }
    // floor price per share from the oracle's last price, else the live underlying price
    let lastPrice8 = reads?.lastPrice && reads.lastPrice > 0n ? reads.lastPrice : null;
    let lastPriceSource = lastPrice8 ? "oracle" : null;
    if (!lastPrice8 && ticker) {
        const live = await (0, prices_1.getUnderlyingPrice)({ ticker, symbol, wrapper }).catch(() => null);
        if (live) {
            lastPrice8 = BigInt(live.price8);
            lastPriceSource = live.source;
        }
    }
    const floor8 = lastPrice8 ? (lastPrice8 * BigInt(10_000 - quoted.barrierBps)) / 10000n : null;
    const capacityOk = reads?.capacityNotional !== null && reads?.capacityNotional !== undefined ? reads.capacityNotional >= p.notionalUsd : null;
    if (capacityOk === false)
        notes.push("the Keeper pool cannot back this notional right now; try a smaller amount");
    const wire = {
        buyer,
        token,
        epochId: epoch.epochId,
        notionalUsd: p.notionalUsd.toString(),
        barrierBps: quoted.barrierBps,
        premiumUsd: quoted.premiumUsd.toString(),
        expiry,
        nonce: nonce.toString(),
    };
    void store_1.store.quoteLogs
        .insert({
        chainId: p.chainId,
        buyer: buyer.toLowerCase(),
        token: token.toLowerCase(),
        ticker,
        epochId: epoch.epochId,
        notionalUsd: wire.notionalUsd,
        barrierBps: wire.barrierBps,
        premiumUsd: wire.premiumUsd,
        nonce: wire.nonce,
        expiry,
        signed: !!signature,
        rv20,
        volSource: vol.source,
        fairBp: quoted.fairBp,
        chargedBp: quoted.chargedBp,
        mode,
        createdAt: new Date(),
    })
        .catch(() => undefined);
    return {
        quote: wire,
        signature,
        signerConfigured: !!account,
        quoter: account?.address ?? null,
        chainId: p.chainId,
        verifyingContract,
        domain: { name: "afterhours.fi CoverMarket", version: "1", chainId: p.chainId, verifyingContract },
        estimatedValue: ev,
        floorPricePerShare: floor8?.toString() ?? null,
        floorPricePerShareUsd: floor8 ? Number(floor8) / 1e8 : null,
        lastPricePerShare: lastPrice8?.toString() ?? null,
        lastPriceSource,
        requiredTokenBalance: reads?.requiredTokenBalance?.toString() ?? null,
        capacityNotional: reads?.capacityNotional?.toString() ?? null,
        capacityOk,
        pricing: {
            mode,
            budgetBps: p.budgetBps ?? null,
            budgetShort,
            pricedOut: false,
            ticker,
            symbol,
            wrapper,
            tokenUnknown,
            rv20,
            volSource: vol.source,
            volAsof: vol.asof,
            volSymbol: vol.symbol,
            menu,
        },
        epoch: { epochId: epoch.epochId, bindDeadline: epoch.bindDeadline, expectedOpen: epoch.expectedOpen, openOnChain: epoch.openOnChain, secondsToBell: Math.max(0, epoch.bindDeadline - now) },
        expiresAt: new Date(expiry * 1000).toISOString(),
        notes,
    };
}
exports.barrierMenu = config_1.BARRIER_MENU;
//# sourceMappingURL=quote.js.map