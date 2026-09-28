import { logger } from "../logger";

export interface FetchJsonOptions {
  headers?: Record<string, string>;
  timeoutMs?: number;
  method?: "GET" | "POST";
  body?: string;
}

export interface FetchJsonResult<T> {
  ok: boolean;
  status: number;
  data: T | null;
  headers: Headers;
  text: string;
}

/** fetch with a timeout that returns parsed JSON (or null) without throwing on non-2xx. */
export async function fetchJson<T = unknown>(url: string, opts: FetchJsonOptions = {}): Promise<FetchJsonResult<T>> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 8_000);
  try {
    const res = await fetch(url, {
      method: opts.method ?? "GET",
      headers: opts.headers,
      body: opts.body,
      signal: ctrl.signal,
      redirect: "follow",
    });
    const text = await res.text();
    let data: T | null = null;
    try {
      data = text ? (JSON.parse(text) as T) : null;
    } catch {
      data = null;
    }
    return { ok: res.ok, status: res.status, data, headers: res.headers, text };
  } finally {
    clearTimeout(t);
  }
}

/** Simple TTL cache for async producers with stale-on-error semantics. */
export class TtlCache<T> {
  private value: T | undefined;
  private at = 0;
  private inflight: Promise<T> | null = null;
  constructor(private readonly ttlMs: number, private readonly name: string) {}

  get cached(): T | undefined {
    return this.value;
  }
  get ageMs(): number {
    return this.at ? Date.now() - this.at : Number.POSITIVE_INFINITY;
  }

  async get(producer: () => Promise<T>, force = false): Promise<T> {
    if (!force && this.value !== undefined && Date.now() - this.at < this.ttlMs) return this.value;
    if (this.inflight) return this.inflight;
    this.inflight = (async () => {
      try {
        const v = await producer();
        this.value = v;
        this.at = Date.now();
        return v;
      } catch (e) {
        if (this.value !== undefined) {
          logger.warn({ cache: this.name, err: (e as Error).message }, "refresh failed, serving stale value");
          return this.value;
        }
        throw e;
      } finally {
        this.inflight = null;
      }
    })();
    return this.inflight;
  }

  set(v: T): void {
    this.value = v;
    this.at = Date.now();
  }

  invalidate(): void {
    this.at = 0;
  }
}

/** Keyed TTL cache. */
export class KeyedTtlCache<T> {
  private readonly map = new Map<string, TtlCache<T>>();
  constructor(private readonly ttlMs: number, private readonly name: string) {}
  entry(key: string): TtlCache<T> {
    let c = this.map.get(key);
    if (!c) {
      c = new TtlCache<T>(this.ttlMs, `${this.name}:${key}`);
      this.map.set(key, c);
    }
    return c;
  }
  get(key: string, producer: () => Promise<T>, force = false): Promise<T> {
    return this.entry(key).get(producer, force);
  }
  peek(key: string): T | undefined {
    return this.map.get(key)?.cached;
  }
  invalidateAll(): void {
    for (const c of this.map.values()) c.invalidate();
  }
}

export function chunk<T>(arr: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
