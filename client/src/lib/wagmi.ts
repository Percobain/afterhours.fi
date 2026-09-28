"use client";
import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { createConfig, type Config } from "wagmi";
import { injected } from "wagmi/connectors";
import { chains, transports } from "./chains";

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID?.trim() ?? "";

function build(): Config {
  if (projectId) {
    return getDefaultConfig({
      appName: "afterhours.fi",
      appDescription: "Weekend floor for tokenized US stocks",
      projectId,
      chains,
      transports,
      ssr: true,
    });
  }
  // No WalletConnect project id: injected (browser extension) wallets only, so the app still runs.
  return createConfig({ chains, transports, connectors: [injected()], ssr: true });
}

export const wagmiConfig: Config = build();
export const hasWalletConnect = projectId.length > 0;
