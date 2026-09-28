# afterhours.fi - risk memorandum (pre-investment, backtest v2)

Prepared as a diligence memo on the Keeper pool: a shared USDT vault that sells 5%-barrier weekend cover on tokenized US equities (bStocks, Ondo) on BSC, priced by the v4 pooled vol-scaled engine, settling at the Monday-open reference price. Numbers reference `results/` and `CONCLUSIONS.md`.

## 1. Catastrophe (tail) risk - severity HIGH, mitigable, not removable
The pool is short a portfolio of deep out-of-the-money weekend puts. Its P&L is many small positive weeks and rare large negative ones (weekly P&L histogram is one-sided). Correlation across names goes to one on exactly the weekends that matter: on 13 Mar 2020, 43 of 43 covered names were underwater and the equal-weight book paid 650bp of covered notional against 32bp of premium, **62% of a 10% capital buffer in one settlement**. 6 Mar 2020 cost 30%, 2 Aug 2024 29%, 21 Aug 2015 19%. Four weekends in 22 years each cost more than 10% of capital; that is the base rate.
Mitigants: capital floor (10% minimum, enforced on-chain); v4's vol conditioning raised the book premium 3-15x going into 2008, 2020 and 2022 (the pool was collecting 13-32bp when the hits came, not 3bp); per-weekend payout cap per ticker (cover is "made whole to the barrier", a second barrier at -25% would have capped TQQQ/MSTR/AMC/WAL payouts).
Residual: a 1987-scale (-20%) index weekend would cost ~150% of a 10% buffer on any equity book. The pool must be allowed to fail gracefully (pro-rata payouts, no socialised debt).

## 2. Concentration risk - severity HIGH, fully controllable
Single-name books are uninsurable at 10% capital: NVDA-only has 4.6% one-year ruin and a -97%-of-capital weekend (Jan 2019). The 15 Binance-spot bStocks as a book need 15% capital for <= 1% ruin; a crypto-beta book (COIN, MSTR, HOOD, GME, AMC, PLTR, TSLA, levered ETFs) needs 15% and shows 19 weekends of >10% capital loss. The WAL case (SVB weekend, -73.9% at the open on a 27bp premium) shows what one regional bank does to a book.
Requirement: per-ticker cap (<= 10% of covered notional), cluster cap for crypto-beta and levered ETFs (<= 25% together), capital ratio that scales with book concentration (e.g. 10% x (1 + 5 x HHI)), and refusal of cover above a vol threshold (v4 quotes > 2% of notional are a natural cut-off; Hermee refuses them too).

## 3. Model risk - severity MEDIUM
- v4 assumes one standardised tail shape across names. The 1% z-quantile per ticker ranges -1.4 to -2.7 around a pooled -1.9; the dispersion is moderate, and v4's decile calibration is close to the diagonal, but a ticker-specific loading for the widest names (SOXS, AMC, MSTR) is warranted.
- v4 uses trailing 20-day realised vol as the sufficient statistic. It over-charges the top decile (26bp predicted, 20bp realised) and, by construction, cannot see a vol spike that begins on the Friday afternoon it is quoting.
- The own-history engines (v2, v3) are the ones a reasonable team would have shipped and they fail out of sample in the wildest quintile (loss ratio 1.3-1.5). Keep them in the repo as the control group; do not ship them.
- Annual refit is conservative; monthly refit should be tested for whether it improves or destabilises quotes.

## 4. Adverse selection and informed buying - severity MEDIUM
Buyers choose when to buy. Anyone who knows an earnings date, an FDA date or a court date buys cover that weekend; v4 does not know the calendar. Evidence of clustering is anecdotal in this data (NVDA Jan 2019, META, NFLX) and a formal test needs an earnings-date history. The token itself does not leak weekend information (Sunday-night beta to the Monday gap is 0.02), so there is no on-chain signal a Sleeper can exploit on Saturday; the exposure is to Friday-afternoon buyers with private information and to Sunday-news buyers if the sale window stays open past Friday close.
Requirement: sales close at the Friday bell (batch auction as in the spec); earnings-week surcharge or refusal; utilisation-based repricing so a surge in demand on one name raises its quote.

## 5. Settlement-basis risk - severity MEDIUM, a design choice
Open-settled cover paid nothing on Volmageddon (SPY -0.7% at the open, -4.2% at the close) and on Christmas Eve 2018; close-settled cover would have. Conversely close settlement exposes the pool to a full Monday session of price discovery. The official Monday-open reference price is the cleaner oracle (single print, exchange-published). The choice must be explicit in the product name ("Monday-open cover") because the buyer's mental model is "Monday".
Corporate actions: AMC/APE (Aug 2022) and reverse splits produce "gaps" that are not losses. The contract must consume the RWA API `statusInfo.reasonCode` and void or adjust on corporate-action codes. Our own data feed contained one unadjusted reverse split (SOXS, May 2026) that would have been a 94% payout.

## 6. Oracle and token-price risk - severity MEDIUM
Never settle on the token print. The bStock trades within 0.31% of the Monday open (median) but 0.84% at the 90th percentile thirty minutes before the bell, and weekend volume is ~21% of the week's, so a weekend book is manipulable for far less than a pool payout. Settle on the exchange reference price at the bell via the RWA API; hold the payout until the reference is published.

## 7. Liquidity and execution risk - severity LOW for the pool, MEDIUM for users
Payouts are USDT from the vault; no market execution is needed to settle. Keeper hedging in the token in Monday pre-market is feasible at ~0.3% tracking error (section 6 of conclusions), which helps above the barrier and not below. Sleepers who want to exit on Sunday face a thin book that has not yet priced the news; the put is the better instrument, which is the product's point.

## 8. Wrapper and peg risk - severity LOW-MEDIUM
bStocks have free 1:1 conversion 24/7 and the spot token tracked the underlying to within tens of bp in the sample. Ondo's mint/redeem window and BSC-only liquidity mean the Ondo token can drift for 48 hours; the public kline endpoint did not return history so this is untested. Reference price, not token price, drives settlement, so peg drift is a user-experience issue rather than a solvency one, unless collateral is held in tokens (it should be USDT).

## 9. Data and survivorship risk - severity MEDIUM (understates everything above)
The universe is today's tokenized list, i.e. survivors. SIVB (-60% weekend), FRC, LEH, BBBY are not in it; proxies (WAL, KRE, SCHW, BAC, C) were used for the SVB case. Yahoo adjusted data has known corporate-action gaps. Both biases understate the tail. Treat every payout estimate as a floor; the 50% load and 10% capital floor are the buffer against it.

## 10. Regulatory and venue risk - severity HIGH for the hackathon, unquantified
Weekend cover is economically a put. The track rules say spot only. Structuring options are in the spec (prepay of two spot legs; pure rotation vault). Not a backtest question, but it gates whether the Keeper pool can exist as designed.

## 11. Capital adequacy recommendation
| book | minimum capital / covered notional | expected return on capital (median, 1y) | 1-y ruin |
|---|---|---|---|
| diversified >= 30 names, single name <= 10% | 10% | +20% | 0.4% |
| ETFs only | 10% | +17% | 0.1% |
| bStocks on Binance spot (15 names) | 15% | +14% | 0.2% |
| crypto / meme beta cluster | 15% (and cluster cap) | +25% | 0.3% |
| any single name | 20% | +13% | 0.3% |

Recommendation: proceed with the diversified or ETF-anchored pool at a 10% floor, hard per-ticker and cluster caps, v4 pricing with a 50% load and a 1bp floor, refusal above a 2%-of-notional quote, sales closing at the Friday bell, Monday-open reference-price settlement, and a payout cap per ticker per weekend. Publish the realised loss ratio every Monday; the loss ratio is the product's credibility.
