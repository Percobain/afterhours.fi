export type PolicyStatus = "Open" | "Settled" | "Refunded";

export interface PolicyDoc {
  chainId: number;
  policyId: number;
  buyer: string; // lowercase
  token: string; // lowercase
  tokenSymbol: string | null;
  ticker: string | null;
  epochId: number;
  notionalUsd: string; // USDT units, 6d, decimal string
  barrierBps: number;
  premiumUsd: string;
  lockedUsd: string;
  payoutUsd: string;
  gapBps: number | null;
  status: PolicyStatus;
  refundReason: string | null;
  boughtAt: number | null;
  settledAt: number | null;
  buyTx: string | null;
  settleTx: string | null;
  blockNumber: number;
  updatedAt: Date;
}

export interface UserStatsDoc {
  chainId: number;
  address: string; // lowercase
  weekendsProtected: number;
  currentStreak: number;
  longestStreak: number;
  premiumsPaid: string;
  payoutsReceived: string;
  floorsHeld: number;
  floorsPaid: number;
  policies: number;
  updatedAt: Date;
}

export interface EpochPriceDoc {
  chainId: number;
  epochId: number;
  token: string; // lowercase
  symbol: string | null;
  closePrice: string | null; // 8d
  openPrice: string | null; // 8d
  closeSource: string | null;
  openSource: string | null;
  closeTx: string | null;
  openTx: string | null;
  closePostedAt: number | null;
  openPostedAt: number | null;
  voided: boolean;
  voidReason: string | null;
  updatedAt: Date;
}

export interface CursorDoc {
  chainId: number;
  key: string;
  block: number;
  updatedAt: Date;
}

export interface QuoteLogDoc {
  chainId: number;
  buyer: string;
  token: string;
  ticker: string | null;
  epochId: number;
  notionalUsd: string;
  barrierBps: number;
  premiumUsd: string;
  nonce: string;
  expiry: number;
  signed: boolean;
  rv20: number;
  volSource: string;
  fairBp: number;
  chargedBp: number;
  mode: "barrier" | "budget";
  createdAt: Date;
}
