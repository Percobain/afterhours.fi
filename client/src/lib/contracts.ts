import type { Address } from "viem";
import { isAddress, parseUnits } from "viem";
import { deployments } from "@/deployments";
import type { Deployment, EpochInfo, StockInfo, TokenInfo } from "./types";
import { PRICE_DECIMALS, USD_DECIMALS } from "./format";

export { CoverMarketAbi, KeeperVaultAbi, MockERC20Abi, ReferenceOracleAbi } from "@/abi";

export const SEPOLIA = 11155111;
export const BSC_TESTNET = 97;
export const SUPPORTED_CHAIN_IDS = [SEPOLIA, BSC_TESTNET] as const;
export type SupportedChainId = (typeof SUPPORTED_CHAIN_IDS)[number];

export const CHAIN_META: Record<number, { name: string; short: string; network: "sepolia" | "bscTestnet"; explorer: string; gasFaucet: string }> = {
  [SEPOLIA]: { name: "Ethereum Sepolia", short: "Sepolia", network: "sepolia", explorer: "https://sepolia.etherscan.io", gasFaucet: "https://sepoliafaucet.com" },
  [BSC_TESTNET]: { name: "BSC Testnet", short: "BSC Testnet", network: "bscTestnet", explorer: "https://testnet.bscscan.com", gasFaucet: "https://www.bnbchain.org/en/testnet-faucet" },
};

export const DEFAULT_CHAIN_ID: number = Number(process.env.NEXT_PUBLIC_DEFAULT_CHAIN_ID ?? SEPOLIA) || SEPOLIA;

export const BARRIER_MENU = [100, 200, 300, 500, 700, 1000] as const;
export const BUDGET_MENU = [2, 5, 10, 25] as const;
export const PAYOUT_CAP_BPS = 2000;
export const EPOCH_LENGTH_SECONDS = 65.5 * 3600;

export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as Address;

function envAddr(v: string | undefined): Address | undefined {
  return v && isAddress(v) ? (v as Address) : undefined;
}

// NEXT_PUBLIC_* values must be referenced statically for Next to inline them.
const ENV_OVERRIDES: Record<number, Partial<Deployment["contracts"]>> = {
  [SEPOLIA]: {
    CoverMarket: envAddr(process.env.NEXT_PUBLIC_SEPOLIA_COVER_MARKET),
    KeeperVault: envAddr(process.env.NEXT_PUBLIC_SEPOLIA_KEEPER_VAULT),
    USDT: envAddr(process.env.NEXT_PUBLIC_SEPOLIA_USDT),
    ReferenceOracle: envAddr(process.env.NEXT_PUBLIC_SEPOLIA_ORACLE),
  },
  [BSC_TESTNET]: {
    CoverMarket: envAddr(process.env.NEXT_PUBLIC_BSC_TESTNET_COVER_MARKET),
    KeeperVault: envAddr(process.env.NEXT_PUBLIC_BSC_TESTNET_KEEPER_VAULT),
    USDT: envAddr(process.env.NEXT_PUBLIC_BSC_TESTNET_USDT),
    ReferenceOracle: envAddr(process.env.NEXT_PUBLIC_BSC_TESTNET_ORACLE),
  },
};

/** Static deployment for a chain: JSON written by the deploy script, with NEXT_PUBLIC_* env overrides on top. */
export function getStaticDeployment(chainId: number | undefined): Deployment | null {
  if (!chainId) return null;
  const json = deployments[chainId];
  const env = ENV_OVERRIDES[chainId] ?? {};
  const contracts = {
    CoverMarket: env.CoverMarket ?? json?.contracts.CoverMarket,
    KeeperVault: env.KeeperVault ?? json?.contracts.KeeperVault,
    USDT: env.USDT ?? json?.contracts.USDT,
    ReferenceOracle: env.ReferenceOracle ?? json?.contracts.ReferenceOracle,
  };
  if (!contracts.CoverMarket || !contracts.KeeperVault || !contracts.USDT) return null;
  return {
    network: json?.network ?? CHAIN_META[chainId]?.network ?? String(chainId),
    chainId,
    deployer: json?.deployer,
    quoter: json?.quoter,
    deployedAt: json?.deployedAt,
    contracts: {
      CoverMarket: contracts.CoverMarket,
      KeeperVault: contracts.KeeperVault,
      USDT: contracts.USDT,
      ReferenceOracle: contracts.ReferenceOracle ?? ZERO_ADDRESS,
    },
    stocks: json?.stocks ?? {},
    epochs: json?.epochs ?? [],
  };
}

export function stocksToTokens(stocks: Record<string, StockInfo>): TokenInfo[] {
  return Object.entries(stocks).map(([symbol, s]) => ({ symbol, ...s, address: s.address as Address, decimals: s.decimals ?? 18 }));
}

export function isSupportedChain(chainId: number | undefined): chainId is SupportedChainId {
  return chainId === SEPOLIA || chainId === BSC_TESTNET;
}

export function explorerTx(chainId: number | undefined, hash: string): string {
  return `${CHAIN_META[chainId ?? DEFAULT_CHAIN_ID]?.explorer ?? ""}/tx/${hash}`;
}
export function explorerAddress(chainId: number | undefined, addr: string): string {
  return `${CHAIN_META[chainId ?? DEFAULT_CHAIN_ID]?.explorer ?? ""}/address/${addr}`;
}

// ---- units ----
// USD / USDT: 6 decimals. Prices: USD per share, 8 decimals. Barrier: bps (300 = 3%).

export function parseUsd(s: string): bigint {
  try {
    return parseUnits((s || "0").replace(/,/g, ""), USD_DECIMALS);
  } catch {
    return 0n;
  }
}

export function parseTokens(s: string, decimals = 18): bigint {
  try {
    return parseUnits((s || "0").replace(/,/g, ""), decimals);
  } catch {
    return 0n;
  }
}

/** notional (6d) = tokens (tokenDecimals) x price (8d) */
export function notionalFromTokens(tokens: bigint, price8: bigint, tokenDecimals = 18): bigint {
  if (price8 === 0n) return 0n;
  return (tokens * price8) / 10n ** BigInt(tokenDecimals + PRICE_DECIMALS - USD_DECIMALS);
}

/** tokens (tokenDecimals) needed for a notional (6d) at price (8d) */
export function tokensForNotional(notional6: bigint, price8: bigint, tokenDecimals = 18): bigint {
  if (price8 === 0n) return 0n;
  return (notional6 * 10n ** BigInt(tokenDecimals + PRICE_DECIMALS - USD_DECIMALS)) / price8;
}

/** floor price per share (8d) = price x (1 - barrier) */
export function floorPrice(price8: bigint, barrierBps: number): bigint {
  return (price8 * BigInt(10_000 - barrierBps)) / 10_000n;
}

/** premium (6d) from bp of notional */
export function premiumFromBp(notional6: bigint, bp: number): bigint {
  return (notional6 * BigInt(Math.round(bp * 100))) / 1_000_000n;
}

export function lockFor(notional6: bigint, capBps = PAYOUT_CAP_BPS): bigint {
  return (notional6 * BigInt(capBps)) / 10_000n;
}

/** Payout per $1 of notional for a realised gap (fraction, negative = down). */
export function payoutPerDollar(gap: number, barrierBps: number, capBps = PAYOUT_CAP_BPS): number {
  const b = barrierBps / 10_000;
  const cap = capBps / 10_000;
  return Math.min(Math.max(-b - gap, 0), cap);
}

/** Share of the worst historical weekend that the floor removes (the peace-of-mind meter). */
export function peaceOfMind(worstWeekend: number, barrierBps: number, capBps = PAYOUT_CAP_BPS): { removed: number; bareLoss: number; coveredLoss: number } {
  const bare = Math.abs(Math.min(worstWeekend, 0));
  if (bare === 0) return { removed: 1, bareLoss: 0, coveredLoss: 0 };
  const paid = payoutPerDollar(-bare, barrierBps, capBps);
  return { removed: paid / bare, bareLoss: bare, coveredLoss: bare - paid };
}

// ---- epochs ----

/** Next Friday 20:00 UTC (16:00 New York in daylight time), matching contracts/scripts/deploy.ts. Fallback only. */
export function fallbackEpoch(from = new Date()): EpochInfo {
  const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate(), 20, 0, 0));
  const day = d.getUTCDay();
  let add = (5 - day + 7) % 7;
  if (add === 0 && from.getTime() > d.getTime()) add = 7;
  d.setUTCDate(d.getUTCDate() + add);
  const epochId = Math.floor(d.getTime() / 1000);
  return { epochId, expectedOpen: epochId + EPOCH_LENGTH_SECONDS };
}

/** The epoch the next purchase binds to: the earliest known epoch whose Friday bell has not passed. */
export function currentEpoch(epochs: EpochInfo[] | undefined, nowSeconds = Date.now() / 1000): EpochInfo & { fromDeployment: boolean } {
  const upcoming = (epochs ?? []).filter((e) => e.epochId > nowSeconds).sort((a, b) => a.epochId - b.epochId)[0];
  if (upcoming) return { ...upcoming, fromDeployment: true };
  return { ...fallbackEpoch(new Date(nowSeconds * 1000)), fromDeployment: false };
}

export const POLICY_STATUS = { None: 0, Open: 1, Settled: 2, Refunded: 3 } as const;

/** Plain-English messages for contract errors and wallet failures. */
export function explainError(err: unknown): string {
  const e = err as { shortMessage?: string; message?: string; cause?: { message?: string } } | undefined;
  const raw = e?.shortMessage ?? e?.message ?? String(err);
  const s = `${raw} ${e?.cause?.message ?? ""} ${e?.message ?? ""}`.toLowerCase();
  const table: [string, string][] = [
    ["user rejected", "You cancelled the transaction in your wallet."],
    ["user denied", "You cancelled the transaction in your wallet."],
    ["insufficient funds", "Not enough gas token in your wallet to pay for this transaction."],
    ["notholdingposition", "You need to hold enough of the stock token to cover this amount. Use the faucet or lower the amount."],
    ["epochclosed", "Sales for this weekend closed at the Friday bell. The next weekend opens shortly."],
    ["epochunknown", "This weekend is not open for sale yet. Try again in a moment."],
    ["quoteexpired", "That quote expired. Fetching a fresh one."],
    ["badsignature", "The quote signature did not match the market quoter. Refresh and try again."],
    ["nonceused", "That quote was already used. Fetching a fresh one."],
    ["barrieroutofrange", "That floor depth is outside the allowed range."],
    ["notionaloutofrange", "That amount is outside the market limits."],
    ["concentrationcap", "The Keeper pool has reached its limit for this stock this weekend. Try a smaller amount."],
    ["insufficientcushion", "The Keeper pool does not have enough free cushion to back this floor right now."],
    ["tokennotallowed", "This token is not enabled on the market."],
    ["enforcedpause", "The market is paused by the admin right now."],
    ["notsettleable", "Monday's reference price has not been posted yet. Try again after the open."],
    ["wrongstatus", "This weekend has already been settled."],
    ["erc20insufficientallowance", "USDT approval is too low. Approve first, then try again."],
    ["erc20insufficientbalance", "Not enough USDT. Use the faucet to get test USDT."],
    ["erc4626exceededmaxwithdraw", "You can only withdraw what is not locked behind open floors right now."],
    ["depositcapexceeded", "The Keeper pool deposit cap has been reached."],
    ["chain mismatch", "Your wallet is on a different network. Switch network and try again."],
    ["does not match the target chain", "Your wallet is on a different network. Switch network and try again."],
    ["timeout", "The network took too long to answer. Please try again."],
  ];
  for (const [k, msg] of table) if (s.includes(k)) return msg;
  return raw.length > 160 ? `${raw.slice(0, 157)}…` : raw;
}
