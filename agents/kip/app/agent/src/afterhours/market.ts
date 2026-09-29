/** Read side: deployment addresses, quotes and market data from the afterhours.fi pricing server. */
import type { Address, Hex } from "viem";
import { AH } from "./config.js";

export interface Deployment {
  chainId: number;
  explorer: string;
  contracts: { CoverMarket: Address; KeeperVault: Address; ReferenceOracle: Address; USDT: Address };
  tokens: { symbol: string; address: Address; ticker: string; name: string; decimals: number; wrapper: string }[];
}

export interface QuoteWire {
  buyer: Address;
  token: Address;
  epochId: number;
  notionalUsd: string;
  barrierBps: number;
  premiumUsd: string;
  expiry: number;
  nonce: string;
}

export interface QuoteResponse {
  quote: QuoteWire;
  signature: Hex | null;
  estimatedValue?: { fairBp?: number; chargedBp?: number; breachProbability?: number; [k: string]: unknown };
  [k: string]: unknown;
}

export class UpstreamError extends Error {
  constructor(
    public status: number,
    message: string,
    public body: unknown,
  ) {
    super(message);
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${AH.api}${path}`, { ...init, signal: AbortSignal.timeout(20_000), headers: { accept: "application/json", ...(init?.headers ?? {}) } });
  const text = await res.text();
  const body = text ? (JSON.parse(text) as unknown) : null;
  if (!res.ok) {
    const b = body as { reason?: string; error?: string } | null;
    throw new UpstreamError(res.status, b?.reason ?? b?.error ?? `HTTP ${res.status}`, body);
  }
  return body as T;
}

let cached: { at: number; dep: Deployment } | null = null;

export async function deployment(): Promise<Deployment> {
  if (cached && Date.now() - cached.at < 5 * 60_000) return cached.dep;
  const cfg = await api<{ networks: (Deployment & { deployed: boolean })[] }>("/api/config");
  const net = cfg.networks.find((n) => n.chainId === AH.chainId);
  if (!net?.deployed) throw new Error(`afterhours.fi is not deployed on chain ${AH.chainId}`);
  cached = { at: Date.now(), dep: net };
  return net;
}

export async function fetchQuote(p: { buyer: Address; token: Address; notionalUsd: string; barrierBps: number }): Promise<QuoteResponse> {
  const qs = new URLSearchParams({ chainId: String(AH.chainId), buyer: p.buyer, token: p.token, notionalUsd: p.notionalUsd, barrierBps: String(p.barrierBps) });
  return api<QuoteResponse>(`/api/quote?${qs}`);
}
