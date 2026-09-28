"use client";
import clsx from "clsx";
import { MoonStars, SunHorizon } from "@phosphor-icons/react";
import { useNow } from "@/hooks/useNow";
import { nextFridayBell, nextMondayOpen, sessionState } from "@/lib/time";
import { LiveDot } from "./Badge";

function parts(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
}

export function Countdown({ to, className }: { to: number; className?: string }) {
  const now = useNow(1000);
  if (!now) return <span className={clsx("inline-block h-[1em] w-24 rounded skeleton", className)} aria-hidden />;
  const { d, h, m, s } = parts(to - now.getTime());
  const cell = (v: number, u: string) => (
    <span className="inline-flex items-baseline gap-0.5">
      <span className="tnum">{String(v).padStart(2, "0")}</span>
      <span className="text-[0.6em] font-medium text-ink-3">{u}</span>
    </span>
  );
  return (
    <span className={clsx("inline-flex items-baseline gap-2 font-semibold", className)}>
      {d > 0 && cell(d, "d")}
      {cell(h, "h")}
      {cell(m, "m")}
      {d === 0 && cell(s, "s")}
    </span>
  );
}

export function useWeekState() {
  const now = useNow(30_000);
  if (!now) return { ready: false as const };
  const inWeekend = sessionState(now) === "weekend";
  const bell = nextFridayBell(now).getTime();
  const open = nextMondayOpen(now).getTime();
  const weekStart = open - 7 * 86400_000; // previous Monday 09:30
  const pos = Math.min(1, Math.max(0, (now.getTime() - weekStart) / (7 * 86400_000)));
  return { ready: true as const, inWeekend, bell, open, pos };
}

const BELL_POS = (4 * 86400 + 6.5 * 3600) / (7 * 86400); // Mon 09:30 -> Fri 16:00

/**
 * Where we are in the week, in words: "Protection for this weekend is on sale — sales close in 5d 11h"
 * or "US market closed for the weekend — Monday open in 2d 1h". Plus a simple Mon -> Fri bell -> Mon bar.
 */
export function WeekendBar({ className, compact = false }: { className?: string; compact?: boolean }) {
  const w = useWeekState();
  if (!w.ready) return <div className={clsx("card-2 h-[104px] skeleton", className)} aria-hidden />;
  const { inWeekend, bell, open, pos } = w;
  return (
    <div className={clsx("card-2 p-4", className)}>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className={clsx("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", inWeekend ? "bg-keeper-soft text-keeper" : "bg-floor-soft text-floor")}>
            {inWeekend ? <MoonStars weight="duotone" className="h-5 w-5" /> : <SunHorizon weight="duotone" className="h-5 w-5" />}
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-semibold text-ink">
              <LiveDot tone={inWeekend ? "keeper" : "floor"} />
              {inWeekend ? "Weekend: US market is closed" : "This weekend’s protection is on sale"}
            </div>
            {!compact && (
              <div className="mt-0.5 text-xs leading-relaxed text-ink-2">
                {inWeekend ? "Protection bought before Friday’s bell is active now and settles at Monday’s open." : "Buy any time before Friday 4:00 pm New York. It covers you until Monday 9:30 am."}
              </div>
            )}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[11px] font-medium uppercase tracking-wider text-ink-3">{inWeekend ? "Monday open in" : "Sales close in"}</div>
          <Countdown to={inWeekend ? open : bell} className={clsx(compact ? "text-lg" : "text-2xl", inWeekend ? "text-keeper" : "text-floor")} />
        </div>
      </div>
      {!compact && (
        <div className="mt-4">
          <div className="relative h-2 rounded-full bg-surface-4">
            <div className="absolute inset-y-0 left-0 rounded-l-full bg-gradient-to-r from-floor/30 to-floor/80" style={{ width: `${BELL_POS * 100}%` }} />
            <div className="absolute inset-y-0 right-0 rounded-r-full bg-[repeating-linear-gradient(135deg,rgba(92,200,255,0.6)_0_6px,rgba(92,200,255,0.25)_6px_12px)]" style={{ width: `${(1 - BELL_POS) * 100}%` }} />
            <div className="absolute top-1/2 h-4 w-1.5 -translate-y-1/2 rounded-full bg-white shadow-[0_0_12px_rgba(255,255,255,0.8)]" style={{ left: `calc(${pos * 100}% - 3px)` }} />
          </div>
          <div className="relative mt-2 h-4 text-[11px] text-ink-3">
            <span className="absolute left-0">Mon 9:30</span>
            <span className="absolute -translate-x-1/2 text-floor" style={{ left: `${BELL_POS * 100}%` }}>
              Fri 4pm
            </span>
            <span className="absolute right-0 text-keeper">Mon 9:30</span>
          </div>
        </div>
      )}
    </div>
  );
}
