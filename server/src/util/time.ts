export const DAY = 86_400;
export const WEEK = 7 * DAY;
/** expectedOpen = epochId + 65.5h (Friday 20:00 UTC -> Monday 13:30 UTC). */
export const OPEN_OFFSET_SECONDS = 65.5 * 3600;

export function nowSec(): number {
  return Math.floor(Date.now() / 1000);
}

/**
 * Next Friday close at `closeHourUtc` (default 20:00 UTC = 16:00 New York on daylight time).
 * Mirrors contracts/scripts/deploy.ts so epochIds agree with the ones opened on-chain.
 */
export function nextFridayClose(fromSec: number = nowSec(), closeHourUtc = 20): number {
  const from = new Date(fromSec * 1000);
  const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate(), closeHourUtc, 0, 0));
  let add = (5 - d.getUTCDay() + 7) % 7;
  if (add === 0 && fromSec * 1000 > d.getTime()) add = 7;
  d.setUTCDate(d.getUTCDate() + add);
  return Math.floor(d.getTime() / 1000);
}

export function expectedOpenFor(epochId: number): number {
  return Math.floor(epochId + OPEN_OFFSET_SECONDS);
}

/** Next Monday 13:30 UTC strictly after `fromSec` (fallback when the market API is unreachable). */
export function nextMondayOpen(fromSec: number = nowSec()): number {
  const from = new Date(fromSec * 1000);
  const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate(), 13, 30, 0));
  let add = (1 - d.getUTCDay() + 7) % 7;
  if (add === 0 && fromSec * 1000 > d.getTime()) add = 7;
  d.setUTCDate(d.getUTCDate() + add);
  return Math.floor(d.getTime() / 1000);
}

export function iso(sec: number | null | undefined): string | null {
  if (sec === null || sec === undefined || !Number.isFinite(sec)) return null;
  return new Date(sec * 1000).toISOString();
}

export function isMondayUtc(sec: number = nowSec()): boolean {
  return new Date(sec * 1000).getUTCDay() === 1;
}

export function fmtDay(sec: number): string {
  return new Date(sec * 1000).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: "UTC" });
}
