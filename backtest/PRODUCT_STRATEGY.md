# afterhours.fi - product strategy for BNB Hack: Tokenized Stocks Edition

Submission locks Sun 11 Oct 2026 12:00 UTC (15 days). Judging: technical 30, creativity 25, DX report 25, product/UX 20; two $2k specials (Agentic Wallet / Wallet Skills, BNB Agent Studio). This document turns the backtest (`CONCLUSIONS.md`, `results/70_structures.md`), the research pack (`research/`, `MARKET_RESEARCH.md`) and the hackathon rules into one build plan.

## 1. The product in one paragraph

**Weekend Floor.** Friday before the bell, a holder of a tokenized US stock on BSC (bStock or Ondo) taps once and sets a floor under the weekend: "if Monday opens more than X% below Friday's close, I am made whole to that line." The premium is a few basis points, quoted by an empirical engine from twenty years of Monday gaps and today's volatility. On the other side, a Keeper vault of USDT underwrites every floor, earns the premiums plus lending yield on idle capital, and is itself principal-protected by CPPI sizing: it never sells more cover than ten times its cushion above a hard floor. Settlement is automatic at the first Monday-open reference print. Nothing is levered, nothing is shorted, every policy is fully collateralised in the vault before it is sold.

## 2. What the simulations say the optimal structure is

### For the holder (Hermee)

The certainty-equivalent test (CRRA gamma 4, 2005-2026, every ticker-weekend) picks different shapes per asset class:

| holder of | structure that is worth it after the 50% load | cost per year | worst weekend, bare to covered |
|---|---|---|---|
| index ETF (SPY, QQQ) | 3% barrier (a 5% barrier is too loose to justify the floor premium) | ~0.9% | -11.5% to -3.6% |
| mega cap (AAPL, NVDA, MSFT) | 3% barrier or 3-18% spread; or a fixed 10-25bp weekly budget | 1.5-2.5% | -18% to -4% |
| high beta (TSLA, COIN, MSTR, PLTR) | fixed weekly budget (5bp) that floats the floor; fixed barriers are too expensive to be worth it | ~1.3% | -37% (priced out on the very worst names) |

The one structure that is certainty-equivalent-positive in every group is **"constant premium, floating floor"**: the holder picks a weekly budget (or accepts a default of 5-10bp), and the engine buys the tightest barrier it affords that Friday. In calm weeks that is a 3% floor; in wild weeks a 7-10% floor. It also makes the UX honest: the number the user chooses is what they pay, and the number the engine shows is what they get.

**Yield-funded ("free") protection.** A sleeve of USDY next to the stock funds the floor from its yield only when T-bill rates are above ~3%: a 20% sleeve fully funded cover in 33% of weekends since 2005, ~0% in 2009-2016, most weekends since 2023. Ship it as an option ("let my yield buy my floor"), not as the headline. Today, at 4.07% bills, a 20% USDY sleeve buys a 3% floor on SPY, 5% on Nvidia.

### For the Keeper (Kip)

| structure | what it does | verdict |
|---|---|---|
| Static pool, 10% capital | 7-10%/yr on capital, Sharpe 0.9, 0.4% one-year ruin, but 13 Mar 2020 cost 62% of capital in one settlement | baseline; survives but frightens |
| Capital in T-bills / Venus | +4 points of return today, nothing in a zero-rate decade | do it, do not depend on it |
| Payout cap 20% per ticker | bounds single-name blow-ups (WAL -74%), does nothing for systemic weekends (loss ratio unchanged) | keep as a concentration tool |
| Static junior/senior tranches | senior impaired in ~4% of bootstrap years at every split, because a 2020-type year exceeds any junior slice; tranching redistributes, it does not remove | not sufficient alone |
| **CPPI sizing: covered notional = 10 x (equity - floor), floor = 50% of capital** | floor held from every start date including 3 Jan 2020 (min equity 0.63x vs 0.26x static) and in all 20,000 bootstrap years; median +11%/yr | **the Keeper structure** |
| CPPI + tranches | with CPPI the floor is never breached, so a senior tranche equal to the floor is safe by construction; junior = cushion | the institutional Keeper product |

**Optimal joint design:** v4 pricing with a 50% load and 1bp floor; holder chooses a weekly budget; Keeper vault sized by CPPI (m = 10, floor 50%) with the floor sold as a senior share earning T-bill + spread and the cushion as a junior share earning the residual; per-ticker cap 10% of covered notional, crypto-beta cluster cap 25%, payout cap 20% per ticker per weekend; utilisation multiplier on quotes (Nexus-style bump and decay) instead of refusal when the cushion shrinks. Both parties are better off under this design in the simulations: the holder's certainty equivalent rises on every volatile name and their worst weekend halves; the Keeper's junior earns a median 20-30% a year at 10% capital while the senior has never been touched in 22 years of data or 20,000 simulated years.

## 3. Why this wins each judging criterion

**Technical (30%).** Three verified contracts on BSC mainnet: `CoverMarket` (Friday batch, per-share policies keyed on `sharesMultiplier`), `KeeperVault` (ERC-4626, CPPI sizing, junior/senior shares, caps), `SettlementOracle` (first non-null underlying print at or after `nextOpenTime`, grace fallback, void on corporate-action `reasonCode`). Integrations: RWA Data API for reference price, market status and `nextOpenTime`; Trading API RFQ for the holder's spot purchase and for Keeper rebalances (EIP-712 signing via the Agentic Wallet); Transaction API simulate before every broadcast; DeFi API deposit of idle USDT into Venus; Wallet API for positions; b402 for premium collection. A fuzz test that payout can never exceed locked collateral. Real mainnet tx hashes in the README.

**Creativity (25%).** The only weekend-cover product on BSC, and the only one anywhere priced empirically rather than by Black-Scholes (AfterHours on Arbitrum is the honest comparison and should be cited). The Keeper is itself principal-protected by CPPI, which no DeFi insurance pool has done. The agent underwrites and settles real risk, not reports. The backtest itself (61,815 ticker-weekends, four engines, famous-weekend cards) ships in the repo as evidence.

**DX report (25%).** Start `DX_LOG.md` today with timestamps. Already logged from this session: the public kline endpoint returns two candles at `limit=300`; `stockInfo.price` is null off-hours; the RWA list `type` parameter returns Ondo, xStocks and bStocks despite docs saying Ondo only; the signed RWA endpoints have no Markdown reference pages; the platformId enum excludes xStocks. To log during the build: the `/build` prefix in `X-OC-SIGN`, error 40102, 40367/40369 market-hours windows on RFQ, RFQ versus SWAP behaviour Friday night versus Saturday, the 5 QPS DeFi API cap, cloud-IP blocking, `MARKET_PAUSED` session transitions, corporate-action `reasonMsg` values, and a bStocks-versus-Ondo-versus-xStocks comparison table of weekend spread, depth and reference-price staleness measured from our own calls. Requested capabilities: an xStocks platformId, historical klines with pagination, a Monday-open reference-print endpoint, an earnings-date field on `underlying-profile`, USDY in the DeFi API.

**Product and UX (20%).** One screen, three numbers. The world-clock spec stays, sobered by the research: no confetti, no leaderboard, no red/green pulse. Protection streaks ("41 weekends protected") not trading streaks. Rebate framing ("Monday cash-back if it gaps") over deductible framing. A Monday-morning receipt ("your floor held / your floor paid $412"). An estimated-value line on every quote (fair premium, load, what the engine expects to pay back). Surplus giveback to a public backstop, visibly. Institutions get the same screen with a policy-size field, the CSV of the backtest and the senior-share deposit.

**Agentic Wallet special ($2k).** A first-party `weekend-cover` skill in the repo (and a PR to binance-skills-hub). Holder flow entirely through skills: resolve the ticker with `binance-tokenized-securities-info`, check `reasonCode` and `nextOpenTime`, quote, `baw contract-call preview/execute` to bind, or `baw x402-payment` to pay the premium via b402; Monday, read settlement and claim. Keeper flow: `baw market-order quote` to prove liquidity, `baw defi deposit` idle USDT to Venus, `baw approvals revoke` hygiene. Show the Binance-App confirmation in the video rather than hide it.

**Agent Studio special ($2k).** A persistent "Weekend Risk Agent": ERC-8004 identity on BSC, free MCP tools (`quote_cover`, `gap_history`, `market_status`), a paid x402 `bind_cover` that returns a signed quote and settles the premium through b402, an ERC-8183 job "monitor and settle my policy" whose evaluator is the settlement contract, and Sleeper feedback on the Reputation Registry after payout. Same code on the 48-hour testnet trial for judges and on AgentCore for the mainnet demo.

## 4. Rules and risks to close in week one

1. **"Spot only, perps out."** A weekend floor is economically a put. Framing: fully collateralised cover attached to a spot position, no leverage, no short, the Keeper vault is a spot USDT vault. Ask in the builder Telegram this week and screenshot the answer into the DX report. Fallback if refused: the pure-rotation vault (Friday sell to USDT via RFQ, Monday rebuy, both legs spot) with the same UX and the same engine choosing when it is worth rotating.
2. **Settlement definition.** First non-null `stockInfo.price` at or after `nextOpenTime` (the official opening auction), `sharesMultiplier` re-read at settle, per-share payoff, void or adjust on `ASSET_PAUSED` with a corporate-action `reasonMsg`, and an outlier filter against the Friday close. Never settle on the token print (our data: 0.84% deviation from the official open at the 90th percentile thirty minutes before the bell, in a book carrying 21% of weekly volume). The literature (Stoll-Whaley; Amihud-Mendelson; Berkman et al.) says the raw opening print is noisy, so disclose that protection is exact only at that print and test a first-15-minute VWAP as the v3 alternative (`LITERATURE.md`).
2b. **Sale window closes at the Friday bell, hard.** Pre-market and Sunday-night futures discover most of the gap before the token moves (Perreten 2026; Bondarenko-Muravyev 2023; our 60_token results). Anyone buying after Friday close is buying with information: batch auction before 16:00 ET, nothing after.
2c. **Earnings weekends** are jumps, not tail risk (Christensen et al. 2026; Dubinsky et al. 2019): flag them from `underlying-profile` if the field exists (it is on the requested-capabilities list if not) and either refuse or surcharge. For the hackathon, refuse and say why on screen.
2d. **Keeper multiplier.** CPPI at m = 10 survived because the worst weekly book loss was 6.7% of covered notional against a 10% breaking point (Balder et al. 2009; Cont-Tankov 2009 on discrete-rebalancing gap risk). Offer m = 5 (20% capital) as the conservative Keeper tier alongside m = 10.
3. **Mainnet everything.** Agentic Wallet has no testnet; Studio's `bnb` runtime dies after 48 hours; judging runs to 23 Oct. Self-host or AgentCore for the runtime; fund the demo wallet with tens of dollars; keep links alive.
4. **Geo.** Team and servers outside the restricted list; jurisdiction disclaimer in the UI.
5. **Ondo versus bStock weekends.** bStocks trade 24/7 on LiquidMesh; Ondo tokens are RFQ-only and likely `MARKET_CLOSED` all weekend. Two pitches from one product: bStock holders buy a floor, Ondo holders buy the only exit that exists.

## 5. Fifteen-day plan

| days | deliverable |
|---|---|
| 1-2 | Web3 API key, first signed call, `DX_LOG.md` started; Telegram question on spot-only asked; `/rwa/platforms` and `/rwa/price` mapped; settlement rule written as a spec |
| 3-6 | Contracts (`CoverMarket`, `KeeperVault` with CPPI and caps, `SettlementOracle`) with tests and the payout-bounded fuzz; v4 quote service (port of `versions/v4_pooled_volscaled.py`, annual refit file committed) |
| 7-9 | Front end: one screen (holder), one screen (Keeper: junior/senior, cushion, floor, utilisation), Monday receipt; Trading API RFQ for the holder's spot leg; DeFi API Venus deposit; Transaction API simulate in every path |
| 10-11 | `weekend-cover` skill + baw flows recorded; Agent Studio seller (8004 register, MCP tools, x402 `bind_cover`, 8183 job) |
| Fri 9 Oct to Mon 12 Oct | live cycle on mainnet with small amounts across the real weekend of 10-11 Oct; record it |
| 10-11 (parallel) | DX report written from the log; 4-minute video; README with tx hashes and the backtest evidence; submit before Sun 11 Oct 12:00 UTC (the live cycle's Monday settle can be appended as a follow-up link only if the form allows; otherwise record the 3-4 Oct weekend instead) |

Note on dates: to have a completed Friday-to-Monday cycle inside the submission window, run the first live weekend on **2-5 Oct** and treat 9-12 Oct as the second.

## 6. What to say about Hermee and Kip in the pitch

Hermee holds $100k of Nvidia. Over 2024-2026 she paid $24k in weekend premiums and was paid $46k back; her worst Monday morning was -$15k instead of -$36k. Kip put $1M behind a $10M book in 2015 and has $3.1M today, having lost money on 8% of weekends and 62% of his capital on one of them; under CPPI sizing that weekend would have cost him 37% and his floor would have held. Twenty-two years, 61,815 weekends, 43 famous crashes: the numbers are in the repo, and every one of them was produced without looking ahead.
