import { createPublicClient, createWalletClient, http, type Address, type Chain, type Hex, type PublicClient, type Transport, type WalletClient } from "viem";
import { privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";
import { config, getChain } from "./config";
import { logger } from "./logger";
import { ApiError } from "./util/errors";

export type Public = PublicClient<Transport, Chain>;
export type Wallet = WalletClient<Transport, Chain, PrivateKeyAccount>;

const publicClients = new Map<number, Public>();
const walletClients = new Map<number, Wallet>();

// keyed by chainId; 0 = the default QUOTER_PRIVATE_KEY
const quoterAccounts = new Map<number, PrivateKeyAccount | null>();

/**
 * The server's signer (quotes + oracle keeper writes + x402 settlement). With a chainId, QUOTER_PRIVATE_KEY_<chainId>
 * wins over QUOTER_PRIVATE_KEY, so mainnet can sign as its own owner/quoter while testnets keep theirs.
 * null when the key is empty or invalid.
 */
export function getQuoterAccount(chainId?: number): PrivateKeyAccount | null {
  const slot = chainId ?? 0;
  if (quoterAccounts.has(slot)) return quoterAccounts.get(slot)!;
  const k = (chainId ? config.quoterPrivateKeyFor(chainId) : config.quoterPrivateKey).trim();
  const name = chainId && process.env[`QUOTER_PRIVATE_KEY_${chainId}`]?.trim() ? `QUOTER_PRIVATE_KEY_${chainId}` : "QUOTER_PRIVATE_KEY";
  let account: PrivateKeyAccount | null = null;
  if (!k) {
    logger.warn({ chainId }, `${name} is empty: quotes are returned unsigned and keeper jobs are disabled`);
  } else {
    try {
      account = privateKeyToAccount((k.startsWith("0x") ? k : `0x${k}`) as Hex);
      logger.info({ chainId, quoter: account.address, from: name }, "quoter signer loaded");
    } catch (e) {
      logger.error({ chainId, err: (e as Error).message }, `${name} is not a valid private key; running unsigned`);
    }
  }
  quoterAccounts.set(slot, account);
  return account;
}

export function quoterAddress(chainId?: number): Address | null {
  return getQuoterAccount(chainId)?.address ?? null;
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
  const account = getQuoterAccount(chainId);
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
