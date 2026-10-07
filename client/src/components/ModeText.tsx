"use client";
import type { ReactNode } from "react";
import { useNetworkMode } from "@/lib/networkMode";

/** Renders the mainnet or testnet wording for the current network mode. Usable from server components too. */
export function ModeText({ mainnet, testnet }: { mainnet: ReactNode; testnet: ReactNode }) {
  return <>{useNetworkMode() === "testnet" ? testnet : mainnet}</>;
}
