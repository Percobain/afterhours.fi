"use client";
import Link from "next/link";
import { useAccount } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import clsx from "clsx";
import { type Icon as PhosphorIcon, ArrowCounterClockwise, ArrowRight, ArrowSquareOut, CheckCircle, CircleNotch, Fire, HandCoins, Receipt, ShieldCheck, Wallet } from "@phosphor-icons/react";
import { CoverMarketAbi, POLICY_STATUS, explorerTx } from "@/lib/contracts";
import { bpsToPct, fmtDateNY, fmtUsd, toNum } from "@/lib/format";
import { usePolicies, type PolicyRow } from "@/hooks/usePolicies";
import { useTx } from "@/hooks/useTx";
import { StockMark } from "@/components/ui/StockMark";
import { Countdown } from "@/components/ui/WeekendBar";
import { Badge } from "@/components/ui/Badge";

/** One plain sentence per weekend. */
function plain(r: PolicyRow): string {
  const t = r.ticker ?? r.symbol;
  const gap = r.gapBps === null || r.gapBps === undefined ? undefined : Number(r.gapBps) / 100;
  const line = bpsToPct(r.barrierBps);
  if (r.status === POLICY_STATUS.Settled) {
    if ((r.payoutUsd ?? 0n) > 0n) return `${t} opened ${gap !== undefined ? `${Math.abs(gap).toFixed(1)}% lower` : "lower"} on Monday, past your ${line} line. We paid you ${fmtUsd(r.payoutUsd)}.`;
    return `${t} opened ${gap !== undefined ? (gap >= 0 ? `${gap.toFixed(1)}% higher` : `only ${Math.abs(gap).toFixed(1)}% lower`) : "above your line"} on Monday. Your stock held up, so nothing was needed.`;
  }
  if (r.status === POLICY_STATUS.Refunded) return `This weekend was cancelled (for example a stock split). Your ${fmtUsd(r.premiumUsd, { precise: true })} fee was returned.`;
  return `If ${t} opens more than ${line} lower on Monday, you get the difference on ${fmtUsd(r.notionalUsd)}. Nothing to do until then.`;
}

export function ActivityFeed() {
  const { isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const { rows, stats, loading, serverUp, refetch, chainId, market } = usePolicies();
  const tx = useTx(chainId);

  async function collect(id: bigint) {
    if (!market) return;
    if (await tx.run("Collect", () => tx.writeContractAsync({ address: market, abi: CoverMarketAbi, functionName: "settle", args: [id], chainId }), { successTitle: "Weekend settled" })) refetch();
  }

  if (!isConnected) {
    return (
      <div className="card p-10 text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-floor-soft text-floor">
          <Wallet weight="duotone" className="h-6 w-6" />
        </span>
        <h2 className="mt-5 text-xl font-semibold">Connect to see your weekends</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm text-ink-2">Your protection and Monday receipts live on the blockchain, tied to your wallet address.</p>
        <button className="btn-primary mx-auto mt-6 max-w-xs" onClick={() => openConnectModal?.()}>
          Connect wallet
        </button>
      </div>
    );
  }

  const active = rows.filter((r) => r.status === POLICY_STATUS.Open);
  const past = rows.filter((r) => r.status !== POLICY_STATUS.Open);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat icon={Fire} tone="floor" label="Weekends in a row" value={String(stats.currentStreak)} sub={`${stats.weekendsProtected} protected in total`} />
        <Stat icon={CheckCircle} tone="held" label="Stock held up" value={String(stats.floorsHeld)} sub="nothing needed" />
        <Stat icon={HandCoins} tone="floor" label="We paid you" value={fmtUsd(stats.payoutsReceived, { compact: true })} sub={`${stats.floorsPaid} time${stats.floorsPaid === 1 ? "" : "s"}`} />
        <Stat icon={Receipt} tone="muted" label="Fees you paid" value={fmtUsd(stats.premiumsPaid, { compact: true })} sub="for peace of mind" />
      </div>

      {loading ? (
        <div className="space-y-3">{[0, 1].map((i) => <div key={i} className="skeleton h-28 w-full" />)}</div>
      ) : rows.length === 0 ? (
        <div className="card p-10 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-floor-soft text-floor">
            <ShieldCheck weight="duotone" className="h-6 w-6" />
          </span>
          <h2 className="mt-5 text-xl font-semibold">No protected weekends yet</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-ink-2">Protect a stock before Friday’s bell. Your first receipt shows up here after Monday’s open.</p>
          <Link href="/protect" className="btn-primary mx-auto mt-6 max-w-xs">
            Protect a weekend <ArrowRight weight="bold" className="h-5 w-5" />
          </Link>
        </div>
      ) : (
        <>
          {active.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-ink-3">Active this weekend</h2>
              <ul className="space-y-3">
                {active.map((r) => (
                  <li key={r.policyId.toString()} className="card ring-grad p-5">
                    <div className="flex items-start gap-4">
                      <StockMark ticker={r.ticker ?? r.symbol} size={44} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold">{r.symbol}</span>
                          <Badge tone="floor" dot>Protected</Badge>
                          <span className="text-xs text-ink-3">weekend of {fmtDateNY(r.epochId, { month: "short", day: "numeric" })}</span>
                        </div>
                        <p className="mt-1.5 text-sm leading-relaxed text-ink-2">{plain(r)}</p>
                        <div className="tnum mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink-3">
                          <span>Line <b className="text-ink">−{bpsToPct(r.barrierBps)}</b></span>
                          <span>Amount <b className="text-ink">{fmtUsd(r.notionalUsd, { compact: true })}</b></span>
                          <span>Fee <b className="text-ink">{fmtUsd(r.premiumUsd, { precise: true })}</b></span>
                        </div>
                      </div>
                      <div className="hidden text-right sm:block">
                        <div className="text-[11px] uppercase tracking-wider text-ink-3">{r.settleable ? "Ready" : "Settles in"}</div>
                        {r.settleable ? <span className="text-sm font-semibold text-held">now</span> : <Countdown to={(r.expectedOpen ?? r.epochId + 65.5 * 3600) * 1000} className="text-lg text-floor" />}
                      </div>
                    </div>
                    {r.settleable && (
                      <button className="btn-primary mt-4 !h-12" disabled={tx.busy} onClick={() => collect(r.policyId)}>
                        {tx.busy ? <CircleNotch weight="bold" className="h-4 w-4 animate-spin" /> : <HandCoins weight="duotone" className="h-4 w-4" />} Monday’s price is in. Settle now
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {past.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-ink-3">Monday receipts</h2>
              <ul className="space-y-3">
                {past.map((r) => {
                  const paid = r.status === POLICY_STATUS.Settled && (r.payoutUsd ?? 0n) > 0n;
                  const refunded = r.status === POLICY_STATUS.Refunded;
                  return (
                    <li key={r.policyId.toString()} className={clsx("card p-5", paid && "border-held/30")}>
                      <div className="flex items-start gap-4">
                        <span className={clsx("flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl", paid ? "bg-held-soft text-held" : refunded ? "bg-surface-3 text-ink-2" : "bg-surface-3 text-ink-2")}>
                          {paid ? <HandCoins weight="duotone" className="h-5 w-5" /> : refunded ? <ArrowCounterClockwise weight="duotone" className="h-5 w-5" /> : <CheckCircle weight="duotone" className="h-5 w-5" />}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-baseline justify-between gap-2">
                            <div className="font-semibold">
                              {paid ? `We paid you ${fmtUsd(r.payoutUsd)}` : refunded ? "Fee returned" : "Your stock held up"}
                            </div>
                            <div className="text-xs text-ink-3">
                              {r.symbol} · {fmtDateNY(r.epochId, { month: "short", day: "numeric" })} → {fmtDateNY(r.expectedOpen ?? r.epochId + 65.5 * 3600, { month: "short", day: "numeric" })}
                            </div>
                          </div>
                          <p className="mt-1 text-sm leading-relaxed text-ink-2">{plain(r)}</p>
                          {paid && (
                            <div className="tnum mt-2 text-xs text-ink-3">
                              Fee {fmtUsd(r.premiumUsd, { precise: true })} · paid back {Math.round(toNum(r.payoutUsd ?? 0n, 6) / Math.max(1e-9, toNum(r.premiumUsd, 6)))}× the fee
                            </div>
                          )}
                          {r.txHash && (
                            <a href={explorerTx(chainId, r.txHash)} target="_blank" rel="noreferrer" className="btn-link mt-2 !text-xs">
                              Transaction <ArrowSquareOut weight="bold" className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
          {!serverUp && <p className="text-xs text-ink-3">Reading straight from the blockchain because the index service is offline. Everything still works.</p>}
        </>
      )}
    </div>
  );
}

function Stat({ icon: Icon, label, value, sub, tone }: { icon: PhosphorIcon; label: string; value: string; sub: string; tone: "floor" | "held" | "muted" }) {
  return (
    <div className="card-2 p-4">
      <div className={clsx("flex h-8 w-8 items-center justify-center rounded-lg", tone === "floor" ? "bg-floor-soft text-floor" : tone === "held" ? "bg-held-soft text-held" : "bg-surface-3 text-ink-2")}>
        <Icon weight="duotone" className="h-4 w-4" />
      </div>
      <div className="tnum mt-3 text-2xl font-semibold tracking-tight">{value}</div>
      <div className="text-xs font-medium text-ink-2">{label}</div>
      <div className="text-[11px] text-ink-3">{sub}</div>
    </div>
  );
}
