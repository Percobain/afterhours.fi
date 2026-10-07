"use client";
import { useEffect, useState } from "react";
import clsx from "clsx";
import D from "./data.json";
import { Calibration, Callout, DataTable, Figure, Formula, ImageFigure, KeyNumbers, RefBars, TailCompare, YearBars } from "./Charts";
import { STORY_SECTIONS, Story } from "./Story";
import { ModeText } from "@/components/ModeText";

/* ------------------------------------------------------------------ helpers */

const pct = (x: number, d = 1) => `${(x * 100).toFixed(d)}%`;
const usd = (x: number) => `${x < 0 ? "−" : ""}$${Math.abs(Math.round(x)).toLocaleString("en-US")}`;
const bp = (x: number, d = 1) => `${x.toFixed(d)} bp`;

const SECTIONS = [
  { id: "abstract", n: "0", t: "Abstract" },
  { id: "journey", n: "1", t: "The intuition, and how it changed" },
  { id: "market", n: "2", t: "Does anyone want this?" },
  { id: "history", n: "3", t: "The history of bad weekends" },
  { id: "model", n: "4", t: "The two-sided model" },
  { id: "data", n: "5", t: "Backtest: data and method" },
  { id: "results", n: "6", t: "Backtest: results" },
  { id: "conclusions", n: "7", t: "Conclusions for both sides" },
  { id: "tech", n: "8", t: "Technology" },
  { id: "accuracy", n: "9", t: "How far to trust the numbers" },
  { id: "refs", n: "10", t: "References" },
];

const ALL_SECTIONS = [...STORY_SECTIONS, ...SECTIONS];

function useActive() {
  const [active, setActive] = useState(STORY_SECTIONS[0].id);
  useEffect(() => {
    const els = ALL_SECTIONS.map((s) => document.getElementById(s.id)).filter(Boolean) as HTMLElement[];
    const io = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (vis) setActive(vis.target.id);
      },
      { rootMargin: "-20% 0px -70% 0px" }
    );
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, []);
  return active;
}

function Section({ id, n, title, lead, children }: { id: string; n: string; title: string; lead?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-28 border-t border-line pt-14 first:border-t-0 first:pt-0">
      <div className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-floor">§{n}</div>
      <h2 className="mt-2 text-3xl font-semibold tracking-tight text-ink sm:text-[2.1rem]">{title}</h2>
      {lead && <p className="mt-3 max-w-3xl text-lg leading-relaxed text-ink-2">{lead}</p>}
      <div className="prose-docs mt-6">{children}</div>
    </section>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="my-4 max-w-3xl leading-relaxed text-ink-2">{children}</p>;
}
function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-2 mt-10 text-xl font-semibold tracking-tight text-ink">{children}</h3>;
}
function B({ children }: { children: React.ReactNode }) {
  return <b className="font-semibold text-ink">{children}</b>;
}
function UL({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="my-4 max-w-3xl space-y-2">
      {items.map((it, i) => (
        <li key={i} className="flex gap-3 leading-relaxed text-ink-2">
          <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-floor" aria-hidden />
          <span>{it}</span>
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------------ data selections */

const FAMOUS_PICK: [string, string][] = [
  ["2008-09-12", "AIG"], ["2008-09-12", "BAC"], ["2011-08-05", "BAC"], ["2015-08-21", "AAPL"], ["2015-08-21", "NFLX"],
  ["2020-03-06", "XOM"], ["2020-03-13", "SPY"], ["2020-03-13", "AAPL"], ["2020-03-13", "TQQQ"], ["2020-11-06", "ZM"],
  ["2022-06-10", "COIN"], ["2022-06-10", "MSTR"], ["2023-03-10", "KRE"], ["2023-03-10", "WAL"], ["2024-08-02", "NVDA"],
  ["2024-08-02", "COIN"], ["2025-01-24", "NVDA"], ["2025-01-24", "AVGO"], ["2025-04-04", "NVDA"],
  ["2018-02-02", "SPY"], ["2021-01-22", "GME"], ["2025-10-03", "AMD"],
];

const ENGINE_NAMES: Record<string, { label: string; sub: string }> = {
  v1a: { label: "Black-Scholes, calendar clock", sub: "textbook, weekend = 65.5 h" },
  v1b: { label: "Black-Scholes, trading clock", sub: "textbook, weekend = 1 day" },
  v2: { label: "Own-history empirical", sub: "each stock’s past weekends" },
  v3: { label: "Extreme-value (GPD) tail", sub: "peaks-over-threshold" },
  v4: { label: "Pooled, volatility-scaled", sub: "the engine we ship" },
};

/* ------------------------------------------------------------------ page */

export function Docs() {
  const active = useActive();
  const famous = FAMOUS_PICK.map(([f, t]) => D.famous.find((r) => r.friday === f && r.ticker === t)).filter(Boolean) as typeof D.famous;
  const sc = D.scorecard;
  const v4 = sc.find((r) => r.version === "v4")!;
  const pooled = D.pooled.find((r) => r.index === "all")!;
  const single = D.pooled.find((r) => r.index === "single names")!;
  const etfs = D.pooled.find((r) => r.index === "ETFs")!;
  const div = D.keeper.find((r) => r.book.startsWith("diversified"))!;
  const hermee = D.hermee;
  const nvda = hermee.find((h) => h.scenario === "H1")!;
  const zm = hermee.find((h) => h.scenario === "H7")!;
  const spy21 = hermee.find((h) => h.scenario === "H11")!;
  const ruinRow = (cap: number) => D.ruin.find((r) => Math.abs(r.capital_ratio - cap) < 1e-9)!;
  const r10 = ruinRow(0.1);
  const cppi = D.cppi.find((r) => r.m === 10 && r.floor === 0.5)!;
  const tok = D.token;

  return (
    <div className="container pb-24 pt-10 sm:pt-14">
      {/* title block */}
      <header className="max-w-3xl">
        <div className="eyebrow text-floor">Docs · afterhours.fi</div>
        <h1 className="mt-3 text-display-2">How afterhours.fi works, and how we know it does</h1>
        <p className="mt-4 text-lg leading-relaxed text-ink-2">
          Two parts. <b className="text-ink">Part I</b> is the story: how Hermee protects her weekend, how Kip earns by backing her, and what the protocol does underneath, with round numbers you can check in your head. <b className="text-ink">Part II</b> is the full research methodology behind every number: the journey, market research, 21 years of weekends, the backtest and its limits.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <a href="#part-1" className="btn-soft !h-10 !rounded-xl">Read the story (10 min)</a>
          <a href="#part-2" className="btn-soft !h-10 !rounded-xl">Jump to the methodology</a>
        </div>
      </header>

      <div className="mt-12 grid grid-cols-1 gap-12 lg:grid-cols-[240px_minmax(0,1fr)]">
        {/* table of contents */}
        <nav className="hidden lg:block" aria-label="Contents">
          <div className="sticky top-28 space-y-6">
            {[
              { title: "Part I · The story", items: STORY_SECTIONS },
              { title: "Part II · The methodology", items: SECTIONS },
            ].map((g) => (
              <div key={g.title}>
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-3">{g.title}</div>
                <ol className="space-y-0.5 border-l border-line">
                  {g.items.map((s) => (
                    <li key={s.id}>
                      <a href={`#${s.id}`} className={clsx("-ml-px flex gap-3 border-l py-1.5 pl-4 text-sm transition", active === s.id ? "border-floor text-ink" : "border-transparent text-ink-3 hover:text-ink-2")}>
                        <span className="w-7 shrink-0 font-mono text-xs leading-5 text-ink-4">{s.n}</span>
                        {s.t}
                      </a>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </nav>

        <article className="min-w-0 space-y-16">
          <div id="part-1" className="scroll-mt-28">
            <div className="rounded-3xl border border-floor/25 bg-gradient-to-br from-floor/[0.08] to-transparent p-6 sm:p-8">
              <div className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-floor">Part I</div>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight">The story</h2>
              <p className="mt-2 max-w-2xl text-ink-2">No finance background needed. Two people, one weekend, and the sums behind it.</p>
            </div>
            <div className="mt-12">
              <Story />
            </div>
          </div>

          <div id="part-2" className="scroll-mt-28 rounded-3xl border border-keeper/25 bg-gradient-to-br from-keeper/[0.08] to-transparent p-6 sm:p-8">
            <div className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-keeper">Part II</div>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight">The methodology</h2>
            <p className="mt-2 max-w-2xl text-ink-2">For researchers and allocators: how the idea evolved, the evidence for demand, the data, the tests, the results for both sides, and how far to trust them.</p>
          </div>

          {/* ---------------------------------------------------------- 0 */}
          <Section id="abstract" n="0" title="Abstract">
            <P>
              US equities stop trading from Friday 16:00 to Monday 09:30 New York, yet tokenized versions of those stocks (Binance <B>bStocks</B>, <B>Ondo Stocks</B>) trade on-chain all weekend. A holder carries the full weekend gap and has no instrument to shed it. We propose a weekly, fully collateralised protection contract: the holder pays a small fee on Friday and is paid the part of any Monday-open drop beyond a chosen line (capped at 20% of the protected amount), funded by a pool of liquidity providers.
            </P>
            <P>
              Using {pooled.n_weekends.toLocaleString("en-US")} ticker-weekends across 50 underlyings, we show that weekend gaps are extremely fat-tailed (excess kurtosis {pooled.exkurt.toFixed(0)}), that textbook option pricing is mis-calibrated for them, and that a pooled, volatility-scaled empirical engine prices them out of sample with a loss ratio of <B>{v4.loss_ratio.toFixed(2)}</B> (target 0.67), stable across volatility regimes. Buyers who are even moderately risk-averse are better off insured on volatile names; liquidity providers earn about <B>{pct(div.roc_annualised)} a year</B> on capital with a weekly Sharpe of <B>{div.sharpe_weekly_ann.toFixed(2)}</B>, at a one-year ruin probability of <B>{pct(r10["diversified (all 50)"])}</B> under the capital rule we enforce.
            </P>
            <KeyNumbers
              items={[
                { v: pct(pooled["P(gap<-5%)"], 2), l: "of weekends open 5%+ lower on Monday" },
                { v: `${Math.round(D.normal_vs_empirical[3].ratio).toLocaleString("en-US")}×`, l: "more 10% drops than a normal curve predicts" },
                { v: v4.loss_ratio.toFixed(2), l: "out-of-sample loss ratio of the shipped engine", tone: "held" },
                { v: `${pct(div.roc_annualised)}`, l: "a year for the pool, 2005–2026", tone: "keeper" },
              ]}
            />
          </Section>

          {/* ---------------------------------------------------------- 1 */}
          <Section id="journey" n="1" title="The intuition, and how it changed" lead="We logged every belief, rejected idea and hard constraint as it happened, with the reason, in RecurOS (our research log). This section is that log, in order. The product we built is not the one we set out to build, and the differences are the point.">
            <ol className="relative my-8 space-y-8 border-l border-line pl-8">
              {[
                { tag: "Hunch", h: "Nobody trades time", p: <>Commodity traders make money on three dimensions: space (the same barrel is worth more in Rotterdam), form (blending off-spec crude) and time (storing it and selling forward). For stocks, the time dimension has a hole in it every weekend. Tokenization is the first thing that makes that hole tradable. Our first spec, “Weekend Market”, put the idea in three steps: closed-session risk is universal and unpriced; tokenization makes it transferable; and the closed session is where equity returns are made, so whoever carries the risk is “paid twice”: the fee plus the overnight drift.</> },
                { tag: "First pricing", h: "A textbook formula", p: <>We first priced protection with the at-the-money approximation <code className="font-mono text-ink">P ≈ 0.4 · σ · S · √T</code>. For Nvidia at 45% volatility over a 65-hour weekend that gives 1.55% of the position: too expensive to buy every week, which told us the product had to be <B>out-of-the-money tail cover</B>, not full hedging.</> },
                { tag: "Test 1", h: "The first backtest killed two ideas", p: <>One stock (Apple), 2015–2017, 104 weekends. (a) A weekend carried 0.75 of a full trading day’s variance, not the ~0.2 the index literature suggested, so the “retail overestimates weekend risk and we pocket the difference” margin story shrank from 3× to 1.58×. (b) Weekend returns were slightly <i>negative</i> (−1.9% a year, t = −0.28), so “paid twice” was <B>rejected</B>. What survived was stronger: weekend gaps had excess kurtosis 43, and the lognormal model under-priced a 7% drop by a factor of thousands. We repositioned from “a carry trade on a quiet session” to <B>“tail insurance on a risk textbook models cannot price”</B>.</> },
                { tag: "Constraints", h: "Two rules we committed to", p: <>From test 1 we wrote two hard constraints into the log: the price must come from data (empirical or extreme-value), never Black-Scholes; and the pool must hold capital of at least 10% of what it covers, with per-stock limits, because one weekend on one stock can exceed any thin buffer.</> },
                { tag: "Test 2", h: "The full backtest", p: <>50 stocks and ETFs with bStock or Ondo wrappers, 61,815 weekends, four pricing engines, strictly out of sample. Section 5 and 6 describe it. It confirmed the tail, overturned test 1’s claim that Black-Scholes is uniformly too cheap (it is wrong by regime, not in one direction), and picked the engine we ship.</> },
                { tag: "Research", h: "Is it wanted, and is it new?", p: <>A market and literature review (section 2) before any code: who carries weekend risk today, what they pay, what already exists, and what 58 academic papers say about pricing it.</> },
                { tag: "Structure", h: "Making both sides work", p: <>Simulations of protection structures for buyers (fixed lines, spreads, yield-funded, fixed budgets) and capital structures for the pool (T-bill collateral, payout caps, junior/senior tranches, dynamic sizing). Tranches were rejected; dynamic sizing was adopted (section 4).</> },
                { tag: "Build", h: <ModeText mainnet="Live on mainnet" testnet="Live on testnet" />, p: <>Contracts, pricing server and app, with a full Friday-to-Monday cycle settled on-chain: a −7% Monday paid exactly the $40 the formula says on $1,000 protected at a 3% line.</> },
              ].map((s) => (
                <li key={s.tag} className="relative">
                  <span className="absolute -left-[41px] top-1 flex h-5 w-5 items-center justify-center rounded-full border border-floor/50 bg-bg" aria-hidden>
                    <span className="h-2 w-2 rounded-full bg-floor" />
                  </span>
                  <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-3">{s.tag}</div>
                  <div className="mt-1 text-lg font-semibold text-ink">{s.h}</div>
                  <p className="mt-1.5 max-w-3xl leading-relaxed text-ink-2">{s.p}</p>
                </li>
              ))}
            </ol>
            <DataTable
              head={["What we believed at the start", "What the data said", "Status"]}
              rows={[
                ["The weekend is a quiet ~0.2 of a trading day", `0.19 to 0.69 of a day by stock (median ${D.var_ratio.median})`, { v: "revised", tone: "mid" }],
                ["Holders over-pay for weekend risk; that’s the margin", "Only 1.58× in test 1; option markets do over-charge weekends, but not enough to be a business on its own", { v: "revised", tone: "mid" }],
                ["The pool is “paid twice” (fee + overnight drift)", "Not for single names; the index-level drift has faded since 2021", { v: "rejected", tone: "bad" }],
                ["Black-Scholes is good enough to price it", "Mis-calibrated by regime; over-charges on average, under-charges in quiet periods", { v: "rejected", tone: "bad" }],
                ["Weekend gaps have fat tails", `Excess kurtosis ${pooled.exkurt.toFixed(0)}; 10% drops ${Math.round(D.normal_vs_empirical[3].ratio).toLocaleString("en-US")}× more common than normal`, { v: "confirmed", tone: "good" }],
                ["A 10% capital pool is safe enough", `Yes if diversified (${pct(r10["diversified (all 50)"])} one-year ruin), not for one stock (${pct(r10["NVDA only"])})`, { v: "confirmed, with limits", tone: "good" }],
              ]}
            />
          </Section>

          {/* ---------------------------------------------------------- 2 */}
          <Section id="market" n="2" title="Does anyone want this?" lead="Before building we asked three questions: is the risk real, who carries it today, and what do they use instead.">
            <H3>The risk is real, and it lives in the closed session</H3>
            <P>
              The most remembered equity losses of 2024–2025 were Monday gaps: Nvidia’s −17% on 27 Jan 2025 after DeepSeek news broke over the weekend (−$589 bn, the largest one-day loss in market value on record), the April 2025 tariff weekend (S&P futures limit-down, VIX 60), and the August 2024 yen carry unwind. The academic literature since French (1980) and Cooper, Cliff &amp; Gulen (2008) finds that most of the equity premium and a large share of variance are realised while the market is closed.
            </P>
            <H3>Retail takes the hit; institutions pay, but not for weekends</H3>
            <UL
              items={[
                <>In a sample of $15 bn of retail option trades (Bogousslavsky &amp; Muravyev), protective puts are close to absent. Stop-loss orders cannot help against a gap: they execute at the first price after it.</>,
                <>Institutions spend heavily on downside protection: about $78–87 bn sits in buffer/defined-outcome ETFs, $79.5 bn of buffered annuities were sold in 2025, and roughly $225 bn of US structured notes were issued. All of it is annual and index-level. <B>No listed product isolates Friday close to Monday open.</B></>,
                <>Option markets over-charge the weekend: selling Friday-to-Monday index puts earned about two-thirds of a one-day put-writing strategy’s profit (OptionMetrics), and Jones &amp; Shemesh (2018) show equity options are systematically overpriced across non-trading periods. That over-pricing is the margin a well-priced pool can share with buyers.</>,
              ]}
            />
            <H3>On-chain, the weekend is where tokenized stocks actually trade</H3>
            <UL
              items={[
                <>{"92%"} of on-chain bStock volume in a July 2026 week happened while the US market was closed (Binance Research). Weekend liquidity falls 70–90% and spreads widen 19–33×, and Chainlink equity feeds publish nothing over the weekend by design.</>,
                <>The institutions already carrying this risk pay for it themselves: Venus keeps a $200,000 “bStock liquidation buffer” for weekends and listed bStocks with zero borrowing; Ethena’s framework for its bStock trade demands 10% extra margin over weekends or flattening before Friday’s close.</>,
                <><B>Ondo Stocks</B> mostly cannot be minted or redeemed between Friday evening and Sunday evening, so a holder often has no way out at all. <B>bStocks</B> can be traded 24/7, but the token itself finds almost none of Monday’s move before Monday morning (section 6.6), so selling on Sunday doesn’t help either.</>,
              ]}
            />
            <DataTable
              head={["What a token holder could use today", "Why it doesn’t solve the weekend"]}
              rows={[
                ["Listed put on the stock", "Needs a US brokerage; can’t settle against a token; also covers all of Monday"],
                ["Buffer ETF / structured note", "Annual, index-level, off-chain"],
                ["Stop-loss", "Fills after the gap, at Monday’s price"],
                ["Short perpetual future", "Needs margin and funding; weekend perp prices got Monday’s direction right only 13 of 25 times"],
                ["Sell the token on Sunday", "Widest spreads of the week, and the token hasn’t priced the news yet"],
              ]}
            />
            <Callout title="Competition">
              As of September 2026 we found three hackathon prototypes on other chains (Arbitrum and Solana), priced with textbook models. Nothing on BNB Chain, where bStocks and Ondo Stocks make up the only tokenized-equity market above $1 bn.
            </Callout>
            <Callout title="Honest caveat on demand" tone="gap">
              The median weekend is uneventful: bStocks finish within about 0.2% of Monday’s open on a typical weekend. The product is for the 1 weekend in 118 that drops more than 5%, and for the holder who doesn’t want to find out which one it is. Demand for weekend-specific cover is inferred from crisis-week hedging surges, not from a survey.
            </Callout>
          </Section>

          {/* ---------------------------------------------------------- 3 */}
          <Section id="history" n="3" title="The history of bad weekends" lead="We priced 29 famous weekends exactly as the engine would have on the Friday before, using only data available at the time, for a $10,000 position with protection starting at a 5% drop.">
            <DataTable
              head={["Weekend", "Event", "Stock", "Monday open", "Fee paid Friday", "Loss without", "Loss with"]}
              rows={famous.map((r) => [
                r.friday,
                r.event,
                r.ticker,
                { v: pct(r.gap_open), tone: r.gap_open < -0.05 ? "bad" : r.gap_open > 0 ? "good" : undefined },
                r.premium_charged_bp == null ? "—" : `$${((r.premium_charged_bp / 1e4) * 10000).toFixed(2)}`,
                { v: usd(r.hermee_unprotected_pnl / 10), tone: r.hermee_unprotected_pnl < 0 ? "bad" : "good" },
                { v: r.hermee_protected_pnl == null ? "—" : usd(r.hermee_protected_pnl / 10), tone: (r.hermee_protected_pnl ?? -1) < 0 ? undefined : "good" },
              ])}
              note="Figures per $10,000 position. Monday open = Friday close to Monday opening price, split- and dividend-adjusted. SVB-weekend banks shown via listed proxies (the failed banks were delisted). Loss with protection = stock move − fee + payout."
            />
            <P>
              Three patterns matter for design. First, the damage is concentrated: across the 99 stock-weekends we priced, the 43 that breached a 5% line account for nearly all of the losses. Second, the fee the engine asked the Friday before was usually small, because a quiet Friday looks quiet (DeepSeek: $5.50 per $10,000), which is exactly why protection has to be bought before you know you need it. Third, some crashes happen during Monday rather than at the open (Volmageddon, February 2018: SPY opened −0.7% and closed −4.2%), so a product that settles at the open must say so plainly.
            </P>
            <ImageFigure n="3.1" title="Every stock in our famous-weekend set: Friday close to Monday open" src="/docs/30_famous_weekends_gaps.png" caption="Filled dots are the gap to Monday’s opening price (what the product settles on); hollow dots are the gap to Monday’s close. Everything left of the dashed line would have been paid." source="backtest/scripts/30_famous_weekends.py" />
          </Section>

          {/* ---------------------------------------------------------- 4 */}
          <Section id="model" n="4" title="The two-sided model" lead="Two roles, one contract. We named them to keep the maths human: Hermee holds a stock and buys protection; Kip provides the money that pays for it.">
            <div className="my-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-floor/30 bg-floor-soft p-5">
                <div className="font-semibold text-ink">Hermee · the protection buyer</div>
                <p className="mt-2 text-sm leading-relaxed text-ink-2">Holds a tokenized stock. Before the Friday bell, pays a one-off fee for one weekend. If Monday opens more than her line below Friday’s close, she is paid the difference on the amount she protected, up to 20% of it. She keeps the stock and all of any gain.</p>
              </div>
              <div className="rounded-2xl border border-keeper/30 bg-keeper-soft p-5">
                <div className="font-semibold text-ink">Kip · the liquidity provider</div>
                <p className="mt-2 text-sm leading-relaxed text-ink-2">Deposits USDT in a shared pool. Every fee flows to the pool. On a bad Monday the pool pays buyers. Before any protection is sold, its maximum payout is locked, so the pool is always able to pay what it has promised.</p>
              </div>
            </div>
            <H3>The payoff</H3>
            <Formula label="per $1 protected, for line b and the realised Monday gap g">{`gap        g = P_open(Monday) / P_close(Friday) − 1         (official exchange prints, per share)
payout     = min( max( −b − g, 0 ), 0.20 )
example    b = 3%, g = −7%   →  payout = 4% of the amount protected`}</Formula>
            <H3>The price (the engine we ship)</H3>
            <P>
              Every historical weekend gap in the universe is divided by that stock’s daily volatility over the previous 20 trading days, which puts a quiet utility and a meme stock on the same scale. The resulting pool of {pooled.n_weekends.toLocaleString("en-US")} standardised moves is the engine’s picture of what a weekend can do. To price a stock this week, we rescale that picture by the stock’s current volatility and average the payoff:
            </P>
            <Formula label="pooled, volatility-scaled expected payout">{`z_i        = g_i / σ_d,i                      (σ_d = 20-day daily volatility known on that Friday)
fair(b)    = mean over all prior weekends of  max( −b − σ_d(today) · z_i , 0 )
fee        = max( 1.5 × fair(b) ,  0.01% )     refuse if fee > 2% of the amount`}</Formula>
            <P>
              The 50% margin is not profit for its own sake: the backtest says the engine’s expected payout is right on average but noisy weekend to weekend, and the margin is what keeps the pool solvent through the bad years (section 6.3). This is the same idea as Kelly &amp; Jiang’s (2014) pooled estimate of tail risk across stocks, applied to weekend gaps.
            </P>
            <H3>The rules that keep it fair</H3>
            <UL
              items={[
                <><B>Sales close at the Friday bell.</B> After 16:00 New York, futures and the overnight session start to reveal the weekend’s news; anyone buying later would be buying with information.</>,
                <><B>Settlement uses the official Monday opening price</B>, never the thin weekend token price, which could be pushed around for less than a payout is worth.</>,
                <><B>You can only protect what you hold</B>, and corporate actions (splits, halts) cancel the weekend and refund the fee.</>,
                <><B>The pool sizes itself.</B> Half of it is a safety reserve that is never put at risk. It can only sell protection whose maximum payout fits inside the other half, so after a bad weekend it automatically sells less until it recovers (constant-proportion portfolio insurance).</>,
              ]}
            />
          </Section>

          {/* ---------------------------------------------------------- 5 */}
          <Section id="data" n="5" title="Backtest: data and method" lead="Everything below runs from one script and uses only public data. The design goal was that no number could have been fitted to the outcome it is scored against.">
            <DataTable
              head={["Dataset", "Coverage", "Used for"]}
              rows={[
                ["Daily open/high/low/close, split and dividend adjusted (Yahoo)", "50 underlyings, 1990 or IPO → 25 Sep 2026", "Weekend gaps, volatility, pricing, backtests"],
                ["Binance RWA token list (public API)", "1,925 tokenized-stock tokens; 458 Ondo and 80 bStock tokens on BNB Chain", "Choosing the universe: every underlying with a live wrapper"],
                ["Binance spot hourly candles", "15 bStocks, Jun–Sep 2026, 165 token-weekends", "How tokens behave while the market is shut"],
                ["US 13-week Treasury bill yield", "1990 → 2026", "Yield on the pool’s idle capital"],
                ["Famous-event list", "29 events, 1987–2025", "Case studies (section 3)"],
              ]}
            />
            <H3>Construction</H3>
            <UL
              items={[
                <><B>Universe.</B> Every underlying that has an Ondo or bStock token on BNB Chain and enough price history: 50 names, 28 of them with a bStock wrapper, 10 ETFs.</>,
                <><B>Weekend definition.</B> A closed session that spans a weekend (Friday close → Monday open, or a longer holiday weekend). {pooled.n_weekends.toLocaleString("en-US")} such ticker-weekends; {single.n_weekends.toLocaleString("en-US")} single names and {etfs.n_weekends.toLocaleString("en-US")} ETFs.</>,
                <><B>Data hygiene.</B> Gaps below −75% were treated as unadjusted corporate actions in the vendor feed and removed (one case, a reverse split). Real distributions such as AMC’s APE units were kept and flagged.</>,
                <><B>Out of sample, walk-forward.</B> Every price for a weekend in year Y uses only data from before 1 January of Y; models are refitted yearly. The backtest runs 2005–2026 so that every engine has at least 15 years of history behind its first quote.</>,
                <><B>Four engines.</B> Textbook Black-Scholes (two clocks), each stock’s own history, an extreme-value (generalised Pareto) tail fitted per stock, and the pooled volatility-scaled engine.</>,
                <><B>Buyer utility.</B> We score protection by the certainty-equivalent return of a buyer with constant relative risk aversion γ = 4: a moderately cautious person. Positive means they’d rather have the protected weekend, fee included.</>,
                <><B>Pool risk.</B> 20,000 simulated years made of randomly drawn 4-week blocks of real history (block bootstrap, which keeps the clustering of bad weeks), for pools of different sizes and compositions.</>,
              ]}
            />
            <Formula label="certainty equivalent (CRRA, γ = 4)">{`CE = ( mean( (1 + r_w)^(1−γ) ) )^(1/(1−γ)) − 1          r_w = weekend return with or without protection`}</Formula>
          </Section>

          {/* ---------------------------------------------------------- 6 */}
          <Section id="results" n="6" title="Backtest: results">
            <H3>6.1 Weekend gaps are extremely fat-tailed</H3>
            <P>
              Pooled over all stocks, the typical weekend gap has a standard deviation of {pct(pooled.sd, 1)}. If gaps followed a normal curve with that spread, a 3% drop would be common and a 10% drop essentially impossible. Reality is the opposite at both ends: fewer small drops, far more large ones. Excess kurtosis is {pooled.exkurt.toFixed(0)} (a normal curve has 0).
            </P>
            <Figure n="6.1" title="How often Monday opens this far down: actual vs a normal curve" caption={<>Pooled over {pooled.n_weekends.toLocaleString("en-US")} ticker-weekends, 1990–2026. A textbook model calibrated to the average weekend is not merely a little off in the tail; it is off by orders of magnitude, and in the direction that bankrupts an insurer.</>} source="results/10_pooled_tail.csv">
              <TailCompare rows={D.normal_vs_empirical} />
            </Figure>
            <ImageFigure n="6.2" title="Distribution of weekend gaps, log scale" src="/docs/10_gap_distribution_log.png" caption="Single names (blue) and ETFs (green) against a normal curve with the same standard deviation (dashed red). The left tail is where the product lives." source="backtest/scripts/10_universe_stats.py" />

            <H3>6.2 Which pricing engine survives out of sample</H3>
            <P>
              The loss ratio is what the pool paid out divided by what it charged. With a 50% margin, a perfectly calibrated engine lands at 1 / 1.5 = 0.67. Below that it over-charges (buyers overpay); above 1 the pool loses money.
            </P>
            <Figure n="6.3" title="Loss ratio by engine, 5% line, 2005–2026, all stocks" caption={<>The textbook engines charge several times what is ever paid out, so no one would buy. The two per-stock empirical engines look close on average ({sc.find((r) => r.version === "v2")!.loss_ratio.toFixed(2)} and {sc.find((r) => r.version === "v3")!.loss_ratio.toFixed(2)}) but fail in turbulent periods (table below). The pooled engine lands at {v4.loss_ratio.toFixed(2)}: slightly conservative, which is the right side to err on.</>} source="results/21_version_scorecard.csv">
              <RefBars
                max={1.1}
                format={(v) => v.toFixed(2)}
                refs={[
                  { at: 0.667, label: "target with 50% margin (0.67)", cls: "bg-held" },
                  { at: 1, label: "break-even (1.0)", cls: "bg-gap" },
                ]}
                rows={sc.map((r) => ({ label: ENGINE_NAMES[r.version].label, sub: ENGINE_NAMES[r.version].sub, value: r.loss_ratio, tone: r.version === "v4" ? "good" : r.loss_ratio < 0.4 ? "bad" : "mid" }))}
              />
            </Figure>
            <DataTable
              head={["Volatility regime", "BS calendar", "BS trading", "Own history", "Extreme value", "Pooled ★"]}
              rows={D.regime.map((r) => [
                r.vol_quintile === "calmest 20%" ? "Calmest fifth" : r.vol_quintile === "wildest 20%" ? "Wildest fifth" : r.vol_quintile === "q2" ? "2nd fifth" : r.vol_quintile === "q3" ? "Middle fifth" : "4th fifth",
                r.v1a.toFixed(2),
                r.v1b.toFixed(2),
                { v: r.v2.toFixed(2), tone: r.v2 > 1 ? "bad" : undefined },
                { v: r.v3.toFixed(2), tone: r.v3 > 1 ? "bad" : undefined },
                { v: r.v4.toFixed(2), tone: "good" },
              ])}
              note="Loss ratio by the stock’s volatility in the 20 days before the weekend (BS = Black-Scholes; ★ = the engine we ship). A per-stock history doesn’t know volatility just tripled, so in the wildest fifth of weeks it pays out 1.3–1.5× what it charged. The pooled engine is level from the second quintile up. (In the calmest fifth almost nothing breaches, so every engine’s ratio is near zero and the 1-cent-per-$100 minimum fee does the work.)"
            />

            <H3>6.3 Is the shipped engine calibrated?</H3>
            <Figure n="6.4" title="Predicted fair price vs what was actually paid, by decile" caption={<>Each dot is one tenth of all {D.calibration.reduce((a, c) => a + c.n, 0).toLocaleString("en-US")} priced ticker-weekends, sorted by the price the engine quoted in advance. Points near the diagonal mean “when it said a weekend was risky, it was; when it said quiet, it was”. The top decile is slightly over-priced ({D.calibration[9].pred_bp.toFixed(1)} bp predicted, {D.calibration[9].real_bp.toFixed(1)} bp paid). Hover a dot for its numbers.</>} source="results/21_calibration.csv">
              <Calibration points={D.calibration} />
            </Figure>
            <Figure n="6.5" title="Loss ratio by year, shipped engine, 5% line" caption={<>Most years the pool pays out a fraction of what it collects. Two years it paid out more: 2015 ({D.by_year.find((y) => y.year === 2015)!.loss_ratio.toFixed(2)}×, China’s Black Monday) and 2020 ({D.by_year.find((y) => y.year === 2020)!.loss_ratio.toFixed(2)}×, Covid). That lumpiness is why the pool needs capital and dynamic sizing, not just a margin.</>} source="results/21_loss_ratio_by_year.csv">
              <YearBars rows={D.by_year} refLine={1} format={(v) => `${v.toFixed(2)}×`} />
            </Figure>

            <H3>6.4 The buyer: twelve people who held a stock</H3>
            <DataTable
              head={["Holder", "Period", "Fees paid", "Paid back", "Worst weekend", "Worst, protected", "Worth it?"]}
              rows={hermee.map((h) => [
                `${h.ticker} · $${(h.invested / 1000).toFixed(0)}k`,
                `${String(h.start).slice(0, 4)}–${String(h.end).slice(0, 4)}`,
                usd(h.premiums_paid),
                { v: usd(h.payouts), tone: h.payouts > h.premiums_paid ? "good" : undefined },
                { v: usd(h.worst_weekend_unprotected), tone: "bad" },
                usd(h.worst_weekend_protected),
                { v: h.worth_it_to_risk_averse ? "yes" : "no", tone: h.worth_it_to_risk_averse ? "good" : "muted" },
              ])}
              note="Fixed number of shares bought at the start, protection bought every weekend at the engine’s price, 5% line. “Worth it” = a moderately risk-averse holder (γ = 4) prefers the protected weekends, fees included. A holder refuses any weekend where the fee would exceed 2% of the position (this happened 14 times for GameStop in 2021)."
            />
            <ImageFigure n="6.6" title="Cumulative weekend profit and loss, protected vs not" src="/docs/40_hermee_weekend_pnl_paths.png" caption="Only the closed-session part of each holding. Protection costs a slow drip and pays in lumps; the shaded area is where the protected holder is ahead." source="backtest/scripts/40_hermee.py" />

            <H3>6.5 The pool: 22 years of underwriting</H3>
            <DataTable
              head={["Pool composition (10% capital)", "Return / yr", "Weekly Sharpe", "Worst weekend (% of capital)", "Max drawdown", "1-yr ruin"]}
              rows={D.keeper.map((k) => [
                k.book,
                { v: pct(k.roc_annualised), tone: "good" },
                k.sharpe_weekly_ann.toFixed(2),
                { v: pct(k.worst_weekend_pct_capital, 0), tone: "bad" },
                pct(k.max_drawdown_pct_of_peak, 0),
                { v: pct(r10[k.book as keyof typeof r10] as number), tone: (r10[k.book as keyof typeof r10] as number) <= 0.01 ? "good" : "bad" },
              ])}
              note="$10 M of protection sold every weekend across the pool’s stocks, capital = 10% of that, idle capital earning 4%. Ruin = capital exhausted within 52 weeks, from 20,000 bootstrapped years. Diversification, not capital, is what separates a safe pool from an unsafe one."
            />
            <P>
              A static pool at 10% capital survives every historical start date, but 13 March 2020 (the Sunday emergency rate cut) cost it 62% of its capital in one weekend. With the dynamic sizing we enforce (sell at most 10× the cushion above a 50% reserve), the same pool’s value never fell below {pct(cppi.min_equity_pct, 0)} of its starting capital in the historical run, the reserve held in all 20,000 simulated years, and the median year returned {pct(cppi.median_ret_1y)}. We also tested splitting the pool into senior and junior slices; the senior slice was still hit in about 4% of years at every split, because a 2020-type year exceeds any junior slice. We rejected it.
            </P>
            <ImageFigure n="6.7" title="Pool value by composition, 2005–2026" src="/docs/50_keeper_equity_curves.png" caption="Multiple of starting capital (log scale). Bottom panel: the diversified pool’s weekly result as a percentage of capital. Many small gains, a few large losses: the signature of selling insurance." source="backtest/scripts/50_keeper.py" />

            <H3>6.6 What the token does while the market is shut</H3>
            <P>
              Across {tok.n_token_weekends} bStock weekends, the token’s move by Monday 13:00 UTC (30 minutes before the open) explained Monday’s gap almost perfectly (slope {tok.beta_preopen_on_gap.toFixed(2)}, correlation {tok.corr_preopen_gap.toFixed(2)}), but its move by Sunday night explained essentially none of it (slope {tok.beta_sunday_on_gap.toFixed(2)}). Price discovery happens in Monday pre-market, when futures and the overnight session trade. Thirty minutes before the bell the token sat within {pct(tok.median_abs_tok_preopen_vs_monopen, 2)} of the official open on a typical weekend and within {pct(tok.p90_abs_tok_preopen_vs_monopen, 2)} at the 90th percentile.
            </P>
            <ImageFigure n="6.8" title="Token move before the open vs the actual Monday gap" src="/docs/60_token_discovery_scatter.png" caption="Blue: token move by Monday pre-market. Orange: by Sunday night. The blue dots sit on the diagonal; the orange ones don’t. Selling the token on Sunday does not protect you, and settling on the token price would invite manipulation." source="backtest/scripts/60_token_weekend.py" />
          </Section>

          {/* ---------------------------------------------------------- 7 */}
          <Section id="conclusions" n="7" title="Conclusions for both sides" lead="A two-sided market only works if both sides are better off. The backtest says they are, for a clear set of buyers and under a clear set of rules for the pool.">
            <div className="my-6 grid gap-4 lg:grid-cols-2">
              <div className="rounded-3xl border border-floor/30 bg-floor-soft p-6">
                <div className="text-lg font-semibold text-ink">Why Hermee buys</div>
                <UL
                  items={[
                    <>On volatile names the protection is worth more than it costs to a cautious holder. Holding $100k of Nvidia 2024–2026 she paid {usd(nvda.premiums_paid)} and was paid {usd(nvda.payouts)}; her worst Monday went from {usd(nvda.worst_weekend_unprotected)} to {usd(nvda.worst_weekend_protected)}.</>,
                    <>Zoom through the vaccine Monday: worst weekend {usd(zm.worst_weekend_unprotected)} → {usd(zm.worst_weekend_protected)}.</>,
                    <>On calm index funds in calm periods it is a small tax for little relief (21 years of SPY: {pct(spy21.net_cost_pct_pa, 2)} a year). We say so in the app rather than hide it.</>,
                    <>The shape that was worth it for every kind of stock was a fixed weekly budget that buys the tightest line it can afford that Friday.</>,
                  ]}
                />
              </div>
              <div className="rounded-3xl border border-keeper/30 bg-keeper-soft p-6">
                <div className="text-lg font-semibold text-ink">Why Kip provides capital</div>
                <UL
                  items={[
                    <>The pool keeps what it doesn’t pay out: with a loss ratio of {v4.loss_ratio.toFixed(2)}, about {pct(1 - v4.loss_ratio, 0)} of every fee is profit over time.</>,
                    <>A diversified pool returned {pct(div.roc_annualised)} a year on capital 2005–2026 (10% since 2015), with a weekly Sharpe of {div.sharpe_weekly_ann.toFixed(2)}, losing money on about {pct(div.share_weekends_losing, 0)} of weekends.</>,
                    <>The risk is real and named: one weekend in 2020 cost a static pool 62% of its capital. Dynamic sizing and a 50% reserve keep that from becoming ruin.</>,
                    <>It prices below the alternatives buyers have (listed Monday puts, 10% extra weekend margin), so the pool is sharing the weekend over-pricing that already exists, not inventing a new one.</>,
                  ]}
                />
              </div>
            </div>
            <Callout title="Where both sides agree">
              Buyers value the tail more than its average cost (they are risk-averse and the tail is fat); the pool, holding many uncorrelated weekends and a reserve, can carry that tail at its average cost plus a margin. The margin fits between the two. That gap is the product.
            </Callout>
          </Section>

          {/* ---------------------------------------------------------- 8 */}
          <Section id="tech" n="8" title="Technology" lead="Kept deliberately simple: research and production share the same model, and nothing in between is hand-tuned.">
            <DataTable
              head={["Part", "Built with", "What it does"]}
              rows={[
                ["Research pipeline", "Python: pandas, NumPy, SciPy, Matplotlib", "Data pulls, the four engines, backtests, bootstrap, all charts on this page"],
                ["Market data", "Binance Web3 RWA API, Binance spot API, Yahoo Finance", "Which tokens exist, live prices and volatility, market open/closed status"],
                ["Contracts", "Solidity, OpenZeppelin, Hardhat", "Pool, protection market and price oracle; verified on BscScan"],
                ["Pricing server", "Node.js, TypeScript, viem, MongoDB", "Runs the shipped engine live, signs each price, posts Friday and Monday prices, settles"],
                ["App", "Next.js, wagmi, RainbowKit", "The interface you’re reading"],
                ["Research log", "RecurOS", "Every decision and rejected idea, with its reason, in order"],
                ["Networks", <ModeText key="net" mainnet="BNB Chain mainnet (via Alchemy)" testnet="BSC Testnet and Sepolia (via Alchemy)" />, "Where it runs today"],
              ]}
            />
            <P>
              The server runs the same pooled, volatility-scaled formula as the backtest, from the same {pooled.n_weekends.toLocaleString("en-US")}-weekend history, with this week’s volatility measured live from the bStock’s own trading. Each price is signed, so the contract accepts only prices the engine produced, and only before the Friday bell.
            </P>
          </Section>

          {/* ---------------------------------------------------------- 9 */}
          <Section id="accuracy" n="9" title="How far to trust the numbers" lead="What we validated, what we corrected, and what we know is biased.">
            <H3>Validated</H3>
            <UL
              items={[
                <><B>Out of sample.</B> No price in any table was fitted on the payouts it is scored against; every engine is refitted once a year on prior data only.</>,
                <><B>Calibration.</B> The shipped engine’s predicted and realised payouts line up by decile (figure 6.4), and its loss ratio is level across volatility regimes from the second quintile up.</>,
                <><B>Stress.</B> Pool results come from 20,000 bootstrapped years and from starting the pool on the worst historical dates (just before 2008, 2015, 2020 and 2024).</>,
                <><B>On-chain.</B> A full cycle was run on the live contracts: $1,000 protected at a 3% line, Monday −7%, payout exactly $40.00 as the formula says.</>,
                <><B>Consistent with the literature.</B> Pooling tails across stocks (Kelly &amp; Jiang 2014), scaling by current volatility (McNeil &amp; Frey 2000), treating the weekend as roughly one trading day of variance (French &amp; Roll 1986), and the finding that weekend options are overpriced (Jones &amp; Shemesh 2018) all match what we built.</>,
              ]}
            />
            <H3>Corrected along the way</H3>
            <P>
              While testing the live app we found the server was measuring a bStock’s volatility over all seven days of its 24/7 trading and annualising it as if every day were a trading day. Quiet Saturdays and Sundays pulled the estimate down (Nvidia read 21% against 46% on the exchange), which would have under-priced protection by up to half. The live estimate now uses weekday closes only, matching how the engine was calibrated. We report it because this is the kind of error a backtest cannot catch and only a live system can.
            </P>
            <H3>Known limitations</H3>
            <UL
              items={[
                <><B>Survivorship.</B> The universe is today’s tokenized list, so stocks that failed (SVB, First Republic, Lehman) are missing. The measured tail is therefore a lower bound on the real one.</>,
                <><B>Few extreme events.</B> Most of the pool’s losses come from a handful of weekends; any figure that depends on them (worst weekend, ruin) has wide uncertainty even with 22 years of data.</>,
                <><B>Opening prints are noisy.</B> The official open is the reference the market publishes, but opening auctions are noisier than closes. A 15-minute average is the next thing to test.</>,
                <><B>Scheduled events.</B> Earnings weekends are known jumps, not tail risk; the production rules refuse or surcharge them rather than rely on the model.</>,
                <><B>Token history is short.</B> bStocks launched in June 2026; the token-behaviour results rest on 165 weekends, and Ondo’s on-chain history could not be retrieved.</>,
                <><B>Vendor data.</B> Daily prices come from a free vendor with occasional corporate-action errors; we removed the one we found and flagged the rest.</>,
              ]}
            />
            <Callout title="Reproduce it" tone="keeper">
              The full pipeline, from data download to every chart, runs with one command in the repository (<code className="font-mono text-ink">backtest/run_all.ps1</code>). Results, charts and a longer technical report live alongside it.
            </Callout>
          </Section>

          {/* ---------------------------------------------------------- 10 */}
          <Section id="refs" n="10" title="References">
            <ol className="max-w-3xl list-decimal space-y-2 pl-5 text-sm leading-relaxed text-ink-2 marker:text-ink-4">
              {[
                "French, K. (1980). Stock returns and the weekend effect. Journal of Financial Economics 8(1).",
                "French, K. & Roll, R. (1986). Stock return variances: the arrival of information and the reaction of traders. Journal of Financial Economics 17(1).",
                "Cooper, M., Cliff, M. & Gulen, H. (2008). Return differences between trading and non-trading hours: like night and day. SSRN 1004081.",
                "Lou, D., Polk, C. & Skouras, S. (2019). A tug of war: overnight versus intraday expected returns. Journal of Financial Economics 134(1).",
                "Boyarchenko, N., Larsen, L. & Whelan, P. (2023). The overnight drift. Review of Financial Studies 36(9); and (2026) The disappearing overnight drift, Liberty Street Economics.",
                "McNeil, A. & Frey, R. (2000). Estimation of tail-related risk measures for heteroscedastic financial time series: an extreme value approach. Journal of Empirical Finance 7.",
                "Kelly, B. & Jiang, H. (2014). Tail risk and asset prices. Review of Financial Studies 27(10).",
                "Jones, C. & Shemesh, J. (2018). Option mispricing around nontrading periods. Journal of Finance 73(2).",
                "Black, F. & Perold, A. (1992). Theory of constant proportion portfolio insurance. Journal of Economic Dynamics and Control 16.",
                "Balder, S., Brandl, M. & Mahayni, A. (2009). Effectiveness of CPPI strategies under discrete-time trading. Journal of Economic Dynamics and Control 33.",
                "Sydnor, J. (2010). (Over)insuring modest risks. American Economic Journal: Applied Economics 2(4).",
                "Bogousslavsky, V. & Muravyev, D. An anatomy of retail option trading. SSRN 4682388.",
                "Binance Research (2026). Tokenized stocks: weekend price discovery analysis.",
              ].map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ol>
            <p className="mt-8 text-sm text-ink-3">
              Nothing here is investment advice. Figures are historical and hypothetical; the product runs on <ModeText mainnet="BNB Chain mainnet with test tokens" testnet="testnet" />. <a href="#part-1" className="text-ink underline underline-offset-4">Back to the plain-English story.</a>
            </p>
          </Section>
        </article>
      </div>
    </div>
  );
}
