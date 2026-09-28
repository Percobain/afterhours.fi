import type { Address } from "viem";

export type Wrapper = "bstock" | "ondo";

export interface StockInfo {
  address: Address;
  ticker: string;
  name: string;
  decimals: number;
  wrapper: Wrapper;
}

export interface EpochInfo {
  epochId: number;
  expectedOpen: number;
}

/** Shape written by contracts/scripts/deploy.ts (see shared/INTERFACE.md). */
export interface Deployment {
  network: string;
  chainId: number;
  deployer?: string;
  quoter?: string;
  deployedAt?: string;
  contracts: {
    USDT: Address;
    ReferenceOracle: Address;
    KeeperVault: Address;
    CoverMarket: Address;
  };
  stocks: Record<string, StockInfo>;
  epochs: EpochInfo[];
}

/** A stock token as the UI uses it: deployment info plus whatever live data the server adds. */
export interface TokenInfo extends StockInfo {
  symbol: string;
  /** USD per share, 8 decimals */
  lastPrice?: bigint;
  rv20?: number;
  breachProb5?: number;
  worstWeekend?: number;
}

// ---- server API (base /api) ----

export interface MarketStatus {
  openState?: string;
  marketStatus?: string;
  reasonCode?: string;
  nextOpenTime?: number | string | null;
  nextCloseTime?: number | string | null;
  currentEpochId?: number;
  bindDeadline?: number;
  secondsToBell?: number;
}

export interface ApiToken {
  symbol: string;
  address: Address;
  ticker: string;
  wrapper: Wrapper;
  name?: string;
  decimals?: number;
  lastPrice?: string | number;
  rv20?: number;
  breachProb5?: number;
  worstWeekend?: number;
}

export interface ServerConfig {
  networks?: unknown;
  contracts?: Record<string, Partial<Deployment["contracts"]>>;
  tokens?: Record<string, ApiToken[]> | ApiToken[];
  epochs?: Record<string, EpochInfo[]> | EpochInfo[];
  quoter?: string;
}

export interface SignedQuote {
  buyer: Address;
  token: Address;
  epochId: string | number;
  notionalUsd: string | number;
  barrierBps: number;
  premiumUsd: string | number;
  expiry: string | number;
  nonce: string | number;
}

export interface EstimatedValue {
  fairBp: number;
  chargedBp: number;
  loadBp: number;
  floorBp: number;
  expectedPayoutBp: number;
  breachProbability: number;
}

export interface QuoteResponse {
  quote: SignedQuote;
  signature: `0x${string}`;
  estimatedValue: EstimatedValue;
  /** 8 decimals */
  floorPricePerShare: string | number;
  /** token wei */
  requiredTokenBalance: string | number;
  /** 6 decimals */
  capacityNotional: string | number;
  priced_out?: boolean;
  budget_short?: boolean;
  reason?: string;
  volSource?: string;
  rv20?: number;
  /** server extras: the same weekend priced at every line in the menu */
  pricing?: {
    mode?: "barrier" | "budget";
    budgetBps?: number | null;
    budgetShort?: boolean;
    pricedOut?: boolean;
    rv20?: number;
    volSource?: string;
    ticker?: string | null;
    menu?: { barrierBps: number; fairBp: number; loadBp?: number; chargedBp: number; breachProbability: number; pricedOut?: boolean }[];
  };
}

export type PolicyStatus = 0 | 1 | 2 | 3;

export interface ApiPolicy {
  policyId: number | string;
  buyer: Address;
  token: Address;
  symbol?: string;
  ticker?: string;
  epochId: number | string;
  expectedOpen?: number;
  notionalUsd: string | number;
  barrierBps: number;
  premiumUsd: string | number;
  lockedUsd?: string | number;
  payoutUsd?: string | number;
  gapBps?: string | number | null;
  status: PolicyStatus | string;
  receipt?: string;
  settleable?: boolean;
  boughtAt?: number;
  settledAt?: number;
  txHash?: string;
}

export interface PolicyStats {
  weekendsProtected: number;
  currentStreak: number;
  longestStreak: number;
  premiumsPaid: string | number;
  payoutsReceived: string | number;
  floorsHeld: number;
  floorsPaid: number;
}

export interface PoliciesResponse {
  policies: ApiPolicy[];
  stats?: PolicyStats;
}

export interface VaultResponse {
  totalAssets?: string | number;
  locked?: string | number;
  lockedAssets?: string | number;
  floor?: string | number;
  floorAssets?: string | number;
  cushion?: string | number;
  freeCushion?: string | number;
  utilisation?: number;
  utilisationBps?: number;
  capacityNotional?: string | number;
  totalPremiumsReceived?: string | number;
  totalPayoutsPaid?: string | number;
  premiums?: string | number;
  payouts?: string | number;
  apyBand?: { low: number; high: number } | [number, number];
  impliedApy?: { low: number; high: number };
  depositCap?: string | number;
}

export interface FamousWeekend {
  friday: string;
  event: string;
  ticker: string;
  gap: number;
  premium_bp: number | null;
  hermee_bare: number;
  hermee_covered: number | null;
  kind: string;
}

export interface HermeeScenario {
  scenario: string;
  ticker: string;
  start: string;
  end: string;
  invested: number;
  paid: number;
  received: number;
  worst_bare: number;
  worst_covered: number;
  pmi: number;
  worth_it: boolean;
}

export interface BacktestSummary {
  universe: { tickers: number; ticker_weekends: number; years: string };
  breach_prob: Record<string, number>;
  fair_premium_bp_5pct: number;
  loss_ratio_v4: number;
  keeper: {
    roc_pa: number;
    roc_pa_since_2015: number;
    sharpe: number;
    worst_weekend: string;
    worst_weekend_pct_capital: number;
    share_weekends_losing: number;
    ruin_1y_10pct_capital: number;
  };
  hermee: HermeeScenario[];
  famous: FamousWeekend[];
  per_ticker: Record<string, { breach_5_pct: number; worst_weekend: number; worst_weekend_date: string; n_weekends: number }>;
  token_discovery?: Record<string, number>;
}

export interface LearnSection {
  title: string;
  body: string;
}
export interface LearnResponse {
  sections?: LearnSection[];
  glossary?: { term: string; definition: string }[];
  pricing?: LearnSection[];
}
