"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import {
  type Icon as PhosphorIcon,
  ArrowRight,
  ArrowSquareOut,
  ArrowsLeftRight,
  CheckCircle,
  CircleNotch,
  Clock,
  Coins,
  Fingerprint,
  HandCoins,
  Lightning,
  Plugs,
  Receipt,
  Robot,
  ShieldCheck,
  Terminal,
  Wallet,
  WarningCircle,
  XCircle,
} from "@phosphor-icons/react";
import { Badge } from "@/components/ui/Badge";
import { StockMark } from "@/components/ui/StockMark";
import { BSC_TESTNET, CHAIN_META, getStaticDeployment, stocksToTokens } from "@/lib/contracts";
import { fmtUsd, shortAddr } from "@/lib/format";
import type { HermeeEvent, HermeeStep } from "@/lib/hermee/core";
import {
  KIP_IDENTITY,
  KIP_URL,
  X402_CONTRACTS,
  fetchAgentActivity,
  fetchDemoInfo,
  fetchKipStatus,
  runAgentDemo,
  type AgentEvent,
  type DemoInfo,
  type DemoResult,
  type KipStatus,
} from "@/lib/agents";

const EXPLORER = CHAIN_META[BSC_TESTNET]!.explorer;
const addrUrl = (a: string) => `${EXPLORER}/address/${a}`;
const txUrl = (h: string) => `${EXPLORER}/tx/${h}`;

/** the x402 handshake, in the order the live run walks through it */
const STEPS: { step: HermeeStep; title: string; wire: string; plain: string }[] = [
  { step: "ask", title: "Hermee's agent asks for cover", wire: "POST /cover/bind", plain: "No payment yet, just the terms: which stock, how much, which floor." },
  { step: "offer", title: "Kip's agent names its price", wire: "402 Payment Required · PAYMENT-REQUIRED", plain: "Priced from 21 years of weekends. The reply says who to pay, how much and in which token." },
  { step: "check", title: "Guardrails before paying", wire: "budget · recipient · asset · network", plain: "Hermee's agent refuses anything above its owner's budget or different from the offer." },
  { step: "pay", title: "One signature pays", wire: "Permit2 witness signature · PAYMENT-SIGNATURE", plain: "No approve-then-transfer. On mainnet this is `baw x402-payment sign` in the Binance Agentic Wallet." },
  { step: "bind", title: "Settle and bind on-chain", wire: "facilitator → x402ExactPermit2Proxy · Kip → coverFor()", plain: "USDT moves Hermee → Kip, then Kip binds the policy for Hermee and moves the premium into the pool." },
  { step: "done", title: "Protected", wire: "200 OK · PAYMENT-RESPONSE", plain: "The policy belongs to Hermee. If Monday opens below the floor, the pool pays Hermee directly." },
];

const STEP_INDEX: Record<HermeeStep, number> = { ask: 0, offer: 1, check: 2, confirm: 2, pay: 3, bind: 4, done: 5, error: -1 };

export function AgentsView() {
  const [kip, setKip] = useState<KipStatus | null | undefined>(undefined);
  const [demo, setDemo] = useState<DemoInfo | null | undefined>(undefined);
  const [events, setEvents] = useState<AgentEvent[]>([]);

  const refresh = useCallback(async () => {
    const [k, d, a] = await Promise.all([fetchKipStatus(), fetchDemoInfo(), fetchAgentActivity(BSC_TESTNET)]);
    setKip(k);
    setDemo(d);
    setEvents(a);
  }, []);

  useEffect(() => {
    void refresh();
    const t = setInterval(() => void refresh(), 30_000);
    return () => clearInterval(t);
  }, [refresh]);

  const earned = useMemo(() => events.filter((e) => e.kind === "x402_settled").reduce((s, e) => s + BigInt(e.amount ?? "0"), 0n), [events]);
  const bound = useMemo(() => events.filter((e) => e.kind === "cover_bound").length, [events]);

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-1 items-stretch gap-4 md:grid-cols-[1fr_auto_1fr]">
        <AgentCard
          tone="floor"
          icon={Wallet}
          role="Buyer · the Sleeper"
          name="Hermee's agent"
          blurb="Protects a stock holder's weekend. It shops for cover, checks the price against a budget and pays with one signature."
          rows={[
            { k: "Wallet", v: demo?.hermee ? <AddrLink a={demo.hermee} /> : <Skeleton /> },
            { k: "Signs with", v: <span>Binance Agentic Wallet on mainnet · test key on BSC Testnet</span> },
            { k: "Policies bought", v: <span className="tnum">{bound}</span> },
          ]}
          chips={["x402 buyer", "budget guardrail", "baw x402-payment"]}
        />
        <div className="flex items-center justify-center py-1 md:py-0" aria-hidden>
          <div className="flex flex-col items-center gap-2 text-ink-3">
            <ArrowsLeftRight weight="bold" className="h-6 w-6 rotate-90 text-ink-2 md:rotate-0" />
            <span className="rounded-full border border-line bg-surface-2 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-ink-2">x402 · USDT</span>
          </div>
        </div>
        <AgentCard
          tone="keeper"
          icon={Robot}
          role="Underwriter · the Keeper"
          name="Kip's agent"
          blurb="Built on BNB Agent Studio. Prices cover, sells it over x402, binds it on-chain and settles its own book on Monday."
          rows={[
            {
              k: "Identity",
              v: (
                <a href={addrUrl(KIP_IDENTITY.registry)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-ink">
                  ERC-8004 agent #{KIP_IDENTITY.agentId} <ArrowSquareOut weight="bold" className="h-3 w-3" />
                </a>
              ),
            },
            { k: "Wallet", v: kip ? <AddrLink a={kip.address} /> : kip === null ? <span className="text-ink-3">waking up…</span> : <Skeleton /> },
            {
              k: "Status",
              v: kip ? (
                <span className="inline-flex flex-wrap items-center gap-1.5">
                  {kip.authorisedBinder ? <Badge tone="held" dot>authorised binder</Badge> : <Badge tone="gap">not authorised</Badge>}
                  <Badge tone="muted">{kip.keeper.openPolicies} open</Badge>
                </span>
              ) : (
                <Skeleton />
              ),
            },
            { k: "Earned over x402", v: <span className="tnum">{fmtUsd(earned, { precise: true })}</span> },
          ]}
          chips={["Agent Studio", "ERC-8004", "MCP tools", "autonomous keeper"]}
        />
      </section>

      <LiveRun demo={demo} onFinished={refresh} />

      <Handshake />

      <MainnetSwitch />

      <ForAgents kip={kip} />

      <ActivityList events={events} />
    </div>
  );
}

// ------------------------------------------------------------------ agent cards

function AgentCard({ tone, icon: Icon, role, name, blurb, rows, chips }: { tone: "floor" | "keeper"; icon: PhosphorIcon; role: string; name: string; blurb: string; rows: { k: string; v: React.ReactNode }[]; chips: string[] }) {
  return (
    <div className={clsx("card relative overflow-hidden p-5", tone === "floor" ? "ring-1 ring-floor/15" : "ring-1 ring-keeper/15")}>
      <div className={clsx("pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full blur-2xl", tone === "floor" ? "bg-floor/10" : "bg-keeper/10")} aria-hidden />
      <div className="flex items-center gap-3">
        <span className={clsx("flex h-11 w-11 items-center justify-center rounded-2xl", tone === "floor" ? "bg-floor-soft text-floor" : "bg-keeper-soft text-keeper")}>
          <Icon weight="duotone" className="h-6 w-6" />
        </span>
        <div>
          <div className={clsx("text-[11px] font-semibold uppercase tracking-wider", tone === "floor" ? "text-floor" : "text-keeper")}>{role}</div>
          <div className="text-lg font-semibold text-ink">{name}</div>
        </div>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-ink-2">{blurb}</p>
      <dl className="mt-4 space-y-2 text-sm">
        {rows.map((r) => (
          <div key={r.k} className="flex items-start justify-between gap-3">
            <dt className="shrink-0 text-ink-3">{r.k}</dt>
            <dd className="min-w-0 text-right text-ink-2">{r.v}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-4 flex flex-wrap gap-1.5">
        {chips.map((c) => (
          <span key={c} className="rounded-lg border border-line bg-surface-2 px-2 py-0.5 text-[11px] text-ink-3">
            {c}
          </span>
        ))}
      </div>
    </div>
  );
}

function AddrLink({ a }: { a: string }) {
  return (
    <a href={addrUrl(a)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-mono text-xs hover:text-ink">
      {shortAddr(a, 5)} <ArrowSquareOut weight="bold" className="h-3 w-3" />
    </a>
  );
}

function Skeleton() {
  return <span className="inline-block h-3.5 w-24 animate-pulse rounded bg-surface-3 align-middle" />;
}

// ------------------------------------------------------------------ live run

const AMOUNTS = [500, 1_000, 2_500];
const FLOORS = [3, 5, 7];

function LiveRun({ demo, onFinished }: { demo: DemoInfo | null | undefined; onFinished: () => void }) {
  const tokens = useMemo(() => {
    const dep = getStaticDeployment(BSC_TESTNET);
    return dep ? stocksToTokens(dep.stocks) : [];
  }, []);
  const [token, setToken] = useState("NVDAB");
  const [amount, setAmount] = useState(1_000);
  const [floor, setFloor] = useState(5);
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState<HermeeEvent[]>([]);
  const [result, setResult] = useState<DemoResult | null>(null);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => () => abort.current?.abort(), []);

  const reached = useMemo(() => log.reduce((m, e) => Math.max(m, STEP_INDEX[e.step] ?? -1), -1), [log]);
  const failed = result ? !result.ok : log.some((e) => e.status === "error");
  const selected = tokens.find((t) => t.symbol === token);

  async function start() {
    setRunning(true);
    setLog([]);
    setResult(null);
    abort.current = new AbortController();
    try {
      const r = await runAgentDemo({ token, amountUsd: amount, floorPct: floor }, (e) => setLog((l) => [...l, e]), abort.current.signal);
      setResult(r);
    } catch (e) {
      setResult({ ok: false, error: (e as Error).message });
    } finally {
      setRunning(false);
      onFinished();
    }
  }

  const disabled = running || !demo?.enabled || demo.busy;

  return (
    <section className="card overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line/70 p-5">
        <div>
          <div className="eyebrow text-floor">Run it live</div>
          <h2 className="mt-1 text-xl font-semibold text-ink">Watch one agent pay another</h2>
          <p className="mt-1 max-w-xl text-sm text-ink-2">A real trade on BSC Testnet: Hermee&apos;s agent buys this weekend&apos;s cover from Kip&apos;s agent. Every step is an on-chain transaction you can open on BscScan. Test tokens only.</p>
        </div>
        <Badge tone="keeper" dot>
          BSC Testnet
        </Badge>
      </div>

      <div className="grid grid-cols-1 gap-5 p-5 lg:grid-cols-[260px_minmax(0,1fr)]">
        <div className="space-y-4">
          <Field label="Stock">
            <div className="grid grid-cols-2 gap-1.5">
              {tokens.slice(0, 6).map((t) => (
                <button key={t.symbol} type="button" disabled={running} onClick={() => setToken(t.symbol)} className={clsx("flex items-center gap-2 rounded-xl border px-2.5 py-2 text-left text-sm transition", token === t.symbol ? "border-floor/50 bg-floor-soft text-ink" : "border-line bg-surface-2 text-ink-2 hover:border-line-strong")}>
                  <StockMark ticker={t.ticker} size={20} />
                  <span className="truncate">{t.symbol}</span>
                </button>
              ))}
            </div>
          </Field>
          <Field label="Amount to protect">
            <Segmented options={AMOUNTS.map((a) => ({ v: a, label: `$${a.toLocaleString("en-US")}` }))} value={amount} onChange={setAmount} disabled={running} />
          </Field>
          <Field label="Floor below Friday's close">
            <Segmented options={FLOORS.map((f) => ({ v: f, label: `-${f}%` }))} value={floor} onChange={setFloor} disabled={running} />
          </Field>
          <button type="button" onClick={start} disabled={disabled} className="btn btn-lg w-full bg-gradient-to-r from-[#FFC76B] to-floor-2 text-[#1A0E00] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50">
            {running ? <CircleNotch weight="bold" className="h-5 w-5 animate-spin" /> : <Lightning weight="duotone" className="h-5 w-5" />}
            {running ? "Agents are trading…" : "Start the agents"}
          </button>
          <p className="text-xs leading-relaxed text-ink-3">
            {demo === undefined
              ? "Waking the agents up (free servers can take up to a minute)…"
              : !demo?.enabled
                ? "The live demo is not configured on this server."
                : demo.busy
                  ? "Another visitor's agents are trading right now."
                  : `Protects ${fmtUsd(amount * 1e6)} of ${selected?.ticker ?? token} below -${floor}% for the weekend closing this Friday. Hermee's budget: at most 1% of the amount.`}
          </p>
        </div>

        <ol className="relative space-y-1">
          {STEPS.map((s, i) => {
            const state = failed && i === reached + 1 ? "failed" : i <= reached ? "done" : running && i === reached + 1 ? "active" : "todo";
            const msg = [...log].reverse().find((e) => STEP_INDEX[e.step] === i);
            return (
              <li key={s.step} className={clsx("relative flex gap-3 rounded-2xl p-3 transition", state === "active" && "bg-surface-2", state === "done" && "opacity-100", state === "todo" && "opacity-60")}>
                <span className={clsx("mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold", state === "done" ? "border-held/40 bg-held-soft text-held" : state === "active" ? "border-floor/50 bg-floor-soft text-floor" : state === "failed" ? "border-gap/40 bg-gap-soft text-gap" : "border-line bg-surface-2 text-ink-3")}>
                  {state === "done" ? <CheckCircle weight="fill" className="h-4 w-4" /> : state === "active" ? <CircleNotch weight="bold" className="h-4 w-4 animate-spin" /> : state === "failed" ? <XCircle weight="fill" className="h-4 w-4" /> : i + 1}
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="font-medium text-ink">{s.title}</span>
                    <code className="text-[11px] text-ink-3">{s.wire}</code>
                  </div>
                  <p className="mt-0.5 text-sm text-ink-2">{msg?.message ?? s.plain}</p>
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      {result && (
        <div className={clsx("animate-fade-in border-t p-5", result.ok ? "border-held/30 bg-held-soft" : "border-gap/30 bg-gap-soft")}>
          {result.ok ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-held text-[#00140B]">
                  <ShieldCheck weight="duotone" className="h-5 w-5" />
                </span>
                <div>
                  <div className="font-semibold text-ink">Policy #{result.policyId} is live for Hermee</div>
                  <div className="text-sm text-ink-2">Paid {fmtUsd(result.premiumUsd ?? "0", { precise: true })} over x402 · Kip&apos;s agent will settle it at Monday&apos;s open</div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 text-sm">
                {result.paymentTx && <TxButton label="x402 payment" hash={result.paymentTx} />}
                {result.bindTx && <TxButton label="Policy bound" hash={result.bindTx} />}
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-3 text-sm text-ink">
              <WarningCircle weight="duotone" className="mt-0.5 h-5 w-5 shrink-0 text-gap" />
              <span>{result.error}</span>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-xs font-medium text-ink-3">{label}</div>
      {children}
    </div>
  );
}

function Segmented<T extends number>({ options, value, onChange, disabled }: { options: { v: T; label: string }[]; value: T; onChange: (v: T) => void; disabled?: boolean }) {
  return (
    <div className="grid grid-cols-3 gap-1 rounded-xl border border-line bg-surface-2 p-1">
      {options.map((o) => (
        <button key={o.v} type="button" disabled={disabled} onClick={() => onChange(o.v)} className={clsx("rounded-lg py-1.5 text-sm font-medium transition", value === o.v ? "bg-surface-4 text-ink" : "text-ink-3 hover:text-ink-2")}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function TxButton({ label, hash }: { label: string; hash: string }) {
  return (
    <a href={txUrl(hash)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-xl border border-line-strong bg-surface-2 px-3 py-1.5 text-ink-2 hover:text-ink">
      {label} <span className="font-mono text-xs">{shortAddr(hash, 4)}</span> <ArrowSquareOut weight="bold" className="h-3.5 w-3.5" />
    </a>
  );
}

// ------------------------------------------------------------------ explainer sections

function Handshake() {
  const lanes = ["Hermee's agent", "Kip's agent", "Facilitator", "BNB Chain"];
  const msgs: { from: number; to: number; label: string; note: string }[] = [
    { from: 0, to: 1, label: "POST /cover/bind", note: "stock, amount, floor" },
    { from: 1, to: 0, label: "402 · PAYMENT-REQUIRED", note: "pay 0.16 USDT to Kip, exact/permit2" },
    { from: 0, to: 1, label: "retry · PAYMENT-SIGNATURE", note: "Permit2 witness signature" },
    { from: 1, to: 2, label: "verify + settle", note: "7 spec checks, then simulate" },
    { from: 2, to: 3, label: "x402ExactPermit2Proxy.settle", note: "USDT Hermee → Kip" },
    { from: 1, to: 3, label: "CoverMarket.coverFor", note: "policy for Hermee, premium → pool" },
    { from: 1, to: 0, label: "200 · PAYMENT-RESPONSE", note: "policy id + tx hashes" },
  ];
  return (
    <section className="card p-5">
      <div className="eyebrow text-keeper">Under the hood</div>
      <h2 className="mt-1 text-xl font-semibold text-ink">The x402 handshake</h2>
      <p className="mt-1 max-w-2xl text-sm text-ink-2">
        x402 turns HTTP&apos;s <code className="text-ink">402 Payment Required</code> into a real payment. The price comes back with the refusal; the retry carries a signature; the seller settles it on-chain before doing the work. The recipient is fixed inside Hermee&apos;s signature, so nobody in the middle can redirect the money.
      </p>
      <div className="mt-5 overflow-x-auto">
        <div className="min-w-[640px]">
          <div className="grid grid-cols-4 gap-2 text-center text-xs font-semibold text-ink-2">
            {lanes.map((l) => (
              <div key={l} className="rounded-xl border border-line bg-surface-2 py-2">
                {l}
              </div>
            ))}
          </div>
          <ol className="relative mt-2 space-y-1.5">
            <div className="pointer-events-none absolute inset-0 grid grid-cols-4" aria-hidden>
              {lanes.map((l) => (
                <div key={l} className="mx-auto w-px bg-line" />
              ))}
            </div>
            {msgs.map((m, i) => {
              const lo = Math.min(m.from, m.to);
              const hi = Math.max(m.from, m.to);
              const left = `${(lo + 0.5) * 25}%`;
              const width = `${(hi - lo) * 25}%`;
              return (
                <li key={i} className="relative h-11">
                  <div className="absolute top-1/2 h-px bg-ink-3" style={{ left, width }} />
                  <div className={clsx("absolute top-1/2 h-2 w-2 -translate-y-1/2 rotate-45 border-ink-3", m.to > m.from ? "-translate-x-full border-r border-t" : "border-b border-l")} style={{ left: `${(m.to + 0.5) * 25}%` }} />
                  <div className="absolute -top-0.5 whitespace-nowrap text-[11px]" style={{ left: `calc(${left} + 8px)` }}>
                    <span className="font-semibold text-ink">
                      {i + 1}. {m.label}
                    </span>{" "}
                    <span className="text-ink-3">{m.note}</span>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-2 text-xs text-ink-3 sm:grid-cols-2">
        <span>
          Permit2 <AddrLink a={X402_CONTRACTS.permit2} /> and the canonical x402 proxy <AddrLink a={X402_CONTRACTS.proxy} /> live at the same address on every chain.
        </span>
        <span>Kip can only call coverFor because the market owner authorised it as a binder; payouts and refunds always go to Hermee from the pool.</span>
      </div>
    </section>
  );
}

function MainnetSwitch() {
  const rows: { piece: string; testnet: string; mainnet: string }[] = [
    { piece: "Hermee's wallet", testnet: "local test key (Agentic Wallet has no testnet)", mainnet: "Binance Agentic Wallet (MPC, limits set in the Binance App)" },
    { piece: "x402 facilitator", testnet: "afterhours.fi stand-in, same verify/settle API", mainnet: "Binance b402 (gas sponsored)" },
    { piece: "Kip's agent", testnet: "Agent Studio, network = bsc-testnet", mainnet: "Agent Studio, network = bsc-mainnet" },
    { piece: "Payment contract", testnet: "canonical x402ExactPermit2Proxy", mainnet: "the same contract, same address" },
  ];
  return (
    <section className="card p-5">
      <div className="eyebrow text-floor">Mainnet-ready</div>
      <h2 className="mt-1 text-xl font-semibold text-ink">Same code, one switch</h2>
      <p className="mt-1 max-w-2xl text-sm text-ink-2">The Binance Agentic Wallet only runs on mainnet, so on testnet Hermee&apos;s agent signs the identical x402 payload with a test key. Moving to mainnet changes configuration, not code.</p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="text-xs text-ink-3">
            <tr>
              <th className="py-2 pr-3 font-medium" />
              <th className="py-2 pr-3 font-medium">BSC Testnet (live now)</th>
              <th className="py-2 font-medium">BSC Mainnet</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line/70">
            {rows.map((r) => (
              <tr key={r.piece}>
                <td className="py-2.5 pr-3 font-medium text-ink">{r.piece}</td>
                <td className="py-2.5 pr-3 text-ink-2">{r.testnet}</td>
                <td className="py-2.5 text-ink-2">{r.mainnet}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 overflow-x-auto rounded-2xl border border-line bg-[#07080C] p-4">
        <div className="mb-2 flex items-center gap-2 text-xs text-ink-3">
          <Terminal weight="duotone" className="h-4 w-4" /> Hermee&apos;s agent on mainnet (skill: binance-agentic-wallet)
        </div>
        <pre className="text-[12px] leading-relaxed text-ink-2">
          <code>{`# 1. ask Kip for cover -> HTTP 402 with a PAYMENT-REQUIRED header
curl -si -X POST ${KIP_URL}/cover/bind -d '{"buyer":"<wallet>","token":"<NVDAB>","notionalUsd":"1000000000","barrierBps":500}'

# 2. let the Agentic Wallet price and sign the payment (asks you first)
baw x402-payment preview --paymentRequirements <PAYMENT-REQUIRED> --json
baw x402-payment sign --paymentId <id> --selectedIndex 1 --json

# 3. retry with the signature -> 200 + PAYMENT-RESPONSE (policy id, tx hashes)
curl -s -X POST ${KIP_URL}/cover/bind -H "PAYMENT-SIGNATURE: <paymentHeaderValue>" -d '{..., "quoteId":"<id>"}'`}</code>
        </pre>
      </div>
    </section>
  );
}

function ForAgents({ kip }: { kip: KipStatus | null | undefined }) {
  const tools: { name: string; what: string }[] = [
    { name: "quote_cover", what: "price a weekend floor for any stock, amount and floor" },
    { name: "market_status", what: "is the market open, when is the Friday bell and Monday open" },
    { name: "gap_history", what: "how often Mondays gap past a floor, famous weekends" },
    { name: "pool_health", what: "the pool's assets, floor, cushion and capacity" },
    { name: "my_book", what: "policies Kip bound and its recent activity" },
  ];
  return (
    <section className="card p-5">
      <div className="eyebrow text-keeper">For other agents</div>
      <h2 className="mt-1 text-xl font-semibold text-ink">Plug in: free MCP tools, paid cover</h2>
      <p className="mt-1 max-w-2xl text-sm text-ink-2">Any agent (a router, an arbitrage bot, a portfolio agent) can check weekend risk for free before it trades, and buy cover when it matters.</p>
      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {tools.map((t) => (
          <div key={t.name} className="flex items-start gap-2.5 rounded-xl border border-line bg-surface-2 p-3">
            <Plugs weight="duotone" className="mt-0.5 h-4 w-4 shrink-0 text-keeper" />
            <div>
              <code className="text-sm text-ink">{t.name}</code>
              <div className="text-xs text-ink-3">{t.what}</div>
            </div>
          </div>
        ))}
        <div className="flex items-start gap-2.5 rounded-xl border border-floor/30 bg-floor-soft p-3">
          <Coins weight="duotone" className="mt-0.5 h-4 w-4 shrink-0 text-floor" />
          <div>
            <code className="text-sm text-ink">POST /cover/bind</code>
            <div className="text-xs text-ink-2">paid over x402 v2 (exact, Permit2)</div>
          </div>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2 text-sm">
        <a href={`${KIP_URL}/.well-known/agent-card.json`} target="_blank" rel="noreferrer" className="btn-soft !h-9 !rounded-xl">
          <Fingerprint weight="duotone" className="h-4 w-4" /> Agent card <ArrowSquareOut weight="bold" className="h-3.5 w-3.5" />
        </a>
        <span className="inline-flex h-9 items-center gap-2 rounded-xl border border-line bg-surface-2 px-3 font-mono text-xs text-ink-2">MCP · {KIP_URL}/mcp</span>
        {kip && (
          <span className="inline-flex h-9 items-center gap-2 rounded-xl border border-line bg-surface-2 px-3 text-xs text-ink-3">
            <Clock weight="duotone" className="h-4 w-4" /> keeper checks every {Math.round(kip.keeper.intervalMs / 1000)}s
          </span>
        )}
      </div>
    </section>
  );
}

const KIND: Record<string, { icon: PhosphorIcon; tone: "floor" | "keeper" | "held" | "gap" | "muted"; label: string }> = {
  x402_settled: { icon: HandCoins, tone: "floor", label: "x402 payment" },
  cover_bound: { icon: ShieldCheck, tone: "keeper", label: "Cover bound" },
  policy_settled: { icon: Receipt, tone: "held", label: "Settled" },
  x402_failed: { icon: XCircle, tone: "gap", label: "Payment failed" },
  feedback: { icon: CheckCircle, tone: "muted", label: "Feedback" },
  x402_verified: { icon: CheckCircle, tone: "muted", label: "Verified" },
};

function ago(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 90) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86_400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86_400)} d ago`;
}

function ActivityList({ events }: { events: AgentEvent[] }) {
  return (
    <section className="card p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="eyebrow text-ink-3">On-chain record</div>
          <h2 className="mt-1 text-xl font-semibold text-ink">Recent agent trades</h2>
        </div>
        <Badge tone="muted">{events.length} events</Badge>
      </div>
      {events.length === 0 ? (
        <p className="mt-4 text-sm text-ink-3">No agent trades yet. Start the agents above to create the first one.</p>
      ) : (
        <ul className="mt-4 divide-y divide-line/70">
          {events.map((e, i) => {
            const k = KIND[e.kind] ?? KIND.feedback!;
            return (
              <li key={`${e.tx ?? i}-${e.kind}`} className="flex flex-wrap items-center gap-3 py-3">
                <Badge tone={k.tone}>
                  <k.icon weight="duotone" className="h-3.5 w-3.5" /> {k.label}
                </Badge>
                <span className="min-w-0 flex-1 text-sm text-ink-2">{e.note}</span>
                {e.amount && <span className="tnum text-sm text-ink">{fmtUsd(e.amount, { precise: true })}</span>}
                <span className="text-xs text-ink-3">{ago(e.at)}</span>
                {e.tx && (
                  <a href={txUrl(e.tx)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-mono text-xs text-ink-3 hover:text-ink">
                    {shortAddr(e.tx, 4)} <ArrowSquareOut weight="bold" className="h-3 w-3" />
                  </a>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <a href="/docs#part-2" className="mt-3 inline-flex items-center gap-1 text-sm text-ink-3 hover:text-ink">
        How the pricing works <ArrowRight weight="bold" className="h-3.5 w-3.5" />
      </a>
    </section>
  );
}
