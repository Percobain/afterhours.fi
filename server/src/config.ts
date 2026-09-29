import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { isAddress, getAddress, type Address, type Chain } from "viem";
import { sepolia, bscTestnet } from "viem/chains";
import { DEPLOYMENTS_DIR, SERVER_ROOT } from "./paths";
import { logger } from "./logger";

dotenv.config({ path: path.join(SERVER_ROOT, ".env") });

function env(name: string, def = ""): string {
  const v = process.env[name];
  return v === undefined || v === "" ? def : v;
}
function envNum(name: string, def: number): number {
  const raw = env(name);
  if (raw === "") return def;
  const v = Number(raw);
  return Number.isFinite(v) ? v : def;
}
function envBool(name: string, def: boolean): boolean {
  const v = env(name).toLowerCase();
  if (v === "") return def;
  return v === "1" || v === "true" || v === "yes";
}
function envAddress(name: string): Address | undefined {
  const v = env(name);
  if (!v) return undefined;
  if (!isAddress(v)) {
    logger.warn({ name, value: v }, "ignoring invalid address in env");
    return undefined;
  }
  return getAddress(v);
}

export type ChainKey = "sepolia" | "bscTestnet";
export type Wrapper = "bstock" | "ondo" | "xstock" | "unknown";

export interface TokenInfo {
  symbol: string;
  address: Address;
  ticker: string;
  name: string;
  decimals: number;
  wrapper: Wrapper;
}

export interface EpochInfo {
  epochId: number;
  bindDeadline: number;
  expectedOpen: number;
}

export interface DeploymentFile {
  network: string;
  chainId: number;
  deployer?: string;
  quoter?: string;
  deployedAt?: string;
  deployBlock?: number;
  contracts: { USDT?: string; ReferenceOracle?: string; KeeperVault?: string; CoverMarket?: string };
  stocks?: Record<string, { address: string; ticker: string; name?: string; decimals?: number; wrapper?: string }>;
  epochs?: { epochId: number; expectedOpen: number; bindDeadline?: number }[];
  binders?: string[];
  x402?: { permit2?: string; exactPermit2Proxy?: string };
}

export interface ChainConfig {
  chainId: number;
  key: ChainKey;
  name: string;
  rpcUrl: string;
  rpcSource: "override" | "alchemy" | "public";
  explorer: string;
  viemChain: Chain;
  contracts: { CoverMarket?: Address; KeeperVault?: Address; ReferenceOracle?: Address; USDT?: Address };
  deployer?: Address;
  quoter?: Address;
  deployBlock?: number;
  tokens: TokenInfo[];
  epochs: EpochInfo[];
  /** agents allowed to bind cover for buyers (CoverMarket.setBinder); also the only x402 payTo addresses we settle for */
  binders: Address[];
  deploymentFile: string | null;
}

export const BARRIER_MENU = [100, 200, 300, 500, 700, 1000] as const;

const PUBLIC_RPC: Record<ChainKey, string> = {
  sepolia: "https://ethereum-sepolia-rpc.publicnode.com",
  bscTestnet: "https://data-seed-prebsc-1-s1.bnbchain.org:8545",
};

/** RPC policy: explicit override > Alchemy (ALCHEMY_API_KEY) > public RPC (warned). */
function resolveRpc(key: ChainKey, overrideVar: string, alchemyHost: string, alchemyKey: string): { url: string; source: ChainConfig["rpcSource"] } {
  const override = env(overrideVar);
  if (override) return { url: override, source: "override" };
  if (alchemyKey) return { url: `https://${alchemyHost}/v2/${alchemyKey}`, source: "alchemy" };
  logger.warn({ chain: key }, `ALCHEMY_API_KEY and ${overrideVar} are both empty; falling back to a public RPC (rate-limited, best effort)`);
  return { url: PUBLIC_RPC[key], source: "public" };
}

export function wrapperFor(symbol: string, given?: string): Wrapper {
  if (given === "bstock" || given === "ondo" || given === "xstock") return given;
  if (symbol.endsWith("on")) return "ondo";
  if (symbol.endsWith("B")) return "bstock";
  if (symbol.endsWith("x")) return "xstock";
  return "unknown";
}

export function tickerFromSymbol(symbol: string): string {
  return symbol.replace(/(on|B|x)$/, "").toUpperCase();
}

function loadDeployment(key: ChainKey): { file: string; data: DeploymentFile } | null {
  const fp = path.join(DEPLOYMENTS_DIR, `${key}.json`);
  if (!fs.existsSync(fp)) return null;
  try {
    const data = JSON.parse(fs.readFileSync(fp, "utf8")) as DeploymentFile;
    return { file: fp, data };
  } catch (e) {
    logger.warn({ fp, err: (e as Error).message }, "could not parse deployment file");
    return null;
  }
}

function parseEnvTokens(chainId: number): TokenInfo[] {
  const raw = env(`TOKENS_${chainId}`);
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw) as { symbol: string; address: string; ticker?: string; name?: string; decimals?: number; wrapper?: string }[];
    return arr
      .filter((t) => t && typeof t.symbol === "string" && isAddress(t.address))
      .map((t) => ({
        symbol: t.symbol,
        address: getAddress(t.address),
        ticker: (t.ticker ?? tickerFromSymbol(t.symbol)).toUpperCase(),
        name: t.name ?? t.symbol,
        decimals: t.decimals ?? 18,
        wrapper: wrapperFor(t.symbol, t.wrapper),
      }));
  } catch (e) {
    logger.warn({ err: (e as Error).message }, `TOKENS_${chainId} is not valid JSON`);
    return [];
  }
}

interface ChainSpec {
  key: ChainKey;
  chainId: number;
  name: string;
  viemChain: Chain;
  explorer: string;
  overrideVar: string;
  alchemyHost: string;
}

function buildChain(spec: ChainSpec, alchemyKey: string): ChainConfig {
  const { key, chainId } = spec;
  const dep = loadDeployment(key);
  const d = dep?.data;
  const addr = (envName: string, fromFile?: string): Address | undefined => {
    const e = envAddress(`${envName}_${chainId}`);
    if (e) return e;
    if (fromFile && isAddress(fromFile)) return getAddress(fromFile);
    return undefined;
  };
  const tokens: TokenInfo[] = [];
  if (d?.stocks) {
    for (const [symbol, s] of Object.entries(d.stocks)) {
      if (!s || !isAddress(s.address)) continue;
      tokens.push({
        symbol,
        address: getAddress(s.address),
        ticker: (s.ticker ?? tickerFromSymbol(symbol)).toUpperCase(),
        name: s.name ?? symbol,
        decimals: s.decimals ?? 18,
        wrapper: wrapperFor(symbol, s.wrapper),
      });
    }
  }
  for (const t of parseEnvTokens(chainId)) {
    if (!tokens.find((x) => x.address.toLowerCase() === t.address.toLowerCase())) tokens.push(t);
  }
  const epochs: EpochInfo[] = (d?.epochs ?? []).map((e) => ({
    epochId: Number(e.epochId),
    bindDeadline: Number(e.bindDeadline ?? e.epochId),
    expectedOpen: Number(e.expectedOpen),
  }));
  const rpc = resolveRpc(key, spec.overrideVar, spec.alchemyHost, alchemyKey);
  const deployBlockEnv = envNum(`DEPLOY_BLOCK_${chainId}`, NaN);
  return {
    chainId,
    key,
    name: spec.name,
    rpcUrl: rpc.url,
    rpcSource: rpc.source,
    explorer: spec.explorer,
    viemChain: spec.viemChain,
    contracts: {
      CoverMarket: addr("CONTRACT_COVER_MARKET", d?.contracts?.CoverMarket),
      KeeperVault: addr("CONTRACT_KEEPER_VAULT", d?.contracts?.KeeperVault),
      ReferenceOracle: addr("CONTRACT_REFERENCE_ORACLE", d?.contracts?.ReferenceOracle),
      USDT: addr("CONTRACT_USDT", d?.contracts?.USDT),
    },
    deployer: d?.deployer && isAddress(d.deployer) ? getAddress(d.deployer) : undefined,
    quoter: d?.quoter && isAddress(d.quoter) ? getAddress(d.quoter) : undefined,
    deployBlock: Number.isFinite(deployBlockEnv) ? deployBlockEnv : d?.deployBlock,
    tokens,
    epochs,
    binders: (d?.binders ?? []).filter((b) => isAddress(b)).map((b) => getAddress(b)),
    deploymentFile: dep?.file ?? null,
  };
}

const alchemyKey = env("ALCHEMY_API_KEY");

export const config = {
  port: envNum("PORT", 4000),
  // Bind on all IPv4 interfaces; hosts like Render only route to 0.0.0.0.
  host: env("HOST", "0.0.0.0"),
  nodeEnv: env("NODE_ENV", "development"),
  mongoUri: env("MONGODB_URI"),
  mongoDbName: env("MONGODB_DB", "afterhours"),
  // Comma-separated resolvers used when the OS resolver refuses the SRV lookup behind mongodb+srv:// URIs.
  dnsFallbackServers: env("DNS_FALLBACK_SERVERS", "8.8.8.8,1.1.1.1").split(",").map((x) => x.trim()).filter(Boolean),
  quoterPrivateKey: env("QUOTER_PRIVATE_KEY"),
  agents: {
    // public URL of Kip's Agent Studio agent (the underwriter that sells cover over x402)
    kipUrl: env("KIP_AGENT_URL", "https://afterhours-kip.onrender.com").replace(/\/+$/, ""),
    // TESTNET-ONLY key for the site's live demo buyer (Hermee's agent); empty disables the demo
    hermeeDemoKey: env("HERMEE_DEMO_PRIVATE_KEY"),
    demoCooldownMs: envNum("AGENT_DEMO_COOLDOWN_MS", 45_000),
  },
  x402: {
    // testnet stand-in for Binance's b402 facilitator; on mainnet agents point at b402 instead
    facilitatorEnabled: envBool("X402_FACILITATOR_ENABLED", true),
    // chains the facilitator settles on; the canonical x402 Permit2 proxy must exist there (BSC testnet does)
    networks: env("X402_NETWORKS", "97").split(",").map((x) => Number(x.trim())).filter((n) => Number.isFinite(n) && n > 0),
    // gas payer for settlements; falls back to the quoter key
    facilitatorPrivateKey: env("FACILITATOR_PRIVATE_KEY"),
  },
  adminSecret: env("ADMIN_SECRET"),
  clientOrigin: env("CLIENT_ORIGIN", "http://localhost:3000"),
  alchemyApiKey: alchemyKey,
  binanceWeb3ApiKey: env("BINANCE_WEB3_API_KEY"),
  binanceWeb3ApiSecret: env("BINANCE_WEB3_API_SECRET"),
  trustProxy: envBool("TRUST_PROXY", false),
  jobsEnabled: envBool("JOBS_ENABLED", true),
  indexerEnabled: envBool("INDEXER_ENABLED", true),
  indexerIntervalMs: envNum("INDEXER_INTERVAL_MS", 30_000),
  indexerChunkBlocks: envNum("INDEXER_CHUNK_BLOCKS", 5_000),
  indexerLookbackBlocks: envNum("INDEXER_LOOKBACK_BLOCKS", 100_000),
  indexerSmallChunkDelayMs: envNum("INDEXER_SMALL_CHUNK_DELAY_MS", 250),
  indexerConfirmations: envNum("INDEXER_CONFIRMATIONS", 2),
  priceRefreshCron: env("PRICE_REFRESH_CRON", "*/5 * * * *"),
  quoteTtlSeconds: envNum("QUOTE_TTL_SECONDS", 15 * 60),
  epochCloseHourUtc: envNum("EPOCH_CLOSE_HOUR_UTC", 20),
  openRetryMinutes: envNum("OPEN_RETRY_MINUTES", 2),
  openRetryWindowMinutes: envNum("OPEN_RETRY_WINDOW_MINUTES", 120),
  openFallbackAfterMinutes: envNum("OPEN_FALLBACK_AFTER_MINUTES", 120),
  closeWindowMinutes: envNum("CLOSE_WINDOW_MINUTES", 360),
  settleChunk: 50,
  pricing: {
    load: envNum("PRICING_LOAD", 1.5),
    floorFraction: envNum("PRICING_FLOOR_FRACTION", 0.0001),
    maxChargedFraction: envNum("PRICING_MAX_CHARGED_FRACTION", 0.02),
    defaultVol: envNum("DEFAULT_VOL", 0.4),
    payoutCapBps: 2000,
    minNotionalUsd: 10_000_000n,
    maxNotionalUsd: 1_000_000_000_000n,
  },
  binance: {
    spotBase: env("BINANCE_SPOT_BASE", "https://api.binance.com"),
    klinesEnabled: envBool("BINANCE_KLINES_ENABLED", true),
    maxRequestsPerMinute: envNum("BINANCE_MAX_RPM", 20),
    web3Base: env("BINANCE_WEB3_BASE", "https://www.binance.com"),
  },
  chains: {
    11155111: buildChain(
      { key: "sepolia", chainId: 11155111, name: "Ethereum Sepolia", viemChain: sepolia, explorer: "https://sepolia.etherscan.io", overrideVar: "SEPOLIA_RPC_URL", alchemyHost: "eth-sepolia.g.alchemy.com" },
      alchemyKey,
    ),
    97: buildChain(
      { key: "bscTestnet", chainId: 97, name: "BSC Testnet", viemChain: bscTestnet, explorer: "https://testnet.bscscan.com", overrideVar: "BSC_TESTNET_RPC_URL", alchemyHost: "bnb-testnet.g.alchemy.com" },
      alchemyKey,
    ),
  } as Record<number, ChainConfig>,
};

export type Config = typeof config;

export function getChain(chainId: number): ChainConfig | undefined {
  return config.chains[chainId];
}

export function chainIds(): number[] {
  return Object.keys(config.chains).map(Number);
}

export function isDeployed(c: ChainConfig): boolean {
  return !!(c.contracts.CoverMarket && c.contracts.ReferenceOracle && c.contracts.KeeperVault);
}

export function deployedChains(): ChainConfig[] {
  return chainIds()
    .map((id) => config.chains[id])
    .filter((c): c is ChainConfig => !!c && isDeployed(c));
}

/** Redacts the RPC URL for public responses (never leak the Alchemy key). */
export function publicRpcUrl(c: ChainConfig): string {
  if (config.alchemyApiKey && c.rpcUrl.includes(config.alchemyApiKey)) return c.rpcUrl.replace(config.alchemyApiKey, "<ALCHEMY_API_KEY>");
  return c.rpcUrl;
}
