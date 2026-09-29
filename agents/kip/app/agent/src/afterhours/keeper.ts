/**
 * Kip's autonomous runtime: keep the book it underwrote moving without a human.
 * Every KEEPER_INTERVAL_MS it checks the policies it bound; once the oracle has the Monday open (or the epoch is
 * voided) it calls settleBatch, so the vault pays each buyer by rule. Anyone may settle; Kip does it for its own book.
 */
import { isAddressEqual } from "viem";
import { AH } from "./config.js";
import { MARKET_ABI, ORACLE_ABI, agentAddress, encode, publicClient, sendTx } from "./chain.js";
import { api, deployment } from "./market.js";

const book = new Set<bigint>();
let timer: NodeJS.Timeout | null = null;
export const keeperState = { lastRunAt: 0, lastSettleTx: null as string | null, lastError: null as string | null, settled: 0 };

export function track(policyId: bigint): void {
  book.add(policyId);
}

export function bookSize(): number {
  return book.size;
}

/** rebuild the book after a restart from the server's agent activity feed (cover_bound rows paid to this agent) */
async function hydrate(): Promise<void> {
  try {
    const r = await api<{ events: { kind: string; payee: string | null; policyId: number | null }[] }>(`/api/agents/activity?chainId=${AH.chainId}&limit=200`);
    const me = agentAddress();
    for (const e of r.events) if (e.kind === "cover_bound" && e.policyId !== null && e.payee && isAddressEqual(e.payee as `0x${string}`, me)) book.add(BigInt(e.policyId));
  } catch (e) {
    keeperState.lastError = `hydrate: ${(e as Error).message}`;
  }
}

async function tick(): Promise<void> {
  keeperState.lastRunAt = Math.floor(Date.now() / 1000);
  if (book.size === 0) return;
  try {
    const dep = await deployment();
    const ready: bigint[] = [];
    for (const id of book) {
      const p = await publicClient.readContract({ address: dep.contracts.CoverMarket, abi: MARKET_ABI, functionName: "getPolicy", args: [id] });
      if (p.status !== 1) {
        book.delete(id); // settled or refunded already
        continue;
      }
      const [ok] = await publicClient.readContract({ address: dep.contracts.ReferenceOracle, abi: ORACLE_ABI, functionName: "isSettleable", args: [p.token, p.epochId] });
      if (ok) ready.push(id);
    }
    if (ready.length) {
      const { hash } = await sendTx(dep.contracts.CoverMarket, encode(MARKET_ABI, "settleBatch", [ready]));
      keeperState.lastSettleTx = hash;
      keeperState.settled += ready.length;
      for (const id of ready) book.delete(id);
      console.log(`[kip] settled ${ready.length} polic${ready.length === 1 ? "y" : "ies"} in ${hash}`);
    }
    keeperState.lastError = null;
  } catch (e) {
    keeperState.lastError = (e as Error).message.split("\n")[0] ?? "keeper error";
  }
}

export function startKeeper(): void {
  if (timer) return;
  void hydrate().then(tick);
  timer = setInterval(() => void tick(), AH.keeperIntervalMs);
  timer.unref?.();
}
