/**
 * Oracle keeper jobs, all signed by QUOTER_PRIVATE_KEY (whitelisted as an oracle keeper by the deploy script):
 *   - Friday at the bell: postCloseBatch for every allowed token.
 *   - Monday at expectedOpen: postOpenBatch once a non-null underlying print exists (retry every 2 min for 2 h),
 *     then settleBatch of open policy ids in chunks of 50.
 *   - Monday: openEpoch for the next two epochs (owner-only; logs the contracts/ command when the quoter is not the owner).
 */
import type { Address, Hex } from "viem";
import { CoverMarketAbi, ReferenceOracleAbi } from "../abi";
import { getPublicClient, getWalletClient, quoterAddress, requireWallet } from "../chains";
import { config, deployedChains, getChain, type ChainConfig, type TokenInfo } from "../config";
import { runIndexerOnce } from "../indexer";
import { logger } from "../logger";
import { getUnderlyingPrice, getUnderlyingPrint, type PriceResult } from "../market/prices";
import { epochOnChain, getTokens, invalidateTokens, knownEpochs, noteEpoch, upcomingEpochs } from "../market/tokens";
import { store } from "../store";
import { ApiError } from "../util/errors";
import { chunk } from "../util/http";
import { expectedOpenFor, isMondayUtc, iso, nextFridayClose, nowSec, WEEK } from "../util/time";

export interface PostResult {
  chainId: number;
  epochId: number;
  posted: { symbol: string; token: Address; price8: string; source: string }[];
  skipped: { symbol: string; reason: string }[];
  tx: Hex | null;
  note?: string;
}

export interface SettleResult {
  chainId: number;
  epochId: number | null;
  candidates: number;
  txs: Hex[];
  settled: number;
  note?: string;
}

interface EpochRef {
  closePrice: bigint;
  openPrice: bigint;
  voided: boolean;
  voidReason: string;
}

const openAttempts = new Map<string, number>(); // `${chainId}:${epochId}` -> last attempt (sec)
const epochsOpenedOn = new Map<number, number>(); // chainId -> day index when openNextEpochs last ran
let ticking = false;

async function readRefs(c: ChainConfig, epochId: number, tokens: TokenInfo[]): Promise<Map<string, EpochRef>> {
  const oracle = c.contracts.ReferenceOracle as Address;
  const res = await getPublicClient(c.chainId).multicall({
    contracts: tokens.map((t) => ({ address: oracle, abi: ReferenceOracleAbi, functionName: "getRef", args: [t.address, BigInt(epochId)] }) as const),
    allowFailure: true,
  });
  const out = new Map<string, EpochRef>();
  tokens.forEach((t, i) => {
    const r = res[i];
    if (r?.status === "success") {
      const v = r.result;
      out.set(t.address.toLowerCase(), { closePrice: v.closePrice, openPrice: v.openPrice, voided: v.voided, voidReason: v.voidReason });
    }
  });
  return out;
}

async function sendOracle(c: ChainConfig, functionName: "postCloseBatch" | "postOpenBatch", tokens: Address[], epochId: number, prices: bigint[]): Promise<Hex> {
  const wallet = requireWallet(c.chainId);
  const client = getPublicClient(c.chainId);
  const { request } = await client.simulateContract({
    account: wallet.account,
    address: c.contracts.ReferenceOracle as Address,
    abi: ReferenceOracleAbi,
    functionName,
    args: [tokens, BigInt(epochId), prices],
  });
  const hash = await wallet.writeContract(request);
  const receipt = await client.waitForTransactionReceipt({ hash, confirmations: 1, timeout: 180_000 });
  if (receipt.status !== "success") throw new Error(`${functionName} reverted in ${hash}`);
  return hash;
}

function requireDeployed(chainId: number): ChainConfig {
  const c = getChain(chainId);
  if (!c) throw new ApiError(400, "unsupported_chain", `chainId ${chainId} is not supported`);
  if (!c.contracts.CoverMarket || !c.contracts.ReferenceOracle) throw new ApiError(503, "not_deployed", `afterhours.fi is not deployed on ${c.name} yet`);
  return c;
}

/** Push live per-share prices to ReferenceOracle.setLastPrices (used by the holding check and the UI). */
export async function setLastPrices(chainId: number, overrides: Record<string, number> = {}): Promise<{ tx: Hex | null; prices: { symbol: string; price8: string; source: string }[] }> {
  const c = requireDeployed(chainId);
  const tokens = await getTokens(chainId);
  const addrs: Address[] = [];
  const vals: bigint[] = [];
  const out: { symbol: string; price8: string; source: string }[] = [];
  for (const t of tokens) {
    const ov = overrides[t.symbol] ?? overrides[t.ticker];
    let price8: string | null = null;
    let source = "override";
    if (ov && Number.isFinite(ov) && ov > 0) price8 = BigInt(Math.round(ov * 1e8)).toString();
    else {
      const live = await getUnderlyingPrice(t);
      if (live) {
        price8 = live.price8;
        source = live.source;
      }
    }
    if (!price8 || price8 === "0") continue;
    addrs.push(t.address);
    vals.push(BigInt(price8));
    out.push({ symbol: t.symbol, price8, source });
  }
  if (addrs.length === 0) return { tx: null, prices: [] };
  const wallet = requireWallet(chainId);
  const client = getPublicClient(chainId);
  const { request } = await client.simulateContract({ account: wallet.account, address: c.contracts.ReferenceOracle as Address, abi: ReferenceOracleAbi, functionName: "setLastPrices", args: [addrs, vals] });
  const hash = await wallet.writeContract(request);
  await client.waitForTransactionReceipt({ hash, timeout: 180_000 });
  logger.info({ chainId, tx: hash, n: addrs.length }, "setLastPrices");
  return { tx: hash, prices: out };
}

/** Friday close: post the last available underlying price for every allowed token that has no close yet. */
export async function postClose(chainId: number, epochId: number, overrides: Record<string, number> = {}): Promise<PostResult> {
  const c = requireDeployed(chainId);
  const tokens = await getTokens(chainId);
  const refs = await readRefs(c, epochId, tokens);
  const posted: PostResult["posted"] = [];
  const skipped: PostResult["skipped"] = [];
  const addrs: Address[] = [];
  const vals: bigint[] = [];
  for (const t of tokens) {
    const ref = refs.get(t.address.toLowerCase());
    if (ref && ref.closePrice > 0n) {
      skipped.push({ symbol: t.symbol, reason: "close already posted" });
      continue;
    }
    const ov = overrides[t.symbol] ?? overrides[t.ticker];
    let price: PriceResult | null = null;
    if (ov && ov > 0) price = { ticker: t.ticker, price: ov, price8: BigInt(Math.round(ov * 1e8)).toString(), source: "override", asof: nowSec(), stale: false, stockPrintNull: false, tokenPrice: null, sharesMultiplier: null, rwaContract: null };
    else price = await getUnderlyingPrice(t);
    if (!price) {
      skipped.push({ symbol: t.symbol, reason: "no price available" });
      continue;
    }
    addrs.push(t.address);
    vals.push(BigInt(price.price8));
    posted.push({ symbol: t.symbol, token: t.address, price8: price.price8, source: price.source });
  }
  let tx: Hex | null = null;
  if (addrs.length > 0) {
    tx = await sendOracle(c, "postCloseBatch", addrs, epochId, vals);
    for (const p of posted) await store.epochPrices.upsert({ chainId, epochId, token: p.token, symbol: p.symbol, closePrice: p.price8, closeSource: p.source, closeTx: tx, closePostedAt: nowSec() });
    logger.info({ chainId, epochId, tx, n: addrs.length }, "postCloseBatch");
  }
  return { chainId, epochId, posted, skipped, tx };
}

/**
 * Monday open: post the first non-null underlying print for tokens that have a close but no open.
 * With allowFallback the best available price is used instead (after the retry window, or on admin request).
 */
export async function postOpen(chainId: number, epochId: number, opts: { overrides?: Record<string, number>; allowFallback?: boolean } = {}): Promise<PostResult> {
  const c = requireDeployed(chainId);
  const tokens = await getTokens(chainId);
  const refs = await readRefs(c, epochId, tokens);
  const posted: PostResult["posted"] = [];
  const skipped: PostResult["skipped"] = [];
  const addrs: Address[] = [];
  const vals: bigint[] = [];
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
    let price: PriceResult | null = null;
    if (ov && ov > 0) price = { ticker: t.ticker, price: ov, price8: BigInt(Math.round(ov * 1e8)).toString(), source: "override", asof: nowSec(), stale: false, stockPrintNull: false, tokenPrice: null, sharesMultiplier: null, rwaContract: null };
    else {
      price = await getUnderlyingPrint(t);
      if (!price && opts.allowFallback) price = await getUnderlyingPrice(t);
    }
    if (!price) {
      skipped.push({ symbol: t.symbol, reason: "underlying print not available yet (stockInfo.price is null)" });
      continue;
    }
    addrs.push(t.address);
    vals.push(BigInt(price.price8));
    posted.push({ symbol: t.symbol, token: t.address, price8: price.price8, source: price.source });
  }
  let tx: Hex | null = null;
  if (addrs.length > 0) {
    tx = await sendOracle(c, "postOpenBatch", addrs, epochId, vals);
    for (const p of posted) await store.epochPrices.upsert({ chainId, epochId, token: p.token, symbol: p.symbol, openPrice: p.price8, openSource: p.source, openTx: tx, openPostedAt: nowSec() });
    logger.info({ chainId, epochId, tx, n: addrs.length }, "postOpenBatch");
  }
  return { chainId, epochId, posted, skipped, tx };
}

export async function voidEpoch(chainId: number, token: Address, epochId: number, reason: string): Promise<Hex> {
  const c = requireDeployed(chainId);
  const wallet = requireWallet(chainId);
  const client = getPublicClient(chainId);
  const { request } = await client.simulateContract({ account: wallet.account, address: c.contracts.ReferenceOracle as Address, abi: ReferenceOracleAbi, functionName: "voidEpoch", args: [token, BigInt(epochId), reason] });
  const hash = await wallet.writeContract(request);
  await client.waitForTransactionReceipt({ hash, timeout: 180_000 });
  await store.epochPrices.upsert({ chainId, epochId, token, voided: true, voidReason: reason });
  logger.info({ chainId, epochId, token, reason, tx: hash }, "voidEpoch");
  return hash;
}

/** Open policy ids from the store; when the store is empty, scan the chain (policyCount + getPolicy). */
async function collectOpenPolicyIds(c: ChainConfig, epochId?: number): Promise<number[]> {
  const fromStore = await store.policies.open(c.chainId, epochId);
  if (fromStore.length > 0 || (await store.policies.count(c.chainId)) > 0) return fromStore.map((p) => p.policyId);
  const client = getPublicClient(c.chainId);
  const market = c.contracts.CoverMarket as Address;
  const count = Number(await client.readContract({ address: market, abi: CoverMarketAbi, functionName: "policyCount" }));
  const ids: number[] = [];
  const all = Array.from({ length: Math.min(count, 5_000) }, (_, i) => count - 1 - i);
  for (const batch of chunk(all, 200)) {
    const res = await client.multicall({ contracts: batch.map((id) => ({ address: market, abi: CoverMarketAbi, functionName: "getPolicy", args: [BigInt(id)] }) as const), allowFailure: true });
    res.forEach((r, i) => {
      if (r.status === "success" && r.result.status === 1 && (epochId === undefined || Number(r.result.epochId) === epochId)) ids.push(batch[i] as number);
    });
  }
  return ids.sort((a, b) => a - b);
}

/** settleBatch every open policy whose epoch is settleable (the contract skips the others), in chunks of 50. */
export async function settleEpoch(chainId: number, epochId?: number): Promise<SettleResult> {
  const c = requireDeployed(chainId);
  const ids = await collectOpenPolicyIds(c, epochId);
  if (ids.length === 0) return { chainId, epochId: epochId ?? null, candidates: 0, txs: [], settled: 0, note: "no open policies" };
  // keep only ids whose epoch is settleable to avoid paying gas for no-ops
  const oracle = c.contracts.ReferenceOracle as Address;
  const market = c.contracts.CoverMarket as Address;
  const client = getPublicClient(chainId);
  const docs = new Map<number, { token: Address; epochId: number }>();
  for (const id of ids) {
    const d = await store.policies.get(chainId, id);
    if (d) docs.set(id, { token: d.token as Address, epochId: d.epochId });
  }
  const missing = ids.filter((id) => !docs.has(id));
  if (missing.length > 0) {
    const res = await client.multicall({ contracts: missing.map((id) => ({ address: market, abi: CoverMarketAbi, functionName: "getPolicy", args: [BigInt(id)] }) as const), allowFailure: true });
    res.forEach((r, i) => {
      if (r.status === "success") docs.set(missing[i] as number, { token: r.result.token, epochId: Number(r.result.epochId) });
    });
  }
  const keys = [...new Set([...docs.values()].map((d) => `${d.token.toLowerCase()}:${d.epochId}`))];
  const settleable = new Set<string>();
  const checks = await client.multicall({
    contracts: keys.map((k) => {
      const [token, e] = k.split(":") as [string, string];
      return { address: oracle, abi: ReferenceOracleAbi, functionName: "isSettleable", args: [token as Address, BigInt(e)] } as const;
    }),
    allowFailure: true,
  });
  checks.forEach((r, i) => {
    if (r.status === "success" && r.result[0]) settleable.add(keys[i] as string);
  });
  const ready = ids.filter((id) => {
    const d = docs.get(id);
    return d && settleable.has(`${d.token.toLowerCase()}:${d.epochId}`);
  });
  if (ready.length === 0) return { chainId, epochId: epochId ?? null, candidates: ids.length, txs: [], settled: 0, note: "no open policy is settleable yet (missing open print or voided flag)" };
  const wallet = requireWallet(chainId);
  const txs: Hex[] = [];
  for (const batch of chunk(ready, config.settleChunk)) {
    const { request } = await client.simulateContract({ account: wallet.account, address: market, abi: CoverMarketAbi, functionName: "settleBatch", args: [batch.map((id) => BigInt(id))] });
    const hash = await wallet.writeContract(request);
    const receipt = await client.waitForTransactionReceipt({ hash, timeout: 180_000 });
    if (receipt.status !== "success") logger.error({ chainId, hash }, "settleBatch reverted");
    else txs.push(hash);
    logger.info({ chainId, hash, n: batch.length }, "settleBatch");
  }
  void runIndexerOnce(chainId);
  return { chainId, epochId: epochId ?? null, candidates: ids.length, txs, settled: ready.length };
}

export interface OpenEpochsResult {
  chainId: number;
  opened: number[];
  existing: number[];
  txs: Hex[];
  skipped?: string;
  instruction?: string;
}

/** openEpoch for the next two epochs. Owner-only on the market: when the quoter is not the owner, log the manual command. */
export async function openNextEpochs(chainId: number): Promise<OpenEpochsResult> {
  const c = requireDeployed(chainId);
  const market = c.contracts.CoverMarket as Address;
  const client = getPublicClient(chainId);
  const targets = upcomingEpochs(2);
  const existing: number[] = [];
  const todo: typeof targets = [];
  for (const e of targets) {
    const on = await epochOnChain(chainId, e.epochId);
    if (on?.exists) existing.push(e.epochId);
    else todo.push(e);
  }
  if (todo.length === 0) return { chainId, opened: [], existing, txs: [] };
  const instruction = `cd contracts && npm run epoch:${c.key}   # opens ${todo.map((e) => e.epochId).join(", ")} with the owner key`;
  const wallet = getWalletClient(chainId);
  const owner = await client.readContract({ address: market, abi: CoverMarketAbi, functionName: "owner" });
  const me = quoterAddress();
  if (!wallet || !me || owner.toLowerCase() !== me.toLowerCase()) {
    logger.warn({ chainId, owner, quoter: me, missing: todo.map((e) => e.epochId) }, `openEpoch is owner-only and the quoter is not the owner. Run: ${instruction}`);
    return { chainId, opened: [], existing, txs: [], skipped: "quoter is not the market owner", instruction };
  }
  const txs: Hex[] = [];
  const opened: number[] = [];
  for (const e of todo) {
    const { request } = await client.simulateContract({ account: wallet.account, address: market, abi: CoverMarketAbi, functionName: "openEpoch", args: [BigInt(e.epochId), BigInt(e.bindDeadline), BigInt(e.expectedOpen)] });
    const hash = await wallet.writeContract(request);
    await client.waitForTransactionReceipt({ hash, timeout: 180_000 });
    noteEpoch(chainId, e);
    txs.push(hash);
    opened.push(e.epochId);
    logger.info({ chainId, epochId: e.epochId, tx: hash }, "openEpoch");
  }
  invalidateTokens(chainId);
  return { chainId, opened, existing, txs };
}

/** Epochs that could need keeper action right now: the last two weekly epochs plus the current one. */
function candidateEpochs(chainId: number): number[] {
  const now = nowSec();
  const current = nextFridayClose(now, config.epochCloseHourUtc);
  const set = new Set<number>([current, current - WEEK, current - 2 * WEEK]);
  for (const e of knownEpochs(chainId)) if (e.epochId >= current - 2 * WEEK && e.epochId <= current) set.add(e.epochId);
  return [...set].sort((a, b) => a - b);
}

async function tickChain(c: ChainConfig): Promise<void> {
  const now = nowSec();
  const tokens = await getTokens(c.chainId);
  if (tokens.length === 0) return;
  for (const epochId of candidateEpochs(c.chainId)) {
    const open = expectedOpenFor(epochId);
    const refs = await readRefs(c, epochId, tokens);
    const missingClose = tokens.filter((t) => (refs.get(t.address.toLowerCase())?.closePrice ?? 0n) === 0n);
    const missingOpen = tokens.filter((t) => {
      const r = refs.get(t.address.toLowerCase());
      return r && r.closePrice > 0n && r.openPrice === 0n && !r.voided;
    });

    // Friday bell: post closes within the close window
    if (missingClose.length > 0 && now >= epochId && now <= epochId + config.closeWindowMinutes * 60) {
      try {
        const r = await postClose(c.chainId, epochId);
        logger.info({ chainId: c.chainId, epochId, posted: r.posted.length, skipped: r.skipped.length }, "friday close job");
      } catch (e) {
        logger.error({ chainId: c.chainId, epochId, err: (e as Error).message.slice(0, 300) }, "friday close job failed");
      }
    }

    // Monday open: retry every OPEN_RETRY_MINUTES for OPEN_RETRY_WINDOW_MINUTES, then allow the fallback price
    if (missingOpen.length > 0 && now >= open) {
      const key = `${c.chainId}:${epochId}`;
      const last = openAttempts.get(key) ?? 0;
      const sinceOpen = now - open;
      const withinWindow = sinceOpen <= (config.openRetryWindowMinutes + config.openFallbackAfterMinutes + 24 * 60) * 60;
      if (withinWindow && now - last >= config.openRetryMinutes * 60) {
        openAttempts.set(key, now);
        const allowFallback = sinceOpen >= config.openFallbackAfterMinutes * 60;
        try {
          const r = await postOpen(c.chainId, epochId, { allowFallback });
          if (r.posted.length > 0) logger.info({ chainId: c.chainId, epochId, posted: r.posted.map((p) => `${p.symbol}@${p.source}`), allowFallback }, "monday open job");
          else logger.info({ chainId: c.chainId, epochId, waiting: r.skipped.filter((s) => s.reason.startsWith("underlying")).length, minutesSinceOpen: Math.floor(sinceOpen / 60) }, "monday open job: no print yet");
        } catch (e) {
          logger.error({ chainId: c.chainId, epochId, err: (e as Error).message.slice(0, 300) }, "monday open job failed");
        }
      }
    }

    // Settle whatever is settleable for this epoch
    const anySettleable = tokens.some((t) => {
      const r = refs.get(t.address.toLowerCase());
      return r && (r.voided || (r.closePrice > 0n && r.openPrice > 0n));
    });
    if (anySettleable && now >= open) {
      const openPolicies = await store.policies.open(c.chainId, epochId);
      if (openPolicies.length > 0) {
        try {
          const r = await settleEpoch(c.chainId, epochId);
          if (r.settled > 0) logger.info({ chainId: c.chainId, epochId, settled: r.settled, txs: r.txs }, "settle job");
        } catch (e) {
          logger.error({ chainId: c.chainId, epochId, err: (e as Error).message.slice(0, 300) }, "settle job failed");
        }
      }
    }
  }

  // Monday: make sure the next two epochs exist
  if (isMondayUtc(now)) {
    const dayIdx = Math.floor(now / 86_400);
    if (epochsOpenedOn.get(c.chainId) !== dayIdx) {
      epochsOpenedOn.set(c.chainId, dayIdx);
      try {
        await openNextEpochs(c.chainId);
      } catch (e) {
        logger.error({ chainId: c.chainId, err: (e as Error).message.slice(0, 300) }, "open epochs job failed");
      }
    }
  }
}

export async function tick(): Promise<void> {
  if (ticking) return;
  ticking = true;
  try {
    for (const c of deployedChains()) {
      try {
        await tickChain(c);
      } catch (e) {
        logger.warn({ chainId: c.chainId, err: (e as Error).message.slice(0, 300) }, "epoch tick failed");
      }
    }
  } finally {
    ticking = false;
  }
}

export function jobsSummary() {
  const now = nowSec();
  const current = nextFridayClose(now, config.epochCloseHourUtc);
  return {
    signer: quoterAddress(),
    enabled: config.jobsEnabled && !!quoterAddress(),
    currentEpochId: current,
    bellAt: iso(current),
    expectedOpenAt: iso(expectedOpenFor(current)),
    openRetry: { everyMinutes: config.openRetryMinutes, windowMinutes: config.openRetryWindowMinutes, fallbackAfterMinutes: config.openFallbackAfterMinutes },
    lastOpenAttempts: Object.fromEntries([...openAttempts.entries()].map(([k, v]) => [k, iso(v)])),
  };
}
