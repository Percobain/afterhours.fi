import type { Metadata } from "next";
import { Docs } from "@/components/docs/Docs";

export const metadata: Metadata = {
  title: "Docs",
  description: "How afterhours.fi prices weekend gap protection: the journey, market research, 61,815-weekend backtest, conclusions for buyers and liquidity providers, and how far to trust the numbers.",
};

export default function DocsPage() {
  return <Docs />;
}
