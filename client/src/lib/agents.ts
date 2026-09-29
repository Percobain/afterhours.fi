import { API_BASE } from "./api";
import type { HermeeEvent } from "./hermee/core";

/** Kip's Agent Studio agent (the underwriter that sells cover over x402) */
export const KIP_URL = (process.env.NEXT_PUBLIC_KIP_AGENT_URL || "https://afterhours-kip.onrender.com").replace(/\/+$/, "");

/** Kip's ERC-8004 identity, registered with `bag erc8004 register` (gas-free via MegaFuel on BSC Testnet) */
export const KIP_IDENTITY = {
  agentId: 2530,
  registry: "0x8004A818BFB912233c491871b3d84c89A494BD9e",
  chainId: 97,
  agentCard: `${KIP_URL}/.well-known/agent-card.json`,
} as const;

export const X402_CONTRACTS = {
  permit2: "0x000000000022D473030F116dDEE9F6B43aC78BA3",
  proxy: "0x402085c248EeA27D92E8b30b2C58ed07f9E20001",
} as const;

export interface KipStatus {
  address: string;
  chainId: number;
  authorisedBinder: boolean;
  balances: { nativeWei: string; usdt: string };
  sells: { method: string; path: string; payment: string; facilitator: string };
  mcp: { path: string; tools: string[] };
  keeper: { lastRunAt: number; lastSettleTx: string | null; lastError: string | null; settled: number; openPolicies: number; intervalMs: number };
  market: string;
}

export interface DemoInfo {
  enabled: boolean;
  kipUrl: string | null;
  hermee: string | null;
  chainId: number;
  busy: boolean;
  cooldownSeconds: number;
}

export type AgentEventKind = "x402_verified" | "x402_settled" | "x402_failed" | "cover_bound" | "policy_settled" | "feedback";

export interface AgentEvent {
  chainId: number;
  kind: AgentEventKind;
  payer: string | null;
  payee: string | null;
  amount: string | null;
  tx: string | null;
  policyId: number | null;
  note: string;
  at: string;
}

export interface DemoResult {
  ok: boolean;
  policyId?: string | null;
  bindTx?: string | null;
  paymentTx?: string | null;
  premiumUsd?: string | null;
  hermee?: string;
  explorer?: string;
  error?: string;
}

async function getJson<T>(url: string, timeoutMs = 20_000): Promise<T | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), headers: { accept: "application/json" } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

// Render's free instances can take ~50s to wake, so the agent reads get a longer timeout than the rest of the app
export const fetchKipStatus = () => getJson<KipStatus>(`${KIP_URL}/afterhours/status`, 60_000);
export const fetchDemoInfo = () => (API_BASE ? getJson<DemoInfo>(`${API_BASE}/agents/demo`, 60_000) : Promise.resolve(null));
export const fetchAgentActivity = (chainId: number) =>
  API_BASE ? getJson<{ events: AgentEvent[] }>(`${API_BASE}/agents/activity?chainId=${chainId}&limit=30`, 60_000).then((r) => r?.events ?? []) : Promise.resolve([] as AgentEvent[]);

/**
 * Run the live demo: the server runs Hermee's agent against Kip's agent and streams each step as server-sent events.
 * EventSource cannot POST, so this reads the event stream from fetch.
 */
export async function runAgentDemo(
  body: { token: string; amountUsd: number; floorPct: number },
  onStep: (e: HermeeEvent) => void,
  signal?: AbortSignal,
): Promise<DemoResult> {
  if (!API_BASE) return { ok: false, error: "The pricing server is not connected to this deployment" };
  const res = await fetch(`${API_BASE}/agents/demo/protect`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal });
  if (!res.ok || !res.body) {
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    return { ok: false, error: j.error ?? `HTTP ${res.status}` };
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let result: DemoResult = { ok: false, error: "the stream ended before a result" };
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buf.indexOf("\n\n")) >= 0) {
      const chunk = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      let event = "message";
      let data = "";
      for (const line of chunk.split("\n")) {
        if (line.startsWith("event: ")) event = line.slice(7);
        else if (line.startsWith("data: ")) data += line.slice(6);
      }
      if (!data) continue;
      const parsed = JSON.parse(data) as unknown;
      if (event === "step") onStep(parsed as HermeeEvent);
      else if (event === "result") result = parsed as DemoResult;
    }
  }
  return result;
}
