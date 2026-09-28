import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { Providers } from "./providers";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: { default: "afterhours.fi — Weekend protection for tokenized stocks", template: "%s · afterhours.fi" },
  description: "The US stock market shuts for 65 hours every weekend. If your stock opens lower on Monday, afterhours.fi pays you the difference.",
  metadataBase: new URL("https://afterhours.fi"),
  openGraph: { title: "afterhours.fi — Weekend protection for tokenized stocks", description: "If your stock opens lower on Monday, afterhours.fi pays you the difference.", type: "website" },
};

export const viewport: Viewport = { themeColor: "#05060A", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable} dark`} suppressHydrationWarning>
      <body className="min-h-dvh flex flex-col">
        <Providers>
          <Nav />
          <main className="flex-1">{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
