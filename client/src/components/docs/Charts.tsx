"use client";
import { useState, type ReactNode } from "react";
import clsx from "clsx";

/* Small native SVG charts for the research docs. Dark surface, one accent per chart, labels in text colours. */

export function Figure({ n, title, children, caption, source }: { n: string; title: string; children: ReactNode; caption: ReactNode; source?: string }) {
  return (
    <figure className="my-8 rounded-3xl border border-line bg-surface/70 p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="text-xs font-semibold uppercase tracking-wider text-ink-3">Figure {n}</div>
        {source && <div className="text-[11px] text-ink-3">{source}</div>}
      </div>
      <div className="mt-1 text-base font-semibold text-ink">{title}</div>
      <div className="mt-5">{children}</div>
      <figcaption className="mt-4 border-t border-line pt-3 text-sm leading-relaxed text-ink-2">{caption}</figcaption>
    </figure>
  );
}

export function ImageFigure({ n, title, src, caption, source }: { n: string; title: string; src: string; caption: ReactNode; source?: string }) {
  return (
    <Figure n={n} title={title} caption={caption} source={source}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={title} loading="lazy" className="w-full rounded-2xl border border-line bg-white" />
    </Figure>
  );
}

/** Two bars per row on a log scale: what a normal distribution predicts vs what actually happened. */
export function TailCompare({ rows }: { rows: { drop: number; empirical: number; normal: number; ratio: number }[] }) {
  const lo = Math.log10(1e-8);
  const hi = Math.log10(0.1);
  const w = (p: number) => `${Math.max(1.5, ((Math.log10(Math.max(p, 1e-8)) - lo) / (hi - lo)) * 100)}%`;
  const pct = (p: number) => (p >= 0.0001 ? `${(p * 100).toFixed(p >= 0.01 ? 2 : 3)}%` : `1 in ${Math.round(1 / p).toLocaleString("en-US")}`);
  return (
    <div className="space-y-5">
      {rows.map((r) => (
        <div key={r.drop}>
          <div className="flex items-baseline justify-between text-sm">
            <span className="font-medium text-ink">Monday opens {r.drop}%+ lower</span>
            <span className={clsx("tnum text-xs font-semibold", r.ratio > 1 ? "text-gap" : "text-ink-3")}>{r.ratio > 1 ? `${r.ratio >= 1000 ? Math.round(r.ratio).toLocaleString("en-US") : r.ratio.toFixed(1)}× more often than a normal curve says` : "less often than a normal curve says"}</span>
          </div>
          <div className="mt-2 space-y-1.5">
            <Bar label="What actually happened" value={pct(r.empirical)} width={w(r.empirical)} cls="bg-gradient-to-r from-floor/60 to-floor" />
            <Bar label="Normal curve, same volatility" value={pct(r.normal)} width={w(r.normal)} cls="bg-ink-4" />
          </div>
        </div>
      ))}
      <div className="flex justify-between text-[11px] text-ink-3">
        <span>1 in 100 million</span>
        <span>log scale</span>
        <span>1 in 10</span>
      </div>
    </div>
  );
}

function Bar({ label, value, width, cls }: { label: string; value: string; width: string; cls: string }) {
  return (
    <div className="grid grid-cols-[150px_1fr] items-center gap-3 text-xs sm:grid-cols-[190px_1fr]">
      <span className="text-ink-2">{label}</span>
      <div className="flex items-center gap-2">
        <div className={clsx("h-3 rounded-full", cls)} style={{ width }} />
        <span className="tnum shrink-0 text-ink">{value}</span>
      </div>
    </div>
  );
}

/** Horizontal bars with reference lines, e.g. loss ratio per engine. */
export function RefBars({ rows, max, refs, format }: { rows: { label: string; sub?: string; value: number; tone: "good" | "bad" | "mid" }[]; max: number; refs: { at: number; label: string; cls: string }[]; format: (v: number) => string }) {
  return (
    <div className="relative">
      <div className="space-y-3">
        {rows.map((r) => (
          <div key={r.label} className="grid grid-cols-[140px_1fr] items-center gap-3 sm:grid-cols-[210px_1fr]">
            <div>
              <div className="text-sm font-medium text-ink">{r.label}</div>
              {r.sub && <div className="text-[11px] text-ink-3">{r.sub}</div>}
            </div>
            <div className="relative h-7">
              <div className="absolute inset-y-1 left-0 right-0 rounded-full bg-surface-3" />
              <div className={clsx("absolute inset-y-1 left-0 rounded-full", r.tone === "good" ? "bg-held" : r.tone === "bad" ? "bg-gap" : "bg-floor")} style={{ width: `${Math.min(100, (r.value / max) * 100)}%` }} />
              <span className="tnum absolute top-1/2 -translate-y-1/2 pl-2 text-xs font-semibold text-ink" style={{ left: `${Math.min(88, (r.value / max) * 100)}%` }}>
                {format(r.value)}
              </span>
              {refs.map((f) => (
                <span key={f.label} className={clsx("absolute inset-y-0 w-px", f.cls)} style={{ left: `${(f.at / max) * 100}%` }} aria-hidden />
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-4 pl-[152px] text-[11px] text-ink-3 sm:pl-[222px]">
        {refs.map((f) => (
          <span key={f.label} className="flex items-center gap-1.5">
            <span className={clsx("h-3 w-px", f.cls)} /> {f.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Predicted vs realised, one dot per decile, with the y = x line. Hover a dot for numbers. */
export function Calibration({ points }: { points: { dec: number; pred_bp: number; real_bp: number; n: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 520, H = 300, P = 44;
  const max = Math.max(...points.map((p) => Math.max(p.pred_bp, p.real_bp))) * 1.1;
  const sx = (v: number) => P + (Math.sqrt(v) / Math.sqrt(max)) * (W - P - 16);
  const sy = (v: number) => H - P - (Math.sqrt(v) / Math.sqrt(max)) * (H - P - 16);
  const ticks = [0, 1, 5, 10, 20, 30].filter((t) => t <= max);
  const h = hover !== null ? points[hover] : null;
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Calibration of the pricing engine by decile">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={P} x2={W - 16} y1={sy(t)} y2={sy(t)} stroke="#1E2330" />
            <text x={P - 8} y={sy(t) + 4} textAnchor="end" fontSize="11" fill="#6C7489">{t}</text>
            <text x={sx(t)} y={H - P + 18} textAnchor="middle" fontSize="11" fill="#6C7489">{t}</text>
          </g>
        ))}
        <line x1={sx(0)} y1={sy(0)} x2={sx(max)} y2={sy(max)} stroke="#A9B1C3" strokeDasharray="5 5" />
        <text x={sx(max) - 4} y={sy(max) + 14} textAnchor="end" fontSize="11" fill="#A9B1C3">perfect calibration</text>
        {points.map((p, i) => (
          <circle key={p.dec} cx={sx(p.pred_bp)} cy={sy(p.real_bp)} r={hover === i ? 8 : 6} fill="#FFB547" stroke="#05060A" strokeWidth="2" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} className="cursor-pointer" />
        ))}
        <text x={(W + P) / 2} y={H - 6} textAnchor="middle" fontSize="11.5" fill="#A9B1C3">predicted fair price, basis points per weekend (√ scale)</text>
        <text x={12} y={H / 2} textAnchor="middle" fontSize="11.5" fill="#A9B1C3" transform={`rotate(-90 12 ${H / 2})`}>what was actually paid out</text>
      </svg>
      {h && (
        <div className="pointer-events-none absolute right-2 top-2 rounded-xl border border-line-strong bg-surface-3 px-3 py-2 text-xs text-ink-2 shadow-pop">
          <div className="font-semibold text-ink">Decile {h.dec + 1} of 10</div>
          <div className="tnum">Predicted {h.pred_bp.toFixed(2)} bp · paid {h.real_bp.toFixed(2)} bp</div>
          <div className="tnum">{h.n.toLocaleString("en-US")} ticker-weekends</div>
        </div>
      )}
    </div>
  );
}

/** Vertical bars per year with a horizontal reference line; hover for values. */
export function YearBars({ rows, refLine, format }: { rows: { year: number; loss_ratio: number; premium_bp: number; payout_bp: number }[]; refLine: number; format: (v: number) => string }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(2.4, ...rows.map((r) => r.loss_ratio));
  const h = hover !== null ? rows[hover] : null;
  return (
    <div className="relative">
      <div className="relative flex h-48 items-end gap-1 border-b border-line">
        {rows.map((r, i) => (
          <div key={r.year} className="group relative flex h-full flex-1 items-end" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
            <div className={clsx("w-full rounded-t-md transition", r.loss_ratio > 1 ? "bg-gap" : "bg-floor/80", hover === i && "brightness-125")} style={{ height: `${Math.max(1.5, (r.loss_ratio / max) * 100)}%` }} />
          </div>
        ))}
        <div className="pointer-events-none absolute inset-x-0 border-t border-dashed border-ink-2" style={{ bottom: `${(refLine / max) * 100}%` }} aria-hidden />
        <span className="pointer-events-none absolute right-0 -translate-y-full pb-0.5 text-[10px] text-ink-2" style={{ bottom: `${(refLine / max) * 100}%` }}>break-even</span>
      </div>
      <div className="mt-1 flex gap-1 text-[10px] text-ink-3">
        {rows.map((r) => (
          <span key={r.year} className="flex-1 text-center">{String(r.year).slice(2)}</span>
        ))}
      </div>
      <div className="mt-2 text-[11px] text-ink-3">Dashed line: payouts equal premiums (loss ratio 1). Red bars are years the pool paid out more than it collected.</div>
      {h && (
        <div className="pointer-events-none absolute right-0 top-0 rounded-xl border border-line-strong bg-surface-3 px-3 py-2 text-xs text-ink-2 shadow-pop">
          <div className="font-semibold text-ink">{h.year}</div>
          <div className="tnum">Loss ratio {format(h.loss_ratio)}</div>
          <div className="tnum">Charged {h.premium_bp.toFixed(1)} bp · paid {h.payout_bp.toFixed(1)} bp</div>
        </div>
      )}
    </div>
  );
}

/** Plain data table with tabular numbers and optional per-cell tone. */
export function DataTable({ head, rows, note }: { head: string[]; rows: (ReactNode | { v: ReactNode; tone?: "good" | "bad" | "mid" | "muted" })[][]; note?: ReactNode }) {
  return (
    <div className="my-6">
      <div className="scroll-thin overflow-x-auto rounded-2xl border border-line">
        <table className="w-full min-w-[520px] border-collapse text-[13px]">
          <thead>
            <tr className="bg-surface-2">
              {head.map((h, i) => (
                <th key={h} className={clsx("px-3 py-3 align-bottom text-[11px] font-semibold uppercase leading-tight tracking-wider text-ink-3", i === 0 ? "text-left" : "text-right")}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, ri) => (
              <tr key={ri} className="border-t border-line">
                {r.map((c, ci) => {
                  const cell = c && typeof c === "object" && "v" in (c as object) ? (c as { v: ReactNode; tone?: string }) : { v: c as ReactNode };
                  const tone = (cell as { tone?: string }).tone;
                  return (
                    <td key={ci} className={clsx("tnum whitespace-nowrap px-3 py-2.5", ci === 0 ? "text-left text-ink" : "text-right", tone === "good" ? "text-held" : tone === "bad" ? "text-gap" : tone === "mid" ? "text-floor" : tone === "muted" ? "text-ink-3" : ci === 0 ? "" : "text-ink-2")}>
                      {cell.v}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {note && <p className="mt-2 text-xs leading-relaxed text-ink-3">{note}</p>}
    </div>
  );
}

export function KeyNumbers({ items }: { items: { v: string; l: string; tone?: "floor" | "keeper" | "held" | "gap" }[] }) {
  return (
    <div className="my-6 grid grid-cols-2 gap-3 md:grid-cols-4">
      {items.map((it) => (
        <div key={it.l} className="rounded-2xl border border-line bg-surface-2 p-4">
          <div className={clsx("tnum text-2xl font-semibold tracking-tight", it.tone === "keeper" ? "text-keeper" : it.tone === "held" ? "text-held" : it.tone === "gap" ? "text-gap" : "text-floor")}>{it.v}</div>
          <div className="mt-1 text-xs leading-snug text-ink-2">{it.l}</div>
        </div>
      ))}
    </div>
  );
}

export function Callout({ title, children, tone = "floor" }: { title: string; children: ReactNode; tone?: "floor" | "keeper" | "gap" }) {
  return (
    <div className={clsx("my-6 rounded-2xl border p-5", tone === "floor" ? "border-floor/30 bg-floor-soft" : tone === "keeper" ? "border-keeper/30 bg-keeper-soft" : "border-gap/30 bg-gap-soft")}>
      <div className="text-sm font-semibold text-ink">{title}</div>
      <div className="mt-1.5 text-sm leading-relaxed text-ink-2">{children}</div>
    </div>
  );
}

export function Formula({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <div className="my-4 rounded-2xl border border-line bg-bg px-5 py-4">
      {label && <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-ink-3">{label}</div>}
      <code className="block whitespace-pre-wrap font-mono text-[13px] leading-relaxed text-ink">{children}</code>
    </div>
  );
}
