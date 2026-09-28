# Research 1 - Weekend gap risk in TradFi: is the need real, what do people do today?

*Compiled 26 Sep 2026 by a research agent (~40 searches). Evidence flagged where thin.*

## Executive answer

**The risk is real and well documented; retail demand for insuring it specifically is real but mostly latent, and the tokenized-stock case is the one place where no substitute exists at all.**

- **The hazard is concentrated in the closed session.** The best-known equity drawdowns of the last two years were Monday gaps: Nvidia -17% on Mon 27 Jan 2025 (DeepSeek, -11% to -14% premarket, $589bn erased, largest single-day cap loss in history); S&P futures limit-down and VIX 60.13 on Mon 7 Apr 2025 after the tariff weekend; S&P -3% and the largest VIX intraday spike on record on Mon 5 Aug 2024 (yen carry unwind). The literature (Cliff/Cooper/Gulen; Lou/Polk/Skouras; Boyarchenko et al.) shows essentially the whole equity premium and most of the variance is realised outside cash hours.
- **Retail overwhelmingly takes it on the chin.** The Bogousslavsky-Muravyev anatomy of $15bn of retail trades finds retail options are short-dated index *calls* with "almost no covered calls or protective puts" (the two together ~0.3% of option-trading accounts). Stop-losses are structurally useless against a gap (FINRA guidance).
- **Institutions pay for protection at scale, but at annual horizons, on indices, and off-chain.** Defined-outcome ETFs hold $78-80bn; RILAs sold $79.5bn in 2025; US structured notes issued ~$149bn (2024) to ~$225bn (2025). Costs run 0.69-0.79%/yr plus a forfeited upside cap, or ~1%/month of assets in a pure tail-hedge fund (Cambria TAIL).
- **No listed product isolates Friday-close-to-Monday-open.** The closest is a Monday-expiring SPX put bought Friday afternoon, which also carries the full Monday session; the option market prices a weekend at roughly half a trading session of variance and systematically over-charges for it (OptionMetrics: weekend puts earn ~two-thirds of a 1DTE put-write strategy's profit).
- **For a holder of tokenized NVDA on BNB Chain, every substitute breaks.** No listed puts settle against a token; on-chain equity options do not exist at scale; equity perps (Hyperliquid, Ostium) require margin, hourly funding and active management; weekend token liquidity is ~0.55% of volume with spreads 19-33x wider once cash markets close.
- **Scale.** Tokenized equities are ~$3.5bn market cap (BNB Chain ~$1bn), $15bn spot volume in Q1 2026, 125k+ xStocks holders, and the SEC's 17 Sept 2026 five-year Innovation Exemption just legitimised on-chain AMM trading of US stocks.

## 1. How retail handles weekend/overnight gap risk today: mostly, they don't

**Academic evidence that the risk lives overnight**
- Cooper, Cliff & Gulen (2008): the US equity premium over their sample "is solely due to overnight returns"; S&P 500 stock night returns 1993-2006 averaged +2.8 to +4.8 bp vs day returns of -2.9 to +0.2 bp. (https://papers.ssrn.com/sol3/papers.cfm?abstract_id=1004081)
- Lou, Polk & Skouras (JFE 2019), "A tug of war": across 14 strategies, profits accrue either entirely overnight or entirely intraday, with opposite signs. (https://personal.lse.ac.uk/polk/research/TugOfWar.pdf)
- Boyarchenko, Larsen & Whelan (NY Fed SR 917, RFS 2023): 1998-2020 the 2-3 a.m. ET window alone earned ~3.7%/yr. Their July 2026 update finds that drift has "averaged close to zero since 2021": the overnight *premium* faded but the overnight *variance* has not. (https://www.newyorkfed.org/research/staff_reports/sr917 ; https://libertystreeteconomics.newyorkfed.org/2026/07/the-disappearing-overnight-drift/)
- French (1980): Monday returns span three calendar days yet the variance is far below 3x a weekday: weekend risk is priced in "trading time", not calendar time. (https://www-2.rotman.utoronto.ca/~kan/3032/pdf/AssetPricingAnomalies/French_JFE_1980.pdf)

**Retail behaviour**
- Bogousslavsky & Muravyev, "An Anatomy of Retail Option Trading" (5,182 traders, 2.4m trades, 2020-22): "a typical retail trade is the purchase of a one-day S&P 500 index call held for an hour"; trades are "dominated by short-term purchases with almost no covered calls or protective puts." (https://papers.ssrn.com/sol3/papers.cfm?abstract_id=4682388)
- Stop orders: FINRA warns that on a gap the stop "executes at the first available trade price." (https://www.finra.org/rules-guidance/notices/16-19)
- Retail share of US options volume is ~50-60%; 2025 total volume 15.2bn contracts (+26%), 0DTE = 59% of SPX volume. Adoption is huge; protective usage is a rounding error. (https://www.cboe.com/insights/posts/the-state-of-the-options-industry-2025)
- **Counter-trend, 2026:** Vanda Research (Aug 2026) reports retail put buying on the top 12 retail names (NVDA, MU, QQQ...) rose from 26% to 110% of net cash buying between Q1 and mid-April-Aug 2026: the first hard evidence of a structural shift to retail hedging. (https://finance.biggo.com/news/c39ebb11-81da-4d80-9a1d-4532a0741bed ; https://www.cnbc.com/2026/08/19/retail-investors-stick-with-ai-trade-but-appear-more-cautious.html)

**Monday gap events (the demand triggers)**

| Date (Mon) | Event | Gap |
|---|---|---|
| 19 Oct 1987 | Black Monday | Dow -22.6% |
| 16 Mar 2020 | COVID | Dow -12.9%, S&P -12% |
| 5 Aug 2024 | Yen carry unwind | Nikkei -12%, S&P -3%, record VIX intraday spike |
| 27 Jan 2025 | DeepSeek | NVDA -11 to -14% premarket, -17% close, -$589bn |
| 7 Apr 2025 | Tariff weekend | Russell futures limit-down overnight, VIX 60.13 |

## 2. How institutions handle it

- **Defined-outcome / buffer ETFs:** $78bn across 420 ETFs at end-2025 (Morningstar), ~$80bn by March 2026; Innovator alone ran 87 S&P-linked series and was bought by Goldman Sachs (Dec 2025). 100%-protected series: Innovator ZAUG 0.79% fee, 8.82% 12-month cap; Calamos CPSA 0.69% fee, 8.74% cap. Morningstar's critique: even with full protection investors "end the year down the better part of a percentage point after fees," plus forfeited upside. (https://www.morningstar.com/funds/how-largest-buffer-etf-providers-stack-up ; https://www.etf.com/sections/news/innovator-calamos-add-100-protection-etfs)
- **RILAs (insurer-wrapped buffers):** $79.5bn sales in 2025 (+20%, 11th straight record). The insurance industry already sells equity-gap protection, at 1-6-year horizons. (https://www.limra.com/en/newsroom/news-releases/2026/limra-final-u.s.-retail-annuity-sales-set-new-sales-high-totaling-$464.1-billion-in-2025/)
- **Structured / principal-protected notes:** record $149.4bn US issuance 2024 (+46%); ~$225bn 2025. Dealers explicitly price "gap risk" on barrier products and trade gap options among themselves. (https://www.structuredretailproducts.com/insights/81380/us-market-review-june-2025-scotiabank-advances ; https://www.risk.net/journal-computational-finance/2160359/pricing-and-hedging-gap-risk)
- **Tail-risk funds:** Cambria TAIL, $106m AUM, spends ~1% of assets per month on S&P puts. Universa ~$20bn RAUM. Nearly 80% of RIAs report using protective puts. (https://cambriafunds.com/assets/docs/Cambria_Tail_FAQ.pdf ; https://www.financialplanningassociation.org/article/journal/JAN21-hedging-options)
- **Margin practice (thin evidence):** Saxo and Interactive Brokers raised margins ahead of the Nov 2024 election weekend (IB by ~35%); clearing-house models size margin to a multi-day close-out horizon rather than a weekend-specific add-on. (https://www.financemagnates.com/forex/brokers/breaking-saxo-bank-raises-margin-requirements-us-election/)

## 3. Does anything price or transfer *weekend* risk specifically?

- **NightShares (NSPY/NIWM):** the only pure overnight-exposure product; launched June 2022, liquidated Aug 2023 after -6.9% vs S&P +22%. Lesson: nobody wanted to *own* the overnight; the unmet need is to *shed* it. (https://www.etf.com/sections/news/2-nightshares-etfs-close-after-struggling-gain-traction)
- **Monday-expiring SPX Weeklys.** The market prices a weekend as ~0.5 trading session of variance, and "weekend decay is priced in by Thursday/Friday." (https://www.cboe.com/tradable_products/sp_500/spx_weekly_options/specifications/ ; https://dn12448583.substack.com/p/the-weekend-theta-myth)
- **Implied vs realised weekend variance:** OptionMetrics (Mar 2018-Sep 2025): ATM SPX puts sold Friday/expiring Monday returned 7.3 bp mean per weekend, with the worst skew of any weekday; removing Mondays cuts a 1DTE put-write strategy's cumulative return by ~68%. Papagelis & Dotsis (2025): variance-swap returns over non-trading periods are "significantly negative." **The option market charges a fat, persistent premium for the weekend; that is the margin an insurer can underwrite.** (https://optionmetrics.com/blog/selling-saturdays-weekend-risk-premia-in-1dte-put-write-strategies/)
- **Back-of-envelope (agent estimate):** with SPX IV ~15% an ATM Friday-to-Monday-open put is worth ~0.25-0.3% of notional; a 3% OTM put is ~0. For NVDA at ~50% IV, a 5% OTM weekend put ~0.1-0.2% of notional. (Our v4 quote for NVDA is in that range.)
- **Overnight venues shrink but do not remove the weekend:** Blue Ocean ATS ~83% of overnight volume; Robinhood 24 Hour Market Sun 8pm-Fri 8pm; Nasdaq and NYSE Arca target **6 Dec 2026** for 23/5 sessions; 24X approved first. **All stop Friday evening and reopen Sunday evening: a ~48-hour hole remains.** (https://www.marketsmedia.com/nasdaq-aims-to-debut-23-5-trading-on-6-december-2026/ ; https://www.jonesday.com/en/insights/2026/09/nyse-and-nasdaq-move-to-23hour-trading-day-overnight-session-is-an-evolution-but-not-yet-a-revolution)
- **CME:** 24/7 launched 29 May 2026 for crypto futures only; equity index futures still close Fri 5pm-Sun 6pm ET.

## 4. Insurance analogies and regulatory framing

- **Parametric insurance vs derivative:** the same trigger can be papered as insurance (insurable interest + proof of loss) or a derivative (pays regardless of loss). A "Monday-open >= X% below Friday close" trigger with payout capped at the holder's token position is the textbook hybrid parametric: index trigger, indemnity cap. (https://www.iais.org/uploads/2024/12/FSI-IAIS-Insights-on-parametric-insurance.pdf ; https://corporatesolutions.swissre.com/insights/knowledge/10_myths_about_parametric_insurance.html)
- **Event contracts:** Kalshi lists daily index range markets; binary, index-level, not indemnifying. Non-sports prediction volume hit $10bn/week in Sept 2026.
- **DeFi cover:** Nexus Mutual covers protocol risk, not price risk.
- **Regulatory tailwind:** SEC Innovation Exemption (17 Sept 2026, five years) exempts permissioned Tokenized Securities Venues / AMM LPs from exchange and dealer registration for tokenized NMS stock. (https://www.sec.gov/newsroom/press-releases/2026-90-sec-issues-innovation-exemption-facilitate-trading-tokenized-nms-stock-request-comment)

## 5. Demand signals (honest)

- **Hard:** April 2025 options volume record 101m contracts (4 Apr); $160bn S&P ETF volume on Mon 7 Apr; retail net put premium >$275m in a 5-day window around Liberation Day. Vanda 2026 put-buying shift (26% to 110% of net cash buying).
- **Weak/absent:** no Google Trends series retrievable; nothing quantifies retail behaviour around earnings weekends; Kalshi does not break out index-market volume.

## 6. The tokenized-NVDA-on-BNB-Chain holder: substitutes and why they fail

Context: tokenized equities ~$3.5bn market cap (BNB Chain ~$1bn), $15.1bn spot volume Q1 2026, xStocks >125k holders; Ondo Global Markets >$1bn TVL. Weekends were 0.55% of Ondo volume; off-hours spreads 19x (post-close) to 33x (pre-open) daytime; a market maker "quoting tokenized Nvidia at 11pm Saturday has no open cash market to hedge into"; Chainlink equity feeds are 24/5 so weekend oracles are stale by design. (https://coincub.com/blog/24-7-tokenized-asset-trading/ ; https://paragraph.com/@themechanismnote/the-weekend-price-problem-in-tokenized-stocks)

| Alternative | Who uses it | Cost | Solves weekend gap for a tokenized-stock holder? |
|---|---|---|---|
| Listed NVDA/SPX put, Mon expiry | Institutions, RIAs, <1% of retail | ~0.1-0.3% notional per weekend (est.) | **No**: needs a US brokerage account, 100-share lots; cannot settle against the token |
| Buffer / 100%-protected ETF | Advisors, $78-80bn | 0.69-0.79%/yr + 8-9% upside cap | **No**: index-level, annual, off-chain |
| RILA / structured note | $80bn / $225bn per yr | Embedded, multi-year | **No**: illiquid, not per-position |
| Tail-risk fund | Institutions | ~1% of assets/month | **No**: continuous drag, index-level |
| Stop-loss / sell Friday, rebuy Monday | Retail default | Zero premium, gap executes at open | **No**: the gap is what a stop cannot catch |
| Short equity perp (Hyperliquid, Ostium) | Crypto-native traders | Hourly funding, margin, liquidation | **Partly**: hedges 24/7 but drifts on weekends, needs collateral and management |
| Sell token on-chain Friday | Anyone | 19-33x wider spreads off-hours | **No**: gives up exposure at the widest spread of the week |
| Kalshi index range contract | US retail | Binary, index-only | **No** |
| 24/5 venues | Everyone | Wider spreads | **No**: all closed Fri evening to Sun evening |
| **Weekend gap cover (afterhours.fi)** | Token holders | Small Friday premium | **Yes by design**: on-chain, per-position, settles to the Friday-close to Monday-open print |

## Five quotable facts

1. "Nvidia lost $589 billion on Monday 27 January 2025, the biggest one-day loss in market history, and the entire move was a gap between Friday's close and Monday's open."
2. "A $15 billion sample of retail trading found 'almost no covered calls or protective puts.' Retail owns the risk and does not hedge it."
3. "Weekend puts account for nearly two-thirds of the profit in a 1DTE SPX put-write strategy: the option market charges a persistent premium for the weekend that realised gaps rarely consume."
4. "TradFi already pays for gap protection: $78bn in buffer ETFs, $79.5bn of RILAs sold in 2025, ~$225bn of structured notes, all annual, all index-level, none of it on-chain."
5. "Tokenized stocks trade 24/7 but price-discover 24/5: weekends are 0.55% of volume, spreads widen 19-33x, and a market maker quoting tokenized Nvidia on a Saturday night has no market to hedge into."

**Caveats:** the overnight return premium has faded since 2021 (NY Fed), so the case rests on variance and tail events, not drift; weekend implied variance already over-prices realised, so an insurer must price at or below listed-put equivalents to win, yet that over-pricing is the underwriting margin; retail demand for specific weekend cover is inferred from crisis-week put surges rather than surveys; the on-chain addressable base is a few billion dollars today.

## Additional sources
https://www.theblock.co/news/defi/2026-07-13-hyperliquid-hip-3-markets-surge-50-perp-volume-onchain-stock-trading-grows-408064 ; https://www.coindesk.com/markets/2026/05/19/a-defi-exchange-becomes-the-first-to-offer-equity-perpetuals-powered-by-nasdaq-data ; https://www.theblock.co/news/business/2026-07-01-robinhood-chain-goes-live-mainnet-alongside-24-7-tokenized-stocks-lighter-perps-planned-crypto-agentic-trading-406918 ; https://cryptorank.io/insights/analytics/rwa-crypto-market-2026-tokenized-stocks-rwa-perps-and-on-chain-finance ; https://www.cboe.com/insights/posts/index-insights-april/ ; https://citadelsecurities.com/news-and-insights/april-update ; https://www.cmegroup.com/media-room/press-releases/2026/6/01/cme_group_announceslaunchof247cryptocurrencyfuturesandoptionstra.html ; https://www.cftc.gov/sites/default/files/filings/orgrules/24/11/rules1113248701.pdf
