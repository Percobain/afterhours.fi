import type { BacktestSummary, FamousWeekend, HermeeScenario } from "./types";

/**
 * Static fallback of server/data/backtest_summary.json so the landing and learn pages
 * render real numbers even when the server is down. Values copied verbatim from the summary.
 */
export const FALLBACK_SUMMARY: BacktestSummary = {
  universe: { tickers: 50, ticker_weekends: 61815, years: "2005-2026" },
  breach_prob: { "3": 0.0247, "5": 0.0085, "7": 0.0041, "10": 0.0019 },
  fair_premium_bp_5pct: 3.7,
  loss_ratio_v4: 0.57,
  keeper: {
    roc_pa: 0.073,
    roc_pa_since_2015: 0.1,
    sharpe: 0.9,
    worst_weekend: "2020-03-13",
    worst_weekend_pct_capital: -0.62,
    share_weekends_losing: 0.06,
    ruin_1y_10pct_capital: 0.004,
  },
  hermee: [
    { scenario: "H1", ticker: "NVDA", start: "2024-01-05", end: "2026-09-18", invested: 100000, paid: 24265, received: 46184, worst_bare: -36306, worst_covered: -14689, pmi: 48, worth_it: true },
    { scenario: "H2", ticker: "AAPL", start: "2015-01-02", end: "2017-12-29", invested: 100000, paid: 2041, received: 5189, worst_bare: -10087, worst_covered: -4913, pmi: 32, worth_it: true },
    { scenario: "H3", ticker: "SPY", start: "2019-01-04", end: "2021-12-31", invested: 100000, paid: 3367, received: 8866, worst_bare: -11361, worst_covered: -6030, pmi: 34, worth_it: true },
    { scenario: "H4", ticker: "COIN", start: "2021-04-16", end: "2026-09-18", invested: 50000, paid: 15826, received: 9604, worst_bare: -6203, worst_covered: -2186, pmi: 51, worth_it: true },
    { scenario: "H5", ticker: "TSLA", start: "2020-01-03", end: "2026-09-18", invested: 50000, paid: 161496, received: 86674, worst_bare: -40800, worst_covered: -35054, pmi: 45, worth_it: true },
    { scenario: "H11", ticker: "SPY", start: "2005-01-07", end: "2026-09-18", invested: 100000, paid: 40796, received: 25515, worst_bare: -32095, worst_covered: -26052, pmi: 10, worth_it: false },
  ],
  famous: [
    { friday: "2025-01-24", event: "DeepSeek Monday", ticker: "NVDA", gap: -0.1249, premium_bp: 5.5, hermee_bare: -12495, hermee_covered: -5055, kind: "crash" },
    { friday: "2020-03-13", event: "Fed emergency cut Sunday", ticker: "AAPL", gap: -0.1296, premium_bp: 26, hermee_bare: -12958, hermee_covered: -5260, kind: "crash" },
    { friday: "2020-03-13", event: "Fed emergency cut Sunday", ticker: "SPY", gap: -0.1045, premium_bp: 14.5, hermee_bare: -10449, hermee_covered: -5145, kind: "crash" },
    { friday: "2023-03-10", event: "SVB weekend", ticker: "WAL", gap: -0.7388, premium_bp: 26.7, hermee_bare: -73875, hermee_covered: -5267, kind: "crash" },
    { friday: "2023-03-10", event: "SVB weekend", ticker: "KRE", gap: -0.1257, premium_bp: 2.4, hermee_bare: -12567, hermee_covered: -5024, kind: "crash" },
    { friday: "2024-08-02", event: "Yen carry unwind", ticker: "NVDA", gap: -0.1418, premium_bp: 18.7, hermee_bare: -14179, hermee_covered: -5187, kind: "crash" },
    { friday: "2024-08-02", event: "Yen carry unwind", ticker: "COIN", gap: -0.2075, premium_bp: 20.4, hermee_bare: -20754, hermee_covered: -5204, kind: "crash" },
    { friday: "2015-08-21", event: "China Black Monday", ticker: "AAPL", gap: -0.103, premium_bp: 1.5, hermee_bare: -10297, hermee_covered: -5015, kind: "crash" },
    { friday: "2008-09-12", event: "Lehman weekend", ticker: "AIG", gap: -0.4135, premium_bp: 50.5, hermee_bare: -41351, hermee_covered: -5505, kind: "crash" },
    { friday: "2022-06-10", event: "CPI + Celsius freeze", ticker: "COIN", gap: -0.2134, premium_bp: 69.6, hermee_bare: -21342, hermee_covered: -5696, kind: "crash" },
    { friday: "2025-04-04", event: "Tariff Monday", ticker: "NVDA", gap: -0.0726, premium_bp: 11.1, hermee_bare: -7263, hermee_covered: -5111, kind: "crash" },
    { friday: "2020-11-06", event: "Pfizer vaccine Monday", ticker: "ZM", gap: -0.1342, premium_bp: 12.1, hermee_bare: -13419, hermee_covered: -5121, kind: "mixed" },
    { friday: "2025-04-11", event: "Smartphone tariff exemption", ticker: "AAPL", gap: 0.0671, premium_bp: 21.8, hermee_bare: 6707, hermee_covered: 6489, kind: "rally" },
  ],
  per_ticker: {
    NVDA: { breach_5_pct: 0.0118, worst_weekend: -0.1474, worst_weekend_date: "2019-01-25", n_weekends: 1443 },
    TSLA: { breach_5_pct: 0.013, worst_weekend: -0.149, worst_weekend_date: "2020-09-04", n_weekends: 847 },
    AAPL: { breach_5_pct: 0.0084, worst_weekend: -0.1897, worst_weekend_date: "1997-01-03", n_weekends: 1915 },
    SPY: { breach_5_pct: 0.0017, worst_weekend: -0.1045, worst_weekend_date: "2020-03-13", n_weekends: 1755 },
    COIN: { breach_5_pct: 0.0317, worst_weekend: -0.2134, worst_weekend_date: "2022-06-10", n_weekends: 284 },
    MSTR: { breach_5_pct: 0.0237, worst_weekend: -0.5182, worst_weekend_date: "2000-03-17", n_weekends: 1475 },
    QQQ: { breach_5_pct: 0.0035, worst_weekend: -0.0946, worst_weekend_date: "2020-03-13", n_weekends: 1436 },
    MSFT: { breach_5_pct: 0.0047, worst_weekend: -0.1481, worst_weekend_date: "2000-04-20", n_weekends: 1915 },
  },
  token_discovery: { beta_preopen: 0.95, beta_sunday: 0.02, median_dev_preopen_vs_open: 0.0031, p90_dev: 0.0084, weekend_volume_share: 0.21 },
};

/** Typical charged premium per weekend at a 5% floor (bp of notional), from PRODUCT_STRATEGY / the summary. Indicative only. */
export const TYPICAL_COST_BP: Record<string, { low: number; high: number }> = {
  SPY: { low: 1, high: 1.5 },
  QQQ: { low: 1, high: 2 },
  AAPL: { low: 4, high: 6 },
  NVDA: { low: 4, high: 6 },
  MSFT: { low: 3, high: 5 },
  TSLA: { low: 10, high: 15 },
  COIN: { low: 25, high: 30 },
  MSTR: { low: 25, high: 35 },
};

/** Curated order for the "famous weekends" strip. */
export function pickFamous(all: FamousWeekend[]): FamousWeekend[] {
  const wanted: [string, string][] = [
    ["2025-01-24", "NVDA"],
    ["2020-03-13", "SPY"],
    ["2020-03-13", "AAPL"],
    ["2023-03-10", "WAL"],
    ["2024-08-02", "NVDA"],
    ["2024-08-02", "COIN"],
    ["2015-08-21", "AAPL"],
    ["2008-09-12", "AIG"],
    ["2022-06-10", "COIN"],
    ["2025-04-04", "NVDA"],
    ["2020-11-06", "ZM"],
    ["2025-04-11", "AAPL"],
  ];
  const out: FamousWeekend[] = [];
  for (const [f, t] of wanted) {
    const hit = all.find((x) => x.friday === f && x.ticker === t);
    if (hit) out.push(hit);
  }
  return out.length ? out : all.slice(0, 12);
}

export function hermeeFor(summary: BacktestSummary, ticker: string): HermeeScenario | undefined {
  return summary.hermee.find((h) => h.ticker === ticker && h.worth_it) ?? summary.hermee.find((h) => h.ticker === ticker);
}
