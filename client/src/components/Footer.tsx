"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowSquareOut } from "@phosphor-icons/react";
import { Logo } from "./Logo";
import { useAccount } from "wagmi";
import { BSC_TESTNET, CHAIN_META, getStaticDeployment, SEPOLIA, explorerAddress } from "@/lib/contracts";
import { useMounted } from "@/hooks/useNow";

/**
 * BSC Testnet is the home network: its contracts are shown when a wallet is on BSC or when nothing is connected.
 * Only a wallet connected to Ethereum Sepolia switches the links to Sepolia. Until BSC is deployed, Sepolia fills in.
 */
function useFooterChain(): { chainId: number; fallback: boolean } {
  const { chainId, isConnected } = useAccount();
  const mounted = useMounted();
  const wanted = mounted && isConnected && chainId === SEPOLIA ? SEPOLIA : BSC_TESTNET;
  if (getStaticDeployment(wanted)) return { chainId: wanted, fallback: false };
  return { chainId: SEPOLIA, fallback: wanted === BSC_TESTNET };
}

export function Footer() {
  const path = usePathname() ?? "/";
  const { chainId, fallback } = useFooterChain();
  const dep = getStaticDeployment(chainId);
  const inApp = path !== "/";
  return (
    <footer className={inApp ? "mt-8 border-t border-line/60 pb-28 lg:pb-0" : "relative mt-0 border-t border-line/60"}>
      <div className="container py-14">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <div className="flex items-center gap-2 text-lg font-semibold">
              <Logo className="h-7 w-7" /> <span>afterhours<span className="text-floor">.fi</span></span>
            </div>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-ink-2">Weekend protection for tokenized US stocks. Priced from 21 years of real weekends. Built for the BNB Hack: Tokenized Stocks Edition.</p>
          </div>
          <FooterCol title="Use it" links={[{ href: "/protect", label: "Protect a weekend" }, { href: "/earn", label: "Earn with the pool" }, { href: "/activity", label: "My activity" }]} />
          <FooterCol title="Understand it" links={[{ href: "/docs", label: "Docs: how it works" }, { href: "/docs#part-2", label: "Research & methodology" }, { href: "/#try", label: "Try the Monday simulator" }, { href: "/#faq", label: "FAQ" }]} />
          <div className="text-sm">
            <div className="mb-3 font-medium text-ink">Verified contracts</div>
            {dep ? (
              <ul className="space-y-2 text-ink-2">
                {(["CoverMarket", "KeeperVault", "ReferenceOracle"] as const).map((k) => (
                  <li key={k}>
                    <a href={explorerAddress(chainId, dep.contracts[k])} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-ink">
                      {k === "CoverMarket" ? "Protection market" : k === "KeeperVault" ? "Protection pool" : "Price oracle"} <ArrowSquareOut weight="bold" className="h-3 w-3" />
                    </a>
                  </li>
                ))}
                <li className="text-xs text-ink-3">
                  {CHAIN_META[chainId]?.name ?? "Testnet"}
                  {fallback && " · BSC Testnet deploy coming soon"}
                </li>
              </ul>
            ) : (
              <p className="text-ink-3">BSC Testnet</p>
            )}
          </div>
        </div>
        <div className="mt-12 rounded-2xl border border-line bg-surface/60 p-4 text-xs leading-relaxed text-ink-3">
          <span className="font-medium text-ink-2">Hackathon prototype on test networks.</span> Test tokens have no value. The admin can pause, change settings and move funds. Not available in restricted jurisdictions (including the US, UK, Canada, Netherlands and Japan). Not an offer of insurance or securities, and nothing here is investment advice.
        </div>
        <div className="mt-6 flex flex-wrap items-center justify-between gap-2 text-xs text-ink-3">
          <span>© {new Date().getFullYear()} afterhours.fi</span>
          <span>Made for people who’d rather sleep through the weekend.</span>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: { href: string; label: string }[] }) {
  return (
    <div className="text-sm">
      <div className="mb-3 font-medium text-ink">{title}</div>
      <ul className="space-y-2 text-ink-2">
        {links.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="hover:text-ink">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
