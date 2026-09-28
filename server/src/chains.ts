import { createPublicClient, createWalletClient, http, type Address, type Chain, type Hex, type PublicClient, type Transport, type WalletClient } from "viem";
import { privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";
import { config, getChain } from "./config";
import { logger } from "./logger";
import { ApiError } from "./util/errors";

export type Public = PublicClient<Transport, Chain>;
export type Wallet = WalletClient<Transport, Chain, PrivateKeyAccount>;

const publicClients = new Map<number, Public>();
const walletClients = new Map<number, Wallet>();

let quoterAccount: PrivateKeyAccount | null | undefined;

/** The server's signer (quotes + oracle keeper writes). null when QUOTER_PRIVATE_KEY is empty or invalid. */
export function getQuoterAccount(): PrivateKeyAccount | null {
  if (quoterAccount !== undefined) return quoterAccount;
  const k = config.quoterPrivateKey.trim();
  if (!k) {
    quoterAccount = null;
    logger.warn("QUOTER_PRIVATE_KEY is empty: quotes are returned unsigned and keeper jobs are disabled");
    return null;
  }
  try {
    const hex = (k.startsWith("0x") ? k : `0x${k}`) as Hex;
    quoterAccount = privateKeyToAccount(hex);
    logger.info({ quoter: quoterAccount.address }, "quoter signer loaded");
  } catch (e) {
    quoterAccount = null;
    logger.error({ err: (e as Error).message }, "QUOTER_PRIVATE_KEY is not a valid private key; running unsigned");
  }
  return quoterAccount;
}

export function quoterAddress(): Address | null {
  return getQuoterAccount()?.address ?? null;
}

export function getPublicClient(chainId: number): Public {
  const existing = publicClients.get(chainId);
  if (existing) return existing;
  const c = getChain(chainId);
  if (!c) throw new ApiError(400, "unsupported_chain", `chainId ${chainId} is not supported`);
  const client = createPublicClient({
    chain: c.viemChain,
    transport: http(c.rpcUrl, { timeout: 12_000, retryCount: 2, retryDelay: 400 }),
    batch: { multicall: { wait: 16 } },
  });
  publicClients.set(chainId, client);
  return client;
}

export function getWalletClient(chainId: number): Wallet | null {
  const existing = walletClients.get(chainId);
  if (existing) return existing;
  const account = getQuoterAccount();
  const c = getChain(chainId);
  if (!account || !c) return null;
  const client = createWalletClient({ account, chain: c.viemChain, transport: http(c.rpcUrl, { timeout: 20_000, retryCount: 1 }) });
  walletClients.set(chainId, client);
  return client;
}

export function requireWallet(chainId: number): Wallet {
  const w = getWalletClient(chainId);
  if (!w) throw new ApiError(503, "signer_not_configured", "QUOTER_PRIVATE_KEY is not configured; on-chain writes are disabled");
  return w;
}
