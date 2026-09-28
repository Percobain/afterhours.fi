/**
 * Polls CoverBought / CoverSettled / CoverRefunded / EpochOpened logs per deployed chain from a stored cursor,
 * in 5,000-block chunks, upserts Policy docs and derives per-user stats.
 */
import { getAbiItem, type Address } from "viem";
import { CoverMarketAbi } from "../abi";
import { getPublicClient } from "../chains";
import { config, deployedChains, getChain, type ChainConfig } from "../config";
import { logger } from "../logger";
import { findToken, noteEpoch } from "../market/tokens";
import type { PolicyDoc, UserStatsDoc } from "../models/types";
import { store } from "../store";
import { nextFridayClose, nowSec, WEEK } from "../util/time";

const EVENTS = [
  getAbiItem({ abi: CoverMarketAbi, name: "CoverBought" }),
  getAbiItem({ abi: CoverMarketAbi, name: "CoverSettled" }),
  getAbiItem({ abi: CoverMarketAbi, name: "CoverRefunded" }),
  getAbiItem({ abi: CoverMarketAbi, name: "EpochOpened" }),
] as const;

const STATUS = ["None", "Open", "Settled", "Refunded"] as const;

interface RunResult {
  chainId: number;
  fromBlock: number;
  toBlock: number;
  logs: number;
  policiesTouched: number;
  skipped?: string;
}

const running = new Set<number>();
const lastRun = new Map<number, RunResult & { at: number; error?: string }>();
let timer: NodeJS.Timeout | null = null;

/** Reads a policy straight from the chain (used when an event arrives for a policy we have not indexed). */
export async function fetchPolicyFromChain(c: ChainConfig, policyId: number, blockNumber = 0): Promise<PolicyDoc | null> {
  if (!c.contracts.CoverMarket) return null;
  try {
    const p = await getPublicClient(c.chainId).readContract({ address: c.contracts.CoverMarket, abi: CoverMarketAbi, functionName: "getPolicy", args: [BigInt(policyId)] });
    const status = STATUS[p.status] ?? "None";
    if (status === "None") return null;
    const tok = await findToken(c.chainId, p.token);
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
  } catch (e) {
    logger.warn({ chainId: c.chainId, policyId, err: (e as Error).message }, "getPolicy failed");
    return null;
  }
}

const chunkByChain = new Map<number, bigint>();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Parse a provider's block-range limit out of its error text, e.g. "up to a 10 block range" or "range is limited to 500". */
function rangeCapFrom(msg: string): bigint | null {
  if (!/block range|range (is )?limit|too many blocks|exceed/i.test(msg)) return null;
  const m = msg.match(/up to (?:a )?(\d+)[ -]block/i) ?? msg.match(/limited to (\d+)/i) ?? msg.match(/(\d+) block range/i);
  const n = m ? Number(m[1]) : 10;
  return BigInt(Math.max(1, Math.min(n, 5000)));
}

async function startBlock(c: ChainConfig, latest: bigint): Promise<bigint> {
  const cur = await store.cursors.get(c.chainId);
  if (cur !== null) return BigInt(cur + 1);
  if (c.deployBlock && c.deployBlock > 0) return BigInt(c.deployBlock);
  const lb = BigInt(config.indexerLookbackBlocks);
  return latest > lb ? latest - lb : 0n;
}

export async function runIndexerOnce(chainId: number): Promise<RunResult> {
  const c = getChain(chainId);
  if (!c?.contracts.CoverMarket) return { chainId, fromBlock: 0, toBlock: 0, logs: 0, policiesTouched: 0, skipped: "not deployed" };
  if (running.has(chainId)) return { chainId, fromBlock: 0, toBlock: 0, logs: 0, policiesTouched: 0, skipped: "already running" };
  running.add(chainId);
  const market = c.contracts.CoverMarket;
  try {
    const client = getPublicClient(chainId);
    const latest = await client.getBlockNumber();
    const safeHead = latest - BigInt(config.indexerConfirmations);
    let from = await startBlock(c, safeHead);
    const touched = new Set<string>();
    const buyers = new Set<string>();
    let logsSeen = 0;
    const firstFrom = from;
    if (from > safeHead) {
      const r = { chainId, fromBlock: Number(from), toBlock: Number(safeHead), logs: 0, policiesTouched: 0 };
      lastRun.set(chainId, { ...r, at: nowSec() });
      return r;
    }
    let chunkSize = chunkByChain.get(chainId) ?? BigInt(config.indexerChunkBlocks);
    while (from <= safeHead) {
      const to = from + chunkSize - 1n > safeHead ? safeHead : from + chunkSize - 1n;
      let logs;
      try {
        logs = await client.getLogs({ address: market, events: EVENTS, fromBlock: from, toBlock: to, strict: true });
      } catch (e) {
        // Providers cap the eth_getLogs range (Alchemy free tier: 10 blocks). Learn the cap once and retry smaller.
        const cap = rangeCapFrom((e as Error).message);
        if (cap && cap < chunkSize) {
          chunkSize = cap;
          chunkByChain.set(chainId, cap);
          logger.info({ chainId, chunkBlocks: Number(cap) }, "getLogs range capped by provider; using smaller chunks");
          continue;
        }
        throw e;
      }
      if (chunkSize <= 50n) await sleep(config.indexerSmallChunkDelayMs); // stay inside the provider's per-second budget
      logsSeen += logs.length;
      for (const log of logs) {
        const bn = Number(log.blockNumber ?? 0n);
        const tx = log.transactionHash ?? null;
        switch (log.eventName) {
          case "EpochOpened": {
            noteEpoch(chainId, { epochId: Number(log.args.epochId), bindDeadline: Number(log.args.bindDeadline), expectedOpen: Number(log.args.expectedOpen) });
            break;
          }
          case "CoverBought": {
            const id = Number(log.args.policyId);
            const existing = await store.policies.get(chainId, id);
            const tok = await findToken(chainId, log.args.token);
            let boughtAt: number | null = existing?.boughtAt ?? null;
            if (!boughtAt) {
              try {
                boughtAt = Number((await client.getBlock({ blockNumber: log.blockNumber as bigint })).timestamp);
              } catch {
                boughtAt = null;
              }
            }
            const doc: PolicyDoc = {
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
            await store.policies.upsert(doc);
            touched.add(`${id}`);
            buyers.add(doc.buyer);
            break;
          }
          case "CoverSettled":
          case "CoverRefunded": {
            const id = Number(log.args.policyId);
            let doc = await store.policies.get(chainId, id);
            if (!doc) doc = await fetchPolicyFromChain(c, id, bn);
            if (!doc) break;
            let settledAt: number | null = doc.settledAt;
            if (!settledAt) {
              try {
                settledAt = Number((await client.getBlock({ blockNumber: log.blockNumber as bigint })).timestamp);
              } catch {
                settledAt = null;
              }
            }
            if (log.eventName === "CoverSettled") {
              doc.status = "Settled";
              doc.gapBps = Number(log.args.gapBps);
              doc.payoutUsd = log.args.payoutUsd.toString();
            } else {
              doc.status = "Refunded";
              doc.refundReason = log.args.reason;
            }
            doc.settledAt = settledAt;
            doc.settleTx = tx;
            doc.blockNumber = Math.max(doc.blockNumber, bn);
            await store.policies.upsert(doc);
            touched.add(`${id}`);
            buyers.add(doc.buyer);
            break;
          }
        }
      }
      await store.cursors.set(chainId, Number(to));
      from = to + 1n;
    }
    for (const b of buyers) await recomputeStats(chainId, b);
    const r = { chainId, fromBlock: Number(firstFrom), toBlock: Number(safeHead), logs: logsSeen, policiesTouched: touched.size };
    lastRun.set(chainId, { ...r, at: nowSec() });
    if (logsSeen > 0) logger.info(r, "indexer pass");
    return r;
  } catch (e) {
    const msg = (e as Error).message;
    logger.warn({ chainId, err: msg.slice(0, 300) }, "indexer pass failed");
    const prev = lastRun.get(chainId);
    lastRun.set(chainId, { chainId, fromBlock: prev?.fromBlock ?? 0, toBlock: prev?.toBlock ?? 0, logs: 0, policiesTouched: 0, at: nowSec(), error: msg.slice(0, 300) });
    return { chainId, fromBlock: 0, toBlock: 0, logs: 0, policiesTouched: 0, skipped: msg.slice(0, 200) };
  } finally {
    running.delete(chainId);
  }
}

/** Derives streaks and totals for one buyer from their indexed policies. */
export function computeStats(chainId: number, address: string, policies: PolicyDoc[]): UserStatsDoc {
  const protectedEpochs = [...new Set(policies.filter((p) => p.status !== "Refunded").map((p) => p.epochId))].sort((a, b) => a - b);
  let longest = 0;
  let run = 0;
  let prev: number | null = null;
  for (const e of protectedEpochs) {
    run = prev !== null && e - prev === WEEK ? run + 1 : 1;
    prev = e;
    if (run > longest) longest = run;
  }
  // current streak: the run ending at the latest protected epoch, alive only if that epoch is this weekend's or last weekend's
  const current = nextFridayClose(nowSec(), config.epochCloseHourUtc);
  const last = protectedEpochs[protectedEpochs.length - 1];
  const currentStreak = last !== undefined && current - last <= WEEK ? run : 0;
  let premiums = 0n;
  let payouts = 0n;
  let held = 0;
  let paid = 0;
  for (const p of policies) {
    if (p.status === "Refunded") continue;
    premiums += BigInt(p.premiumUsd || "0");
    if (p.status === "Settled") {
      const po = BigInt(p.payoutUsd || "0");
      payouts += po;
      if (po > 0n) paid++;
      else held++;
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

export async function recomputeStats(chainId: number, address: string): Promise<UserStatsDoc> {
  const policies = await store.policies.byBuyer(chainId, address);
  const s = computeStats(chainId, address, policies);
  await store.stats.upsert(s);
  return s;
}

export async function resetCursor(chainId: number, fromBlock?: number): Promise<void> {
  await store.policies.clear(chainId);
  if (fromBlock !== undefined && fromBlock >= 0) await store.cursors.set(chainId, fromBlock - 1);
  else await store.cursors.clear(chainId);
}

export async function runIndexerAll(): Promise<RunResult[]> {
  const out: RunResult[] = [];
  for (const c of deployedChains()) out.push(await runIndexerOnce(c.chainId));
  return out;
}

export function startIndexer(): void {
  if (!config.indexerEnabled) {
    logger.warn("indexer disabled (INDEXER_ENABLED=false)");
    return;
  }
  const chains = deployedChains();
  if (chains.length === 0) {
    logger.warn("indexer idle: no chain has a CoverMarket address (add deployments/<network>.json or CONTRACT_COVER_MARKET_<chainId>)");
    return;
  }
  const tick = () => void runIndexerAll();
  setTimeout(tick, 2_000);
  timer = setInterval(tick, config.indexerIntervalMs);
  timer.unref();
  logger.info({ chains: chains.map((c) => c.chainId), intervalMs: config.indexerIntervalMs }, "indexer started");
}

export function stopIndexer(): void {
  if (timer) clearInterval(timer);
  timer = null;
}

export function indexerStatus() {
  return Object.fromEntries([...lastRun.entries()].map(([k, v]) => [k, v]));
}

/** Live on-chain fallback for /policies when the store has nothing for a buyer (fresh memory store, Mongo down). */
export async function policiesFromChain(chainId: number, buyer: Address): Promise<PolicyDoc[]> {
  const c = getChain(chainId);
  if (!c?.contracts.CoverMarket) return [];
  try {
    const ids = await getPublicClient(chainId).readContract({ address: c.contracts.CoverMarket, abi: CoverMarketAbi, functionName: "policiesOf", args: [buyer] });
    const docs: PolicyDoc[] = [];
    for (const id of ids.slice(-200)) {
      const d = await fetchPolicyFromChain(c, Number(id));
      if (d) docs.push(d);
    }
    return docs.sort((a, b) => b.epochId - a.epochId || b.policyId - a.policyId);
  } catch (e) {
    logger.warn({ chainId, buyer, err: (e as Error).message }, "policiesOf fallback failed");
    return [];
  }
}
