"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setLastPrices = setLastPrices;
exports.postClose = postClose;
exports.postOpen = postOpen;
exports.voidEpoch = voidEpoch;
exports.settleEpoch = settleEpoch;
exports.openNextEpochs = openNextEpochs;
exports.tick = tick;
exports.jobsSummary = jobsSummary;
const abi_1 = require("../abi");
const chains_1 = require("../chains");
const config_1 = require("../config");
const indexer_1 = require("../indexer");
const logger_1 = require("../logger");
const prices_1 = require("../market/prices");
const tokens_1 = require("../market/tokens");
const store_1 = require("../store");
const errors_1 = require("../util/errors");
const http_1 = require("../util/http");
const time_1 = require("../util/time");
const openAttempts = new Map(); // `${chainId}:${epochId}` -> last attempt (sec)
const epochsOpenedOn = new Map(); // chainId -> day index when openNextEpochs last ran
let ticking = false;
async function readRefs(c, epochId, tokens) {
    const oracle = c.contracts.ReferenceOracle;
    const res = await (0, chains_1.getPublicClient)(c.chainId).multicall({
        contracts: tokens.map((t) => ({ address: oracle, abi: abi_1.ReferenceOracleAbi, functionName: "getRef", args: [t.address, BigInt(epochId)] })),
        allowFailure: true,
    });
    const out = new Map();
    tokens.forEach((t, i) => {
        const r = res[i];
        if (r?.status === "success") {
            const v = r.result;
            out.set(t.address.toLowerCase(), { closePrice: v.closePrice, openPrice: v.openPrice, voided: v.voided, voidReason: v.voidReason });
        }
    });
    return out;
}
async function sendOracle(c, functionName, tokens, epochId, prices) {
    const wallet = (0, chains_1.requireWallet)(c.chainId);
    const client = (0, chains_1.getPublicClient)(c.chainId);
    const { request } = await client.simulateContract({
        account: wallet.account,
        address: c.contracts.ReferenceOracle,
        abi: abi_1.ReferenceOracleAbi,
        functionName,
        args: [tokens, BigInt(epochId), prices],
    });
    const hash = await wallet.writeContract(request);
    const receipt = await client.waitForTransactionReceipt({ hash, confirmations: 1, timeout: 180_000 });
    if (receipt.status !== "success")
        throw new Error(`${functionName} reverted in ${hash}`);
    return hash;
}
function requireDeployed(chainId) {
    const c = (0, config_1.getChain)(chainId);
    if (!c)
        throw new errors_1.ApiError(400, "unsupported_chain", `chainId ${chainId} is not supported`);
    if (!c.contracts.CoverMarket || !c.contracts.ReferenceOracle)
        throw new errors_1.ApiError(503, "not_deployed", `afterhours.fi is not deployed on ${c.name} yet`);
    return c;
}
/** Push live per-share prices to ReferenceOracle.setLastPrices (used by the holding check and the UI). */
async function setLastPrices(chainId, overrides = {}) {
    const c = requireDeployed(chainId);
    const tokens = await (0, tokens_1.getTokens)(chainId);
    const addrs = [];
    const vals = [];
    const out = [];
    for (const t of tokens) {
        const ov = overrides[t.symbol] ?? overrides[t.ticker];
        let price8 = null;
        let source = "override";
        if (ov && Number.isFinite(ov) && ov > 0)
            price8 = BigInt(Math.round(ov * 1e8)).toString();
        else {
            const live = await (0, prices_1.getUnderlyingPrice)(t);
            if (live) {
                price8 = live.price8;
                source = live.source;
            }
        }
        if (!price8 || price8 === "0")
            continue;
        addrs.push(t.address);
        vals.push(BigInt(price8));
        out.push({ symbol: t.symbol, price8, source });
    }
    if (addrs.length === 0)
        return { tx: null, prices: [] };
    const wallet = (0, chains_1.requireWallet)(chainId);
    const client = (0, chains_1.getPublicClient)(chainId);
    const { request } = await client.simulateContract({ account: wallet.account, address: c.contracts.ReferenceOracle, abi: abi_1.ReferenceOracleAbi, functionName: "setLastPrices", args: [addrs, vals] });
    const hash = await wallet.writeContract(request);
    await client.waitForTransactionReceipt({ hash, timeout: 180_000 });
    logger_1.logger.info({ chainId, tx: hash, n: addrs.length }, "setLastPrices");
    return { tx: hash, prices: out };
}
/** Friday close: post the last available underlying price for every allowed token that has no close yet. */
async function postClose(chainId, epochId, overrides = {}) {
    const c = requireDeployed(chainId);
    const tokens = await (0, tokens_1.getTokens)(chainId);
    const refs = await readRefs(c, epochId, tokens);
    const posted = [];
    const skipped = [];
    const addrs = [];
    const vals = [];
    for (const t of tokens) {
        const ref = refs.get(t.address.toLowerCase());
        if (ref && ref.closePrice > 0n) {
            skipped.push({ symbol: t.symbol, reason: "close already posted" });
            continue;
        }
        const ov = overrides[t.symbol] ?? overrides[t.ticker];
        let price = null;
        if (ov && ov > 0)
            price = { ticker: t.ticker, price: ov, price8: BigInt(Math.round(ov * 1e8)).toString(), source: "override", asof: (0, time_1.nowSec)(), stale: false, stockPrintNull: false, tokenPrice: null, sharesMultiplier: null, rwaContract: null };
        else
            price = await (0, prices_1.getUnderlyingPrice)(t);
        if (!price) {
            skipped.push({ symbol: t.symbol, reason: "no price available" });
            continue;
        }
        addrs.push(t.address);
        vals.push(BigInt(price.price8));
        posted.push({ symbol: t.symbol, token: t.address, price8: price.price8, source: price.source });
    }
    let tx = null;
    if (addrs.length > 0) {
        tx = await sendOracle(c, "postCloseBatch", addrs, epochId, vals);
        for (const p of posted)
            await store_1.store.epochPrices.upsert({ chainId, epochId, token: p.token, symbol: p.symbol, closePrice: p.price8, closeSource: p.source, closeTx: tx, closePostedAt: (0, time_1.nowSec)() });
        logger_1.logger.info({ chainId, epochId, tx, n: addrs.length }, "postCloseBatch");
    }
    return { chainId, epochId, posted, skipped, tx };
}
/**
 * Monday open: post the first non-null underlying print for tokens that have a close but no open.
 * With allowFallback the best available price is used instead (after the retry window, or on admin request).
 */
async function postOpen(chainId, epochId, opts = {}) {
    const c = requireDeployed(chainId);
    const tokens = await (0, tokens_1.getTokens)(chainId);
    const refs = await readRefs(c, epochId, tokens);
    const posted = [];
    const skipped = [];
    const addrs = [];
    const vals = [];
    for (const t of tokens) {
        const ref = refs.get(t.address.toLowerCase());
        if (!ref || ref.closePrice === 0n) {
            skipped.push({ symbol: t.symbol, reason: "no close posted for this epoch" });
            continue;
        }
        if (ref.voided) {
            skipped.push({ symbol: t.symbol, reason: `voided (${ref.voidReason})` });
            continue;
        }
        if (ref.openPrice > 0n) {
            skipped.push({ symbol: t.symbol, reason: "open already posted" });
            continue;
        }
        const ov = opts.overrides?.[t.symbol] ?? opts.overrides?.[t.ticker];
        let price = null;
        if (ov && ov > 0)
            price = { ticker: t.ticker, price: ov, price8: BigInt(Math.round(ov * 1e8)).toString(), source: "override", asof: (0, time_1.nowSec)(), stale: false, stockPrintNull: false, tokenPrice: null, sharesMultiplier: null, rwaContract: null };
        else {
            price = await (0, prices_1.getUnderlyingPrint)(t);
            if (!price && opts.allowFallback)
                price = await (0, prices_1.getUnderlyingPrice)(t);
        }
        if (!price) {
            skipped.push({ symbol: t.symbol, reason: "underlying print not available yet (stockInfo.price is null)" });
            continue;
        }
        addrs.push(t.address);
        vals.push(BigInt(price.price8));
        posted.push({ symbol: t.symbol, token: t.address, price8: price.price8, source: price.source });
    }
    let tx = null;
    if (addrs.length > 0) {
        tx = await sendOracle(c, "postOpenBatch", addrs, epochId, vals);
        for (const p of posted)
            await store_1.store.epochPrices.upsert({ chainId, epochId, token: p.token, symbol: p.symbol, openPrice: p.price8, openSource: p.source, openTx: tx, openPostedAt: (0, time_1.nowSec)() });
        logger_1.logger.info({ chainId, epochId, tx, n: addrs.length }, "postOpenBatch");
    }
    return { chainId, epochId, posted, skipped, tx };
}
async function voidEpoch(chainId, token, epochId, reason) {
    const c = requireDeployed(chainId);
    const wallet = (0, chains_1.requireWallet)(chainId);
    const client = (0, chains_1.getPublicClient)(chainId);
    const { request } = await client.simulateContract({ account: wallet.account, address: c.contracts.ReferenceOracle, abi: abi_1.ReferenceOracleAbi, functionName: "voidEpoch", args: [token, BigInt(epochId), reason] });
    const hash = await wallet.writeContract(request);
    await client.waitForTransactionReceipt({ hash, timeout: 180_000 });
    await store_1.store.epochPrices.upsert({ chainId, epochId, token, voided: true, voidReason: reason });
    logger_1.logger.info({ chainId, epochId, token, reason, tx: hash }, "voidEpoch");
    return hash;
}
/** Open policy ids from the store; when the store is empty, scan the chain (policyCount + getPolicy). */
async function collectOpenPolicyIds(c, epochId) {
    const fromStore = await store_1.store.policies.open(c.chainId, epochId);
    if (fromStore.length > 0 || (await store_1.store.policies.count(c.chainId)) > 0)
        return fromStore.map((p) => p.policyId);
    const client = (0, chains_1.getPublicClient)(c.chainId);
    const market = c.contracts.CoverMarket;
    const count = Number(await client.readContract({ address: market, abi: abi_1.CoverMarketAbi, functionName: "policyCount" }));
    const ids = [];
    const all = Array.from({ length: Math.min(count, 5_000) }, (_, i) => count - 1 - i);
    for (const batch of (0, http_1.chunk)(all, 200)) {
        const res = await client.multicall({ contracts: batch.map((id) => ({ address: market, abi: abi_1.CoverMarketAbi, functionName: "getPolicy", args: [BigInt(id)] })), allowFailure: true });
        res.forEach((r, i) => {
            if (r.status === "success" && r.result.status === 1 && (epochId === undefined || Number(r.result.epochId) === epochId))
                ids.push(batch[i]);
        });
    }
    return ids.sort((a, b) => a - b);
}
/** settleBatch every open policy whose epoch is settleable (the contract skips the others), in chunks of 50. */
async function settleEpoch(chainId, epochId) {
    const c = requireDeployed(chainId);
    const ids = await collectOpenPolicyIds(c, epochId);
    if (ids.length === 0)
        return { chainId, epochId: epochId ?? null, candidates: 0, txs: [], settled: 0, note: "no open policies" };
    // keep only ids whose epoch is settleable to avoid paying gas for no-ops
    const oracle = c.contracts.ReferenceOracle;
    const market = c.contracts.CoverMarket;
    const client = (0, chains_1.getPublicClient)(chainId);
    const docs = new Map();
    for (const id of ids) {
        const d = await store_1.store.policies.get(chainId, id);
        if (d)
            docs.set(id, { token: d.token, epochId: d.epochId });
    }
    const missing = ids.filter((id) => !docs.has(id));
    if (missing.length > 0) {
        const res = await client.multicall({ contracts: missing.map((id) => ({ address: market, abi: abi_1.CoverMarketAbi, functionName: "getPolicy", args: [BigInt(id)] })), allowFailure: true });
        res.forEach((r, i) => {
            if (r.status === "success")
                docs.set(missing[i], { token: r.result.token, epochId: Number(r.result.epochId) });
        });
    }
    const keys = [...new Set([...docs.values()].map((d) => `${d.token.toLowerCase()}:${d.epochId}`))];
    const settleable = new Set();
    const checks = await client.multicall({
        contracts: keys.map((k) => {
            const [token, e] = k.split(":");
            return { address: oracle, abi: abi_1.ReferenceOracleAbi, functionName: "isSettleable", args: [token, BigInt(e)] };
        }),
        allowFailure: true,
    });
    checks.forEach((r, i) => {
        if (r.status === "success" && r.result[0])
            settleable.add(keys[i]);
    });
    const ready = ids.filter((id) => {
        const d = docs.get(id);
        return d && settleable.has(`${d.token.toLowerCase()}:${d.epochId}`);
    });
    if (ready.length === 0)
        return { chainId, epochId: epochId ?? null, candidates: ids.length, txs: [], settled: 0, note: "no open policy is settleable yet (missing open print or voided flag)" };
    const wallet = (0, chains_1.requireWallet)(chainId);
    const txs = [];
    for (const batch of (0, http_1.chunk)(ready, config_1.config.settleChunk)) {
        const { request } = await client.simulateContract({ account: wallet.account, address: market, abi: abi_1.CoverMarketAbi, functionName: "settleBatch", args: [batch.map((id) => BigInt(id))] });
        const hash = await wallet.writeContract(request);
        const receipt = await client.waitForTransactionReceipt({ hash, timeout: 180_000 });
        if (receipt.status !== "success")
            logger_1.logger.error({ chainId, hash }, "settleBatch reverted");
        else
            txs.push(hash);
        logger_1.logger.info({ chainId, hash, n: batch.length }, "settleBatch");
    }
    void (0, indexer_1.runIndexerOnce)(chainId);
    return { chainId, epochId: epochId ?? null, candidates: ids.length, txs, settled: ready.length };
}
/** openEpoch for the next two epochs. Owner-only on the market: when the quoter is not the owner, log the manual command. */
async function openNextEpochs(chainId) {
    const c = requireDeployed(chainId);
    const market = c.contracts.CoverMarket;
    const client = (0, chains_1.getPublicClient)(chainId);
    const targets = (0, tokens_1.upcomingEpochs)(2);
    const existing = [];
    const todo = [];
    for (const e of targets) {
        const on = await (0, tokens_1.epochOnChain)(chainId, e.epochId);
        if (on?.exists)
            existing.push(e.epochId);
        else
            todo.push(e);
    }
    if (todo.length === 0)
        return { chainId, opened: [], existing, txs: [] };
    const instruction = `cd contracts && npm run epoch:${c.key}   # opens ${todo.map((e) => e.epochId).join(", ")} with the owner key`;
    const wallet = (0, chains_1.getWalletClient)(chainId);
    const owner = await client.readContract({ address: market, abi: abi_1.CoverMarketAbi, functionName: "owner" });
    const me = (0, chains_1.quoterAddress)();
    if (!wallet || !me || owner.toLowerCase() !== me.toLowerCase()) {
        logger_1.logger.warn({ chainId, owner, quoter: me, missing: todo.map((e) => e.epochId) }, `openEpoch is owner-only and the quoter is not the owner. Run: ${instruction}`);
        return { chainId, opened: [], existing, txs: [], skipped: "quoter is not the market owner", instruction };
    }
    const txs = [];
    const opened = [];
    for (const e of todo) {
        const { request } = await client.simulateContract({ account: wallet.account, address: market, abi: abi_1.CoverMarketAbi, functionName: "openEpoch", args: [BigInt(e.epochId), BigInt(e.bindDeadline), BigInt(e.expectedOpen)] });
        const hash = await wallet.writeContract(request);
        await client.waitForTransactionReceipt({ hash, timeout: 180_000 });
        (0, tokens_1.noteEpoch)(chainId, e);
        txs.push(hash);
        opened.push(e.epochId);
        logger_1.logger.info({ chainId, epochId: e.epochId, tx: hash }, "openEpoch");
    }
    (0, tokens_1.invalidateTokens)(chainId);
    return { chainId, opened, existing, txs };
}
/** Epochs that could need keeper action right now: the last two weekly epochs plus the current one. */
function candidateEpochs(chainId) {
    const now = (0, time_1.nowSec)();
    const current = (0, time_1.nextFridayClose)(now, config_1.config.epochCloseHourUtc);
    const set = new Set([current, current - time_1.WEEK, current - 2 * time_1.WEEK]);
    for (const e of (0, tokens_1.knownEpochs)(chainId))
        if (e.epochId >= current - 2 * time_1.WEEK && e.epochId <= current)
            set.add(e.epochId);
    return [...set].sort((a, b) => a - b);
}
async function tickChain(c) {
    const now = (0, time_1.nowSec)();
    const tokens = await (0, tokens_1.getTokens)(c.chainId);
    if (tokens.length === 0)
        return;
    for (const epochId of candidateEpochs(c.chainId)) {
        const open = (0, time_1.expectedOpenFor)(epochId);
        const refs = await readRefs(c, epochId, tokens);
        const missingClose = tokens.filter((t) => (refs.get(t.address.toLowerCase())?.closePrice ?? 0n) === 0n);
        const missingOpen = tokens.filter((t) => {
            const r = refs.get(t.address.toLowerCase());
            return r && r.closePrice > 0n && r.openPrice === 0n && !r.voided;
        });
        // Friday bell: post closes within the close window
        if (missingClose.length > 0 && now >= epochId && now <= epochId + config_1.config.closeWindowMinutes * 60) {
            try {
                const r = await postClose(c.chainId, epochId);
                logger_1.logger.info({ chainId: c.chainId, epochId, posted: r.posted.length, skipped: r.skipped.length }, "friday close job");
            }
            catch (e) {
                logger_1.logger.error({ chainId: c.chainId, epochId, err: e.message.slice(0, 300) }, "friday close job failed");
            }
        }
        // Monday open: retry every OPEN_RETRY_MINUTES for OPEN_RETRY_WINDOW_MINUTES, then allow the fallback price
        if (missingOpen.length > 0 && now >= open) {
            const key = `${c.chainId}:${epochId}`;
            const last = openAttempts.get(key) ?? 0;
            const sinceOpen = now - open;
            const withinWindow = sinceOpen <= (config_1.config.openRetryWindowMinutes + config_1.config.openFallbackAfterMinutes + 24 * 60) * 60;
            if (withinWindow && now - last >= config_1.config.openRetryMinutes * 60) {
                openAttempts.set(key, now);
                const allowFallback = sinceOpen >= config_1.config.openFallbackAfterMinutes * 60;
                try {
                    const r = await postOpen(c.chainId, epochId, { allowFallback });
                    if (r.posted.length > 0)
                        logger_1.logger.info({ chainId: c.chainId, epochId, posted: r.posted.map((p) => `${p.symbol}@${p.source}`), allowFallback }, "monday open job");
                    else
                        logger_1.logger.info({ chainId: c.chainId, epochId, waiting: r.skipped.filter((s) => s.reason.startsWith("underlying")).length, minutesSinceOpen: Math.floor(sinceOpen / 60) }, "monday open job: no print yet");
                }
                catch (e) {
                    logger_1.logger.error({ chainId: c.chainId, epochId, err: e.message.slice(0, 300) }, "monday open job failed");
                }
            }
        }
        // Settle whatever is settleable for this epoch
        const anySettleable = tokens.some((t) => {
            const r = refs.get(t.address.toLowerCase());
            return r && (r.voided || (r.closePrice > 0n && r.openPrice > 0n));
        });
        if (anySettleable && now >= open) {
            const openPolicies = await store_1.store.policies.open(c.chainId, epochId);
            if (openPolicies.length > 0) {
                try {
                    const r = await settleEpoch(c.chainId, epochId);
                    if (r.settled > 0)
                        logger_1.logger.info({ chainId: c.chainId, epochId, settled: r.settled, txs: r.txs }, "settle job");
                }
                catch (e) {
                    logger_1.logger.error({ chainId: c.chainId, epochId, err: e.message.slice(0, 300) }, "settle job failed");
                }
            }
        }
    }
    // Monday: make sure the next two epochs exist
    if ((0, time_1.isMondayUtc)(now)) {
        const dayIdx = Math.floor(now / 86_400);
        if (epochsOpenedOn.get(c.chainId) !== dayIdx) {
            epochsOpenedOn.set(c.chainId, dayIdx);
            try {
                await openNextEpochs(c.chainId);
            }
            catch (e) {
                logger_1.logger.error({ chainId: c.chainId, err: e.message.slice(0, 300) }, "open epochs job failed");
            }
        }
    }
}
async function tick() {
    if (ticking)
        return;
    ticking = true;
    try {
        for (const c of (0, config_1.deployedChains)()) {
            try {
                await tickChain(c);
            }
            catch (e) {
                logger_1.logger.warn({ chainId: c.chainId, err: e.message.slice(0, 300) }, "epoch tick failed");
            }
        }
    }
    finally {
        ticking = false;
    }
}
function jobsSummary() {
    const now = (0, time_1.nowSec)();
    const current = (0, time_1.nextFridayClose)(now, config_1.config.epochCloseHourUtc);
    return {
        signer: (0, chains_1.quoterAddress)(),
        enabled: config_1.config.jobsEnabled && !!(0, chains_1.quoterAddress)(),
        currentEpochId: current,
        bellAt: (0, time_1.iso)(current),
        expectedOpenAt: (0, time_1.iso)((0, time_1.expectedOpenFor)(current)),
        openRetry: { everyMinutes: config_1.config.openRetryMinutes, windowMinutes: config_1.config.openRetryWindowMinutes, fallbackAfterMinutes: config_1.config.openFallbackAfterMinutes },
        lastOpenAttempts: Object.fromEntries([...openAttempts.entries()].map(([k, v]) => [k, (0, time_1.iso)(v)])),
    };
}
//# sourceMappingURL=epoch.js.map