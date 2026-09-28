# Research 2 - Tokenized stocks on-chain: landscape, weekend behaviour, lenders, yield legs, competitors

*Compiled 26 Sep 2026 by a research agent (~97 fetches). Evidence flagged where thin.*

## Executive answer

**Yes, there is white space, and it is narrow but real.** As of 26 Sept 2026 no live product on any chain sells weekend/closed-session gap protection or principal protection on tokenized stocks. The closest things are (a) **AfterHours**, a Sept 2026 Arbitrum Open House Singapore hackathon project selling Friday-to-Monday puts on Robinhood Chain stock tokens (unaudited, Arbitrum only); (b) **Holdline**, a Kamino/Solana auto-repay keeper that exists only as a mainnet-fork proof; and (c) internal risk plumbing at the institutions that warehouse the risk today: Venus's $200k weekend liquidation buffer, Kamino's weekend price bands, and Ethena/Kairos's "10% extra weekend margin or flatten before Friday close" rule. Nobody is doing this on BNB Chain, where bStocks + Ondo Stocks make it the only chain with >$1B of tokenized-equity market cap and where 92% of on-chain bStocks volume already prints while the NYSE is closed.

**Who is close:** AfterHours (same product, wrong chain, hackathon stage); Ondo Perps and Binance equity perps (a hedge, but capital-intensive and their weekend index is circular); Bitget rToken (CEX-internal weekend trading, no protection); Nexus Mutual (has the cover-product rails but covers no equity tokens and prices on 7-day depeg windows, not Monday-open gaps).

**Honest caveat on demand:** the measured weekend gap is small on average. Binance Research shows bStocks converge to within 0.19% of Monday open (median), and Kairos found 14.9 bps average hedged divergence across 400 weekend windows. The product must be priced and marketed on the *tail* (SPCXB's 6.5% weekend gap, Apple-linked tokens at ~12% premium, earnings-adjacent weekends), not the mean. Lenders' behaviour (borrow caps of zero, 50-60% CFs, price bands) shows they price the tail even though it hasn't yet bitten publicly.

## 1. Tokenized equities landscape (Sept 2026)

Market totals: ~$3.5B tokenized stock market, 4M+ holders, BNB Chain 1.7M holders (~42.5%) and the only chain above $1B cap. Binance Research: active market cap $4.0B (9 Sep), August DEX volume $7.9B (vs $237M in January), BNB Chain + Robinhood Chain = 88.2% of September DEX volume, DeFi TVL of tokenized stocks $289.1M (7.2% of cap). A narrower count puts tokenized-stock DeFi deposits at $111M across 15 protocols, xStocks 58% of deposits and 86.5% of lending TVL ($23.1M).

### Table (a): Issuers, BNB Chain presence, liquidity, 24/7 behaviour

| Issuer | Size | BNB Chain / PancakeSwap | Off-hours behaviour |
|---|---|---|---|
| **bStocks** (BTech Holdings, ADGM; Binance affiliate) | Launched 10-12 Jun 2026; $5.6M to $100M cap in 15 days; ~$500M cap by 27 Aug; 15 tickers by 2 Jul (SPCX ~53% of holdings early) | Native BEP-20; PancakeSwap (5 launch pairs, +10 later), Venus, Lista, Aster | 24/7 spot on Binance and DEX; stock-to-bStock conversion "generally available 24/7", zero fee, but redemption to a direct stock position settles in market hours; not for US persons. 92% of on-chain volume outside US hours (week to 28 Jul) |
| **Ondo Stocks** (ex-Ondo Global Markets, renamed 13 Jul 2026) | >$1B TVL, 438+ listings, >$20B cumulative volume; ~59-70% issuer share | Live on BNB Chain since Oct 2025 (100+ assets, PancakeSwap); also ETH, Solana | Mint/redeem 24/5 (Sun 8pm-Fri 7:59pm ET); 24/7 mint/redeem for six names (NVDAon, SPYon, CRCLon, TSLAon, QQQon, GOOGLon); "Off-Hours session" for select assets with wider spreads; weekends only 0.55% of volume through May 2026 |
| **xStocks** (Backed; Kraken acquiring) | $25B cumulative volume; ~162k holders; on-chain AUM ~$845M; DeFi TVL $63-84M | Primarily Solana (Kamino, Raydium) + Ethereum (Morpho); BNB Chain presence minimal | Kraken: 24/5, with 10 tickers 24/7; on-chain 24/7; MMs use ATS/futures/models off-hours; "historically under 1% mismatch at Monday open" |
| **Robinhood** (Robinhood Chain, Arbitrum Orbit) | 194 tokens; $2.21B lifetime DEX volume by 30 Aug; 240k new holders in 30 days; RWA cap only $12.66M | None | 24/7 Uniswap pools; Chainlink 24/5 feeds |
| **Coinbase B20** (Base) | 4 pools, $6.07M liquidity; Aave V4 Equities Hub 25 Sep | None | Stayed within 0.6% of Friday reference over a weekend |
| **Dinari** | 724 US stocks to US investors (4 Aug 2026); ~$42.6M cap | None | Market-hours mint/redeem |
| **Securitize / Gemini** | SECZ $295M own-stock tokenization; Gemini fee-free tokenized stocks (MSTR first) | None | n/a |
| **Bitget rToken** | $114M AUM, $671M cumulative vol (6 Jul) | None (CEX-internal) | Weekend trading on select tickers |

## 2. What actually happens on weekends

| Study | Sample | Finding |
|---|---|---|
| Binance Research (bStocks) | 3 weekends, Jun 2026 | bStocks captured 87% of Monday move; direction right 21/22; median deviation 0.59% (perps 0.43%); ~44% of volume off-session. SPCXB independently priced a **6.5% weekend gap** (Cursor acquisition) and converged to within 0.09% of Monday open, but token holders "sold the news at 6% above the following opening price" |
| Binance Research (7 weekends, to 28 Jul) | 7 weekends | Median 92% of gap captured, residual 0.19% at open; directional hit rate 81% (<0.5% gaps), 90% (0.5-1%), 97% (1-3%), 100% (>3%, n=41) |
| Same dataset, outliers | | Apple-linked token traded ~12% above underlying; Amazon-linked briefly "several times" reference; weekend activity falls 70-90%; spreads 89 bps vs 20 bps core hours |
| Wu Blockchain (Binance equity perps) | 25 weekend obs | Perps got Monday direction right only 13/25 (52%); Sunday error avg 181.9 bps; SNDK printed 1,223.98 Sunday vs 1,203.41 open despite $338M weekend volume |
| Kairos Research for Ethena | 400 weekend/holiday windows | Avg hedged-leg divergence 14.9 bps; across 37 earnings events underlying moved 9.9% vs 20.3 bps hedged; worst -81.7 bps |
| Coinbase B20 on Base | one weekend, Aug 2026 | All four within 0.6% of Friday Chainlink value |
| DFDVx (xStock, illiquid) | spot | 24% discount to underlying despite 1:1 redemption |

**Oracles.** Chainlink Tokenized Equity Feeds are 24/5; over weekends they report the last pre-close value and publish no heartbeats; docs tell protocols to "restrict high-risk operations (large liquidations, new positions)" in thin sessions. RedStone's co-founder publicly warned of "ghost prices" and under-collateralised lenders on weekends (CoinDesk, 23 Nov 2025). Binance's RWA API `referencePrice` is defined as `tokenInfo.price / sharesMultiplier`, derived from the on-chain token price, and `stockInfo.price` is null outside market hours. Kairos notes Binance builds its weekend perp index from the perp's own book and Kraken follows the token price: "circular reference risks". Per CryptoSlate: nothing can liquidate you Friday night to Monday, "and then the entire weekend move lands on your position at once."

**October 10-11 2025 crash.** Evidence is thin. The crash itself ($19B liquidations, BTC -8%, ETH -12%) is well documented, but no article quantified xStocks/Ondo discounts that weekend, and no public post-mortem of a user loss attributable to off-hours tokenized-stock pricing exists. Treat "documented losses" as **not yet publicly established**: a gap the product can fill with its own data.

## 3. DeFi lending treatment

| Protocol | Assets | Parameters | Weekend / oracle measures |
|---|---|---|---|
| **Venus (BSC)** | vTSLAB, vNVDAB (60% CF), vSPCXB (50% CF); vSKHYB proposed | LT 65-70%; borrow caps 0 at launch (collateral-only); **16.67% oracle protection trigger** | **$200,000 revolving "Bstock liquidation buffer"** in a protocol-owned multisig for "weekends and low-liquidity windows"; backstop liquidator whitelisted for flash loans |
| **Lista DAO (BSC)** | NVDAB, TSLAB, MUB live 16 Jun 2026; CRCLB, SNDKB, SPCXB added | Per-market LLTV; values not published | Prices from Atlas Oracle; no weekend-specific rule found |
| **Kamino (Solana)** | 8 xStocks since Jul 2025 | Lending TVL ~$23M; dynamic 2-10% liquidation penalty | Chainlink Data Streams; **price band around last close** on weekends; staleness indicator auto-pauses |
| **Morpho (ETH)** | SPYon, QQQon vs USDC | Gauntlet-curated | none found |
| **Aave V4 Base "Equities Hub"** (25 Sep 2026) | 7 Coinbase stocks | CF 65-79%; $29M collateral cap, $21M borrow cap | Chainlink 24/5; weekend freeze acknowledged |

## 4. Adjacent products and why they don't solve it

| Product | What it is | Why it doesn't solve weekend gap on BSC |
|---|---|---|
| **AfterHours** (GitHub, Sep 2026) | Cash-settled Friday-to-Monday puts on Robinhood Chain stock tokens; Stylus Black-Scholes with closed-market vol multiplier; ERC-4626 writer vaults; settles on first post-open Chainlink print | Hackathon, unaudited, puts only, Arbitrum only, no BNB assets, Black-Scholes pricing. **Closest analogue; validates the design.** https://github.com/bchuazw/afterhours |
| **Holdline** (GitHub) | Keeper auto-repays Kamino xStocks loans during closed hours | Mainnet-fork proof only; Solana; prevents liquidation, doesn't insure P&L |
| **closing-bell-agent** (GitHub) | BNB spread scanner using Binance RWA API referencePrice | Tooling, not a risk product |
| **Ondo Perps** (7 Jul 2026) / Binance equity perps ($2.9B OI) | 24/7 perps, tokenized stock as collateral | Hedge requires margin and funding (18% to 7% annualised); weekend index self-referential; directional accuracy 52% on weekends |
| **Bitget rToken** | CEX weekend trading | Closed-loop, no protection leg |
| **Nexus Mutual** | Depeg cover (7-day trigger), Leveraged Liquidation Cover ($9.5M active); 2-10%/yr | No equity tokens; trigger mismatched to a single Monday-open print |
| **Y2K** (Arbitrum) | Stablecoin depeg vaults, epoch-settled | Stablecoins only, no BSC |
| **Cega** | Principal-protected exotic vaults (90% barrier) | Crypto underliers, no tokenized stocks, no BSC |
| **Pendle** (on BSC) / Venus Fixed Rate Vault | PT fixed yield | Yield leg only; no protection payoff |
| **Tranchess** (BSC) | BNB staking tranches | Delisted from Binance Feb 2026; no equity exposure |
| **BarnBridge / Saffron / Idle** | Tranche pioneers | BarnBridge shut by SEC settlement (Dec 2023); others inactive |
| Derive / Stryke / Thetanuts / Panoptic / Opyn | Crypto options | No tokenized-stock listings found |

## 5. Yield legs on BNB Chain

| Instrument | On BSC? | APY | Redemption / restrictions | Binance Wallet |
|---|---|---|---|---|
| **USDY** (Ondo) | **Yes, since 4 Aug 2026** | ~4% | Instant mint/redeem on BSC; non-US KYC, $500 min, 40-day transfer lockup on primary mints; PancakeSwap, 1inch, Trust Wallet | Not confirmed in Simple Yield |
| **OUSG** | No (ETH/Mantle/Polygon) | T-bill | Qualified purchasers only | No |
| **RWUSD** (Binance) | No: off-chain ledger, non-transferable | 4.2% APR | Instant (0.1% fee) or T+3 | n/a |
| **USD1** (WLF) | Yes; Venus Core Pool | Venus supply rate + XVS | Instant fiat-backed | Venus borrow enabled |
| **lisUSD** (Lista) | Native CDP | Variable | Redeemable vs BNB collateral | Lista in Simple Yield |
| **USDe / sUSDe** | Yes (PancakeSwap, Venus, Pendle) | sUSDe ~5.0% | 7-day unstake | USDE borrowable on Venus via Wallet |
| **syrupUSDT** (Maple) | Yes | ~5% | Maple redemption queue | |
| **Venus USDT** | Native | ~3-8% variable | Instant | Yes |
| **Aster USDF** | Native | 0.8% base, up to 15% with conditions | 1:1 USDT | |

Sources: https://ondo.finance/blog/usdy-is-live-on-bnb-chain ; https://eco.com/support/en/articles/14798657-ondo-usdy-tokenized-treasuries-explained ; https://cryptoslate.com/binance-launches-rwusd-yield-bearing-stablecoin-like-rwa-product-offering-4-2-apr/ ; https://beincrypto.com/venus-expands-bnb-chain-world-liberty-partnership/ ; https://www.binance.com/en/support/announcement/web3-wallet-earn-update-enhancing-simple-yield-with-13-new-protocols-and-binance-sol-staking-3d57f29812ee4c12a7e153e81d93a239

## 6. Who warehouses weekend risk on BSC today

- **Ethena** (allocations began 25 Sep 2026): long bStocks / short Binance equity perps. Kairos framework: carry **>=10% extra stablecoin margin over weekends or close before Friday/earnings**; caps at 10% of perp OI, 20% of token circulating supply; auto-escalation if venue index and tokenized spot diverge >1.5% for 15 minutes off-hours; spot leg is "unsecured credit exposure to a Binance affiliate" until a side letter is signed. (https://gov.ethenafoundation.com/t/a-framework-for-the-tokenized-equity-basis-trade/832 ; https://unchainedcrypto.com/ethena-starts-backing-usde-with-tokenized-stocks-on-binance-its-first-equity-basis-venue/)
- **Venus**: $200k buffer + backstop liquidator (https://community.venus.io/t/bnb-chain-liquidity-reserve-institutional-fixed-rate-vault-backstop-bstock-liquidation-buffer/5823). **Lista**: Atlas Oracle, no published buffer.
- **BTech/Binance**: conversion "generally available 24/7" but stock-side redemption settles in market hours; no securities borrow, so "short bStocks + long perp" arbitrage is impossible.
- **PancakeSwap MMs**: no public data on who quotes bStock pools on weekends.

## Five quotable facts

1. "92% of total on-chain bStocks volume occurred while US equity markets were closed" (week to 28 Jul 2026, Binance Research).
2. Across 7 weekends bStocks captured a median 92% of the Monday move with 0.19% residual, but SPCXB gapped 6.5% and Apple-linked tokens traded ~12% above underlying.
3. Venus Protocol keeps a $200,000 revolving "Bstock liquidation buffer" explicitly for "weekends and low-liquidity windows" and launched all three bStock markets with borrow caps of zero.
4. Ethena's risk framework requires >=10% extra stablecoin margin over weekends on its bStocks basis trade, or flattening before Friday close: an institutional price tag on weekend risk.
5. Chainlink tokenized-equity feeds "do not publish updates, including heartbeat updates, while markets are closed"; the only weekend product built on that fact (AfterHours) is a Sept 2026 hackathon prototype on Arbitrum.

## Key sources
https://www.binance.com/en/research/analysis/opportunity-only-tokenized-stocks-unlock ; https://www.financemagnates.com/thought-leadership/the-convergence-trade-nobody-planned-on-chain-fridays-to-nyse-mondays/ ; https://wublock.substack.com/p/the-other-side-of-bstocks-not-building ; https://docs.chain.link/data-feeds/tokenized-equity-feeds ; https://www.coindesk.com/business/2025/11/23/on-chain-stocks-could-misprice-over-weekends-triggering-arbitrage-risks-redstone ; https://community.venus.io/t/bnb-chain-list-vtslab-vnvdab-and-vspcxb-markets-in-the-venus-core-pool/5832 ; https://cryptobriefing.com/bstocks-lista-dao-defi-integration/ ; https://gov.kamino.finance/t/kamino-is-integrating-xstocks-powered-by-the-chainlink-data-standard-to-enable-tokenized-equities-lending/792 ; https://www.theblock.co/news/defi/2026-09-25-aave-v4-on-base-adds-coinbase-tokenized-stocks-as-collateral-for-usdc-loans-416372 ; https://github.com/bchuazw/afterhours ; https://github.com/dmustapha/holdline ; https://github.com/daveaire/closing-bell-agent ; https://ondo.finance/blog/introducing-ondo-perps ; https://docs.nexusmutual.io/protocol/pricing/ ; https://www.thecoinrepublic.com/2026/09/21/bnb-chain-leads-3-5b-tokenized-stock-market-as-binance-adds-pre-access/ ; https://en.coinotag.com/bnb-chain-tokenized-stock-dex-volume-88-2-binance-research ; https://cryptobriefing.com/xstocks-defi-tvl-growth-tokenized-stocks/ ; https://www.bnbchain.org/en/blog/introducing-bstocks-on-bnb-chain-trade-24-7-with-zero-fees-deploy-across-defi-protocols-with-full-self-custody ; https://docs.ondo.finance/ondo-stocks/market-hours-and-trading-availability ; https://coincub.com/blog/24-7-tokenized-asset-trading/ ; https://support.kraken.com/articles/xstocks-faq ; https://cryptoslate.com/coinbase-stock-tokens-stayed-within-0-6-of-friday-prices-through-the-weekend-as-aave-collateral-remained-pending/ ; https://genfinity.io/2026/07/13/ondo-global-markets-becomes-ondo-stocks-tokenized-equities-leader/
