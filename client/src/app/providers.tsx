"use client";
import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import { WagmiProvider } from "wagmi";
import "@rainbow-me/rainbowkit/styles.css";
import { wagmiConfig } from "@/lib/wagmi";
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
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={qc}>
        <RainbowKitProvider theme={theme} modalSize="compact" appInfo={{ appName: "afterhours.fi" }}>
          <ToastProvider>{children}</ToastProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
