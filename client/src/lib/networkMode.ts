"use client";
import { useSyncExternalStore } from "react";

/**
 * Mainnet (BNB Chain) is the default. Testnet mode swaps the whole app to BSC Testnet + Sepolia and hides mainnet.
 * The choice lives in localStorage, so it is per browser. The server always renders mainnet; a browser in testnet
 * mode switches right after hydration.
 */
export type NetworkMode = "mainnet" | "testnet";

const KEY = "afterhours.networkMode";
const listeners = new Set<() => void>();

function read(): NetworkMode {
  try {
    return localStorage.getItem(KEY) === "testnet" ? "testnet" : "mainnet";
  } catch {
    return "mainnet";
  }
}

export function setNetworkMode(mode: NetworkMode) {
  try {
    localStorage.setItem(KEY, mode);
  } catch {
    // storage blocked: the switch still applies until the page reloads
  }
  current = mode;
  justSwitched = true;
  listeners.forEach((l) => l());
}

let justSwitched = false;

/** True once after the user flips the switch, so the wallet is asked to follow (plain reloads leave it alone). */
export function consumeModeSwitch(): boolean {
  const v = justSwitched;
  justSwitched = false;
  return v;
}

let current: NetworkMode | undefined;

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useNetworkMode(): NetworkMode {
  return useSyncExternalStore(
    subscribe,
    () => (current ??= read()),
    () => "mainnet"
  );
}
