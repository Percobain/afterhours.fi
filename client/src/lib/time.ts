/** New York session helpers. Regular NYSE hours only (holidays are not modelled; the server's market-status is authoritative). */

const NY = "America/New_York";
const dtf = new Intl.DateTimeFormat("en-US", {
  timeZone: NY,
  hour12: false,
  weekday: "short",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export interface NyParts {
  weekday: number; // 0 Sun .. 6 Sat
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  second: number;
  /** minutes since Monday 00:00 New York */
  weekMinutes: number;
}

export function nyParts(date = new Date()): NyParts {
  const parts = dtf.formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "0";
  const weekday = WEEKDAYS.indexOf(get("weekday"));
  const hour = Number(get("hour")) % 24;
  const minute = Number(get("minute"));
  const dayFromMonday = (weekday + 6) % 7;
  return {
    weekday,
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour,
    minute,
    second: Number(get("second")),
    weekMinutes: dayFromMonday * 1440 + hour * 60 + minute,
  };
}

/** Offset of New York from UTC in minutes at the given instant (e.g. -240 in summer, -300 in winter). */
export function nyOffsetMinutes(date: Date): number {
  const p = nyParts(date);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUtc - date.getTime()) / 60_000);
}

/** UTC instant for a New York wall-clock time on the given NY calendar day (y, m 1-12, d). */
export function nyWallClockToUtc(y: number, m: number, d: number, hour: number, minute: number): Date {
  let guess = new Date(Date.UTC(y, m - 1, d, hour, minute, 0));
  for (let i = 0; i < 2; i++) {
    const off = nyOffsetMinutes(guess);
    guess = new Date(Date.UTC(y, m - 1, d, hour, minute, 0) - off * 60_000);
  }
  return guess;
}

const OPEN_MIN = 9 * 60 + 30;
const CLOSE_MIN = 16 * 60;

export type SessionState = "open" | "night" | "weekend";

export function sessionState(date = new Date()): SessionState {
  const p = nyParts(date);
  const dow = p.weekday;
  const mins = p.hour * 60 + p.minute;
  if (dow === 0 || dow === 6) return "weekend";
  if (dow === 5 && mins >= CLOSE_MIN) return "weekend";
  if (dow === 1 && mins < OPEN_MIN) return "weekend";
  if (mins >= OPEN_MIN && mins < CLOSE_MIN) return "open";
  return "night";
}

function addDaysNY(p: NyParts, days: number): { y: number; m: number; d: number } {
  const t = new Date(Date.UTC(p.year, p.month - 1, p.day + days, 12));
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
}

/** Next Friday 16:00 New York at or after `from`. */
export function nextFridayBell(from = new Date()): Date {
  const p = nyParts(from);
  let add = (5 - p.weekday + 7) % 7;
  let candidate = addDaysNY(p, add);
  let bell = nyWallClockToUtc(candidate.y, candidate.m, candidate.d, 16, 0);
  if (bell.getTime() <= from.getTime()) {
    add += 7;
    candidate = addDaysNY(p, add);
    bell = nyWallClockToUtc(candidate.y, candidate.m, candidate.d, 16, 0);
  }
  return bell;
}

/** Next Monday 09:30 New York at or after `from`. */
export function nextMondayOpen(from = new Date()): Date {
  const p = nyParts(from);
  let add = (1 - p.weekday + 7) % 7;
  let candidate = addDaysNY(p, add);
  let open = nyWallClockToUtc(candidate.y, candidate.m, candidate.d, 9, 30);
  if (open.getTime() <= from.getTime()) {
    add += 7;
    candidate = addDaysNY(p, add);
    open = nyWallClockToUtc(candidate.y, candidate.m, candidate.d, 9, 30);
  }
  return open;
}

/** Fraction [0,1) of the New York week elapsed (Mon 00:00 = 0). */
export function weekFraction(date = new Date()): number {
  const p = nyParts(date);
  return (p.weekMinutes + p.second / 60) / (7 * 1440);
}

/** The NYSE-open windows of the week as fractions of the 7-day band (Mon 09:30-16:00 .. Fri 09:30-16:00). */
export const NYSE_OPEN_WINDOWS: { start: number; end: number }[] = [0, 1, 2, 3, 4].map((d) => ({
  start: (d * 1440 + OPEN_MIN) / (7 * 1440),
  end: (d * 1440 + CLOSE_MIN) / (7 * 1440),
}));

/** Friday 16:00 to Monday 09:30 as fractions of the band (the weekend gap the product covers). */
export const WEEKEND_WINDOW = { start: (4 * 1440 + CLOSE_MIN) / (7 * 1440), end: 1 + OPEN_MIN / (7 * 1440) };

export function nyClock(date = new Date()): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: NY, hour: "numeric", minute: "2-digit", weekday: "short", timeZoneName: "short" }).format(date);
}
