import { http, type Transport } from "viem";
import { bscTestnet, sepolia } from "wagmi/chains";

export const chains = [sepolia, bscTestnet] as const;

const key = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY?.trim() ?? "";

/** RPC policy: Alchemy endpoints when NEXT_PUBLIC_ALCHEMY_API_KEY is set, the chains' public RPCs otherwise. */
export function rpcUrl(chainId: number): string | undefined {
  if (!key) return undefined;
  if (chainId === sepolia.id) return `https://eth-sepolia.g.alchemy.com/v2/${key}`;
  if (chainId === bscTestnet.id) return `https://bnb-testnet.g.alchemy.com/v2/${key}`;
  return undefined;
}

export const transports: Record<number, Transport> = {
  [sepolia.id]: http(rpcUrl(sepolia.id), { batch: true, timeout: 15_000 }),
  [bscTestnet.id]: http(rpcUrl(bscTestnet.id), { batch: true, timeout: 15_000 }),
};

export const usingAlchemy = key.length > 0;
