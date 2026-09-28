import fs from "node:fs";
import path from "node:path";
import { DATA_DIR } from "./paths";
import { logger } from "./logger";

export interface PooledZ {
  n: number;
  quantiles: number[];
  note?: string;
}

export interface TickerVol {
  rv20: number;
  rv60: number;
  asof: string;
  close: number;
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

export interface FamousWeekend {
  friday: string;
  event: string;
  ticker: string;
  gap: number;
  premium_bp: number | null;
  hermee_bare: number | null;
  hermee_covered: number | null;
  kind: string;
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

function readJson<T>(name: string): T {
  const fp = path.join(DATA_DIR, name);
  return JSON.parse(fs.readFileSync(fp, "utf8")) as T;
}

let pooledZ: PooledZ | null = null;
let tickerVol: Record<string, TickerVol> | null = null;
let summary: BacktestSummary | null = null;

export function getPooledZ(): PooledZ {
  if (!pooledZ) {
    pooledZ = readJson<PooledZ>("pooled_z.json");
    if (!Array.isArray(pooledZ.quantiles) || pooledZ.quantiles.length < 100) throw new Error("pooled_z.json: quantiles missing");
    logger.info({ n: pooledZ.n, quantiles: pooledZ.quantiles.length }, "pooled z loaded");
  }
  return pooledZ;
}

export function getTickerVol(): Record<string, TickerVol> {
  if (!tickerVol) tickerVol = readJson<Record<string, TickerVol>>("ticker_vol.json");
  return tickerVol;
}

export function getSummary(): BacktestSummary {
  if (!summary) summary = readJson<BacktestSummary>("backtest_summary.json");
  return summary;
}
