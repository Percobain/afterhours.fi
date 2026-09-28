# afterhours.fi backtest v2 - conclusions

Run 26 Sep 2026. Universe: every Ondo / bStock ticker on BSC with usable price history (50 names, 28 with a bStock wrapper), daily OHLC 1990/2004 to 25 Sep 2026, split and dividend adjusted; bStock hourly spot klines from Binance (15 tokens, 11 Jun to 26 Sep 2026); Binance public RWA endpoints for the token universe. 61,815 ticker-weekends. Pricing evaluated walk-forward 2005-2026 (184k ticker-weekend-barrier rows). Everything reproducible with `run_all.ps1`; charts in `charts/`, tables in `results/`, browsable at `report/index.html`.

## 1. The risk is real, fat-tailed, and priced in basis points

| pooled, all tickers | value |
|---|---|
| P(Monday opens more than 3% below Friday close) | 2.47% of weekends |
| P(gap < -5%) | 0.85% |
| P(gap < -7%) | 0.41% |
| P(gap < -10%) | 0.19% |
| expected payout of 5% cover | 2.85bp of notional per weekend (3.3bp over 2005-2026) |
| excess kurtosis of weekend gaps | 198 (single names 221, ETFs 63) |
| weekend variance / full trading-day variance | 0.19 to 0.69 by ticker (median 0.34); the 0.2 index prior holds only for the calmest names |

A 5% weekend put on a diversified name costs about **4-6bp charged** (fair 3.7bp plus a 50% load). SPY holders pay the 1bp floor most weekends. COIN and MSTR holders pay 25-30bp. That is the price list, and it is cheap enough for a one-button Friday product on most names and too expensive to be a weekly habit on meme names, which is correct.

## 2. Textbook pricing is wrong in both directions; the pooled vol-scaled engine (v4) is the one to ship

Out of sample, 5% barrier, 2005-2026, loss ratio = payouts / premiums charged (target 0.67 with a 50% load):

| engine | fair quote (bp) | loss ratio | Keeper Sharpe | loss ratio, calmest 20% | loss ratio, wildest 20% |
|---|---|---|---|---|---|
| v1a Black-Scholes, calendar clock | 23.2 | 0.10 | 5.0 | 0.02 | 0.10 |
| v1b Black-Scholes, trading clock | 9.8 | 0.22 | 2.7 | 0.03 | 0.21 |
| v2 own-history empirical | 2.5 | 0.83 | 0.20 | 0.02 | **1.46** |
| v3 EVT / GPD tail | 2.9 | 0.73 | 0.34 | 0.02 | **1.26** |
| **v4 pooled vol-scaled** | 3.7 | **0.57** | **0.68** | 0.03 | 0.58 |

- Black-Scholes with trailing realised vol over-charges 3-10x on average (nobody buys) and is not level across regimes. backtest-v1's "15x under-priced" was a fixed-vol, calm-regime statement; the general statement is **mis-calibrated by regime**.
- v2 and v3 look fine on average and then pay out 1.3-1.5x their premium in the wildest vol quintile: a per-ticker history does not know that vol just tripled. A pool priced with them is fine for years and then eats 2015, 2020 and 2024 (annual loss ratios 2.3, 1.8, 0.7).
- v4 conditions on today's vol and borrows the tail shape across 50 names. Its loss ratio is level (0.54-0.67) from the second-calmest quintile to the wildest, calibration by decile is close to the diagonal, and it never quotes zero. It over-charges the very top decile (predicts 26bp, realises 20bp), which is the right side to err on.
- The 1bp floor binds in the calmest 60% of ticker-weekends. Those weekends' realised payout is 0.03bp per bp charged, so the floor is pure margin and pays for the DX, not for risk.

## 3. Hermee (the Sleeper): the cover is worth it on volatile single names, marginal on indices

Twelve holding scenarios, fixed share count, cover bought every weekend at v4's quote, settlement at Monday open, 5% barrier. She refuses any weekend quote above 2% of her holding (14 GameStop weekends in early 2021).

| scenario | paid | received | net cost per year | worst weekend, bare | worst weekend, covered | worth it to a risk-averse holder (CRRA 4) | Peace-of-Mind Index |
|---|---|---|---|---|---|---|---|
| H1 $100k NVDA 2024-26 | $24.3k | $46.2k | **-3.1%** (she is paid) | -$36.3k | -$14.7k | yes | 48 |
| H2 $100k AAPL 2015-17 | $2.0k | $5.2k | -1.0% | -$10.1k | -$4.9k | yes | 32 |
| H3 $100k SPY 2019-21 | $3.4k | $8.9k | -1.5% | -$11.4k | -$6.0k | yes | 34 |
| H4 $50k COIN 2021-26 | $15.8k | $9.6k | +3.9% | -$6.2k | -$2.2k | yes | 51 |
| H5 $50k TSLA 2020-26 | $161k | $87k | +3.3% | -$40.8k | -$35.1k | yes (barely) | 45 |
| H6 $100k QQQ 2007-09 | $2.2k | $0.6k | +0.8% | -$5.8k | -$5.2k | no | 4 |
| H7 $50k ZM 2020-21 | $34.4k | $41.1k | -1.7% | -$49.9k | -$18.9k | yes | 44 |
| H8 $100k GLD 2012-13 | $1.0k | $0.5k | +0.3% | -$5.1k | -$4.6k | no | 6 |
| H9 $50k MSTR 2024-26 | $72.8k | $58.1k | +2.8% | -$31.4k | -$14.4k | yes | 58 |
| H10 $25k GME 2020-21 | $148k | $0 | +14% | -$123k | -$123k (priced out that weekend) | no | 0 |
| H11 $100k SPY 2005-26 | $40.8k | $25.5k | +0.24% | -$32.1k | -$26.1k | no | 10 |
| H12 $50k SMCI 2023-26 | $166k | $76k | +10% | -$52.8k | -$31.6k | no | 45 |

Reading: on names whose tail is genuinely fat relative to their vol (NVDA, AAPL, SPY through COVID, ZM, MSTR, COIN) a gamma-4 holder is better off insured *after* the 50% load, and her worst Monday is cut by half to two thirds. On calm ETFs in calm periods (QQQ 2007-09 had exactly one breach, GLD one) it is a small tax for little relief. On extreme-vol names (SMCI, GME) v4 prices her out, which is the engine doing its job. The "peace of mind" number that matters is the worst-weekend column: **-$36k becomes -$15k, -$50k becomes -$19k.** The 5% floor is the product.

## 4. Kip (the Keeper): 7-10% a year on capital, with one weekend that takes 62% of it

Diversified book, $10M covered across all 50 names equal-weight, capital 10% ($1M), v4 pricing, 4% idle yield:

| | 2005-2026 | Jan 2015 - Sep 2026 |
|---|---|---|
| return on capital, annualised | 7.3% | 10.0% (equity $1.0M to $3.07M) |
| weekly Sharpe, annualised | 0.90 | - |
| loss ratio | 0.57 | 0.65 |
| weekends losing money | 6% | 8% |
| worst weekend | 13 Mar 2020: -62% of capital | same |
| max drawdown from peak | -32% | -63% |
| in-sample ruin | never | never |

Bootstrap (20,000 block-resampled 52-week paths) one-year ruin probability at the 10% on-chain floor: **diversified 0.4%, ETFs-only 0.1%, single names 0.9%, the 15 Binance-spot bStocks 1.4%, crypto/meme beta 2.4%, NVDA-only 4.6%.** Capital ratio needed for <= 1%: 10% for diversified or ETF books, 15% for a bStock-only or crypto-beta book, 20% for a single name. Median one-year return on capital at 10%: +20% diversified, +35% crypto beta, +23% NVDA-only (with a 5th percentile of -80%).

Kip's honest pitch: a short-tail-risk book that earns 3-4x its payouts in most years and hands back a year or two of income in one weekend every five years. The Sharpe of 0.9 is real out of sample. The 10% floor is the minimum, not the target; concentration caps are not optional (section 5 of the risk memo).

## 5. Famous weekends: 99 event-ticker cases, 43 breaches

Full cards in `results/30_famous_weekends.md`; every case priced with v4 fitted on data before the event.

- **Crashes that paid**: Fed Sunday cut (13 Mar 2020: SPY -10.4%, AAPL -13%, TQQQ -28.8%), China Black Monday (AAPL -10.3%, NFLX -14.6%), yen carry unwind (NVDA -14.2%, COIN -20.8%, HOOD -17.8%), DeepSeek Monday (NVDA -12.5%, AVGO -12.8%), SVB (KRE -12.6%, SCHW -11.8%, WAL -73.9%), CPI + Celsius (COIN -21.3%, MSTR -26.6%), oil war (XOM -12.5%), Lehman, S&P downgrade, gold crash 2013. Across the 43 breach rows Hermee avoided **$382k of losses per $100k-position set**; Kip paid it.
- **Crashes that did not breach at the open**: Volmageddon (SPY -0.7% at the open, -4.2% at the close), Christmas Eve 2018, Brexit Monday, yuan-7 Monday, COVID-Italy for SPY. Open-settled cover pays nothing on an intraday crash: settlement basis is a product decision to make explicitly.
- **Rallies** (G7 rescue, EU bailout, curve-flattening, Pfizer Monday for airlines, GameStop, Roaring Kitty, smartphone exemption, AMD-OpenAI): 20 rows, premium wasted $8.7k in total, Hermee keeps every dollar of upside. Pfizer Monday shows the two-sided nature: BA +13.5%, AAL +25% and ZM -13.4% on the same open.
- **Scares that fizzled**: the October 2025 crypto liquidation weekend, where tokenized stocks traded at deep on-chain discounts all weekend, opened flat to up on Monday. Cover cost 12-14bp and paid nothing, and that is the weekend the buyer remembers as cheap.
- **Corporate actions**: AMC/APE (Aug 2022) prints a -37% "gap" that was a distribution. The reference-price feed must carry the RWA API `reasonCode`, and the contract must void or adjust on corporate actions.

## 6. What the bStock actually does while the NYSE is shut (165 token-weekends)

- The token discovers **95% of Monday's gap before the 13:30 UTC bell** (regression beta 0.95, r 0.96), but almost none of it by Sunday night (beta 0.02). Discovery happens in Monday pre-market, when US futures and pre-market prints exist. On Saturday and Sunday the token drifts on crypto sentiment, not on stock information.
- Thirty minutes before the open, the token is within 0.31% of the official Monday open on a median weekend and within 0.84% at the 90th percentile. That is the tracking error a Keeper who hedges in the token, or a Sleeper who sells it Sunday night, carries.
- Median weekend high-to-low range 3.0%; the weekend carries 21% of the week's quote volume; every weekend hour had trades. The book is thin but never empty.
- Product consequences: (a) settle on the official reference price at the bell, never on the token print, or the weekend book becomes the oracle; (b) the Keeper can lay off risk in Monday pre-market at ~0.3% slippage, which caps the tail somewhat above the 5% line but not below it; (c) a "sell the token Sunday" exit for Sleepers is inferior to the put, because the token has not yet moved on Sunday.

## 7. Claims from backtest-v1 that changed

| v1 claim | v2 finding |
|---|---|
| Black-Scholes under-prices the 5% tail 15x | Over-prices 3-10x on average with trailing vol; under-prices only in calm regimes with a fixed low vol. Mis-calibrated, not uniformly cheap. |
| Fair premium at 5% ~5bp, ~7.6bp loaded | 3.7bp fair, ~5.5bp charged, over 50 names; 1bp for SPY, 25-30bp for COIN/MSTR |
| Keeper Sharpe +0.36, in-sample | +0.68 per notional out of sample; 0.90 weekly on the capitalised diversified book |
| Capital >= 10% gives 1.6% ruin | 0.4% for a diversified book; 1.4-2.4% for the books people will actually build (bStocks-only, crypto beta); 4.6% single name |
| The overnight-drift leg does not hold | Over 2004-2026 closed-session drift is strongly positive (SPY +9.6%/yr closed vs +0.7%/yr open). Still not a pricing input and not in the pitch; it is a research artefact. |
| Weekend variance = 0.75 of a day (AAPL) | 0.2-0.7 across names; the point stands: weekends are far riskier than calendar time implies for single names |

## 8. What v3 must do

1. Earnings-calendar flag (refuse or widen cover in earnings weekends): the NVDA Jan 2019 and META/NFLX gaps cluster there.
2. Survivorship correction: today's tokenized list excludes SIVB, FRC, LEH, BBBY. The measured tail is a lower bound. Add a delisted-name sample.
3. Per-ticker concentration rule in the pool contract, parameterised from the ruin curves (single name <= 10% of covered notional; crypto-beta cluster <= 25%).
4. Ondo on-chain klines (the public kline endpoint returned two candles); repeat section 6 on Ondo to test the "mint window shut" drift hypothesis.
5. Live shadow-quoting on the 15 Binance bStocks every Friday and a record of realised loss ratio from now on.
