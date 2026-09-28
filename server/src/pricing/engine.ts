/**
 * Port of backtest/versions/v4_pooled_volscaled.py.
 *   sd   = rv20 / sqrt(252)                         (daily vol of the underlying, annualised 20d realised vol)
 *   fair = mean over pooled quantiles z of max(-b - sd * z, 0)
 *   charged = max(fair * LOAD, FLOOR)               (LOAD 1.5, FLOOR 1bp)
 *   priced_out when charged > 2% of notional.
 */
import { BARRIER_MENU, config } from "../config";
import { getPooledZ } from "../data";

export interface BarrierPrice {
  barrierBps: number;
  fair: number; // fraction of notional
  charged: number; // fraction of notional
  fairBp: number;
  loadBp: number;
  chargedBp: number;
  breachProbability: number; // P(gap < -barrier) under the vol-scaled pooled distribution
  expectedPayoutBp: number; // = fairBp (what the engine expects to pay back per weekend)
  pricedOut: boolean;
}

export interface QuotedPrice extends BarrierPrice {
  premiumUsd: bigint; // USDT units (6d), rounded up
  chargedBpEffective: number; // premiumUsd / notional after rounding
}

export interface EstimatedValue {
  fairBp: number;
  loadBp: number;
  chargedBp: number;
  floorBp: number;
  expectedPayoutBp: number;
  breachProbability: number;
  sentence: string;
}

export interface BudgetResult {
  pick: BarrierPrice;
  budgetShort: boolean;
  menu: BarrierPrice[];
}

const bp = (x: number) => Math.round(x * 1e4 * 100) / 100;

export function dailySd(rv20: number): number {
  return rv20 / Math.sqrt(252);
}

/** Fair premium per $1 and breach probability for a barrier (fraction, e.g. 0.03) and annualised 20d vol. */
export function fairPremium(barrier: number, rv20: number): { fair: number; breach: number } {
  const { quantiles } = getPooledZ();
  const sd = dailySd(rv20);
  if (!Number.isFinite(sd) || sd <= 0) return { fair: 0, breach: 0 };
  let sum = 0;
  let breaches = 0;
  for (let i = 0; i < quantiles.length; i++) {
    const z = quantiles[i] as number;
    const loss = -barrier - sd * z;
    if (loss > 0) {
      sum += loss;
      breaches++;
    }
  }
  return { fair: sum / quantiles.length, breach: breaches / quantiles.length };
}

export function priceBarrier(barrierBps: number, rv20: number): BarrierPrice {
  const { load, floorFraction, maxChargedFraction } = config.pricing;
  const barrier = barrierBps / 1e4;
  const { fair, breach } = fairPremium(barrier, rv20);
  const charged = Math.max(fair * load, floorFraction);
  return {
    barrierBps,
    fair,
    charged,
    fairBp: bp(fair),
    loadBp: bp(charged - fair),
    chargedBp: bp(charged),
    breachProbability: Math.round(breach * 1e5) / 1e5,
    expectedPayoutBp: bp(fair),
    pricedOut: charged > maxChargedFraction,
  };
}

/** Premium in USDT units (6d) for a notional, rounded up so the pool never under-collects. */
export function premiumUnits(notionalUsd: bigint, charged: number): bigint {
  const SCALE = 10_000_000_000n; // 1e10 -> 1e-10 resolution on the fraction
  const c = BigInt(Math.round(charged * 1e10));
  const p = (notionalUsd * c + SCALE - 1n) / SCALE;
  return p < 1n ? 1n : p;
}

export function quoteBarrier(barrierBps: number, rv20: number, notionalUsd: bigint): QuotedPrice {
  const base = priceBarrier(barrierBps, rv20);
  const premiumUsd = premiumUnits(notionalUsd, base.charged);
  const eff = notionalUsd > 0n ? (Number(premiumUsd) / Number(notionalUsd)) * 1e4 : 0;
  return { ...base, premiumUsd, chargedBpEffective: Math.round(eff * 100) / 100 };
}

export function priceMenu(rv20: number): BarrierPrice[] {
  return BARRIER_MENU.map((b) => priceBarrier(b, rv20));
}

/**
 * Budget mode: the tightest barrier in the menu whose charged premium fits the budget.
 * If none fits, the 1000bp quote flagged budget_short (never priced_out).
 */
export function pickForBudget(budgetBps: number, rv20: number): BudgetResult {
  const menu = priceMenu(rv20);
  const fits = menu.find((m) => m.chargedBp <= budgetBps);
  if (fits) return { pick: fits, budgetShort: false, menu };
  const widest = menu[menu.length - 1] as BarrierPrice;
  return { pick: { ...widest, pricedOut: false }, budgetShort: true, menu };
}

export function estimatedValue(p: BarrierPrice): EstimatedValue {
  const fmt = (x: number) => (Math.abs(x) >= 100 ? x.toFixed(0) : x.toFixed(1));
  return {
    fairBp: p.fairBp,
    loadBp: p.loadBp,
    chargedBp: p.chargedBp,
    floorBp: 1,
    expectedPayoutBp: p.expectedPayoutBp,
    breachProbability: p.breachProbability,
    sentence: `Fair price ${fmt(p.fairBp)}bp + our margin ${fmt(p.loadBp)}bp = ${fmt(p.chargedBp)}bp. The engine expects to pay back about ${fmt(p.expectedPayoutBp)}bp of this over many weekends.`,
  };
}
