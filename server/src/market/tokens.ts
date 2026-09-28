/**
 * Token registry per chain: deployment file / env tokens merged with the on-chain CoverMarket.tokens() list
 * (symbols read from the ERC20), cached 5 minutes. Also resolves epochs: deployment file + indexed EpochOpened
 * events + on-chain `epochs(id)` checks.
 */
import type { Address } from "viem";
import { CoverMarketAbi, MockERC20Abi } from "../abi";
import { getPublicClient } from "../chains";
import { config, getChain, tickerFromSymbol, wrapperFor, type ChainConfig, type EpochInfo, type TokenInfo } from "../config";
import { logger } from "../logger";
import { KeyedTtlCache } from "../util/http";
import { expectedOpenFor, nextFridayClose, nowSec, WEEK } from "../util/time";

const tokenCache = new KeyedTtlCache<TokenInfo[]>(5 * 60_000, "tokens");
const epochCache = new KeyedTtlCache<{ exists: boolean; bindDeadline: number; expectedOpen: number }>(60_000, "epoch");
const indexedEpochs = new Map<number, Map<number, EpochInfo>>();

async function fetchChainTokens(c: ChainConfig): Promise<TokenInfo[]> {
  const base = [...c.tokens];
  if (!c.contracts.CoverMarket) return base;
  try {
    const client = getPublicClient(c.chainId);
    const addrs = await client.readContract({ address: c.contracts.CoverMarket, abi: CoverMarketAbi, functionName: "tokens" });
    const unknown = addrs.filter((a) => !base.find((t) => t.address.toLowerCase() === a.toLowerCase()));
    if (unknown.length > 0) {
      const results = await client.multicall({
        contracts: unknown.flatMap((a) => [
          { address: a, abi: MockERC20Abi, functionName: "symbol" } as const,
          { address: a, abi: MockERC20Abi, functionName: "name" } as const,
          { address: a, abi: MockERC20Abi, functionName: "decimals" } as const,
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
          ticker: tickerFromSymbol(symbol),
          name: typeof name === "string" && name ? name : symbol,
          decimals: typeof dec === "number" ? dec : 18,
          wrapper: wrapperFor(symbol),
        });
      });
    }
    // allowed flags: drop tokens the market no longer allows
    const allowed = await client.multicall({
      contracts: base.map((t) => ({ address: c.contracts.CoverMarket as Address, abi: CoverMarketAbi, functionName: "tokenAllowed", args: [t.address] }) as const),
      allowFailure: true,
    });
    return base.filter((_, i) => allowed[i]?.status !== "success" || allowed[i]?.result !== false);
  } catch (e) {
    logger.warn({ chainId: c.chainId, err: (e as Error).message }, "could not read tokens from chain; using configured list");
    return base;
  }
}

export async function getTokens(chainId: number): Promise<TokenInfo[]> {
  const c = getChain(chainId);
  if (!c) return [];
  return tokenCache.get(String(chainId), () => fetchChainTokens(c));
}

export async function findToken(chainId: number, address: string): Promise<TokenInfo | null> {
  const tokens = await getTokens(chainId);
  return tokens.find((t) => t.address.toLowerCase() === address.toLowerCase()) ?? null;
}

export function noteEpoch(chainId: number, e: EpochInfo): void {
  let m = indexedEpochs.get(chainId);
  if (!m) {
    m = new Map();
    indexedEpochs.set(chainId, m);
  }
  m.set(e.epochId, e);
  epochCache.entry(`${chainId}:${e.epochId}`).set({ exists: true, bindDeadline: e.bindDeadline, expectedOpen: e.expectedOpen });
}

/** Known epochs for a chain: deployment file + indexed events, sorted. */
export function knownEpochs(chainId: number): EpochInfo[] {
  const c = getChain(chainId);
  const m = new Map<number, EpochInfo>();
  for (const e of c?.epochs ?? []) m.set(e.epochId, e);
  for (const e of indexedEpochs.get(chainId)?.values() ?? []) m.set(e.epochId, e);
  return [...m.values()].sort((a, b) => a.epochId - b.epochId);
}

/** On-chain epoch lookup, cached 60s. null when the chain is not deployed or unreachable. */
export async function epochOnChain(chainId: number, epochId: number): Promise<{ exists: boolean; bindDeadline: number; expectedOpen: number } | null> {
  const c = getChain(chainId);
  if (!c?.contracts.CoverMarket) return null;
  try {
    return await epochCache.get(`${chainId}:${epochId}`, async () => {
      const [bindDeadline, expectedOpen, exists] = await getPublicClient(chainId).readContract({
        address: c.contracts.CoverMarket as Address,
        abi: CoverMarketAbi,
        functionName: "epochs",
        args: [BigInt(epochId)],
      });
      return { exists, bindDeadline: Number(bindDeadline), expectedOpen: Number(expectedOpen) };
    });
  } catch (e) {
    logger.debug({ chainId, epochId, err: (e as Error).message }, "epoch read failed");
    return null;
  }
}

export interface CurrentEpoch extends EpochInfo {
  openOnChain: boolean | null;
  source: "chain" | "deployment" | "computed";
}

/**
 * The epoch a quote should bind to: the computed next Friday close (same rule as deploy.ts). If a known epoch with
 * a later bind deadline exists but the computed one does not exist on-chain, still return the computed one and flag it.
 */
export async function currentEpoch(chainId: number): Promise<CurrentEpoch> {
  const now = nowSec();
  const computed = nextFridayClose(now, config.epochCloseHourUtc);
  const known = knownEpochs(chainId).find((e) => e.bindDeadline >= now);
  const candidate = known && known.epochId <= computed ? known.epochId : computed;
  const chain = await epochOnChain(chainId, candidate);
  if (chain?.exists) return { epochId: candidate, bindDeadline: chain.bindDeadline, expectedOpen: chain.expectedOpen, openOnChain: true, source: "chain" };
  if (known && known.epochId === candidate) return { ...known, openOnChain: chain ? false : null, source: "deployment" };
  return { epochId: candidate, bindDeadline: candidate, expectedOpen: expectedOpenFor(candidate), openOnChain: chain ? false : null, source: "computed" };
}

/** Next two epochs after now (for openEpoch on Mondays). */
export function upcomingEpochs(count = 2): EpochInfo[] {
  const first = nextFridayClose(nowSec(), config.epochCloseHourUtc);
  return Array.from({ length: count }, (_, k) => {
    const id = first + k * WEEK;
    return { epochId: id, bindDeadline: id, expectedOpen: expectedOpenFor(id) };
  });
}

export function invalidateTokens(chainId?: number): void {
  if (chainId === undefined) tokenCache.invalidateAll();
  else tokenCache.entry(String(chainId)).invalidate();
}
