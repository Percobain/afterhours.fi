import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Analytics } from "@vercel/analytics/next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { Providers } from "./providers";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: { default: "afterhours.fi - Weekend protection for tokenized stocks", template: "%s · afterhours.fi" },
  description: "The US stock market shuts for 65 hours every weekend. If your stock opens lower on Monday, afterhours.fi pays you the difference.",
  metadataBase: new URL("https://afterhoursfi.vercel.app"),
  openGraph: { title: "afterhours.fi - Weekend protection for tokenized stocks", description: "If your stock opens lower on Monday, afterhours.fi pays you the difference.", type: "website" },
};

// Microsoft Clarity (heatmaps / session replay). Loaded only in production builds so local dev stays out of the data.
const CLARITY_ID = process.env.NEXT_PUBLIC_CLARITY_ID || "ypde5xb455";
const analyticsOn = process.env.NODE_ENV === "production";

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
        {analyticsOn && <Analytics />}
        {analyticsOn && CLARITY_ID && (
          <Script id="ms-clarity" strategy="afterInteractive">
            {`(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script","${CLARITY_ID}");`}
          </Script>
        )}
      </body>
    </html>
  );
}
