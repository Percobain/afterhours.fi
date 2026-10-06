"use client";
import { connectorsForWallets } from "@rainbow-me/rainbowkit";
import {
  binanceWallet,
  bitgetWallet,
  braveWallet,
  bybitWallet,
  coinbaseWallet,
  gateWallet,
  injectedWallet,
  ledgerWallet,
  metaMaskWallet,
  okxWallet,
  phantomWallet,
  rabbyWallet,
  rainbowWallet,
  safepalWallet,
  tokenPocketWallet,
  trustWallet,
  walletConnectWallet,
  zerionWallet,
} from "@rainbow-me/rainbowkit/wallets";
import { createConfig, type Config } from "wagmi";
import { chains, transports } from "./chains";

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID?.trim() ?? "";
export const hasWalletConnect = projectId.length > 0;

/**
 * Every wallet RainbowKit offers that is popular on BNB Chain, Binance Web3 Wallet first.
 *
 * Browser-extension wallets connect directly (injected) and need nothing else. QR codes, mobile apps and
 * "scan with your phone" go through WalletConnect, which needs NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
 * (free at https://cloud.reown.com). Without it those wallets still connect through their extension,
 * and the WalletConnect-only entries are hidden.
 */
const recommended = [binanceWallet, metaMaskWallet, trustWallet, okxWallet];
const more = [
  bitgetWallet,
  coinbaseWallet,
  safepalWallet,
  tokenPocketWallet,
  bybitWallet,
  gateWallet,
  rabbyWallet,
  phantomWallet,
  rainbowWallet,
  zerionWallet,
  braveWallet,
  injectedWallet,
  ...(hasWalletConnect ? [ledgerWallet, walletConnectWallet] : []),
];

// Built in the browser only: WalletConnect touches indexedDB as soon as its connectors are created, which throws during
// server rendering. The server never needs a wallet (nothing is connected while rendering), so it gets none.
const connectors =
  typeof window === "undefined"
    ? []
    : connectorsForWallets(
        [
          { groupName: "Recommended for BNB Chain", wallets: recommended },
          { groupName: "More wallets", wallets: more },
        ],
        {
          appName: "afterhours.fi",
          appDescription: "Weekend protection for tokenized US stocks",
          appUrl: "https://www.afterhoursfi.xyz",
          appIcon: "https://www.afterhoursfi.xyz/apple-icon.png",
          // RainbowKit needs a string here; with no real id only the WalletConnect (QR / mobile) paths are unavailable
          projectId: projectId || "afterhoursfi-no-walletconnect",
        },
      );

export const wagmiConfig: Config = createConfig({ chains, transports, connectors, ssr: true });
