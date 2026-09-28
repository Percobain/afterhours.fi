"use client";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import clsx from "clsx";
import { type Icon as PhosphorIcon, ChartLineDown, ChartLineUp, ShieldCheck } from "@phosphor-icons/react";
import { payoutPerDollar, PAYOUT_CAP_BPS } from "@/lib/contracts";

const PRESETS = [
  { label: "Quiet Monday", gap: 0.4 },
  { label: "Bad Monday", gap: -5 },
  { label: "DeepSeek, Jan 2025", gap: -12.5 },
  { label: "Covid, Mar 2020", gap: -10.4 },
  { label: "Good news", gap: 4 },
];

const MIN = -25;
const MAX = 10;

const money = (v: number, sign = false) =>
  `${sign && v > 0 ? "+" : v < 0 ? "−" : ""}$${Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: Math.abs(v) < 100 ? 2 : 0, maximumFractionDigits: Math.abs(v) < 100 ? 2 : 0 })}`;

/**
 * "What if Monday opens at X%?" Drag the slider; see what happens to your money with and without protection.
 * All numbers are simple arithmetic on the same rule the contract uses.
 */
export function MondaySimulator({
  ticker = "NVDA",
  amount = 1000,
  lineBps = 300,
  cost,
  className,
  onLineChange,
  showLinePicker = false,
}: {
  ticker?: string;
  amount?: number;
  lineBps?: number;
  cost?: number;
  className?: string;
  onLineChange?: (bps: number) => void;
  showLinePicker?: boolean;
}) {
  const [gap, setGap] = useState(-8);
  const line = lineBps / 100;
  const fee = cost ?? amount * 0.0004;

  const r = useMemo(() => {
    const stockMove = (amount * gap) / 100;
    const payout = amount * payoutPerDollar(gap / 100, lineBps);
    const withProtection = stockMove + payout - fee;
    const capped = payoutPerDollar(gap / 100, lineBps) >= PAYOUT_CAP_BPS / 10_000 - 1e-9 && gap < 0;
    return { stockMove, payout, withProtection, capped };
  }, [amount, gap, lineBps, fee]);

  const pct = (v: number) => ((v - MIN) / (MAX - MIN)) * 100;
  const linePos = pct(-line);
  const zeroPos = pct(0);
  const paying = r.payout > 0;

  const sentence = paying
    ? `${ticker} opens ${Math.abs(gap).toFixed(1)}% lower. Your stock loses ${money(Math.abs(r.stockMove))}, and protection pays you ${money(r.payout)}${r.capped ? " (the 20% maximum)" : ""}. You only lose the first ${line}% plus the fee.`
    : gap < 0
      ? `${ticker} opens ${Math.abs(gap).toFixed(1)}% lower, which is above your ${line}% line. The dip is small, so nothing is paid and you keep your stock.`
      : `${ticker} opens ${gap.toFixed(1)}% higher. Nothing to pay out: you keep every dollar of the gain. The ${money(fee)} fee was the price of sleeping well.`;

  return (
    <div className={clsx("rounded-3xl border border-line bg-surface-2/80 p-5 sm:p-6", className)}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-sm text-ink-2">
            What if <span className="font-semibold text-ink">{ticker}</span> opens on Monday at
          </div>
          <motion.div key={Math.sign(gap)} initial={{ opacity: 0.6 }} animate={{ opacity: 1 }} className={clsx("tnum mt-1 text-5xl font-semibold tracking-tight", gap < 0 ? (paying ? "text-gap" : "text-ink") : "text-held")}>
            {gap > 0 ? "+" : gap < 0 ? "−" : ""}
            {Math.abs(gap).toFixed(1)}%
          </motion.div>
        </div>
        <div className="text-right text-xs text-ink-3">
          on {money(amount)} of {ticker}
          <br />
          protection line at −{line}%
        </div>
      </div>

      {/* slider with the protected zone drawn under it */}
      <div className="relative mt-6">
        <div className="absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 overflow-hidden rounded-full bg-surface-4">
          <div className="absolute inset-y-0 left-0 bg-[repeating-linear-gradient(135deg,rgba(255,181,71,0.7)_0_6px,rgba(255,181,71,0.35)_6px_12px)]" style={{ width: `${linePos}%` }} />
          <div className="absolute inset-y-0 bg-held/40" style={{ left: `${zeroPos}%`, right: 0 }} />
        </div>
        <div className="absolute top-1/2 h-5 w-0.5 -translate-y-1/2 bg-floor" style={{ left: `${linePos}%` }} aria-hidden />
        <input
          type="range"
          min={MIN}
          max={MAX}
          step={0.1}
          value={gap}
          onChange={(e) => setGap(Number(e.target.value))}
          className="slider relative z-10 w-full"
          aria-label="Monday opening move in percent"
          aria-valuetext={`${gap.toFixed(1)} percent`}
        />
      </div>
      <div className="relative mt-1 h-5 text-[11px] text-ink-3">
        <span className="absolute left-0">−25%</span>
        <span className="absolute -translate-x-1/2 whitespace-nowrap text-floor" style={{ left: `${linePos}%` }}>
          your line −{line}%
        </span>
        <span className="absolute -translate-x-1/2" style={{ left: `${zeroPos}%` }}>
          0
        </span>
        <span className="absolute right-0">+10%</span>
      </div>

      <div className="strip -mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-1">
        {PRESETS.map((p) => (
          <button key={p.label} type="button" onClick={() => setGap(p.gap)} className={clsx("shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition", Math.abs(gap - p.gap) < 0.05 ? "border-floor/50 bg-floor-soft text-floor" : "border-line bg-surface-3 text-ink-2 hover:text-ink")}>
            {p.label} <span className="tnum text-ink-3">{p.gap > 0 ? "+" : ""}{p.gap}%</span>
          </button>
        ))}
      </div>

      {showLinePicker && onLineChange && (
        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-ink-2">
          Protection line:
          {[200, 300, 500, 1000].map((b) => (
            <button key={b} type="button" onClick={() => onLineChange(b)} className={clsx("rounded-full border px-3 py-1.5 font-medium", lineBps === b ? "border-floor/50 bg-floor-soft text-floor" : "border-line bg-surface-3 hover:text-ink")}>
              −{b / 100}%
            </button>
          ))}
        </div>
      )}

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <Outcome icon={gap < 0 ? ChartLineDown : ChartLineUp} label="Your stock on Monday" value={money(r.stockMove, true)} tone={r.stockMove < 0 ? "gap" : "held"} />
        <Outcome icon={ShieldCheck} label="Protection pays you" value={paying ? `+${money(r.payout)}` : "$0"} tone={paying ? "floor" : "muted"} highlight={paying} />
        <Outcome label="Total with protection" value={money(r.withProtection, true)} sub={`after the ${money(fee)} fee`} tone={r.withProtection < 0 ? "ink" : "held"} />
      </div>

      <p className="mt-4 rounded-2xl bg-surface-3/70 px-4 py-3 text-sm leading-relaxed text-ink-2">{sentence}</p>
    </div>
  );
}

function Outcome({ label, value, sub, tone, icon: Icon, highlight }: { label: string; value: string; sub?: string; tone: "gap" | "held" | "floor" | "muted" | "ink"; icon?: PhosphorIcon; highlight?: boolean }) {
  const color = { gap: "text-gap", held: "text-held", floor: "text-floor", muted: "text-ink-3", ink: "text-ink" }[tone];
  return (
    <div className={clsx("rounded-2xl border p-4 transition", highlight ? "border-floor/40 bg-floor-soft" : "border-line bg-surface-3/50")}>
      <div className="flex items-center gap-1.5 text-xs text-ink-2">
        {Icon && <Icon weight="duotone" className="h-3.5 w-3.5" aria-hidden />}
        {label}
      </div>
      <div className={clsx("tnum mt-1 text-2xl font-semibold tracking-tight", color)}>{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-ink-3">{sub}</div>}
    </div>
  );
}
