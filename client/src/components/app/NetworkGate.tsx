"use client";
import type { ReactNode } from "react";
import { useAccount, useSwitchChain } from "wagmi";
import { type Icon as PhosphorIcon, PlugsConnected, RocketLaunch } from "@phosphor-icons/react";
import { CHAIN_META, MODE_CHAIN_IDS, isSupportedChain } from "@/lib/contracts";
import { setNetworkMode, useNetworkMode } from "@/lib/networkMode";
import { useDeployment } from "@/hooks/useDeployment";

/**
 * Plain-English blockers shown instead of the page when it cannot work:
 * the wallet is on a network the current mode (mainnet / testnet) doesn't offer, or the contracts are not deployed there.
 * Not connected is NOT a blocker: every page is readable without a wallet.
 */
export function NetworkGate({ children }: { children: ReactNode }) {
  const { isConnected, chainId: walletChain } = useAccount();
  const { switchChain, isPending } = useSwitchChain();
  const { chainId, deployment, isLoading } = useDeployment();
  const mode = useNetworkMode();
  const ids = MODE_CHAIN_IDS[mode];

  if (isConnected && !isSupportedChain(walletChain, mode)) {
    const otherMode = mode === "mainnet" ? "testnet" : "mainnet";
    const body =
      mode === "mainnet"
        ? "afterhours.fi runs on BNB Chain. Switch and your wallet will follow. Gas costs a fraction of a cent; the USDT and stock tokens are free test tokens."
        : "Testnet mode runs on two free test networks. Pick one and your wallet will switch. Nothing here uses real money.";
    return (
      <Blocker icon={PlugsConnected} title="Your wallet is on a different network" body={body}>
        <div className={ids.length > 1 ? "mt-6 grid gap-2 sm:grid-cols-2" : "mt-6 grid gap-2"}>
          {ids.map((id) => (
            <button key={id} className="btn-ghost !h-12" disabled={isPending} onClick={() => switchChain({ chainId: id })}>
              Switch to {CHAIN_META[id].name}
            </button>
          ))}
        </div>
        {isSupportedChain(walletChain, otherMode) && (
          <button className="btn-link mt-4 !text-xs" onClick={() => setNetworkMode(otherMode)}>
            Or stay on {CHAIN_META[walletChain].name} and turn testnet mode {otherMode === "testnet" ? "on" : "off"}
          </button>
        )}
      </Blocker>
    );
  }

  if (!deployment && !isLoading) {
    const other = ids.find((id) => id !== chainId);
    const body = other
      ? `The contracts are live on ${CHAIN_META[other].name}. Switch there to try everything.`
      : mode === "mainnet"
        ? "Mainnet is launching shortly. Turn on testnet mode to try everything now."
        : "The contracts are not deployed on a test network yet.";
    return (
      <Blocker icon={RocketLaunch} title={`Not live on ${CHAIN_META[chainId]?.name ?? "this network"} yet`} body={body}>
        {!other && mode === "mainnet" && (
          <button className="btn-primary mt-6" onClick={() => setNetworkMode("testnet")}>
            Turn on testnet mode
          </button>
        )}
        {other && (
          <button className="btn-primary mt-6" disabled={!isConnected || isPending} onClick={() => switchChain({ chainId: other })}>
            {isConnected ? `Switch to ${CHAIN_META[other].name}` : "Connect a wallet to switch"}
          </button>
        )}
      </Blocker>
    );
  }

  return <>{children}</>;
}

function Blocker({ icon: Icon, title, body, children }: { icon: PhosphorIcon; title: string; body: string; children?: ReactNode }) {
  return (
    <div className="card p-8 text-center sm:p-10">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-keeper-soft text-keeper">
        <Icon weight="duotone" className="h-6 w-6" />
      </span>
      <h2 className="mt-5 text-xl font-semibold">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-2">{body}</p>
      {children}
    </div>
  );
}
