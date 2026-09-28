import type {
  ApiToken,
  BacktestSummary,
  FamousWeekend,
  LearnResponse,
  MarketStatus,
  PoliciesResponse,
  QuoteResponse,
  ServerConfig,
  VaultResponse,
} from "./types";

export const API_BASE = `${(process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/$/, "")}/api`;
const TIMEOUT_MS = 5000;

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, message: string, body?: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${API_BASE}${path}`, { ...init, signal: ctrl.signal, headers: { accept: "application/json", ...(init?.headers ?? {}) } });
    const text = await res.text();
    let body: unknown = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = text;
    }
    if (!res.ok) {
      const b = body as { error?: string; message?: string; reason?: string } | null;
      throw new ApiError(res.status, b?.reason ?? b?.error ?? b?.message ?? `HTTP ${res.status}`, body);
    }
    return body as T;
  } finally {
    clearTimeout(t);
  }
}

/** Returns null instead of throwing: for data the UI can live without. */
async function safe<T>(p: Promise<T>): Promise<T | null> {
  try {
    return await p;
  } catch {
    return null;
  }
}

const qs = (o: Record<string, string | number | undefined>) =>
  Object.entries(o)
    .filter(([, v]) => v !== undefined && v !== "")
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join("&");

/** Typed fetchers for the endpoints in shared/INTERFACE.md. Everything except `quote` swallows failures. */
export const api = {
  health: () => safe(request<{ ok?: boolean; status?: string }>("/health")),
  config: () => safe(request<ServerConfig>("/config")),
  marketStatus: () => safe(request<MarketStatus>("/market-status")),
  tokens: (chainId: number) => safe(request<ApiToken[] | { tokens: ApiToken[] }>(`/tokens?${qs({ chainId })}`)),
  /** Throws ApiError (e.g. 422 priced_out) so the quote card can say why. */
  quote: (p: { chainId: number; buyer: string; token: string; notionalUsd: string; barrierBps?: number; budgetBps?: number }) =>
    request<QuoteResponse>(`/quote?${qs(p)}`),
  policies: (address: string, chainId: number) => safe(request<PoliciesResponse>(`/policies/${address}?${qs({ chainId })}`)),
  vault: (chainId: number) => safe(request<VaultResponse>(`/vault?${qs({ chainId })}`)),
  stats: () => safe(request<BacktestSummary>("/stats")),
  famous: () => safe(request<FamousWeekend[] | { famous: FamousWeekend[] }>("/famous")),
  learn: () => safe(request<LearnResponse>("/learn")),
};

export function normaliseTokens(r: Awaited<ReturnType<typeof api.tokens>>): ApiToken[] {
  if (!r) return [];
  return Array.isArray(r) ? r : Array.isArray(r.tokens) ? r.tokens : [];
}
export function normaliseFamous(r: Awaited<ReturnType<typeof api.famous>>): FamousWeekend[] {
  if (!r) return [];
  return Array.isArray(r) ? r : Array.isArray(r.famous) ? r.famous : [];
}
