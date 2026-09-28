import { formatUnits } from "viem";

export const USD_DECIMALS = 6;
export const PRICE_DECIMALS = 8;

export function toBig(v: string | number | bigint | null | undefined): bigint {
  if (v === null || v === undefined || v === "") return 0n;
  if (typeof v === "bigint") return v;
  if (typeof v === "number") return BigInt(Math.round(v));
  try {
    return BigInt(v);
  } catch {
    const n = Number(v);
    return Number.isFinite(n) ? BigInt(Math.round(n)) : 0n;
  }
}

export function toNum(v: string | number | bigint | null | undefined, decimals = 0): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return decimals ? v / 10 ** decimals : v;
  return Number(formatUnits(toBig(v), decimals));
}

const usdFmt = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
const usdFmt0 = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const usdFmt4 = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 3 });

/** Format a 6-decimal USDT amount (bigint/string) or, with decimals 0, a plain USD number. */
export function fmtUsd(v: string | number | bigint | null | undefined, opts: { decimals?: number; compact?: boolean; precise?: boolean } = {}): string {
  const { decimals = USD_DECIMALS, compact = false, precise = false } = opts;
  const n = toNum(v, decimals);
  if (compact && Math.abs(n) >= 10_000) return usdFmt0.format(n);
  if (precise && Math.abs(n) < 0.1 && n !== 0) return usdFmt4.format(n);
  return usdFmt.format(n);
}

/** Plain USD number (already in dollars). */
export function fmtUsdPlain(n: number): string {
  return Math.abs(n) >= 1000 ? usdFmt0.format(n) : usdFmt.format(n);
}

export function fmtPrice(v: string | number | bigint | null | undefined): string {
  return usdFmt.format(toNum(v, PRICE_DECIMALS));
}

export function fmtTokens(v: bigint | undefined, decimals = 18, max = 4): string {
  if (v === undefined) return "-";
  const n = Number(formatUnits(v, decimals));
  return n.toLocaleString("en-US", { maximumFractionDigits: n < 1 ? 6 : max });
}

export function fmtNum(n: number, max = 1): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: max });
}

export function fmtPct(fraction: number, max = 1, signed = false): string {
  const s = (fraction * 100).toLocaleString("en-US", { maximumFractionDigits: max, minimumFractionDigits: 0 });
  return signed && fraction > 0 ? `+${s}%` : `${s}%`;
}

export function fmtBp(bp: number, max = 1): string {
  return `${bp.toLocaleString("en-US", { maximumFractionDigits: max })}bp`;
}

export function bpsToPct(bps: number): string {
  const p = bps / 100;
  return `${Number.isInteger(p) ? p : p.toFixed(1)}%`;
}

export function shortAddr(a?: string, n = 4): string {
  if (!a) return "";
  return `${a.slice(0, 2 + n)}…${a.slice(-n)}`;
}

const NY = "America/New_York";

export function fmtDateNY(unixSeconds: number, opts: Intl.DateTimeFormatOptions = {}): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: NY, month: "short", day: "numeric", ...opts }).format(new Date(unixSeconds * 1000));
}

export function fmtDateTimeNY(unixSeconds: number): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: NY,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(unixSeconds * 1000));
}

/** "Fri, Oct 3 to Mon, Oct 6" for an epoch */
export function fmtWeekend(epochId: number, expectedOpen?: number): string {
  const open = expectedOpen ?? epochId + 65.5 * 3600;
  return `${fmtDateNY(epochId, { weekday: "short" })} → ${fmtDateNY(open, { weekday: "short" })}`;
}

export function fmtCountdown(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}
