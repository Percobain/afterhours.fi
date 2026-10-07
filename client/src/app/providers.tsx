"use client";
import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import { WagmiProvider, useAccountEffect, useSwitchChain } from "wagmi";
import "@rainbow-me/rainbowkit/styles.css";
import { getWagmiConfig } from "@/lib/wagmi";
import { chainsByMode } from "@/lib/chains";
import { isSupportedChain } from "@/lib/contracts";
import { consumeModeSwitch, useNetworkMode, type NetworkMode } from "@/lib/networkMode";
import { ToastProvider } from "@/hooks/useToast";

const theme = darkTheme({ accentColor: "#f0b35a", accentColorForeground: "#09090b", borderRadius: "medium", fontStack: "system", overlayBlur: "small" });
theme.colors.modalBackground = "#111114";
theme.colors.modalBorder = "#232329";
theme.colors.profileForeground = "#111114";
theme.colors.connectButtonBackground = "#17171b";
theme.colors.connectButtonInnerBackground = "#1e1e24";
theme.colors.closeButtonBackground = "#1e1e24";
theme.colors.actionButtonBorder = "#232329";
theme.colors.generalBorder = "#232329";
theme.colors.menuItemBackground = "#1e1e24";

export function Providers({ children }: { children: ReactNode }) {
  const [qc] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 15_000, refetchOnWindowFocus: false, retry: 1 } },
      })
  );
  const mode = useNetworkMode();
  const home = chainsByMode[mode][0];
  // keyed by mode: flipping mainnet/testnet remounts wagmi with that mode's chains, and the wallet reconnects by itself
  return (
    <WagmiProvider key={mode} config={getWagmiConfig(mode)}>
      <QueryClientProvider client={qc}>
        <RainbowKitProvider theme={theme} modalSize="compact" initialChain={home} appInfo={{ appName: "afterhours.fi" }}>
          <PreferHome mode={mode} />
          <ToastProvider>{children}</ToastProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

/**
 * Each mode has a home chain (BNB Chain on mainnet, BSC Testnet on testnet). A fresh wallet connection on a chain the
 * mode doesn't offer is asked to switch home once, and so is a connected wallet right after the mainnet/testnet switch.
 * Plain reconnects (page reloads) are left alone, so someone who deliberately moved to Sepolia stays there.
 */
function PreferHome({ mode }: { mode: NetworkMode }) {
  const { switchChain } = useSwitchChain();
  useAccountEffect({
    onConnect({ chainId, isReconnected }) {
      const flipped = consumeModeSwitch();
      if ((!isReconnected || flipped) && !isSupportedChain(chainId, mode)) switchChain({ chainId: chainsByMode[mode][0].id });
    },
  });
  return null;
}
