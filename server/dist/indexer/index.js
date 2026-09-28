"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchPolicyFromChain = fetchPolicyFromChain;
exports.runIndexerOnce = runIndexerOnce;
exports.computeStats = computeStats;
exports.recomputeStats = recomputeStats;
exports.resetCursor = resetCursor;
exports.runIndexerAll = runIndexerAll;
exports.startIndexer = startIndexer;
exports.stopIndexer = stopIndexer;
exports.indexerStatus = indexerStatus;
exports.policiesFromChain = policiesFromChain;
/**
 * Polls CoverBought / CoverSettled / CoverRefunded / EpochOpened logs per deployed chain from a stored cursor,
 * in 5,000-block chunks, upserts Policy docs and derives per-user stats.
 */
const viem_1 = require("viem");
const abi_1 = require("../abi");
const chains_1 = require("../chains");
const config_1 = require("../config");
const logger_1 = require("../logger");
const tokens_1 = require("../market/tokens");
const store_1 = require("../store");
const time_1 = require("../util/time");
const EVENTS = [
    (0, viem_1.getAbiItem)({ abi: abi_1.CoverMarketAbi, name: "CoverBought" }),
    (0, viem_1.getAbiItem)({ abi: abi_1.CoverMarketAbi, name: "CoverSettled" }),
    (0, viem_1.getAbiItem)({ abi: abi_1.CoverMarketAbi, name: "CoverRefunded" }),
    (0, viem_1.getAbiItem)({ abi: abi_1.CoverMarketAbi, name: "EpochOpened" }),
];
const STATUS = ["None", "Open", "Settled", "Refunded"];
const running = new Set();
const lastRun = new Map();
let timer = null;
/** Reads a policy straight from the chain (used when an event arrives for a policy we have not indexed). */
async function fetchPolicyFromChain(c, policyId, blockNumber = 0) {
    if (!c.contracts.CoverMarket)
        return null;
    try {
        const p = await (0, chains_1.getPublicClient)(c.chainId).readContract({ address: c.contracts.CoverMarket, abi: abi_1.CoverMarketAbi, functionName: "getPolicy", args: [BigInt(policyId)] });
        const status = STATUS[p.status] ?? "None";
        if (status === "None")
            return null;
        const tok = await (0, tokens_1.findToken)(c.chainId, p.token);
        return {
            chainId: c.chainId,
            policyId,
            buyer: p.buyer.toLowerCase(),
            token: p.token.toLowerCase(),
            tokenSymbol: tok?.symbol ?? null,
            ticker: tok?.ticker ?? null,
            epochId: Number(p.epochId),
            notionalUsd: p.notionalUsd.toString(),
            barrierBps: p.barrierBps,
            premiumUsd: p.premiumUsd.toString(),
            lockedUsd: p.lockedUsd.toString(),
            payoutUsd: p.payoutUsd.toString(),
            gapBps: status === "Settled" ? Number(p.gapBps) : null,
            status,
            refundReason: null,
            boughtAt: Number(p.boughtAt) || null,
            settledAt: Number(p.settledAt) || null,
            buyTx: null,
            settleTx: null,
            blockNumber,
            updatedAt: new Date(),
        };
    }
    catch (e) {
        logger_1.logger.warn({ chainId: c.chainId, policyId, err: e.message }, "getPolicy failed");
        return null;
    }
}
const chunkByChain = new Map();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/** Parse a provider's block-range limit out of its error text, e.g. "up to a 10 block range" or "range is limited to 500". */
function rangeCapFrom(msg) {
    if (!/block range|range (is )?limit|too many blocks|exceed/i.test(msg))
        return null;
    const m = msg.match(/up to (?:a )?(\d+)[ -]block/i) ?? msg.match(/limited to (\d+)/i) ?? msg.match(/(\d+) block range/i);
    const n = m ? Number(m[1]) : 10;
    return BigInt(Math.max(1, Math.min(n, 5000)));
}
async function startBlock(c, latest) {
    const cur = await store_1.store.cursors.get(c.chainId);
    if (cur !== null)
        return BigInt(cur + 1);
    if (c.deployBlock && c.deployBlock > 0)
        return BigInt(c.deployBlock);
    const lb = BigInt(config_1.config.indexerLookbackBlocks);
    return latest > lb ? latest - lb : 0n;
}
async function runIndexerOnce(chainId) {
    const c = (0, config_1.getChain)(chainId);
    if (!c?.contracts.CoverMarket)
        return { chainId, fromBlock: 0, toBlock: 0, logs: 0, policiesTouched: 0, skipped: "not deployed" };
    if (running.has(chainId))
        return { chainId, fromBlock: 0, toBlock: 0, logs: 0, policiesTouched: 0, skipped: "already running" };
    running.add(chainId);
    const market = c.contracts.CoverMarket;
    try {
        const client = (0, chains_1.getPublicClient)(chainId);
        const latest = await client.getBlockNumber();
        const safeHead = latest - BigInt(config_1.config.indexerConfirmations);
        let from = await startBlock(c, safeHead);
        const touched = new Set();
        const buyers = new Set();
        let logsSeen = 0;
        const firstFrom = from;
        if (from > safeHead) {
            const r = { chainId, fromBlock: Number(from), toBlock: Number(safeHead), logs: 0, policiesTouched: 0 };
            lastRun.set(chainId, { ...r, at: (0, time_1.nowSec)() });
            return r;
        }
        let chunkSize = chunkByChain.get(chainId) ?? BigInt(config_1.config.indexerChunkBlocks);
        while (from <= safeHead) {
            const to = from + chunkSize - 1n > safeHead ? safeHead : from + chunkSize - 1n;
            let logs;
            try {
                logs = await client.getLogs({ address: market, events: EVENTS, fromBlock: from, toBlock: to, strict: true });
            }
            catch (e) {
                // Providers cap the eth_getLogs range (Alchemy free tier: 10 blocks). Learn the cap once and retry smaller.
                const cap = rangeCapFrom(e.message);
                if (cap && cap < chunkSize) {
                    chunkSize = cap;
                    chunkByChain.set(chainId, cap);
                    logger_1.logger.info({ chainId, chunkBlocks: Number(cap) }, "getLogs range capped by provider; using smaller chunks");
                    continue;
                }
                throw e;
            }
            if (chunkSize <= 50n)
                await sleep(config_1.config.indexerSmallChunkDelayMs); // stay inside the provider's per-second budget
            logsSeen += logs.length;
            for (const log of logs) {
                const bn = Number(log.blockNumber ?? 0n);
                const tx = log.transactionHash ?? null;
                switch (log.eventName) {
                    case "EpochOpened": {
                        (0, tokens_1.noteEpoch)(chainId, { epochId: Number(log.args.epochId), bindDeadline: Number(log.args.bindDeadline), expectedOpen: Number(log.args.expectedOpen) });
                        break;
                    }
                    case "CoverBought": {
                        const id = Number(log.args.policyId);
                        const existing = await store_1.store.policies.get(chainId, id);
                        const tok = await (0, tokens_1.findToken)(chainId, log.args.token);
                        let boughtAt = existing?.boughtAt ?? null;
                        if (!boughtAt) {
                            try {
                                boughtAt = Number((await client.getBlock({ blockNumber: log.blockNumber })).timestamp);
                            }
                            catch {
                                boughtAt = null;
                            }
                        }
                        const doc = {
                            chainId,
                            policyId: id,
                            buyer: log.args.buyer.toLowerCase(),
                            token: log.args.token.toLowerCase(),
                            tokenSymbol: tok?.symbol ?? existing?.tokenSymbol ?? null,
                            ticker: tok?.ticker ?? existing?.ticker ?? null,
                            epochId: Number(log.args.epochId),
                            notionalUsd: log.args.notionalUsd.toString(),
                            barrierBps: log.args.barrierBps,
                            premiumUsd: log.args.premiumUsd.toString(),
                            lockedUsd: log.args.lockedUsd.toString(),
                            payoutUsd: existing?.payoutUsd ?? "0",
                            gapBps: existing?.gapBps ?? null,
                            status: existing && existing.status !== "Open" ? existing.status : "Open",
                            refundReason: existing?.refundReason ?? null,
                            boughtAt,
                            settledAt: existing?.settledAt ?? null,
                            buyTx: tx,
                            settleTx: existing?.settleTx ?? null,
                            blockNumber: bn,
                            updatedAt: new Date(),
                        };
                        await store_1.store.policies.upsert(doc);
                        touched.add(`${id}`);
                        buyers.add(doc.buyer);
                        break;
                    }
                    case "CoverSettled":
                    case "CoverRefunded": {
                        const id = Number(log.args.policyId);
                        let doc = await store_1.store.policies.get(chainId, id);
                        if (!doc)
                            doc = await fetchPolicyFromChain(c, id, bn);
                        if (!doc)
                            break;
                        let settledAt = doc.settledAt;
                        if (!settledAt) {
                            try {
                                settledAt = Number((await client.getBlock({ blockNumber: log.blockNumber })).timestamp);
                            }
                            catch {
                                settledAt = null;
                            }
                        }
                        if (log.eventName === "CoverSettled") {
                            doc.status = "Settled";
                            doc.gapBps = Number(log.args.gapBps);
                            doc.payoutUsd = log.args.payoutUsd.toString();
                        }
                        else {
                            doc.status = "Refunded";
                            doc.refundReason = log.args.reason;
                        }
                        doc.settledAt = settledAt;
                        doc.settleTx = tx;
                        doc.blockNumber = Math.max(doc.blockNumber, bn);
                        await store_1.store.policies.upsert(doc);
                        touched.add(`${id}`);
                        buyers.add(doc.buyer);
                        break;
                    }
                }
            }
            await store_1.store.cursors.set(chainId, Number(to));
            from = to + 1n;
        }
        for (const b of buyers)
            await recomputeStats(chainId, b);
        const r = { chainId, fromBlock: Number(firstFrom), toBlock: Number(safeHead), logs: logsSeen, policiesTouched: touched.size };
        lastRun.set(chainId, { ...r, at: (0, time_1.nowSec)() });
        if (logsSeen > 0)
            logger_1.logger.info(r, "indexer pass");
        return r;
    }
    catch (e) {
        const msg = e.message;
        logger_1.logger.warn({ chainId, err: msg.slice(0, 300) }, "indexer pass failed");
        const prev = lastRun.get(chainId);
        lastRun.set(chainId, { chainId, fromBlock: prev?.fromBlock ?? 0, toBlock: prev?.toBlock ?? 0, logs: 0, policiesTouched: 0, at: (0, time_1.nowSec)(), error: msg.slice(0, 300) });
        return { chainId, fromBlock: 0, toBlock: 0, logs: 0, policiesTouched: 0, skipped: msg.slice(0, 200) };
    }
    finally {
        running.delete(chainId);
    }
}
/** Derives streaks and totals for one buyer from their indexed policies. */
function computeStats(chainId, address, policies) {
    const protectedEpochs = [...new Set(policies.filter((p) => p.status !== "Refunded").map((p) => p.epochId))].sort((a, b) => a - b);
    let longest = 0;
    let run = 0;
    let prev = null;
    for (const e of protectedEpochs) {
        run = prev !== null && e - prev === time_1.WEEK ? run + 1 : 1;
        prev = e;
        if (run > longest)
            longest = run;
    }
    // current streak: the run ending at the latest protected epoch, alive only if that epoch is this weekend's or last weekend's
    const current = (0, time_1.nextFridayClose)((0, time_1.nowSec)(), config_1.config.epochCloseHourUtc);
    const last = protectedEpochs[protectedEpochs.length - 1];
    const currentStreak = last !== undefined && current - last <= time_1.WEEK ? run : 0;
    let premiums = 0n;
    let payouts = 0n;
    let held = 0;
    let paid = 0;
    for (const p of policies) {
        if (p.status === "Refunded")
            continue;
        premiums += BigInt(p.premiumUsd || "0");
        if (p.status === "Settled") {
            const po = BigInt(p.payoutUsd || "0");
            payouts += po;
            if (po > 0n)
                paid++;
            else
                held++;
        }
    }
    return {
        chainId,
        address: address.toLowerCase(),
        weekendsProtected: protectedEpochs.length,
        currentStreak,
        longestStreak: longest,
        premiumsPaid: premiums.toString(),
        payoutsReceived: payouts.toString(),
        floorsHeld: held,
        floorsPaid: paid,
        policies: policies.length,
        updatedAt: new Date(),
    };
}
async function recomputeStats(chainId, address) {
    const policies = await store_1.store.policies.byBuyer(chainId, address);
    const s = computeStats(chainId, address, policies);
    await store_1.store.stats.upsert(s);
    return s;
}
async function resetCursor(chainId, fromBlock) {
    await store_1.store.policies.clear(chainId);
    if (fromBlock !== undefined && fromBlock >= 0)
        await store_1.store.cursors.set(chainId, fromBlock - 1);
    else
        await store_1.store.cursors.clear(chainId);
}
async function runIndexerAll() {
    const out = [];
    for (const c of (0, config_1.deployedChains)())
        out.push(await runIndexerOnce(c.chainId));
    return out;
}
function startIndexer() {
    if (!config_1.config.indexerEnabled) {
        logger_1.logger.warn("indexer disabled (INDEXER_ENABLED=false)");
        return;
    }
    const chains = (0, config_1.deployedChains)();
    if (chains.length === 0) {
        logger_1.logger.warn("indexer idle: no chain has a CoverMarket address (add deployments/<network>.json or CONTRACT_COVER_MARKET_<chainId>)");
        return;
    }
    const tick = () => void runIndexerAll();
    setTimeout(tick, 2_000);
    timer = setInterval(tick, config_1.config.indexerIntervalMs);
    timer.unref();
    logger_1.logger.info({ chains: chains.map((c) => c.chainId), intervalMs: config_1.config.indexerIntervalMs }, "indexer started");
}
function stopIndexer() {
    if (timer)
        clearInterval(timer);
    timer = null;
}
function indexerStatus() {
    return Object.fromEntries([...lastRun.entries()].map(([k, v]) => [k, v]));
}
/** Live on-chain fallback for /policies when the store has nothing for a buyer (fresh memory store, Mongo down). */
async function policiesFromChain(chainId, buyer) {
    const c = (0, config_1.getChain)(chainId);
    if (!c?.contracts.CoverMarket)
        return [];
    try {
        const ids = await (0, chains_1.getPublicClient)(chainId).readContract({ address: c.contracts.CoverMarket, abi: abi_1.CoverMarketAbi, functionName: "policiesOf", args: [buyer] });
        const docs = [];
        for (const id of ids.slice(-200)) {
            const d = await fetchPolicyFromChain(c, Number(id));
            if (d)
                docs.push(d);
        }
        return docs.sort((a, b) => b.epochId - a.epochId || b.policyId - a.policyId);
    }
    catch (e) {
        logger_1.logger.warn({ chainId, buyer, err: e.message }, "policiesOf fallback failed");
        return [];
    }
}
//# sourceMappingURL=index.js.map