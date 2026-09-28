"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAccount, useBalance, useReadContracts, useSwitchChain } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import clsx from "clsx";
import { ArrowSquareOut, CaretDown, Check, Sparkle } from "@phosphor-icons/react";
import { CHAIN_META, CoverMarketAbi, MockERC20Abi, ZERO_ADDRESS } from "@/lib/contracts";
import { useDeployment } from "@/hooks/useDeployment";
import { useTx } from "@/hooks/useTx";
import { useMounted } from "@/hooks/useNow";
import { Term } from "@/components/ui/Term";

type StepId = "connect" | "network" | "gas" | "tokens" | "protect" | "monday";

/**
 * The first-time guide. Reads wallet state and shows exactly one next action with its button.
 * Collapses to a small progress pill once everything is done (or when dismissed).
 */
export function GettingStarted({ className, variant = "rail" }: { className?: string; variant?: "rail" | "inline" }) {
  const mounted = useMounted();
  const { address, isConnected, chainId: walletChain } = useAccount();
  const { openConnectModal } = useConnectModal();
  const { switchChain, isPending: switching } = useSwitchChain();
  const { chainId, deployment, tokens } = useDeployment();
  const tx = useTx(chainId);
  const [pref, setPref] = useState<boolean | null>(null); // user's explicit choice, if any

  useEffect(() => {
    try {
      const v = localStorage.getItem("ahfi.guide.collapsed");
      if (v === "1" || v === "0") setPref(v === "1");
    } catch {
      /* private mode */
    }
  }, []);
  const toggle = () => {
    const next = !collapsed;
    setPref(next);
    try {
      localStorage.setItem("ahfi.guide.collapsed", next ? "1" : "0");
    } catch {
      /* ignore */
    }
  };

  const onChain = isConnected && walletChain === chainId;
  const usdt = deployment?.contracts.USDT;
  const market = deployment?.contracts.CoverMarket;
  const demoStock = tokens.find((t) => t.ticker === "NVDA" && t.wrapper === "bstock") ?? tokens[0];
  const me = address ?? ZERO_ADDRESS;

  const gas = useBalance({ address, chainId, query: { enabled: onChain, refetchInterval: 20_000 } });
  const reads = useReadContracts({
    contracts: [
      { address: usdt, abi: MockERC20Abi, functionName: "balanceOf", args: [me], chainId },
      { address: demoStock?.address, abi: MockERC20Abi, functionName: "balanceOf", args: [me], chainId },
      { address: market, abi: CoverMarketAbi, functionName: "policiesOf", args: [me], chainId },
    ],
    query: { enabled: onChain && !!usdt && !!market, refetchInterval: 20_000 },
  });
  const usdtBal = (reads.data?.[0]?.result as bigint | undefined) ?? 0n;
  const stockBal = (reads.data?.[1]?.result as bigint | undefined) ?? 0n;
  const policies = (reads.data?.[2]?.result as readonly bigint[] | undefined) ?? [];

  const done: Record<StepId, boolean> = {
    connect: isConnected,
    network: onChain,
    gas: onChain && (gas.data?.value ?? 0n) > 0n,
    tokens: onChain && usdtBal > 0n && stockBal > 0n,
    protect: onChain && policies.length > 0,
    monday: false,
  };

  async function getTestMoney() {
    if (!usdt || !demoStock) return;
    if (usdtBal === 0n) {
      const ok = await tx.run("Test USDT", () => tx.writeContractAsync({ address: usdt, abi: MockERC20Abi, functionName: "faucet", chainId }), { successTitle: "10,000 test USDT added" });
      if (!ok) return;
    }
    if (stockBal === 0n) {
      await tx.run(`Test ${demoStock.symbol}`, () => tx.writeContractAsync({ address: demoStock.address, abi: MockERC20Abi, functionName: "faucet", chainId }), { successTitle: `100 test ${demoStock.symbol} added` });
    }
    reads.refetch();
  }

  const meta = CHAIN_META[chainId];
  const steps: { id: StepId; title: string; body: React.ReactNode; action?: React.ReactNode }[] = [
    {
      id: "connect",
      title: "Connect a wallet",
      body: "Any browser wallet works (MetaMask, Rabby, Coinbase Wallet). Nothing is spent by connecting.",
      action: (
        <button className="btn-primary !h-11 !text-sm" onClick={() => openConnectModal?.()}>
          Connect wallet
        </button>
      ),
    },
    {
      id: "network",
      title: "Switch to the test network",
      body: (
        <>
          This is a <Term k="testnet">test network</Term>, so nothing here costs real money. Your wallet will ask once.
        </>
      ),
      action: (
        <button className="btn-primary !h-11 !text-sm" disabled={switching} onClick={() => switchChain({ chainId })}>
          Switch to {meta?.short ?? "testnet"}
        </button>
      ),
    },
    {
      id: "gas",
      title: "Get free gas",
      body: (
        <>
          Every action needs a tiny bit of <Term k="gas">gas</Term>. Grab some free from a faucet site, then come back. This updates by itself.
        </>
      ),
      action: meta ? (
        <a className="btn-ghost w-full" href={meta.gasFaucet} target="_blank" rel="noreferrer">
          Open the {meta.short} gas faucet <ArrowSquareOut weight="bold" className="h-3.5 w-3.5" />
        </a>
      ) : null,
    },
    {
      id: "tokens",
      title: "Get free test money",
      body: `One click gives you 10,000 test USDT and 100 test ${demoStock?.symbol ?? "stock"} tokens to practise with.`,
      action: (
        <button className="btn-primary !h-11 !text-sm" disabled={tx.busy || !usdt} onClick={getTestMoney}>
          {tx.busy ? "Waiting for your wallet…" : "Get test USDT + stock"}
        </button>
      ),
    },
    {
      id: "protect",
      title: "Protect your first weekend",
      body: "Pick a stock, choose how much, and see exactly what it costs. Takes about a minute.",
      action: (
        <Link href="/protect" className="btn-primary !h-11 !text-sm">
          Start protecting
        </Link>
      ),
    },
    {
      id: "monday",
      title: "Check back on Monday",
      body: "After 9:30 am New York your weekend settles by itself. Your receipt appears in My activity.",
      action: (
        <Link href="/activity" className="btn-ghost w-full">
          Open My activity
        </Link>
      ),
    },
  ];

  const firstOpen = steps.findIndex((s) => !done[s.id]);
  const completed = steps.filter((s) => done[s.id]).length;
  const pct = useMemo(() => Math.round((completed / (steps.length - 1)) * 100), [completed, steps.length]);
  const allDone = completed >= steps.length - 1;
  // once everything is done the guide folds itself away, unless the user opened it on purpose
  const collapsed = pref ?? allDone;

  if (!mounted) return <div className={clsx("card h-40 skeleton", className)} aria-hidden />;

  return (
    <section className={clsx("card overflow-hidden", className)} aria-label="Getting started">
      <button type="button" onClick={toggle} className="flex w-full items-center justify-between gap-3 p-5 text-left" aria-expanded={!collapsed}>
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-floor-soft text-floor">
            <Sparkle weight="duotone" className="h-4 w-4" />
          </span>
          <div>
            <div className="text-sm font-semibold text-ink">{completed >= steps.length - 1 ? "You’re all set" : "Getting started"}</div>
            <div className="text-xs text-ink-2">
              {Math.min(completed, steps.length - 1)} of {steps.length - 1} steps done
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative h-9 w-9" aria-hidden>
            <svg viewBox="0 0 36 36" className="h-9 w-9 -rotate-90">
              <circle cx="18" cy="18" r="15" fill="none" stroke="#222735" strokeWidth="4" />
              <circle cx="18" cy="18" r="15" fill="none" stroke="url(#gsg)" strokeWidth="4" strokeLinecap="round" strokeDasharray={`${(pct / 100) * 94.2} 94.2`} />
              <defs>
                <linearGradient id="gsg" x1="0" x2="1">
                  <stop offset="0" stopColor="#FFC76B" />
                  <stop offset="1" stopColor="#FF8A3D" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <CaretDown weight="bold" className={clsx("h-4 w-4 text-ink-3 transition", collapsed && "-rotate-90")} />
        </div>
      </button>

      {!collapsed && (
        <ol className={clsx("space-y-1 px-3 pb-4", variant === "inline" && "sm:grid sm:grid-cols-2 sm:gap-2 sm:space-y-0")}>
          {steps.map((s, i) => {
            const isDone = done[s.id];
            const isNext = i === firstOpen;
            return (
              <li key={s.id} className={clsx("rounded-2xl px-3 py-3 transition", isNext ? "bg-surface-2 ring-1 ring-floor/30" : "")}>
                <div className="flex items-start gap-3">
                  <span
                    className={clsx(
                      "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
                      isDone ? "bg-held text-[#00140B]" : isNext ? "bg-floor text-[#1A0E00]" : "border border-line-strong text-ink-3"
                    )}
                  >
                    {isDone ? <Check weight="bold" className="h-3.5 w-3.5" /> : i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className={clsx("text-sm font-medium", isDone ? "text-ink-2 line-through decoration-ink-4" : isNext ? "text-ink" : "text-ink-2")}>{s.title}</div>
                    {isNext && (
                      <>
                        <p className="mt-1 text-xs leading-relaxed text-ink-2">{s.body}</p>
                        {s.action && <div className="mt-3">{s.action}</div>}
                      </>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
