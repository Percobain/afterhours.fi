"use client";
import { useState } from "react";
import clsx from "clsx";

/**
 * Official company marks, served from /public/logos. `bg` is the badge colour that keeps the mark
 * legible on our dark UI; `pad` is the inner padding as a fraction of the badge size (0 = full bleed).
 */
const LOGOS: Record<string, { src: string; bg: string; pad: number }> = {
  NVDA: { src: "/logos/NVDA.svg", bg: "#FFFFFF", pad: 0.16 },
  TSLA: { src: "/logos/TSLA.svg", bg: "#FFFFFF", pad: 0.2 },
  AAPL: { src: "/logos/AAPL.svg", bg: "#FFFFFF", pad: 0.22 },
  SPY: { src: "/logos/SPY.svg", bg: "#FFFFFF", pad: 0.24 },
  KRE: { src: "/logos/KRE.svg", bg: "#FFFFFF", pad: 0.24 },
  COIN: { src: "/logos/COIN.png", bg: "#FFFFFF", pad: 0.1 },
  MSTR: { src: "/logos/MSTR.svg", bg: "#FFFFFF", pad: 0.2 },
  WAL: { src: "/logos/WAL.png", bg: "#FFFFFF", pad: 0.14 },
  AIG: { src: "/logos/AIG.svg", bg: "#FFFFFF", pad: 0.14 },
  ZM: { src: "/logos/ZM.png", bg: "#FFFFFF", pad: 0 },
  AMD: { src: "/logos/AMD.svg", bg: "#FFFFFF", pad: 0.24 },
  MSFT: { src: "/logos/MSFT.svg", bg: "#FFFFFF", pad: 0.2 },
  QQQ: { src: "/logos/QQQ.svg", bg: "#FFFFFF", pad: 0.14 },
};

const HUES: Record<string, [string, string]> = {
  NVDA: ["#76B900", "#3F6B00"],
  TSLA: ["#E82127", "#7A0D10"],
  AAPL: ["#D8DDE6", "#6C7489"],
  SPY: ["#5CC8FF", "#2C5DA8"],
  COIN: ["#3B82F6", "#1E3A8A"],
  MSTR: ["#FF8A3D", "#9A3B00"],
  MSFT: ["#22C55E", "#0EA5E9"],
  QQQ: ["#A78BFA", "#4C1D95"],
};

/** Map token symbols like "NVDAon" / "NVDAb" / "bNVDA" back to the underlying ticker. */
function baseTicker(raw: string): string {
  const t = raw.trim();
  if (LOGOS[t.toUpperCase()]) return t.toUpperCase();
  const stripped = t.replace(/on$/, "").replace(/^b(?=[A-Z])/, "").replace(/b$/, "").toUpperCase();
  return LOGOS[stripped] ? stripped : t.toUpperCase();
}

/** Round badge with the company's official logo, falling back to a coloured monogram. */
export function StockMark({ ticker, size = 40, className }: { ticker: string; size?: number; className?: string }) {
  const key = baseTicker(ticker);
  const logo = LOGOS[key];
  const [failed, setFailed] = useState(false);

  if (logo && !failed) {
    const pad = Math.round(size * logo.pad);
    return (
      <span
        className={clsx("relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full ring-1 ring-white/10", className)}
        style={{ width: size, height: size, background: logo.bg, padding: pad, boxShadow: "0 6px 18px -8px rgba(0,0,0,0.8)" }}
        aria-hidden
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logo.src} alt="" width={size} height={size} draggable={false} onError={() => setFailed(true)} className="h-full w-full object-contain" />
      </span>
    );
  }

  const [a, b] = HUES[key] ?? ["#FFB547", "#7B83FF"];
  const txt = key.length > 4 ? key.slice(0, 4) : key;
  return (
    <span
      className={clsx("relative inline-flex shrink-0 items-center justify-center rounded-full font-bold tracking-tight text-white", className)}
      style={{ width: size, height: size, background: `radial-gradient(120% 120% at 20% 10%, ${a}, ${b})`, fontSize: size * (txt.length > 3 ? 0.26 : 0.32), boxShadow: `inset 0 1px 0 rgba(255,255,255,0.25), 0 6px 18px -6px ${a}80` }}
      aria-hidden
    >
      {txt}
    </span>
  );
}

/** Issuer marks for the two tokenized-stock families we support. */
export type Issuer = "bstock" | "ondo";

const ISSUERS: Record<Issuer, { src: string; bg: string; label: string; short: string }> = {
  bstock: { src: "/logos/binance.svg", bg: "#181A20", label: "Binance bStock", short: "bStocks" },
  ondo: { src: "/logos/ondo.svg", bg: "#FFFFFF", label: "Ondo Stock", short: "Ondo Stocks" },
};

export function issuerLabel(issuer: Issuer, short = false) {
  return short ? ISSUERS[issuer].short : ISSUERS[issuer].label;
}

/** Round badge with the issuer's official logo (Binance or Ondo Finance). */
export function IssuerMark({ issuer, size = 16, className }: { issuer: Issuer; size?: number; className?: string }) {
  const it = ISSUERS[issuer];
  return (
    <span
      className={clsx("inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full ring-1 ring-white/10", className)}
      style={{ width: size, height: size, background: it.bg, padding: Math.round(size * (issuer === "ondo" ? 0.12 : 0.16)) }}
      aria-hidden
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={it.src} alt="" width={size} height={size} draggable={false} className="h-full w-full object-contain" />
    </span>
  );
}

/** Pill with issuer logo + name, e.g. "Binance bStock" / "Ondo Stock". */
export function IssuerPill({ issuer, short = false, size = "sm", className }: { issuer: Issuer; short?: boolean; size?: "sm" | "md" | "lg"; className?: string }) {
  const s = { sm: { mark: 14, cls: "gap-1.5 py-0.5 pl-0.5 pr-2 text-[11px]" }, md: { mark: 18, cls: "gap-2 py-1 pl-1 pr-3 text-xs" }, lg: { mark: 24, cls: "gap-2.5 py-1.5 pl-1.5 pr-4 text-sm" } }[size];
  return (
    <span className={clsx("inline-flex items-center whitespace-nowrap rounded-full border font-semibold", issuer === "bstock" ? "border-[#F0B90B]/30 bg-[#F0B90B]/10 text-[#F8D33A]" : "border-white/15 bg-white/[0.06] text-ink", s.cls, className)}>
      <IssuerMark issuer={issuer} size={s.mark} />
      {issuerLabel(issuer, short)}
    </span>
  );
}
