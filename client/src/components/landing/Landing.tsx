"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, animate, motion, useInView, useReducedMotion } from "framer-motion";
import clsx from "clsx";
import { ArrowRight, ArrowsLeftRight, BellSimpleSlash, CalendarCheck, Check, Clock, Coins, Flask, Lightning, Lock, Minus, MoonStars, PiggyBank, Plus, SealCheck, ShieldCheck, Sparkle, SunHorizon, Vault, Wallet } from "@phosphor-icons/react";
import { FALLBACK_SUMMARY, pickFamous } from "@/lib/backtest";
import { SEPOLIA, explorerAddress, getStaticDeployment } from "@/lib/contracts";
import { Reveal } from "@/components/Reveal";
import { MondaySimulator } from "@/components/MondaySimulator";
import { IssuerMark, IssuerPill, StockMark } from "@/components/ui/StockMark";
import { WeekendBar } from "@/components/ui/WeekendBar";
import { LiveDot } from "@/components/ui/Badge";
import { HeroDemo } from "./HeroDemo";

const S = FALLBACK_SUMMARY;

export function Landing() {
  return (
    <div className="relative overflow-x-clip">
      <Hero />
      <Marquee />
      <Problem />
      <HowItWorks />
      <Issuers />
      <TryIt />
      <TwoSides />
      <Proof />
      <Safety />
      <Faq />
      <FinalCta />
    </div>
  );
}

/* ------------------------------------------------------------------ hero */

function Hero() {
  return (
    <section className="noise relative -mt-[76px] pb-16 pt-[140px] sm:pb-24 sm:pt-[170px]">
      {/* aurora */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -left-[10%] -top-[20%] h-[640px] w-[640px] animate-aurora rounded-full bg-[radial-gradient(circle,rgba(255,138,61,0.30),transparent_65%)] will-change-transform" />
        <div className="absolute -right-[10%] top-[5%] h-[560px] w-[560px] animate-aurora2 rounded-full bg-[radial-gradient(circle,rgba(123,131,255,0.26),transparent_65%)] will-change-transform" />
        <div className="absolute left-[35%] top-[45%] h-[420px] w-[420px] animate-aurora rounded-full bg-[radial-gradient(circle,rgba(92,200,255,0.16),transparent_65%)] will-change-transform" />
        <div className="bg-grid mask-radial absolute inset-0" />
      </div>

      <div className="container relative grid grid-cols-1 items-center gap-12 lg:grid-cols-2 xl:gap-16">
        <div>
          <div>
            <Link href="/protect" className="glass inline-flex items-center gap-2 rounded-full py-1.5 pl-1.5 pr-4 text-xs font-medium text-ink hover:bg-white/[0.06]">
              <span className="rounded-full bg-floor px-2 py-0.5 text-[11px] font-bold text-[#1A0E00]">LIVE</span>
              On Ethereum Sepolia · BNB Hack: Tokenized Stocks <ArrowRight weight="bold" className="h-3.5 w-3.5" />
            </Link>
          </div>

          <h1 className="mt-6 text-display-1">
            <span className="text-ink">Your stocks trade all weekend.</span>{" "}
            <span className="text-grad">Now they can be protected too.</span>
          </h1>

          <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-2">
            The US stock market shuts for 65 hours every weekend. If your stock opens lower on Monday, afterhours.fi pays you the difference. One tap on Friday, a few cents per $1,000.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/protect" className="btn btn-lg bg-gradient-to-r from-[#FFC76B] via-floor to-floor-2 text-[#1A0E00] shadow-glow hover:brightness-110">
              <ShieldCheck weight="duotone" className="h-5 w-5" /> Protect my stocks
            </Link>
            <Link href="/earn" className="btn btn-lg glass text-ink hover:bg-white/[0.07]">
              <Coins weight="duotone" className="h-5 w-5 text-keeper" /> Earn by backing others
            </Link>
          </div>

          <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-2">
            {["No lock-up, keep your stock", "Pays automatically on Monday", "Free to try on testnet"].map((t) => (
              <li key={t} className="flex items-center gap-2">
                <Check weight="bold" className="h-4 w-4 text-held" /> {t}
              </li>
            ))}
          </ul>

          <div className="mt-10">
            <div className="text-xs font-semibold uppercase tracking-wider text-ink-3">Works with</div>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <a href="#issuers" className="transition hover:brightness-110">
                <IssuerPill issuer="bstock" short size="lg" className="!text-[15px] font-bold" />
              </a>
              <a href="#issuers" className="transition hover:brightness-110">
                <IssuerPill issuer="ondo" short size="lg" className="!text-[15px] font-bold" />
              </a>
              <span className="text-xs text-ink-3">
                on <span className="text-ink-2">BNB Chain</span> · <span className="text-ink-2">Ethereum</span>
              </span>
            </div>
          </div>
        </div>

        <div>
          <HeroDemo />
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ marquee */

function Marquee() {
  const items = pickFamous(S.famous).filter((f) => f.gap < 0);
  const row = [...items, ...items];
  return (
    <section aria-label="Famous weekend drops" className="relative border-y border-line/60 bg-surface/40 py-4">
      <div className="mask-x overflow-hidden">
        <div className="flex w-max animate-marquee gap-10 hover:[animation-play-state:paused]">
          {row.map((f, i) => (
            <div key={`${f.friday}-${f.ticker}-${i}`} className="flex items-center gap-3 whitespace-nowrap text-sm">
              <StockMark ticker={f.ticker} size={24} />
              <span className="text-ink-2">{f.event}</span>
              <span className="tnum font-semibold text-gap">
                {f.ticker} {(f.gap * 100).toFixed(1)}%
              </span>
              <span className="text-ink-4">·</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ problem */

function CountUp({ to, decimals = 0, prefix = "", suffix = "" }: { to: number; decimals?: number; prefix?: string; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  const reduced = useReducedMotion();
  const [v, setV] = useState(reduced ? to : 0);
  useEffect(() => {
    if (!inView || reduced) return;
    const c = animate(0, to, { duration: 1.4, ease: [0.22, 1, 0.36, 1], onUpdate: setV });
    return () => c.stop();
  }, [inView, to, reduced]);
  return (
    <span ref={ref} className="tnum">
      {prefix}
      {v.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
      {suffix}
    </span>
  );
}

function SectionHead({ eyebrow, title, sub, center = false, tone = "floor" }: { eyebrow: string; title: React.ReactNode; sub?: React.ReactNode; center?: boolean; tone?: "floor" | "keeper" }) {
  return (
    <Reveal className={clsx("max-w-2xl", center && "mx-auto text-center")}>
      <div className={clsx("eyebrow", tone === "floor" ? "text-floor" : "text-keeper", center && "justify-center")}>{eyebrow}</div>
      <h2 className="mt-3 text-display-2">{title}</h2>
      {sub && <p className="mt-4 text-lg leading-relaxed text-ink-2">{sub}</p>}
    </Reveal>
  );
}

function Problem() {
  const cards = [
    { big: <CountUp to={65.5} decimals={1} suffix="h" />, title: "Every weekend, the market is shut", body: "From Friday 4 pm to Monday 9:30 am New York, nobody can buy or sell a US stock on the exchange." },
    { big: <CountUp to={92} suffix="%" />, title: "…but tokenized stocks keep trading", body: "92% of on-chain bStock trading happens while the US market is closed. The risk is live all weekend." },
    { big: <CountUp to={589} prefix="$" suffix="B" />, title: "One Monday can erase a year", body: "Nvidia lost $589 billion on Monday Jan 27, 2025, after news broke over the weekend. It opened 12.5% lower." },
  ];
  return (
    <section className="container py-20 sm:py-24">
      <SectionHead eyebrow="The problem" title={<>The weekend is when the worst Mondays are made.</>} sub="Stop-losses can’t help: they sell after the drop, at Monday’s price. Until now, holders just took the hit." />
      <div className="mt-14 grid gap-4 md:grid-cols-3">
        {cards.map((c, i) => (
          <Reveal key={i} delay={i * 0.08} className="card relative overflow-hidden p-7">
            <div className="text-5xl font-semibold tracking-tight text-grad">{c.big}</div>
            <div className="mt-6 text-lg font-semibold">{c.title}</div>
            <p className="mt-2 text-sm leading-relaxed text-ink-2">{c.body}</p>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ how it works */

function HowItWorks() {
  const steps = [
    { icon: CalendarCheck, t: "Friday, before 4 pm", h: "Pick a stock and a protection line", p: "For example: protect $1,000 of Nvidia if it opens more than 3% lower. You see the exact price, usually a few cents to a few dollars." },
    { icon: MoonStars, t: "The weekend", h: "Close the app. Live your life.", p: "The money to pay you is already locked in the pool the moment you buy. There is nothing to watch and nothing to sell." },
    { icon: SunHorizon, t: "Monday, 9:30 am", h: "It settles by itself", p: "We compare Monday’s official opening price with Friday’s close. If the drop went past your line, USDT lands in your wallet. If not, you keep your stock and every gain." },
  ];
  return (
    <section id="how" className="relative scroll-mt-24 py-20 sm:py-24">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(50%_50%_at_50%_50%,rgba(255,138,61,0.06),transparent)]" aria-hidden />
      <div className="container relative">
        <SectionHead center eyebrow="How it works" title="Three moments. One tap." sub="Like travel insurance, but for one weekend of one stock." />
        <div className="relative mt-16 grid gap-6 md:grid-cols-3">
          <div className="absolute left-0 right-0 top-9 hidden h-px bg-gradient-to-r from-transparent via-floor/50 to-transparent md:block" aria-hidden />
          {steps.map((s, i) => (
            <Reveal key={s.h} delay={i * 0.1} className="relative">
              <div className="relative mx-auto flex h-[72px] w-[72px] items-center justify-center rounded-3xl border border-floor/30 bg-surface shadow-glow">
                <s.icon weight="duotone" className="h-7 w-7 text-floor" />
                <span className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-floor text-xs font-bold text-[#1A0E00]">{i + 1}</span>
              </div>
              <div className="mt-6 text-center">
                <div className="text-xs font-semibold uppercase tracking-wider text-ink-3">{s.t}</div>
                <h3 className="mt-2 text-xl font-semibold">{s.h}</h3>
                <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-ink-2">{s.p}</p>
              </div>
            </Reveal>
          ))}
        </div>
        <Reveal className="mx-auto mt-14 max-w-3xl">
          <WeekendBar />
        </Reveal>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ issuers */

function Issuers() {
  const cards = [
    {
      issuer: "bstock" as const,
      title: "Binance bStocks",
      tag: "Trades all weekend",
      glow: "rgba(240,185,11,0.18)",
      border: "border-[#F0B90B]/25",
      points: [
        { icon: Clock, text: "Trade 24/7 on Binance and on PancakeSwap, including Saturday and Sunday." },
        { icon: ArrowsLeftRight, text: "Switch between the Binance and on-chain versions 1:1, for free, any time." },
        { icon: Lightning, text: "So weekend news hits the price right away, while the real US market is shut." },
      ],
      bottom: "Protection turns that live weekend risk into a known, fixed cost.",
    },
    {
      issuer: "ondo" as const,
      title: "Ondo Stocks",
      tag: "Stuck until Sunday night",
      glow: "rgba(255,255,255,0.10)",
      border: "border-white/15",
      points: [
        { icon: Lock, text: "For most names, creating and cashing out closes on Friday evening." },
        { icon: MoonStars, text: "Holders can’t get out at the real price until Sunday night, whatever the news." },
        { icon: ShieldCheck, text: "Protection is the only exit: it pays you if Monday opens lower." },
      ],
      bottom: "Buy it on Friday, then close the app for the weekend.",
    },
  ];
  return (
    <section id="issuers" className="container scroll-mt-24 py-20 sm:py-24">
      <SectionHead
        center
        eyebrow="Made for your tokens"
        title="Built for bStocks and Ondo Stocks."
        sub="The two biggest ways to hold US stocks on BNB Chain. They behave differently on weekends, and both leave you exposed on Monday."
      />
      <div className="mt-14 grid gap-5 lg:grid-cols-2">
        {cards.map((c, i) => (
          <Reveal key={c.issuer} delay={i * 0.08} className={clsx("card relative overflow-hidden p-8", c.border)}>
            <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full" style={{ background: `radial-gradient(circle, ${c.glow}, transparent 65%)` }} aria-hidden />
            <div className="relative flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <IssuerMark issuer={c.issuer} size={44} />
                <h3 className="text-2xl font-semibold">{c.title}</h3>
              </div>
              <span className="rounded-full border border-line bg-surface-2 px-3 py-1 text-xs font-medium text-ink-2">{c.tag}</span>
            </div>
            <ul className="relative mt-7 space-y-4">
              {c.points.map((p) => (
                <li key={p.text} className="flex items-start gap-3 text-sm leading-relaxed text-ink">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/[0.05] text-ink-2">
                    <p.icon weight="duotone" className="h-[18px] w-[18px]" />
                  </span>
                  <span className="pt-1.5">{p.text}</span>
                </li>
              ))}
            </ul>
            <p className="relative mt-7 border-t border-line pt-5 text-sm font-medium text-ink-2">{c.bottom}</p>
          </Reveal>
        ))}
      </div>
      <Reveal className="mx-auto mt-6 flex max-w-3xl items-start justify-center gap-3 rounded-2xl border border-line bg-surface-2 px-5 py-4 text-sm text-ink-2">
        <SealCheck weight="duotone" className="mt-0.5 h-5 w-5 shrink-0 text-held" />
        <span>
          Both are priced off the <span className="text-ink">same official US price</span>: Friday’s close and Monday’s opening price on the stock exchange, never the thin weekend token market.
        </span>
      </Reveal>
    </section>
  );
}

/* ------------------------------------------------------------------ try it */

function TryIt() {
  const [ticker, setTicker] = useState("NVDA");
  const [amount, setAmount] = useState(1000);
  const [line, setLine] = useState(300);
  const costPer1k: Record<string, number> = { NVDA: 0.9, SPY: 0.2, AAPL: 0.8, COIN: 4.2, TSLA: 2.2 };
  const cost = (costPer1k[ticker] ?? 1) * (amount / 1000) * ({ 200: 1.7, 300: 1, 500: 0.45, 1000: 0.12 } as Record<number, number>)[line];
  return (
    <section id="try" className="container scroll-mt-24 py-20 sm:py-24">
      <div className="grid grid-cols-1 items-start gap-12 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="lg:sticky lg:top-28">
          <SectionHead eyebrow="Try it" title="What would Monday do to you?" sub="Drag the slider to any Monday you can imagine, or tap a real one. You’ll see what you lose without protection, and what you get back with it." />
          <Reveal className="mt-8 space-y-5">
            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-3">Stock</div>
              <div className="flex flex-wrap gap-2">
                {Object.keys(costPer1k).map((t) => (
                  <button key={t} onClick={() => setTicker(t)} className={clsx("flex items-center gap-2 rounded-full border py-1.5 pl-1.5 pr-3.5 text-sm font-medium transition", ticker === t ? "border-floor/50 bg-floor-soft text-ink" : "border-line bg-surface-2 text-ink-2 hover:text-ink")}>
                    <StockMark ticker={t} size={24} /> {t}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-3">Amount</div>
              <div className="flex flex-wrap gap-2">
                {[500, 1000, 10000].map((a) => (
                  <button key={a} onClick={() => setAmount(a)} className={clsx("rounded-full border px-4 py-2 text-sm font-medium transition", amount === a ? "border-floor/50 bg-floor-soft text-ink" : "border-line bg-surface-2 text-ink-2 hover:text-ink")}>
                    ${a.toLocaleString()}
                  </button>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-line bg-surface-2 p-4 text-sm text-ink-2">
              Protecting ${amount.toLocaleString()} of {ticker} below −{line / 100}% costs about <b className="text-floor">${cost.toFixed(2)}</b> for one weekend.
              <span className="mt-1 block text-xs text-ink-3">Typical price. The app shows your exact price, which moves with how jumpy the stock is that week.</span>
            </div>
          </Reveal>
        </div>
        <Reveal>
          <MondaySimulator ticker={ticker} amount={amount} lineBps={line} cost={cost} showLinePicker onLineChange={setLine} className="!bg-surface/80 shadow-pop" />
        </Reveal>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ two sides */

function TwoSides() {
  return (
    <section id="earn" className="container scroll-mt-24 py-20 sm:py-24">
      <SectionHead center eyebrow="Two ways to use it" title="Sleep better, or earn from people who want to." />
      <div className="mt-14 grid gap-5 lg:grid-cols-2">
        <Reveal className="card ring-grad relative overflow-hidden p-8">
          <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(255,138,61,0.22),transparent_65%)]" aria-hidden />
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-floor-soft text-floor">
            <ShieldCheck weight="duotone" className="h-6 w-6" />
          </span>
          <h3 className="mt-6 text-2xl font-semibold">Protect</h3>
          <p className="mt-2 text-ink-2">For anyone holding tokenized US stocks who doesn’t want Monday to ruin their week.</p>
          <ul className="mt-6 space-y-3 text-sm">
            {["Pick any line from 1% to 10%", "Pay once, only for the weekends you want", "Keep your stock and every dollar of upside", "Paid automatically in USDT on Monday"].map((t) => (
              <li key={t} className="flex items-start gap-3 text-ink">
                <Check weight="bold" className="mt-0.5 h-4 w-4 shrink-0 text-floor" /> {t}
              </li>
            ))}
          </ul>
          <Link href="/protect" className="btn-primary mt-8 sm:w-auto sm:px-8">
            Protect a weekend <ArrowRight weight="bold" className="h-5 w-5" />
          </Link>
        </Reveal>

        <Reveal delay={0.08} className="card relative overflow-hidden border-keeper/20 p-8">
          <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(92,200,255,0.22),transparent_65%)]" aria-hidden />
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-keeper-soft text-keeper">
            <PiggyBank weight="duotone" className="h-6 w-6" />
          </span>
          <h3 className="mt-6 text-2xl font-semibold">Earn</h3>
          <p className="mt-2 text-ink-2">For people who’d like to be the insurer: add USDT to the pool and collect every weekly fee.</p>
          <ul className="mt-6 space-y-3 text-sm">
            {[`About ${Math.round(S.keeper.roc_pa * 100)}–${Math.round(S.keeper.roc_pa_since_2015 * 100)}% a year in 21 years of history`, "Half the pool is a safety reserve, never at risk", "Every protection is fully paid for before it’s sold", "Withdraw anything not set aside for this weekend"].map((t) => (
              <li key={t} className="flex items-start gap-3 text-ink">
                <Check weight="bold" className="mt-0.5 h-4 w-4 shrink-0 text-keeper" /> {t}
              </li>
            ))}
          </ul>
          <Link href="/earn" className="btn-keeper mt-8 sm:w-auto sm:px-8">
            Start earning <ArrowRight weight="bold" className="h-5 w-5" />
          </Link>
        </Reveal>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ proof (bento) */

function Proof() {
  const nvda = S.hermee[0];
  const dep = getStaticDeployment(SEPOLIA);
  return (
    <section className="container py-20 sm:py-24">
      <SectionHead eyebrow="Backed by data" title="Priced from 21 years of real weekends." sub="Not a guess. Every price comes from how 50 stocks actually moved over 61,815 weekends, adjusted for how jumpy each one is this week." />
      <div className="mt-14 grid auto-rows-[minmax(180px,auto)] gap-4 md:grid-cols-6">
        <Reveal className="card relative overflow-hidden p-7 md:col-span-3 md:row-span-2">
          <div className="text-sm text-ink-2">Weekends studied</div>
          <div className="mt-2 text-6xl font-semibold tracking-tight text-grad sm:text-7xl">
            <CountUp to={61815} />
          </div>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-ink-2">Across 50 stocks from 2005 to 2026, including every crash weekend: Lehman, Covid, SVB, DeepSeek. Out of every 100 weekends, a 5%+ drop happened less than 1 time.</p>
          <div className="mt-8 grid w-full max-w-[240px] grid-cols-10 gap-1" aria-hidden>
            {Array.from({ length: 100 }).map((_, i) => (
              <span key={i} className={clsx("aspect-square rounded-[3px]", i === 57 ? "bg-gap shadow-[0_0_10px_rgba(255,107,107,0.8)]" : "bg-surface-4")} />
            ))}
          </div>
          <div className="mt-3 flex items-center gap-2 text-xs text-ink-3">
            <span className="h-2.5 w-2.5 rounded-[3px] bg-gap" /> one weekend that dropped 5% or more
          </div>
        </Reveal>

        <Reveal delay={0.05} className="card p-7 md:col-span-3">
          <div className="flex items-center gap-3">
            <StockMark ticker="NVDA" size={36} />
            <div className="text-sm font-semibold">Holding $100k of Nvidia, 2024–2026</div>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-ink-3">Paid in fees</div>
              <div className="tnum text-2xl font-semibold">${nvda.paid.toLocaleString()}</div>
            </div>
            <div>
              <div className="text-xs text-ink-3">Got back</div>
              <div className="tnum text-2xl font-semibold text-held">${nvda.received.toLocaleString()}</div>
            </div>
          </div>
          <p className="mt-4 text-sm text-ink-2">
            Worst Monday: <span className="tnum text-gap">−${Math.abs(nvda.worst_bare).toLocaleString()}</span> without protection, <span className="tnum text-ink">−${Math.abs(nvda.worst_covered).toLocaleString()}</span> with it.
          </p>
        </Reveal>

        <Reveal delay={0.1} className="card p-7 md:col-span-3">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-keeper-soft text-keeper">
              <Vault weight="duotone" className="h-4 w-4" />
            </span>
            <div className="text-sm font-semibold">Backing the pool since 2015</div>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-ink-3">Typical year</div>
              <div className="tnum text-2xl font-semibold text-keeper">+{Math.round(S.keeper.roc_pa_since_2015 * 100)}%</div>
            </div>
            <div>
              <div className="text-xs text-ink-3">Weekends that lost money</div>
              <div className="tnum text-2xl font-semibold">{Math.round(S.keeper.share_weekends_losing * 100)}%</div>
            </div>
          </div>
          <p className="mt-4 text-sm text-ink-2">Honest caveat: the worst weekend (March 2020) was a big one for the pool. That’s why half of it is kept as a safety reserve.</p>
        </Reveal>

        <Reveal delay={0.05} className="card flex flex-col justify-between p-7 md:col-span-2">
          <Lightning weight="duotone" className="h-6 w-6 text-floor" />
          <div>
            <div className="tnum mt-6 text-4xl font-semibold">2%</div>
            <div className="mt-1 text-sm text-ink-2">of Monday’s drop shows up in the token by Sunday night. Selling on Sunday doesn’t save you.</div>
          </div>
        </Reveal>
        <Reveal delay={0.1} className="card flex flex-col justify-between p-7 md:col-span-2">
          <BellSimpleSlash weight="duotone" className="h-6 w-6 text-keeper" />
          <div>
            <div className="tnum mt-6 text-4xl font-semibold">0</div>
            <div className="mt-1 text-sm text-ink-2">things to do over the weekend. No alerts, no stop-losses, no watching charts.</div>
          </div>
        </Reveal>
        <Reveal delay={0.15} className="card flex flex-col justify-between p-7 md:col-span-2">
          <Flask weight="duotone" className="h-6 w-6 text-held" />
          <div>
            <div className="mt-6 text-lg font-semibold">Tested live on-chain</div>
            <div className="mt-1 text-sm text-ink-2">A simulated −7% Monday paid exactly $40 on a $1,000 protection with a 3% line.</div>
            {dep && (
              <a href={explorerAddress(SEPOLIA, dep.contracts.CoverMarket)} target="_blank" rel="noreferrer" className="btn-link mt-3 !text-xs">
                See the contract <ArrowRight weight="bold" className="h-3 w-3" />
              </a>
            )}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ safety */

function Safety() {
  const items = [
    { icon: Lock, h: "Paid for before it’s sold", p: "The moment you buy, the most you could be paid is locked in the pool. It can’t be spent on anything else." },
    { icon: SealCheck, h: "Settles from the official price", p: "Payouts use the exchange’s Monday opening price, not the thin weekend token market, so nobody can game it." },
    { icon: Wallet, h: "You keep your stock", p: "Protection sits next to your holding. Nothing is sold, lent or locked, and you keep every gain." },
    { icon: Sparkle, h: "Calm by design", p: "No confetti, no leaderboards, no odds. Your streak counts weekends you were careful, never trades." },
  ];
  return (
    <section className="container py-20 sm:py-24">
      <SectionHead center eyebrow="Built to be trusted" title="Simple rules, written into the contract." />
      <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((it, i) => (
          <Reveal key={it.h} delay={i * 0.06} className="card-2 p-6">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.05] text-ink">
              <it.icon weight="duotone" className="h-5 w-5" />
            </span>
            <h3 className="mt-5 font-semibold">{it.h}</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-2">{it.p}</p>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ faq */

const FAQ: { q: string; a: string }[] = [
  { q: "What exactly do I get?", a: "A safety net for one weekend on one stock. If the stock opens on Monday more than your chosen line (for example 3%) below Friday’s close, you get the difference back in USDT, up to 20% of the amount you protected. If it doesn’t fall that far, nothing happens and you keep your stock." },
  { q: "How much does it cost?", a: "Usually a few cents to a few dollars per $1,000 for one weekend. Calm stocks like the S&P 500 are cheapest; jumpy ones like Coinbase cost more. You always see the exact dollar amount before you pay." },
  { q: "When do I need to buy it?", a: "Any time before Friday 4:00 pm New York, when the US market closes. After that, sales for that weekend stop, because news starts to show up in futures and it wouldn’t be fair to the pool." },
  { q: "How do I get paid?", a: "Automatically. On Monday at 9:30 am New York we compare the official opening price with Friday’s close. If you’re owed money, it’s sent in USDT to the wallet you bought with." },
  { q: "Do I have to hold the stock?", a: "Yes. You can only protect stock you actually hold in your wallet. That keeps it protection, not betting." },
  { q: "Who pays me, and could they run out?", a: "The protection pool: USDT from people who chose to earn. Before your protection is sold, the most you could be paid is locked for you, so the money is already there." },
  { q: "What if something weird happens, like a stock split?", a: "If Friday and Monday prices can’t be compared fairly (a split, a halt, no Monday price), that weekend is cancelled and your fee is returned." },
  { q: "Is this real money?", a: "Not yet. This is a hackathon build on test networks, with free test tokens. The admin can pause things and move funds. It isn’t available in restricted countries." },
];

function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  const reduced = useReducedMotion();
  return (
    <section id="faq" className="container scroll-mt-24 py-20 sm:py-24">
      <div className="grid grid-cols-1 gap-12 lg:grid-cols-[0.8fr_1.2fr]">
        <SectionHead eyebrow="Questions" title="Plain answers." sub={<>Still curious? The <Link href="/docs" className="text-ink underline underline-offset-4">full explainer</Link> walks through the pricing and the math.</>} />
        <ul className="space-y-3">
          {FAQ.map((f, i) => {
            const isOpen = open === i;
            return (
              <li key={f.q} className={clsx("rounded-2xl border transition", isOpen ? "border-line-strong bg-surface-2" : "border-line bg-surface/60")}>
                <button type="button" onClick={() => setOpen(isOpen ? null : i)} aria-expanded={isOpen} className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left font-medium">
                  {f.q}
                  <span className={clsx("flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition", isOpen ? "bg-floor text-[#1A0E00]" : "bg-surface-3 text-ink-2")}>{isOpen ? <Minus weight="bold" className="h-4 w-4" /> : <Plus weight="bold" className="h-4 w-4" />}</span>
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div initial={reduced ? false : { height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                      <p className="px-5 pb-5 text-sm leading-relaxed text-ink-2">{f.a}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ final CTA */

function FinalCta() {
  return (
    <section className="container pb-20 sm:pb-24">
      <Reveal className="noise relative overflow-hidden rounded-4xl border border-floor/25 px-6 py-16 text-center sm:px-12 sm:py-24">
        <div className="absolute inset-0 bg-[radial-gradient(70%_90%_at_50%_0%,rgba(255,138,61,0.28),transparent_70%),radial-gradient(50%_60%_at_80%_100%,rgba(123,131,255,0.22),transparent)]" aria-hidden />
        <div className="bg-grid mask-radial absolute inset-0 opacity-60" aria-hidden />
        <div className="relative">
          <div className="inline-flex items-center gap-2 text-sm text-ink-2">
            <LiveDot tone="floor" /> This weekend’s protection is open
          </div>
          <h2 className="mx-auto mt-5 max-w-3xl text-display-2">Protect your first weekend in about a minute.</h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-ink-2">Free test tokens included. No real money, no sign-up, just a wallet.</p>
          <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/protect" className="btn btn-lg bg-gradient-to-r from-[#FFC76B] via-floor to-floor-2 px-8 text-[#1A0E00] shadow-glow hover:brightness-110">
              <ShieldCheck weight="duotone" className="h-5 w-5" /> Get started
            </Link>
            <Link href="/docs" className="btn btn-lg glass px-8 text-ink hover:bg-white/[0.07]">
              Read the docs
            </Link>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
