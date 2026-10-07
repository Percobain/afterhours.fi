"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useAccount, useReadContracts, useSwitchChain } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { decodeEventLog, formatUnits, type Address } from "viem";
import { motion, useReducedMotion } from "framer-motion";
import clsx from "clsx";
import { ArrowLeft, ArrowRight, ArrowSquareOut, CalendarCheck, CaretDown, Check, CircleNotch, Drop, Info, MoonStars, ShieldCheck, Sparkle, SunHorizon, Warning } from "@phosphor-icons/react";
import { ApiError, api } from "@/lib/api";
import { CHAIN_META, CoverMarketAbi, MockERC20Abi, ZERO_ADDRESS, currentEpoch, explorerTx, floorPrice, parseUsd, premiumFromBp, tokensForNotional } from "@/lib/contracts";
import { FALLBACK_SUMMARY, TYPICAL_COST_BP } from "@/lib/backtest";
import { EXTRA_LEVELS, LEVELS, oneIn, riskLevel } from "@/lib/copy";
import { bpsToPct, fmtDateNY, fmtPrice, fmtTokens, fmtUsd, toBig, toNum } from "@/lib/format";
import type { QuoteResponse, TokenInfo } from "@/lib/types";
import { useDeployment } from "@/hooks/useDeployment";
import { useDebounced } from "@/hooks/useNow";
import { useTx } from "@/hooks/useTx";
import { useToast } from "@/hooks/useToast";
import { Steps, ActionChecklist } from "@/components/ui/Steps";
import { IssuerPill, StockMark } from "@/components/ui/StockMark";
import { Badge } from "@/components/ui/Badge";
import { Term } from "@/components/ui/Term";
import { MondaySimulator } from "@/components/MondaySimulator";
import { useWeekState } from "@/components/ui/WeekendBar";
import { ModeText } from "@/components/ModeText";

const STEP_NAMES = ["Stock", "Amount", "Protection", "Review"];
const QUICK_AMOUNTS = [250, 1000, 5000];

type Mode = "line" | "budget";

interface Done {
  policyId?: bigint;
  symbol: string;
  ticker: string;
  epochId: number;
  expectedOpen: number;
  notional: bigint;
  lineBps: number;
  premium: bigint;
  txHash: string;
}

export function ProtectFlow() {
  const reduced = useReducedMotion();
  const { address, isConnected, chainId: walletChain } = useAccount();
  const { openConnectModal } = useConnectModal();
  const { switchChain, isPending: switching } = useSwitchChain();
  const { chainId, deployment, tokens, epochs } = useDeployment();
  const { toast } = useToast();
  const tx = useTx(chainId);

  const [step, setStep] = useState(0);
  const [token, setToken] = useState<TokenInfo | undefined>();
  const [amount, setAmount] = useState("1000");
  const [mode, setMode] = useState<Mode>("line");
  const [lineBps, setLineBps] = useState(300);
  const [budgetBp, setBudgetBp] = useState(5);
  const [showMore, setShowMore] = useState(false);
  const [done, setDone] = useState<Done | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const firstRender = useRef(true);

  // every step starts at the top of the card, so you never land looking at the footer
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const el = cardRef.current;
    if (el && el.getBoundingClientRect().top < 80) el.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
  }, [step, done, reduced]);

  // keep the selected token fresh (prices arrive from the server after first render)
  useEffect(() => {
    if (token) {
      const fresh = tokens.find((t) => t.address === token.address);
      if (fresh && (fresh.lastPrice !== token.lastPrice || fresh.rv20 !== token.rv20 || fresh.breachProb5 !== token.breachProb5 || fresh.worstWeekend !== token.worstWeekend)) setToken(fresh);
    }
  }, [tokens, token]);

  const market = deployment?.contracts.CoverMarket;
  const usdt = deployment?.contracts.USDT;
  const price = token?.lastPrice ?? 0n;
  const decimals = token?.decimals ?? 18;
  const notional = parseUsd(amount);
  const dNotional = useDebounced(notional, 400);
  const tokensWei = useMemo(() => tokensForNotional(notional, price, decimals), [notional, price, decimals]);
  const me = address ?? ZERO_ADDRESS;

  // balances for every listed token (for the picker) + what the purchase needs
  const balReads = useReadContracts({
    contracts: tokens.map((t) => ({ address: t.address, abi: MockERC20Abi, functionName: "balanceOf" as const, args: [me] as const, chainId })),
    query: { enabled: isConnected && tokens.length > 0, refetchInterval: 20_000 },
  });
  const balanceOf = (t?: TokenInfo) => (t ? ((balReads.data?.[tokens.findIndex((x) => x.address === t.address)]?.result as bigint | undefined) ?? 0n) : 0n);

  const reads = useReadContracts({
    contracts: [
      { address: usdt, abi: MockERC20Abi, functionName: "balanceOf", args: [me], chainId },
      { address: usdt, abi: MockERC20Abi, functionName: "allowance", args: [me, market ?? ZERO_ADDRESS], chainId },
      { address: market, abi: CoverMarketAbi, functionName: "minNotionalUsd", chainId },
      { address: market, abi: CoverMarketAbi, functionName: "paused", chainId },
      { address: market, abi: CoverMarketAbi, functionName: "requireHolding", chainId },
    ],
    query: { enabled: !!market, refetchInterval: 20_000 },
  });
  const usdtBalance = (reads.data?.[0]?.result as bigint | undefined) ?? 0n;
  const allowance = (reads.data?.[1]?.result as bigint | undefined) ?? 0n;
  const minNotional = (reads.data?.[2]?.result as bigint | undefined) ?? 10_000_000n;
  const paused = (reads.data?.[3]?.result as boolean | undefined) ?? false;
  const requireHolding = (reads.data?.[4]?.result as boolean | undefined) ?? true;

  const epoch = useMemo(() => currentEpoch(epochs), [epochs]);

  const quoteQ = useQuery<QuoteResponse, Error>({
    queryKey: ["quote", chainId, me, token?.address, dNotional.toString(), mode, mode === "line" ? lineBps : budgetBp],
    queryFn: () => api.quote({ chainId, buyer: me, token: token!.address, notionalUsd: dNotional.toString(), ...(mode === "line" ? { barrierBps: lineBps } : { budgetBps: budgetBp }) }),
    enabled: !!token && dNotional >= minNotional && step >= 2,
    retry: false,
    staleTime: 20_000,
    refetchInterval: 45_000,
  });
  const q = quoteQ.data;
  const quoteErr = quoteQ.error;
  const pricedOut = quoteErr instanceof ApiError && (quoteErr.status === 422 || /priced_out/i.test(quoteErr.message));
  const serverDown = !!quoteErr && !(quoteErr instanceof ApiError);
  // the free server can take up to a minute to wake; say so instead of looking stuck
  const [slowQuote, setSlowQuote] = useState(false);
  const waitingForFirstQuote = quoteQ.isFetching && !q;
  useEffect(() => {
    if (!waitingForFirstQuote) {
      setSlowQuote(false);
      return;
    }
    const t = setTimeout(() => setSlowQuote(true), 6_000);
    return () => clearTimeout(t);
  }, [waitingForFirstQuote]);

  const chosenLine = q ? Number(q.quote.barrierBps) : mode === "line" ? lineBps : 500;
  const premium = q ? toBig(q.quote.premiumUsd) : 0n;
  const menu = q?.pricing?.menu;
  const costFor = (bps: number): bigint | undefined => {
    const m = menu?.find((x) => x.barrierBps === bps);
    if (m) return premiumFromBp(notional, m.chargedBp);
    const base = token ? TYPICAL_COST_BP[token.ticker]?.high : undefined;
    if (!base) return undefined;
    const f: Record<number, number> = { 100: 6, 200: 3, 300: 1.8, 500: 1, 700: 0.55, 1000: 0.3 };
    return premiumFromBp(notional, Math.max(1, base * (f[bps] ?? 1)));
  };
  const chanceFor = (bps: number) => menu?.find((x) => x.barrierBps === bps)?.breachProbability;
  const required = q ? toBig(q.requiredTokenBalance) : tokensWei;
  const held = balanceOf(token);
  const holdingOk = !requireHolding || held >= required;
  const wrongChain = isConnected && walletChain !== chainId;
  const expectedOpen = epochs.find((e) => e.epochId === (q ? Number(q.quote.epochId) : epoch.epochId))?.expectedOpen ?? epoch.expectedOpen;
  const epochId = q ? Number(q.quote.epochId) : epoch.epochId;

  const week = useWeekState();
  const risk = riskLevel(token?.rv20);
  const worst = token ? token.worstWeekend ?? FALLBACK_SUMMARY.per_ticker[token.ticker]?.worst_weekend : undefined;

  // ---------- actions ----------
  async function faucet(addr: Address, symbol: string) {
    const r = await tx.run(`Test ${symbol}`, () => tx.writeContractAsync({ address: addr, abi: MockERC20Abi, functionName: "faucet", chainId }), { successTitle: `Test ${symbol} added to your wallet` });
    if (r) {
      reads.refetch();
      balReads.refetch();
    }
  }
  async function approve() {
    if (!usdt || !market) return;
    const r = await tx.run("Allow USDT", () => tx.writeContractAsync({ address: usdt, abi: MockERC20Abi, functionName: "approve", args: [market, premium], chainId }), { successTitle: "USDT allowed" });
    if (r) reads.refetch();
  }
  async function buy() {
    if (!q || !market || !token) return;
    if (Number(q.quote.expiry) * 1000 < Date.now() + 15_000) {
      toast({ kind: "info", title: "Price refreshed", body: "The price was about to expire, so we fetched a fresh one. Press confirm again." });
      quoteQ.refetch();
      return;
    }
    const args = {
      buyer: q.quote.buyer,
      token: q.quote.token,
      epochId: BigInt(q.quote.epochId),
      notionalUsd: toBig(q.quote.notionalUsd),
      barrierBps: Number(q.quote.barrierBps),
      premiumUsd: toBig(q.quote.premiumUsd),
      expiry: BigInt(q.quote.expiry),
      nonce: toBig(q.quote.nonce),
    } as const;
    const receipt = await tx.run("Protection", () => tx.writeContractAsync({ address: market, abi: CoverMarketAbi, functionName: "buyCover", args: [args, q.signature], chainId }), { silent: true });
    if (!receipt) {
      if (/expired|nonce/i.test(tx.error ?? "")) quoteQ.refetch();
      return;
    }
    let policyId: bigint | undefined;
    for (const log of receipt.logs) {
      try {
        const ev = decodeEventLog({ abi: CoverMarketAbi, data: log.data, topics: log.topics });
        if (ev.eventName === "CoverBought") {
          policyId = (ev.args as { policyId: bigint }).policyId;
          break;
        }
      } catch {
        /* not ours */
      }
    }
    setDone({ policyId, symbol: token.symbol, ticker: token.ticker, epochId: Number(args.epochId), expectedOpen, notional: args.notionalUsd, lineBps: args.barrierBps, premium: args.premiumUsd, txHash: receipt.transactionHash });
    reads.refetch();
    balReads.refetch();
  }

  // ---------- step validity ----------
  const amountProblem =
    notional === 0n ? "Enter how many dollars of the stock you want to protect." : notional < minNotional ? `The smallest amount you can protect is ${fmtUsd(minNotional)}.` : undefined;
  const canNext = [!!token, !amountProblem, !!q && !pricedOut, false][step];

  // the one button at the bottom of the review step
  const primary = (() => {
    if (!isConnected) return { label: "Connect wallet to continue", onClick: () => openConnectModal?.() };
    if (wrongChain) return { label: `Switch to ${CHAIN_META[chainId]?.short}`, onClick: () => switchChain({ chainId }), disabled: switching };
    if (paused) return { label: "Paused by the admin right now", disabled: true };
    if (!q) return { label: quoteQ.isFetching ? "Getting your price…" : "No price yet", disabled: true };
    if (!holdingOk) return { label: `Get free test ${token?.symbol}`, onClick: () => faucet(token!.address, token!.symbol) };
    if (usdtBalance < premium) return { label: "Get free test USDT", onClick: () => faucet(usdt!, "USDT") };
    if (allowance < premium) return { label: `Allow ${fmtUsd(premium, { precise: true })} USDT`, onClick: approve };
    return { label: `Confirm · pay ${fmtUsd(premium, { precise: true })}`, onClick: buy };
  })();

  const checklist = [
    { label: `Hold at least ${fmtTokens(required, decimals)} ${token?.symbol ?? ""}`, detail: `Protection only covers stock you actually hold. You have ${fmtTokens(held, decimals)}.`, state: !isConnected ? "todo" : holdingOk ? "done" : "active" },
    { label: `Have ${fmtUsd(premium, { precise: true })} USDT for the fee`, detail: "The test faucet gives you 10,000 USDT for free.", state: !isConnected || !holdingOk ? "todo" : usdtBalance >= premium ? "done" : "active" },
    { label: "Allow the exact fee", detail: "Your wallet asks permission for this one amount. Nothing more.", state: !isConnected || !holdingOk || usdtBalance < premium ? "todo" : allowance >= premium ? "done" : "active" },
    { label: "Confirm protection", detail: "One signature. After that there is nothing to do until Monday.", state: !isConnected || !holdingOk || usdtBalance < premium || allowance < premium ? "todo" : "active" },
  ] as const;

  if (done) return <Success d={done} chainId={chainId} onAgain={() => { setDone(null); setStep(0); }} />;

  return (
    <div ref={cardRef} className="card ring-grad scroll-mt-24 overflow-hidden">
      <div className="border-b border-line px-5 py-4 sm:px-6">
        <Steps steps={STEP_NAMES} current={step} onJump={(i) => setStep(i)} />
      </div>

      <div className="p-5 sm:p-6">
        <>
          {/* ---------------- STEP 1: STOCK ---------------- */}
          {step === 0 && (
            <div key="s0" className="animate-step-in">
              <StepTitle n={1} title="Which stock do you want to protect?" hint={<ModeText mainnet="These are tokenized US stocks. On mainnet these test versions are free from the faucet." testnet="These are tokenized US stocks. On testnet they’re free from the faucet." />} />
              {tokens.length === 0 ? (
                <div className="mt-5 grid gap-3 sm:grid-cols-2">{[0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-28" />)}</div>
              ) : (
                <div className="mt-5 grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Stock">
                  {tokens.map((t) => {
                    const r = riskLevel(t.rv20);
                    const p5 = t.breachProb5 ?? FALLBACK_SUMMARY.per_ticker[t.ticker]?.breach_5_pct;
                    const bal = balanceOf(t);
                    const sel = token?.address === t.address;
                    return (
                      <button
                        key={t.address}
                        type="button"
                        role="radio"
                        aria-checked={sel}
                        onClick={() => setToken(t)}
                        onDoubleClick={() => { setToken(t); setStep(1); }}
                        className="pill-choice group relative"
                      >
                        <div className="flex items-center gap-3">
                          <StockMark ticker={t.ticker} size={40} />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                              <span className="font-semibold text-ink">{t.symbol}</span>
                              <IssuerPill issuer={t.wrapper} />
                            </div>
                            <div className="truncate text-xs text-ink-3">{t.name.replace(" (test)", "")}</div>
                          </div>
                          <div className="text-right">
                            <div className="tnum text-sm font-medium text-ink">{t.lastPrice ? fmtPrice(t.lastPrice) : "—"}</div>
                            {isConnected && bal > 0n && <div className="tnum text-[11px] text-ink-3">you hold {fmtTokens(bal, t.decimals, 2)}</div>}
                          </div>
                        </div>
                        <div className="mt-3 flex items-center justify-between gap-2 text-xs">
                          <Badge tone={r.tone}>{r.label} stock</Badge>
                          <span className="text-ink-3">drops 5%+ {oneIn(p5)}</span>
                        </div>
                        {sel && <span className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-floor text-[#1A0E00] shadow-glow"><Check weight="bold" className="h-3.5 w-3.5" /></span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ---------------- STEP 2: AMOUNT ---------------- */}
          {step === 1 && token && (
            <div key="s1" className="animate-step-in">
              <StepTitle n={2} title={`How much of your ${token.ticker} should we protect?`} hint="In dollars. It can be part of what you hold." />
              <div className="field mt-5">
                <label htmlFor="amt" className="text-xs text-ink-3">Amount to protect</label>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className="text-3xl font-semibold text-ink-3">$</span>
                  <input
                    id="amt"
                    inputMode="decimal"
                    autoComplete="off"
                    autoFocus
                    value={amount}
                    placeholder="0"
                    onChange={(e) => {
                      const v = e.target.value.replace(/[^0-9.]/g, "");
                      if ((v.match(/\./g) ?? []).length <= 1) setAmount(v);
                    }}
                    className="input-bare"
                  />
                </div>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-ink-2">
                  <span className="tnum">{price > 0n && notional > 0n ? `≈ ${fmtTokens(tokensWei, decimals)} ${token.symbol} at ${fmtPrice(price)}` : price === 0n ? "Waiting for a price…" : ""}</span>
                  {isConnected && held > 0n && price > 0n && <span className="tnum">You hold {fmtTokens(held, decimals)} {token.symbol} (≈ {fmtUsd((held * price) / 10n ** BigInt(decimals + 2))})</span>}
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {QUICK_AMOUNTS.map((a) => (
                  <button key={a} type="button" onClick={() => setAmount(String(a))} className={clsx("rounded-full border px-4 py-2 text-sm font-medium transition", amount === String(a) ? "border-floor/50 bg-floor-soft text-floor" : "border-line bg-surface-2 text-ink-2 hover:text-ink")}>
                    ${a.toLocaleString()}
                  </button>
                ))}
                {isConnected && held > 0n && price > 0n && (
                  <button type="button" onClick={() => setAmount(String(Math.floor(Number(formatUnits((held * price) / 10n ** BigInt(decimals + 2), 6)))))} className="rounded-full border border-line bg-surface-2 px-4 py-2 text-sm font-medium text-ink-2 hover:text-ink">
                    All I hold
                  </button>
                )}
              </div>
              {amountProblem && notional > 0n && <Hint tone="warn">{amountProblem}</Hint>}
              {isConnected && !wrongChain && notional > 0n && requireHolding && held < tokensWei && (
                <Hint tone="info" action={<button className="btn-soft !h-9 !px-3 !text-xs" disabled={tx.busy} onClick={() => faucet(token.address, token.symbol)}><Drop weight="duotone" className="h-3.5 w-3.5" />Get 100 free</button>}>
                  You hold {fmtTokens(held, decimals)} {token.symbol}. You need about {fmtTokens(tokensWei, decimals)} to protect this much.
                </Hint>
              )}
            </div>
          )}

          {/* ---------------- STEP 3: PROTECTION ---------------- */}
          {step === 2 && token && (
            <div key="s2" className="animate-step-in">
              <StepTitle n={3} title="How much protection do you want?" hint={<>Pick your <Term k="line">protection line</Term>: how far {token.ticker} can fall on Monday before we start paying you.</>} />

              <div className="mt-5 grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Protection line">
                {[...LEVELS, ...(showMore ? EXTRA_LEVELS.map((b) => ({ bps: b, name: b < 200 ? "Tightest" : "Loose", tagline: `Pays after a ${b / 100}% drop` })) : [])].map((lv) => {
                  const cost = costFor(lv.bps);
                  const chance = chanceFor(lv.bps);
                  const sel = mode === "line" && lineBps === lv.bps;
                  return (
                    <button key={lv.bps} type="button" role="radio" aria-checked={sel} onClick={() => { setMode("line"); setLineBps(lv.bps); }} className="pill-choice relative">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-ink">{lv.name}</div>
                          <div className="mt-0.5 text-xs text-ink-2">{lv.tagline}</div>
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="tnum text-lg font-semibold text-ink">{cost !== undefined ? fmtUsd(cost, { precise: true }) : <span className="skeleton inline-block h-5 w-12" />}</div>
                          <div className="text-[10px] text-ink-3">{menu ? "this weekend" : "estimate"}</div>
                        </div>
                      </div>
                      {"recommended" in lv && !!lv.recommended && <Badge tone="floor" className="mt-3 !py-0.5 !text-[10px]">Best for most people</Badge>}
                      {chance !== undefined && <div className="mt-3 text-[11px] text-ink-3">Would have paid out {oneIn(chance)}</div>}
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <button type="button" onClick={() => setShowMore((s) => !s)} className="btn-link !text-xs">
                  <CaretDown weight="bold" className={clsx("h-3.5 w-3.5 transition", showMore && "rotate-180")} /> {showMore ? "Fewer options" : "More options (1% and 7%)"}
                </button>
                <button type="button" onClick={() => setMode(mode === "budget" ? "line" : "budget")} className="btn-link !text-xs">
                  <Sparkle weight="duotone" className="h-3.5 w-3.5" /> {mode === "budget" ? "Choose a line instead" : "Or: I’d rather set a weekly budget"}
                </button>
              </div>

              {mode === "budget" && (
                <div className="mt-3 rounded-2xl border border-floor/30 bg-floor-soft p-4">
                  <div className="text-sm font-medium text-ink">Spend at most this much per weekend</div>
                  <p className="mt-1 text-xs text-ink-2">We buy the tightest protection line this budget affords this Friday. In calm weeks that’s tighter; in wild weeks it’s looser.</p>
                  <div className="mt-3 grid grid-cols-4 gap-2">
                    {[2, 5, 10, 25].map((bp) => (
                      <button key={bp} type="button" onClick={() => setBudgetBp(bp)} className={clsx("tnum rounded-xl border px-2 py-2.5 text-sm font-semibold", budgetBp === bp ? "border-floor/60 bg-surface text-floor" : "border-line bg-surface-2 text-ink-2")}>
                        {fmtUsd(premiumFromBp(notional, bp), { precise: true })}
                      </button>
                    ))}
                  </div>
                  {q && <p className="mt-3 text-xs text-ink">That buys a <b>{bpsToPct(chosenLine)}</b> line this weekend.</p>}
                </div>
              )}

              {pricedOut && <Hint tone="warn">{token.ticker} is too jumpy this week to protect at a fair price with this line (it would cost over 2% of the amount). Try a looser line, like 10%.</Hint>}
              {slowQuote && !serverDown && <Hint tone="info">Waking up the pricing server. It sleeps when nobody has used it for a while, so the first price can take up to a minute.</Hint>}
              {serverDown && (
                <Hint tone="warn" action={<button type="button" className="btn-soft !h-9 !px-3 !text-xs" onClick={() => quoteQ.refetch()}>Try again</button>}>
                  The pricing service isn’t reachable right now, so we can’t give you a firm price. The numbers above are estimates.
                </Hint>
              )}

              <MondaySimulator className="mt-5" ticker={token.ticker} amount={toNum(notional, 6)} lineBps={chosenLine} cost={q ? toNum(premium, 6) : undefined} />
            </div>
          )}

          {/* ---------------- STEP 4: REVIEW ---------------- */}
          {step === 3 && token && (
            <div key="s3" className="animate-step-in">
              <StepTitle n={4} title="Review and confirm" hint="Here’s exactly what you’re buying, in one sentence and in numbers." />

              {week.ready && week.inWeekend && (
                <Hint tone="info">Sales for this weekend closed at Friday’s bell, so this protection covers <b>next</b> weekend ({fmtDateNY(epochId, { month: "short", day: "numeric" })} → {fmtDateNY(expectedOpen, { month: "short", day: "numeric" })}).</Hint>
              )}
              <div className="mt-5 rounded-2xl border border-floor/30 bg-gradient-to-br from-floor/[0.10] to-transparent p-5">
                <div className="flex items-center gap-3">
                  <StockMark ticker={token.ticker} size={44} />
                  <p className="text-base leading-relaxed text-ink">
                    If <b>{token.ticker}</b> opens on Monday more than <b className="text-floor">{bpsToPct(chosenLine)}</b> below Friday’s close, you get the difference back on your <b>{fmtUsd(notional)}</b>. Up to <b>{fmtUsd((notional * 2000n) / 10_000n)}</b>.
                  </p>
                </div>
              </div>

              <dl className="mt-4 divide-y divide-line rounded-2xl border border-line bg-surface-2 px-4">
                <Row k="Stock" v={<span className="inline-flex flex-wrap items-center justify-end gap-2"><span>{token.symbol}</span><IssuerPill issuer={token.wrapper} /></span>} />
                <Row k="Amount protected" v={fmtUsd(notional)} />
                <Row k={<Term k="line">Protection line</Term>} v={q ? `−${bpsToPct(chosenLine)} (${fmtPrice(toBig(q.floorPricePerShare) || floorPrice(price, chosenLine))} per share)` : `−${bpsToPct(chosenLine)}`} />
                <Row k="Covers" v={`${fmtDateNY(epochId, { weekday: "short", month: "short", day: "numeric" })} 4 pm → ${fmtDateNY(expectedOpen, { weekday: "short", month: "short", day: "numeric" })} 9:30 am (New York)`} />
                <Row k={<Term k="maxPayout">Most it can pay</Term>} v={fmtUsd((notional * 2000n) / 10_000n)} />
                <Row k="Chance it pays (history)" v={q ? oneIn(q.estimatedValue.breachProbability) : "…"} />
                <Row k={<Term k="cost">You pay once</Term>} v={q ? <span className="text-lg font-semibold text-floor">{fmtUsd(premium, { precise: true })}</span> : <CircleNotch weight="bold" className="ml-auto h-4 w-4 animate-spin text-ink-3" />} />
              </dl>

              {q && (
                <p className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-ink-3">
                  <Info weight="duotone" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {q.estimatedValue.fairBp * 1.5 < q.estimatedValue.floorBp
                    ? <>On average we expect to pay back {fmtUsd(premiumFromBp(notional, q.estimatedValue.fairBp), { precise: true })} over many weekends like this one. That’s below our minimum fee of $0.01 per $100, so you pay the minimum.</>
                    : <>Fair value is {fmtUsd(premiumFromBp(notional, q.estimatedValue.fairBp), { precise: true })}: that’s what we expect to pay back on average over many weekends. The other {fmtUsd(premiumFromBp(notional, q.estimatedValue.chargedBp - q.estimatedValue.fairBp), { precise: true })} is our 50% safety margin, which keeps the protection pool able to pay.</>}
                </p>
              )}
              {worst !== undefined && (
                <p className="mt-2 text-xs text-ink-3">
                  For scale: {token.ticker}’s worst weekend since 2005 was {(worst * 100).toFixed(1)}%. Risk level this week: <span className="text-ink-2">{risk.label.toLowerCase()}</span>.
                </p>
              )}

              <div className="mt-5">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-3">What your wallet will ask for</div>
                <ActionChecklist items={checklist.map((c) => ({ ...c }))} />
              </div>
            </div>
          )}
        </>
      </div>

      {/* footer: back / continue, sticky on phones */}
      <div className="sticky bottom-[calc(5.75rem+env(safe-area-inset-bottom))] z-10 border-t border-line bg-surface/95 px-5 py-4 backdrop-blur sm:px-6 lg:static">
        {step < 3 ? (
          <div className="flex items-center gap-3">
            {step > 0 && (
              <button type="button" onClick={() => setStep(step - 1)} className="btn-ghost !h-14 !w-14 !px-0" aria-label="Back">
                <ArrowLeft weight="bold" className="h-5 w-5" />
              </button>
            )}
            <button type="button" onClick={() => setStep(step + 1)} disabled={!canNext} className="btn-primary">
              {step === 0 ? (token ? `Continue with ${token.ticker}` : "Pick a stock to continue") : step === 1 ? (amountProblem ? "Enter an amount" : `Protect ${fmtUsd(notional)}`) : quoteQ.isFetching && !q ? "Getting your price…" : q ? `Continue · ${fmtUsd(premium, { precise: true })}` : pricedOut ? "Try another line" : "Getting your price…"}
              <ArrowRight weight="bold" className="h-5 w-5" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setStep(2)} className="btn-ghost !h-14 !w-14 !px-0" aria-label="Back">
              <ArrowLeft weight="bold" className="h-5 w-5" />
            </button>
            <button type="button" onClick={primary.onClick} disabled={primary.disabled || tx.busy} className="btn-primary">
              {tx.busy ? (
                <>
                  <CircleNotch weight="bold" className="h-5 w-5 animate-spin" /> {tx.status === "signing" ? "Check your wallet…" : "Confirming on the network…"}
                </>
              ) : (
                <>
                  <ShieldCheck weight="duotone" className="h-5 w-5" /> {primary.label}
                </>
              )}
            </button>
          </div>
        )}
        <p className="mt-2 text-center text-[11px] text-ink-3"><ModeText mainnet="Mainnet · test tokens, no real money" testnet="Testnet · no real money" /> · you can back out at any step</p>
      </div>
    </div>
  );
}

function StepTitle({ n, title, hint }: { n: number; title: string; hint: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wider text-floor">Step {n} of 4</div>
      <h2 className="mt-1 text-xl font-semibold tracking-tight text-ink sm:text-2xl">{title}</h2>
      <p className="mt-1 text-sm leading-relaxed text-ink-2">{hint}</p>
    </div>
  );
}

function Row({ k, v }: { k: React.ReactNode; v: React.ReactNode }) {
  return (
    <div className="row !py-3">
      <dt>{k}</dt>
      <dd>{v}</dd>
    </div>
  );
}

function Hint({ children, tone, action }: { children: React.ReactNode; tone: "warn" | "info"; action?: React.ReactNode }) {
  return (
    <div className={clsx("mt-4 flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-sm", tone === "warn" ? "border-floor/30 bg-floor-soft text-ink" : "border-keeper/25 bg-keeper-soft text-ink")}>
      <div className="flex items-start gap-2">
        {tone === "warn" ? <Warning weight="duotone" className="mt-0.5 h-4 w-4 shrink-0 text-floor" /> : <Info weight="duotone" className="mt-0.5 h-4 w-4 shrink-0 text-keeper" />}
        <span className="leading-relaxed">{children}</span>
      </div>
      {action}
    </div>
  );
}

function Success({ d, chainId, onAgain }: { d: Done; chainId: number; onAgain: () => void }) {
  const reduced = useReducedMotion();
  return (
    <motion.div initial={reduced ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="card ring-grad overflow-hidden p-6 sm:p-8">
      <div className="flex flex-col items-center text-center">
        <motion.span initial={reduced ? false : { scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 260, damping: 18 }} className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#FFC76B] to-floor-2 text-[#1A0E00] shadow-glow">
          <ShieldCheck weight="duotone" className="h-8 w-8" />
        </motion.span>
        <h2 className="mt-5 text-2xl font-semibold tracking-tight">Your weekend is protected</h2>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-ink-2">
          {fmtUsd(d.notional)} of {d.ticker} is covered below −{bpsToPct(d.lineBps)} for the weekend of {fmtDateNY(d.epochId, { weekday: "short", month: "short", day: "numeric" })}. You paid {fmtUsd(d.premium, { precise: true })}.
        </p>
      </div>

      <ol className="mx-auto mt-8 max-w-md space-y-0">
        {[
          { icon: CalendarCheck, h: `Friday ${fmtDateNY(d.epochId, { month: "short", day: "numeric" })}, 4 pm`, p: "The US market closes. Your protection starts." },
          { icon: MoonStars, h: "All weekend", p: "Nothing to do. Your payout money is already set aside in the pool." },
          { icon: SunHorizon, h: `Monday ${fmtDateNY(d.expectedOpen, { month: "short", day: "numeric" })}, 9:30 am`, p: `We compare Monday’s opening price with Friday’s close. If ${d.ticker} fell more than ${bpsToPct(d.lineBps)}, USDT lands in your wallet.` },
        ].map((s, i, arr) => (
          <li key={s.h} className="relative flex gap-4 pb-6">
            {i < arr.length - 1 && <span className="absolute left-[19px] top-10 h-[calc(100%-2.5rem)] w-px bg-line-strong" aria-hidden />}
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-3 text-floor">
              <s.icon weight="duotone" className="h-[18px] w-[18px]" />
            </span>
            <div className="pt-1">
              <div className="text-sm font-semibold text-ink">{s.h}</div>
              <div className="mt-0.5 text-sm text-ink-2">{s.p}</div>
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-2 grid gap-3 sm:grid-cols-2">
        <Link href="/activity" className="btn-primary">
          See it in My activity
        </Link>
        <button type="button" onClick={onAgain} className="btn-ghost !h-14">
          Protect another stock
        </button>
      </div>
      <a href={explorerTx(chainId, d.txHash)} target="_blank" rel="noreferrer" className="btn-link mx-auto mt-4 flex w-fit !text-xs">
        View the transaction <ArrowSquareOut weight="bold" className="h-3 w-3" />
      </a>
    </motion.div>
  );
}
