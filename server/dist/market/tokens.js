"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTokens = getTokens;
exports.findToken = findToken;
exports.noteEpoch = noteEpoch;
exports.knownEpochs = knownEpochs;
exports.epochOnChain = epochOnChain;
exports.currentEpoch = currentEpoch;
exports.upcomingEpochs = upcomingEpochs;
exports.invalidateTokens = invalidateTokens;
const abi_1 = require("../abi");
const chains_1 = require("../chains");
const config_1 = require("../config");
const logger_1 = require("../logger");
const http_1 = require("../util/http");
const time_1 = require("../util/time");
const tokenCache = new http_1.KeyedTtlCache(5 * 60_000, "tokens");
const epochCache = new http_1.KeyedTtlCache(60_000, "epoch");
const indexedEpochs = new Map();
async function fetchChainTokens(c) {
    const base = [...c.tokens];
    if (!c.contracts.CoverMarket)
        return base;
    try {
        const client = (0, chains_1.getPublicClient)(c.chainId);
        const addrs = await client.readContract({ address: c.contracts.CoverMarket, abi: abi_1.CoverMarketAbi, functionName: "tokens" });
        const unknown = addrs.filter((a) => !base.find((t) => t.address.toLowerCase() === a.toLowerCase()));
        if (unknown.length > 0) {
            const results = await client.multicall({
                contracts: unknown.flatMap((a) => [
                    { address: a, abi: abi_1.MockERC20Abi, functionName: "symbol" },
                    { address: a, abi: abi_1.MockERC20Abi, functionName: "name" },
                    { address: a, abi: abi_1.MockERC20Abi, functionName: "decimals" },
                ]),
                allowFailure: true,
            });
            unknown.forEach((a, i) => {
                const sym = results[i * 3]?.result;
                const name = results[i * 3 + 1]?.result;
                const dec = results[i * 3 + 2]?.result;
                const symbol = typeof sym === "string" && sym ? sym : `TOKEN_${a.slice(2, 8)}`;
                base.push({
                    symbol,
                    address: a,
                    ticker: (0, config_1.tickerFromSymbol)(symbol),
                    name: typeof name === "string" && name ? name : symbol,
                    decimals: typeof dec === "number" ? dec : 18,
                    wrapper: (0, config_1.wrapperFor)(symbol),
                });
            });
        }
        // allowed flags: drop tokens the market no longer allows
        const allowed = await client.multicall({
            contracts: base.map((t) => ({ address: c.contracts.CoverMarket, abi: abi_1.CoverMarketAbi, functionName: "tokenAllowed", args: [t.address] })),
            allowFailure: true,
        });
        return base.filter((_, i) => allowed[i]?.status !== "success" || allowed[i]?.result !== false);
    }
    catch (e) {
        logger_1.logger.warn({ chainId: c.chainId, err: e.message }, "could not read tokens from chain; using configured list");
        return base;
    }
}
async function getTokens(chainId) {
    const c = (0, config_1.getChain)(chainId);
    if (!c)
        return [];
    return tokenCache.get(String(chainId), () => fetchChainTokens(c));
}
async function findToken(chainId, address) {
    const tokens = await getTokens(chainId);
    return tokens.find((t) => t.address.toLowerCase() === address.toLowerCase()) ?? null;
}
function noteEpoch(chainId, e) {
    let m = indexedEpochs.get(chainId);
    if (!m) {
        m = new Map();
        indexedEpochs.set(chainId, m);
    }
    m.set(e.epochId, e);
    epochCache.entry(`${chainId}:${e.epochId}`).set({ exists: true, bindDeadline: e.bindDeadline, expectedOpen: e.expectedOpen });
}
/** Known epochs for a chain: deployment file + indexed events, sorted. */
function knownEpochs(chainId) {
    const c = (0, config_1.getChain)(chainId);
    const m = new Map();
    for (const e of c?.epochs ?? [])
        m.set(e.epochId, e);
    for (const e of indexedEpochs.get(chainId)?.values() ?? [])
        m.set(e.epochId, e);
    return [...m.values()].sort((a, b) => a.epochId - b.epochId);
}
/** On-chain epoch lookup, cached 60s. null when the chain is not deployed or unreachable. */
async function epochOnChain(chainId, epochId) {
    const c = (0, config_1.getChain)(chainId);
    if (!c?.contracts.CoverMarket)
        return null;
    try {
        return await epochCache.get(`${chainId}:${epochId}`, async () => {
            const [bindDeadline, expectedOpen, exists] = await (0, chains_1.getPublicClient)(chainId).readContract({
                address: c.contracts.CoverMarket,
                abi: abi_1.CoverMarketAbi,
                functionName: "epochs",
                args: [BigInt(epochId)],
            });
            return { exists, bindDeadline: Number(bindDeadline), expectedOpen: Number(expectedOpen) };
        });
    }
    catch (e) {
        logger_1.logger.debug({ chainId, epochId, err: e.message }, "epoch read failed");
        return null;
    }
}
/**
 * The epoch a quote should bind to: the computed next Friday close (same rule as deploy.ts). If a known epoch with
 * a later bind deadline exists but the computed one does not exist on-chain, still return the computed one and flag it.
 */
async function currentEpoch(chainId) {
    const now = (0, time_1.nowSec)();
    const computed = (0, time_1.nextFridayClose)(now, config_1.config.epochCloseHourUtc);
    // Only real Friday-close weekends are sold; demo/test epochs seen by the indexer are ignored.
    const known = knownEpochs(chainId).find((e) => e.bindDeadline >= now && (0, time_1.isFridayCloseEpoch)(e.epochId));
    const candidate = known && known.epochId <= computed ? known.epochId : computed;
    const chain = await epochOnChain(chainId, candidate);
    if (chain?.exists)
        return { epochId: candidate, bindDeadline: chain.bindDeadline, expectedOpen: chain.expectedOpen, openOnChain: true, source: "chain" };
    if (known && known.epochId === candidate)
        return { ...known, openOnChain: chain ? false : null, source: "deployment" };
    return { epochId: candidate, bindDeadline: candidate, expectedOpen: (0, time_1.expectedOpenFor)(candidate), openOnChain: chain ? false : null, source: "computed" };
}
/** Next two epochs after now (for openEpoch on Mondays). */
function upcomingEpochs(count = 2) {
    const first = (0, time_1.nextFridayClose)((0, time_1.nowSec)(), config_1.config.epochCloseHourUtc);
    return Array.from({ length: count }, (_, k) => {
        const id = first + k * time_1.WEEK;
        return { epochId: id, bindDeadline: id, expectedOpen: (0, time_1.expectedOpenFor)(id) };
    });
}
function invalidateTokens(chainId) {
    if (chainId === undefined)
        tokenCache.invalidateAll();
    else
        tokenCache.entry(String(chainId)).invalidate();
}
//# sourceMappingURL=tokens.js.map