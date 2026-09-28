"use client";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAccount, useReadContracts, useSwitchChain } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import clsx from "clsx";
import { ArrowLineDown, ArrowLineUp, ChartLineDown, ChartLineUp, CircleNotch, Coins, Lock, ShieldStar, Wallet } from "@phosphor-icons/react";
import { api } from "@/lib/api";
import { CHAIN_META, CoverMarketAbi, KeeperVaultAbi, MockERC20Abi, ZERO_ADDRESS, parseUsd } from "@/lib/contracts";
import { FALLBACK_SUMMARY } from "@/lib/backtest";
import { fmtUsd, toBig, toNum } from "@/lib/format";
import { useDeployment } from "@/hooks/useDeployment";
import { useTx } from "@/hooks/useTx";
import { Term } from "@/components/ui/Term";
import { ActionChecklist } from "@/components/ui/Steps";

type Side = "deposit" | "withdraw";

export function EarnFlow() {
  const { address, isConnected, chainId: walletChain } = useAccount();
  const { openConnectModal } = useConnectModal();
  const { switchChain, isPending: switching } = useSwitchChain();
  const { chainId, deployment } = useDeployment();
  const tx = useTx(chainId);
  const [side, setSide] = useState<Side>("deposit");
  const [amount, setAmount] = useState("");

  const vault = deployment?.contracts.KeeperVault;
  const market = deployment?.contracts.CoverMarket;
  const usdt = deployment?.contracts.USDT;
  const me = address ?? ZERO_ADDRESS;

  const reads = useReadContracts({
    contracts: [
      { address: vault, abi: KeeperVaultAbi, functionName: "totalAssets", chainId },
      { address: vault, abi: KeeperVaultAbi, functionName: "lockedAssets", chainId },
      { address: vault, abi: KeeperVaultAbi, functionName: "floorAssets", chainId },
      { address: vault, abi: KeeperVaultAbi, functionName: "freeCushion", chainId },
      { address: vault, abi: KeeperVaultAbi, functionName: "totalPremiumsReceived", chainId },
      { address: vault, abi: KeeperVaultAbi, functionName: "totalPayoutsPaid", chainId },
      { address: vault, abi: KeeperVaultAbi, functionName: "depositCap", chainId },
      { address: market, abi: CoverMarketAbi, functionName: "capacityNotional", chainId },
      { address: vault, abi: KeeperVaultAbi, functionName: "balanceOf", args: [me], chainId },
      { address: vault, abi: KeeperVaultAbi, functionName: "maxWithdraw", args: [me], chainId },
      { address: usdt, abi: MockERC20Abi, functionName: "balanceOf", args: [me], chainId },
      { address: usdt, abi: MockERC20Abi, functionName: "allowance", args: [me, vault ?? ZERO_ADDRESS], chainId },
      { address: vault, abi: KeeperVaultAbi, functionName: "paused", chainId },
    ],
    query: { enabled: !!vault, refetchInterval: 20_000 },
  });
  const r = (i: number) => reads.data?.[i]?.result as bigint | undefined;
  const total = r(0) ?? 0n;
  const locked = r(1) ?? 0n;
  const reserve = r(2) ?? 0n;
  const free = r(3) ?? 0n;
  const premiums = r(4) ?? 0n;
  const payouts = r(5) ?? 0n;
  const cap = r(6);
  const capacity = r(7) ?? 0n;
  const shares = r(8) ?? 0n;
  const maxWithdraw = r(9) ?? 0n;
  const usdtBal = r(10) ?? 0n;
  const allowance = r(11) ?? 0n;
  const paused = (reads.data?.[12]?.result as boolean | undefined) ?? false;

  const mine = useReadContracts({
    contracts: [{ address: vault, abi: KeeperVaultAbi, functionName: "convertToAssets", args: [shares], chainId }],
    query: { enabled: !!vault && shares > 0n, refetchInterval: 20_000 },
  });
  const myValue = (mine.data?.[0]?.result as bigint | undefined) ?? 0n;

  const srv = useQuery({ queryKey: ["vault", chainId], queryFn: () => api.vault(chainId), staleTime: 30_000, retry: false });
  const band = useMemo(() => {
    const b = srv.data?.apyBand ?? srv.data?.impliedApy;
    if (Array.isArray(b)) return { low: b[0], high: b[1] };
    if (b && typeof b === "object" && "low" in b) return { low: b.low, high: b.high };
    return { low: FALLBACK_SUMMARY.keeper.roc_pa, high: FALLBACK_SUMMARY.keeper.roc_pa_since_2015 };
  }, [srv.data]);
  const lifePrem = premiums > 0n ? premiums : toBig(srv.data?.totalPremiumsReceived ?? srv.data?.premiums);
  const lifePay = payouts > 0n ? payouts : toBig(srv.data?.totalPayoutsPaid ?? srv.data?.payouts);

  const amt = parseUsd(amount);
  const wrongChain = isConnected && walletChain !== chainId;

  async function faucet() {
    if (!usdt) return;
    if (await tx.run("Test USDT", () => tx.writeContractAsync({ address: usdt, abi: MockERC20Abi, functionName: "faucet", chainId }), { successTitle: "10,000 test USDT added" })) reads.refetch();
  }
  async function approve() {
    if (!usdt || !vault) return;
    if (await tx.run("Allow USDT", () => tx.writeContractAsync({ address: usdt, abi: MockERC20Abi, functionName: "approve", args: [vault, amt], chainId }), { successTitle: "USDT allowed" })) reads.refetch();
  }
  async function deposit() {
    if (!vault || !address) return;
    if (await tx.run("Deposit", () => tx.writeContractAsync({ address: vault, abi: KeeperVaultAbi, functionName: "deposit", args: [amt, address], chainId }), { successTitle: "You’re now earning", successBody: `${fmtUsd(amt)} added to the protection pool.` })) {
      setAmount("");
      reads.refetch();
      mine.refetch();
    }
  }
  async function withdraw() {
    if (!vault || !address) return;
    if (await tx.run("Withdraw", () => tx.writeContractAsync({ address: vault, abi: KeeperVaultAbi, functionName: "withdraw", args: [amt, address, address], chainId }), { successTitle: "Withdrawn to your wallet" })) {
      setAmount("");
      reads.refetch();
      mine.refetch();
    }
  }

  const primary = (() => {
    if (!isConnected) return { label: "Connect wallet", onClick: () => openConnectModal?.() };
    if (wrongChain) return { label: `Switch to ${CHAIN_META[chainId]?.short}`, onClick: () => switchChain({ chainId }), disabled: switching };
    if (paused) return { label: "Pool paused by the admin", disabled: true };
    if (amt === 0n) return { label: side === "deposit" ? "Enter an amount to add" : "Enter an amount to take out", disabled: true };
    if (side === "deposit") {
      if (cap !== undefined && cap > 0n && total + amt > cap) return { label: "Pool is full right now", disabled: true };
      if (usdtBal < amt) return { label: "Get free test USDT", onClick: faucet };
      if (allowance < amt) return { label: `Allow ${fmtUsd(amt)} USDT`, onClick: approve };
      return { label: `Add ${fmtUsd(amt)} to the pool`, onClick: deposit };
    }
    if (amt > maxWithdraw) return { label: `You can take out up to ${fmtUsd(maxWithdraw)} now`, disabled: true };
    return { label: `Take out ${fmtUsd(amt)}`, onClick: withdraw };
  })();

  const pct = (x: bigint) => (total > 0n ? Number((x * 10_000n) / total) / 100 : 0);
  const reservePct = pct(reserve);
  const lockedPct = pct(locked);
  const freePct = Math.max(0, 100 - reservePct - lockedPct);

  return (
    <div className="space-y-6">
      {/* how it works in one line */}
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { icon: Coins, h: "You add USDT", p: "It joins the protection pool." },
          { icon: ChartLineUp, h: "You earn every fee", p: "People pay each Friday to protect their stocks." },
          { icon: ChartLineDown, h: "Sometimes it pays out", p: "When a stock opens much lower on Monday." },
        ].map((s) => (
          <div key={s.h} className="card-2 flex items-start gap-3 p-4 sm:flex-col">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-keeper-soft text-keeper">
              <s.icon weight="duotone" className="h-4 w-4" />
            </span>
            <div>
              <div className="text-sm font-semibold text-ink">{s.h}</div>
              <div className="text-xs leading-relaxed text-ink-2">{s.p}</div>
            </div>
          </div>
        ))}
      </div>

      {/* deposit / withdraw */}
      <div className="card overflow-hidden">
        <div className="grid grid-cols-2 border-b border-line">
          {(["deposit", "withdraw"] as Side[]).map((s) => (
            <button key={s} type="button" onClick={() => { setSide(s); setAmount(""); }} className={clsx("flex items-center justify-center gap-2 py-4 text-sm font-semibold transition", side === s ? "bg-keeper-soft text-keeper shadow-[inset_0_-2px_0_0] shadow-keeper" : "text-ink-2 hover:text-ink")}>
              {s === "deposit" ? <ArrowLineDown weight="bold" className="h-4 w-4" /> : <ArrowLineUp weight="bold" className="h-4 w-4" />}
              {s === "deposit" ? "Add money" : "Take money out"}
            </button>
          ))}
        </div>
        <div className="p-5 sm:p-6">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 text-ink-2"><Wallet weight="duotone" className="h-4 w-4" /> Your share of the pool</span>
            <span className="tnum font-semibold text-ink">{isConnected ? fmtUsd(myValue) : "—"}</span>
          </div>
          <div className="field mt-4 focus-within:!border-keeper/50">
            <div className="flex items-center justify-between text-xs text-ink-3">
              <span>{side === "deposit" ? "Amount to add" : "Amount to take out"}</span>
              {isConnected && <span className="tnum">{side === "deposit" ? `Wallet: ${fmtUsd(usdtBal)}` : `Available now: ${fmtUsd(maxWithdraw)}`}</span>}
            </div>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-3xl font-semibold text-ink-3">$</span>
              <input inputMode="decimal" autoComplete="off" placeholder="0" value={amount} onChange={(e) => { const v = e.target.value.replace(/[^0-9.]/g, ""); if ((v.match(/\./g) ?? []).length <= 1) setAmount(v); }} className="input-bare" aria-label="Amount in USDT" />
              <span className="text-sm font-medium text-ink-3">USDT</span>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {(side === "deposit" ? [500, 2000, 10000] : []).map((v) => (
              <button key={v} type="button" onClick={() => setAmount(String(v))} className="rounded-full border border-line bg-surface-2 px-4 py-2 text-sm font-medium text-ink-2 hover:text-ink">${v.toLocaleString()}</button>
            ))}
            {isConnected && (
              <button type="button" onClick={() => setAmount(String(toNum(side === "deposit" ? usdtBal : maxWithdraw, 6)))} className="rounded-full border border-line bg-surface-2 px-4 py-2 text-sm font-medium text-ink-2 hover:text-ink">
                Max
              </button>
            )}
          </div>

          {side === "withdraw" && isConnected && myValue > maxWithdraw && (
            <p className="mt-3 flex items-start gap-2 rounded-2xl bg-surface-2 px-4 py-3 text-xs leading-relaxed text-ink-2">
              <Lock weight="duotone" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-keeper" /> {fmtUsd(myValue - maxWithdraw)} of your share is set aside to pay this weekend’s protection. It frees up after Monday’s open.
            </p>
          )}

          {side === "deposit" && isConnected && amt > 0n && (
            <div className="mt-4">
              <ActionChecklist
                items={[
                  { label: "Have the USDT", detail: "The test faucet gives 10,000 for free.", state: usdtBal >= amt ? "done" : "active" },
                  { label: "Allow this amount", detail: "One-time permission for exactly this deposit.", state: usdtBal < amt ? "todo" : allowance >= amt ? "done" : "active" },
                  { label: "Add to the pool", detail: "You receive pool shares that grow with every fee.", state: usdtBal >= amt && allowance >= amt ? "active" : "todo" },
                ]}
              />
            </div>
          )}

          <button type="button" onClick={primary.onClick} disabled={primary.disabled || tx.busy} className="btn-keeper mt-5">
            {tx.busy ? (<><CircleNotch weight="bold" className="h-5 w-5 animate-spin" /> {tx.status === "signing" ? "Check your wallet…" : "Confirming…"}</>) : primary.label}
          </button>
        </div>
      </div>

      <EarningsCalculator low={band.low} high={band.high} />

      {/* where the pool's money is */}
      <div className="card p-5 sm:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-lg font-semibold">Where the pool’s money is right now</h3>
          <span className="tnum text-2xl font-semibold text-keeper">{fmtUsd(total, { compact: true })}</span>
        </div>
        <div className="mt-4 flex h-4 overflow-hidden rounded-full bg-surface-4" role="img" aria-label="Pool breakdown">
          <div className="bg-[repeating-linear-gradient(135deg,#2A3142_0_6px,#222735_6px_12px)]" style={{ width: `${reservePct}%` }} />
          <div className="bg-floor" style={{ width: `${lockedPct}%` }} />
          <div className="bg-keeper" style={{ width: `${freePct}%` }} />
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Legend swatch="bg-[repeating-linear-gradient(135deg,#2A3142_0_4px,#3a4256_4px_8px)]" title={<Term k="safetyFloor">Safety reserve</Term>} value={fmtUsd(reserve, { compact: true })} note="Never used to back protection." />
          <Legend swatch="bg-floor" title="Set aside this weekend" value={fmtUsd(locked, { compact: true })} note="The most this weekend can pay out." />
          <Legend swatch="bg-keeper" title="Free to back more" value={fmtUsd(free, { compact: true })} note={`Room to protect ${fmtUsd(capacity, { compact: true })} more stock.`} />
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 border-t border-line pt-5">
          <div>
            <div className="text-xs text-ink-3">Fees earned, all time</div>
            <div className="tnum mt-1 text-lg font-semibold text-held">+{fmtUsd(lifePrem)}</div>
          </div>
          <div>
            <div className="text-xs text-ink-3">Paid out on bad Mondays</div>
            <div className="tnum mt-1 text-lg font-semibold text-ink">{fmtUsd(lifePay)}</div>
          </div>
        </div>
      </div>

      <div className="card-2 flex items-start gap-3 p-5 text-sm leading-relaxed text-ink-2">
        <ShieldStar weight="duotone" className="mt-0.5 h-5 w-5 shrink-0 text-keeper" />
        <p>
          <span className="font-semibold text-ink">The honest part.</span> This is not a savings account. Most weekends the pool just collects fees. A few times a year it pays out, and in a crash weekend like March 2020 a pool like this lost a big chunk of what it had at risk. One weekend can never cost more than what was set aside for it, which is never more than half the pool. Test network only; the admin can pause and move funds.
        </p>
      </div>
    </div>
  );
}

function Legend({ swatch, title, value, note }: { swatch: string; title: React.ReactNode; value: string; note: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className={clsx("mt-1.5 h-3 w-3 shrink-0 rounded", swatch)} aria-hidden />
      <div>
        <div className="text-xs text-ink-2">{title}</div>
        <div className="tnum text-base font-semibold text-ink">{value}</div>
        <div className="text-[11px] text-ink-3">{note}</div>
      </div>
    </div>
  );
}

/** Slide a deposit size; see a typical year and the worst weekend on record, in dollars. */
function EarningsCalculator({ low, high }: { low: number; high: number }) {
  const [dep, setDep] = useState(10_000);
  const worstShare = 0.5 * Math.abs(FALLBACK_SUMMARY.keeper.worst_weekend_pct_capital); // at-risk half x worst hit on it
  const fmt = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
  return (
    <div className="card p-5 sm:p-6">
      <h3 className="text-lg font-semibold">What could I earn?</h3>
      <p className="mt-1 text-sm text-ink-2">Based on 21 years of real weekends (2005 to 2026). Past years don’t promise future ones.</p>
      <div className="mt-5 flex items-baseline justify-between">
        <span className="text-sm text-ink-2">If you add</span>
        <span className="tnum text-3xl font-semibold tracking-tight">{fmt(dep)}</span>
      </div>
      <input type="range" min={500} max={100_000} step={500} value={dep} onChange={(e) => setDep(Number(e.target.value))} className="slider mt-3 w-full [&::-webkit-slider-runnable-track]:bg-surface-4" style={{ background: `linear-gradient(to right, #5CC8FF ${(dep / 100_000) * 100}%, #222735 ${(dep / 100_000) * 100}%)`, borderRadius: 999 }} aria-label="Deposit size" />
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-held/25 bg-held-soft p-4">
          <div className="text-xs text-ink-2">A typical year</div>
          <div className="tnum mt-1 text-2xl font-semibold text-held">
            +{fmt(dep * low)} to +{fmt(dep * high)}
          </div>
          <div className="mt-1 text-[11px] text-ink-3">{Math.round(low * 100)}% to {Math.round(high * 100)}% a year, after paying out on bad Mondays</div>
        </div>
        <div className="rounded-2xl border border-gap/25 bg-gap-soft p-4">
          <div className="text-xs text-ink-2">The worst weekend on record (Mar 2020)</div>
          <div className="tnum mt-1 text-2xl font-semibold text-gap">−{fmt(dep * worstShare)}</div>
          <div className="mt-1 text-[11px] text-ink-3">Stocks opened 10–29% lower after a Sunday emergency rate cut</div>
        </div>
      </div>
    </div>
  );
}
