"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import clsx from "clsx";
import { ArrowRight, BookOpenText, CaretDown, Coins, Pulse, ShieldCheck, Wallet } from "@phosphor-icons/react";
import { useMounted } from "@/hooks/useNow";
import { Logo } from "./Logo";

const APP_LINKS = [
  { href: "/protect", label: "Protect", icon: ShieldCheck },
  { href: "/earn", label: "Earn", icon: Coins },
  { href: "/activity", label: "My activity", icon: Pulse },
  { href: "/docs", label: "Docs", icon: BookOpenText },
];

const LANDING_LINKS = [
  { href: "/#how", label: "How it works" },
  { href: "/#try", label: "Try it" },
  { href: "/#earn", label: "Earn" },
  { href: "/#faq", label: "FAQ" },
  { href: "/docs", label: "Docs" },
];

export function Nav() {
  const path = usePathname() ?? "/";
  const mounted = useMounted();
  const onLanding = path === "/";
  const links = onLanding ? LANDING_LINKS : APP_LINKS;

  return (
    <>
      <header className="sticky top-0 z-50 px-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-4">
        <div className="glass mx-auto flex h-14 !bg-surface/85 max-w-[1200px] items-center justify-between gap-3 rounded-2xl pl-4 pr-2 shadow-[0_10px_40px_-20px_rgba(0,0,0,0.9)]">
          <div className="flex min-w-0 items-center gap-8">
            <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight text-ink">
              <Logo className="h-7 w-7" />
              <span className="text-[15px]">afterhours<span className="text-floor">.fi</span></span>
            </Link>
            <nav className={clsx("hidden items-center gap-1", onLanding ? "md:flex" : "lg:flex")} aria-label="Primary">
              {links.map((l) => {
                const active = !onLanding && path.startsWith(l.href);
                return (
                  <Link key={l.href} href={l.href} className={clsx("rounded-xl px-3 py-2 text-sm font-medium transition", active ? "bg-white/[0.08] text-ink" : "text-ink-2 hover:text-ink")}>
                    {l.label}
                  </Link>
                );
              })}
            </nav>
          </div>
          <div className="flex items-center gap-2">
            {onLanding ? (
              <Link href="/protect" className="btn btn-md bg-white text-[#05060A] hover:bg-white/90">
                Launch app <ArrowRight weight="bold" className="h-4 w-4" />
              </Link>
            ) : mounted ? (
              <WalletButton />
            ) : (
              <div className="h-10 w-36 rounded-xl bg-surface-2" aria-hidden />
            )}
          </div>
        </div>
      </header>

      {/* phone: bottom tab bar inside the app */}
      {!onLanding && (
        <nav className="glass fixed !bg-surface/90 inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-50 grid grid-cols-4 rounded-2xl p-1.5 shadow-pop lg:hidden" aria-label="App">
          {APP_LINKS.map((l) => {
            const active = path.startsWith(l.href);
            return (
              <Link key={l.href} href={l.href} className={clsx("flex flex-col items-center gap-1 rounded-xl py-2 text-[11px] font-medium transition", active ? "bg-white/[0.08] text-ink" : "text-ink-3")}>
                <l.icon weight="duotone" className={clsx("h-5 w-5", active && (l.href === "/earn" ? "text-keeper" : "text-floor"))} />
                {l.label === "How it works" ? "Guide" : l.label === "My activity" ? "Activity" : l.label}
              </Link>
            );
          })}
        </nav>
      )}
    </>
  );
}

function WalletButton() {
  return (
    <ConnectButton.Custom>
      {({ account, chain, openAccountModal, openChainModal, openConnectModal, mounted }) => {
        const ready = mounted;
        if (!ready) return <div className="h-10 w-36 rounded-xl bg-surface-2" aria-hidden />;
        if (!account || !chain) {
          return (
            <button onClick={openConnectModal} className="btn btn-md bg-gradient-to-r from-[#FFC76B] to-floor-2 text-[#1A0E00] hover:brightness-110">
              <Wallet weight="duotone" className="h-4 w-4" /> Connect wallet
            </button>
          );
        }
        if (chain.unsupported) {
          return (
            <button onClick={openChainModal} className="btn btn-md border border-gap/40 bg-gap-soft text-gap">
              Wrong network <CaretDown weight="bold" className="h-4 w-4" />
            </button>
          );
        }
        return (
          <div className="flex items-center gap-1.5">
            <button onClick={openChainModal} className="btn btn-md hidden border border-line bg-surface-2 !px-3 text-ink-2 hover:text-ink sm:inline-flex" title="Change network">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {chain.iconUrl ? <img src={chain.iconUrl} alt="" className="h-4 w-4 rounded-full" /> : <span className="h-2 w-2 rounded-full bg-held" />}
              <span className="text-xs">{chain.name?.replace("Binance Smart Chain", "BSC")}</span>
              <span className="rounded bg-keeper-soft px-1 text-[10px] font-semibold text-keeper">TEST</span>
            </button>
            <button onClick={openAccountModal} className="btn btn-md border border-line bg-surface-2 !px-3 text-ink hover:border-line-strong">
              <span className="h-5 w-5 rounded-full bg-gradient-to-br from-floor to-keeper-2" aria-hidden />
              {account.displayName}
            </button>
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
}
