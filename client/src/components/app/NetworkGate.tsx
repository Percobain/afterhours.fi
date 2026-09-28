"use client";
import type { ReactNode } from "react";
import { useAccount, useSwitchChain } from "wagmi";
import { type Icon as PhosphorIcon, PlugsConnected, RocketLaunch } from "@phosphor-icons/react";
import { CHAIN_META, SUPPORTED_CHAIN_IDS, isSupportedChain } from "@/lib/contracts";
import { useDeployment } from "@/hooks/useDeployment";

/**
 * Plain-English blockers shown instead of the page when it cannot work:
 * the wallet is on a network we don't support, or the contracts are not deployed on the chosen network.
 * Not connected is NOT a blocker: every page is readable without a wallet.
 */
export function NetworkGate({ children }: { children: ReactNode }) {
  const { isConnected, chainId: walletChain } = useAccount();
  const { switchChain, isPending } = useSwitchChain();
  const { chainId, deployment, isLoading } = useDeployment();

  if (isConnected && !isSupportedChain(walletChain)) {
    return (
      <Blocker icon={PlugsConnected} title="Your wallet is on a different network" body="afterhours.fi runs on two free test networks. Pick one and your wallet will switch. Nothing here uses real money.">
        <div className="mt-6 grid gap-2 sm:grid-cols-2">
          {SUPPORTED_CHAIN_IDS.map((id) => (
            <button key={id} className="btn-ghost !h-12" disabled={isPending} onClick={() => switchChain({ chainId: id })}>
              Switch to {CHAIN_META[id].name}
            </button>
          ))}
        </div>
      </Blocker>
    );
  }

  if (!deployment && !isLoading) {
    const other = SUPPORTED_CHAIN_IDS.find((id) => id !== chainId);
    return (
      <Blocker icon={RocketLaunch} title={`Not live on ${CHAIN_META[chainId]?.name ?? "this network"} yet`} body={`The contracts are live on ${other ? CHAIN_META[other].name : "another network"}. Switch there to try everything.`}>
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
