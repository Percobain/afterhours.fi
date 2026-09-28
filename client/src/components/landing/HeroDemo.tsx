"use client";
import { useEffect, useState, type ReactNode } from "react";
import { useReducedMotion } from "framer-motion";
import { HandCoins, MoonStars, ShieldCheck } from "@phosphor-icons/react";
import { StockMark } from "@/components/ui/StockMark";

/**
 * A looping, self-explaining demo: Nvidia through the DeepSeek weekend (Jan 24 -> 27, 2025).
 * Week line draws -> market closes Friday -> Monday opens 12.5% lower -> protection pays the gap below −3%.
 */
const W = 520;
const H = 230;
const LINE = 0.03;
const GAP = -0.125;
const AMOUNT = 10_000;
const PAYOUT = AMOUNT * Math.min(-LINE - GAP, 0.2);

// Mon..Fri close, normalised to Friday close = 1
const WEEK = [0.97, 0.985, 0.978, 0.992, 1.004, 0.996, 1.01, 1.0, 1.006, 1.0];
const yOf = (v: number) => 30 + (1.03 - v) * (H - 60) / 0.2;
const X_FRI = 300;
const X_MON = 470;

export function HeroDemo() {
  const reduced = useReducedMotion();
  const [cycle, setCycle] = useState(0);
  const [phase, setPhase] = useState(reduced ? 3 : 0);
  const [drawn, setDrawn] = useState(!!reduced);

  useEffect(() => {
    if (reduced) return;
    setPhase(0);
    setDrawn(false);
    const t = [setTimeout(() => setDrawn(true), 60), setTimeout(() => setPhase(1), 1800), setTimeout(() => setPhase(2), 3200), setTimeout(() => setPhase(3), 4300), setTimeout(() => setCycle((c) => c + 1), 9500)];
    return () => t.forEach(clearTimeout);
  }, [cycle, reduced]);

  const pts = WEEK.map((v, i) => `${20 + (i * (X_FRI - 20)) / (WEEK.length - 1)},${yOf(v)}`).join(" ");
  const yLine = yOf(1 - LINE);
  const yGap = yOf(1 + GAP);

  return (
    <div className="relative">
      <div className="absolute -inset-10 rounded-[3rem] bg-[radial-gradient(60%_60%_at_50%_40%,rgba(255,138,61,0.22),transparent_70%)]" aria-hidden />
      <div className="card ring-grad relative overflow-hidden p-5 shadow-pop sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <StockMark ticker="NVDA" size={40} />
            <div>
              <div className="text-sm font-semibold">NVDAB · $10,000 protected</div>
              <div className="text-xs text-ink-3">Weekend of Jan 24, 2025 · line at −3%</div>
            </div>
          </div>
          <span className="chip border-floor/30 bg-floor-soft text-floor">
            <ShieldCheck weight="duotone" className="h-3.5 w-3.5" /> Protected
          </span>
        </div>

        <svg viewBox={`0 0 ${W} ${H}`} className="mt-4 w-full" role="img" aria-label="Nvidia fell 12.5% at Monday's open; protection paid the drop below 3%">
          <defs>
            <linearGradient id="hd-line" x1="0" x2="1">
              <stop offset="0" stopColor="#A9B1C3" />
              <stop offset="1" stopColor="#F5F7FB" />
            </linearGradient>
            <pattern id="hd-hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="4" height="8" fill="rgba(92,200,255,0.10)" />
            </pattern>
            <linearGradient id="hd-pay" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="rgba(255,181,71,0.55)" />
              <stop offset="1" stopColor="rgba(255,138,61,0.15)" />
            </linearGradient>
          </defs>

          {/* weekend: market closed */}
          <rect x={X_FRI} y={10} width={X_MON - X_FRI} height={H - 30} fill="url(#hd-hatch)" rx="10" />
          <text x={(X_FRI + X_MON) / 2} y={28} textAnchor="middle" fontSize="11" fill="#5CC8FF" fontWeight="600">
            MARKET CLOSED 65h
          </text>
          <line x1={X_FRI} x2={X_FRI} y1={10} y2={H - 20} stroke="#FFB547" strokeDasharray="3 4" />
          <text x={X_FRI - 6} y={H - 6} textAnchor="end" fontSize="10.5" fill="#FFB547">Fri 4 pm</text>
          <text x={X_MON} y={H - 6} textAnchor="middle" fontSize="10.5" fill="#A9B1C3">Mon 9:30</text>

          {/* protection line */}
          <line x1={20} x2={W - 10} y1={yLine} y2={yLine} stroke="#FFB547" strokeWidth="1.5" strokeDasharray="6 5" />
          <text x={24} y={yLine + 15} fontSize="10.5" fill="#FFB547" fontWeight="600">your line −3%</text>

          {/* the week */}
          <polyline key={`w${cycle}`} points={pts} pathLength={1000} fill="none" stroke="url(#hd-line)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ strokeDasharray: 1000, strokeDashoffset: drawn ? 0 : 1000, transition: reduced ? "none" : "stroke-dashoffset 1.6s ease-in-out" }} />

          {/* weekend gap: dotted jump to Monday open */}
          <line x1={X_FRI} y1={yOf(1)} x2={X_MON} y2={yGap} stroke="#FF6B6B" strokeWidth="2" strokeDasharray="4 5" style={{ opacity: phase >= 1 ? 1 : 0, transition: "opacity 0.8s ease" }} />
          <g style={{ opacity: phase >= 2 ? 1 : 0, transition: "opacity 0.5s ease" }}>
              <rect x={X_MON - 22} y={yLine} width={44} height={yGap - yLine} rx="8" fill="url(#hd-pay)" stroke="#FFB547" strokeOpacity="0.6" />
              <circle cx={X_MON} cy={yGap} r="6" fill="#FF6B6B" />
              <circle cx={X_MON} cy={yGap} r="12" fill="#FF6B6B" opacity="0.2" />
              <text x={X_MON - 30} y={yGap + 4} textAnchor="end" fontSize="12" fill="#FF6B6B" fontWeight="700">
                −12.5%
              </text>
              <text x={X_MON - 30} y={(yLine + yGap) / 2 + 4} textAnchor="end" fontSize="11" fill="#FFB547" fontWeight="600">
                we pay this part
              </text>
            </g>
          <circle cx={X_FRI} cy={yOf(1)} r="4.5" fill="#F5F7FB" />
        </svg>

        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <Cell label="Fee paid Friday" value="$5.50" />
          <Cell label="Stock on Monday" value="−$1,250" tone="gap" show={phase >= 1} />
          <Cell label="We paid you" value={`+$${PAYOUT.toLocaleString("en-US")}`} tone="floor" show={phase >= 2} />
        </div>

        {/* All three captions share one grid cell, so the card is always as tall as the tallest one and never jumps. */}
        <div className="mt-4 grid">
          <Caption show={phase === 0} tone="wait">
            <MoonStars weight="duotone" className="h-5 w-5 shrink-0 text-keeper" />
            <span>Friday: you set protection, then close the app.</span>
          </Caption>
          <Caption show={phase === 1 || phase === 2} tone="wait">
            <MoonStars weight="duotone" className="h-5 w-5 shrink-0 text-keeper" />
            <span>The weekend: DeepSeek news breaks while the market is shut…</span>
          </Caption>
          <Caption show={phase >= 3} tone="paid">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-held text-[#00140B]">
              <HandCoins weight="duotone" className="h-5 w-5" />
            </span>
            <span className="block">
              <span className="block font-semibold text-ink">Monday 9:30 am · ${PAYOUT.toLocaleString("en-US")} sent to your wallet</span>
              <span className="block text-xs text-ink-2">Automatically. You lost 3% plus the fee instead of 12.5%.</span>
            </span>
          </Caption>
        </div>
      </div>
    </div>
  );
}

function Cell({ label, value, tone, show = true }: { label: string; value: string; tone?: "gap" | "floor"; show?: boolean }) {
  return (
    <div className="rounded-xl bg-surface-2 px-2 py-2.5">
      <div className="text-[10px] uppercase tracking-wider text-ink-3">{label}</div>
      <div className={`tnum mt-0.5 text-sm font-semibold transition-opacity duration-500 ${show ? "opacity-100" : "opacity-0"} ${tone === "gap" ? "text-gap" : tone === "floor" ? "text-floor" : "text-ink"}`}>{value}</div>
    </div>
  );
}

function Caption({ show, tone, children }: { show: boolean; tone: "wait" | "paid"; children: ReactNode }) {
  return (
    <div
      aria-hidden={!show}
      className={`col-start-1 row-start-1 flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm transition-[opacity,transform] duration-500 ease-out motion-reduce:transition-none ${
        tone === "paid" ? "border-held/30 bg-held-soft" : "border-line bg-surface-2 text-ink-2"
      } ${show ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-1 opacity-0"}`}
    >
      {children}
    </div>
  );
}
