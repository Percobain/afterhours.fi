import { http, type Transport } from "viem";
import { bsc as bscBase, bscTestnet as bscTestnetBase, sepolia } from "wagmi/chains";
import type { NetworkMode } from "./networkMode";

// Short display name: "Binance Smart Chain Testnet" wraps onto two lines in the wallet modals.
export const bscTestnet = { ...bscTestnetBase, name: "BSC Testnet" } as const;

export const bsc = { ...bscBase, name: "BNB Mainnet" } as const;

// The chains wagmi and RainbowKit know about in each network mode. First entry is the home chain offered when connecting.
export const chainsByMode = {
  mainnet: [bsc],
  testnet: [bscTestnet, sepolia],
} as const satisfies Record<NetworkMode, readonly unknown[]>;

const key = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY?.trim() ?? "";

/** RPC policy: Alchemy endpoints when NEXT_PUBLIC_ALCHEMY_API_KEY is set, the chains' public RPCs otherwise. */
export function rpcUrl(chainId: number): string | undefined {
  if (!key) return undefined;
  if (chainId === sepolia.id) return `https://eth-sepolia.g.alchemy.com/v2/${key}`;
  if (chainId === bscTestnet.id) return `https://bnb-testnet.g.alchemy.com/v2/${key}`;
  if (chainId === bsc.id) return `https://bnb-mainnet.g.alchemy.com/v2/${key}`;
  return undefined;
}

export const transports: Record<number, Transport> = {
  [sepolia.id]: http(rpcUrl(sepolia.id), { batch: true, timeout: 15_000 }),
  [bscTestnet.id]: http(rpcUrl(bscTestnet.id), { batch: true, timeout: 15_000 }),
  [bsc.id]: http(rpcUrl(bsc.id), { batch: true, timeout: 15_000 }),
};

export const usingAlchemy = key.length > 0;
