"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.KeyedTtlCache = exports.TtlCache = void 0;
exports.fetchJson = fetchJson;
exports.chunk = chunk;
exports.sleep = sleep;
const logger_1 = require("../logger");
/** fetch with a timeout that returns parsed JSON (or null) without throwing on non-2xx. */
async function fetchJson(url, opts = {}) {
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
        let data = null;
        try {
            data = text ? JSON.parse(text) : null;
        }
        catch {
            data = null;
        }
        return { ok: res.ok, status: res.status, data, headers: res.headers, text };
    }
    finally {
        clearTimeout(t);
    }
}
/** Simple TTL cache for async producers with stale-on-error semantics. */
class TtlCache {
    ttlMs;
    name;
    value;
    at = 0;
    inflight = null;
    constructor(ttlMs, name) {
        this.ttlMs = ttlMs;
        this.name = name;
    }
    get cached() {
        return this.value;
    }
    get ageMs() {
        return this.at ? Date.now() - this.at : Number.POSITIVE_INFINITY;
    }
    async get(producer, force = false) {
        if (!force && this.value !== undefined && Date.now() - this.at < this.ttlMs)
            return this.value;
        if (this.inflight)
            return this.inflight;
        this.inflight = (async () => {
            try {
                const v = await producer();
                this.value = v;
                this.at = Date.now();
                return v;
            }
            catch (e) {
                if (this.value !== undefined) {
                    logger_1.logger.warn({ cache: this.name, err: e.message }, "refresh failed, serving stale value");
                    return this.value;
                }
                throw e;
            }
            finally {
                this.inflight = null;
            }
        })();
        return this.inflight;
    }
    set(v) {
        this.value = v;
        this.at = Date.now();
    }
    invalidate() {
        this.at = 0;
    }
}
exports.TtlCache = TtlCache;
/** Keyed TTL cache. */
class KeyedTtlCache {
    ttlMs;
    name;
    map = new Map();
    constructor(ttlMs, name) {
        this.ttlMs = ttlMs;
        this.name = name;
    }
    entry(key) {
        let c = this.map.get(key);
        if (!c) {
            c = new TtlCache(this.ttlMs, `${this.name}:${key}`);
            this.map.set(key, c);
        }
        return c;
    }
    get(key, producer, force = false) {
        return this.entry(key).get(producer, force);
    }
    peek(key) {
        return this.map.get(key)?.cached;
    }
    invalidateAll() {
        for (const c of this.map.values())
            c.invalidate();
    }
}
exports.KeyedTtlCache = KeyedTtlCache;
function chunk(arr, size) {
    const out = [];
    for (let i = 0; i < arr.length; i += size)
        out.push(arr.slice(i, i + size));
    return out;
}
function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}
//# sourceMappingURL=http.js.map