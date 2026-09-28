# Famous weekends - Hermee vs Kip, $100k per ticker, 5% barrier, v4 pricing (fitted on data before each event)

Hermee = the Sleeper (holds the stock, buys weekend cover). Kip = the Keeper (LP in the pool, sells the cover).
All premiums are what v4 would have quoted on that Friday, using only history before it. Gaps are Friday close to Monday open, split/dividend adjusted.

## 1987-10-16 -> 1987-10-19  Black Monday 1987  [crash]

Dow -22.6% on the Monday. Index open data pre-1982 is unreliable, so this row uses close-to-close and is an anchor, not a backtest point.

| ticker | gap (open) | gap (close) | premium | Hermee unprotected | Hermee protected | loss avoided | Kip net |
|---|---|---|---|---|---|---|---|
| ^GSPC | -20.5% | -20.5% | nanbp | $-20,467 | $nan | $nan | $nan |

## 2001-09-07 -> 2001-09-10  9/11 - market shut a week  [crash]

Exchanges closed 11-14 Sep. Holders were locked in for 10 days. SPY reopened -4.9%.

| ticker | gap (open) | gap (close) | premium | Hermee unprotected | Hermee protected | loss avoided | Kip net |
|---|---|---|---|---|---|---|---|
| SPY | -0.9% | +1.2% | 1.0bp | $-938 | $-948 | $-10 | $10 |
| QQQ | -0.6% | +1.2% | 2.5bp | $-623 | $-648 | $-25 | $25 |
| BA | -0.6% | -3.8% | 1.6bp | $-620 | $-636 | $-16 | $16 |
| DIS | -2.5% | -2.2% | 1.0bp | $-2,530 | $-2,540 | $-10 | $10 |

## 2008-09-12 -> 2008-09-15  Lehman weekend  [crash]

Lehman filed Sunday night, Merrill sold to BofA, AIG on the brink. The archetypal weekend where the world changed while the market was shut.

| ticker | gap (open) | gap (close) | premium | Hermee unprotected | Hermee protected | loss avoided | Kip net |
|---|---|---|---|---|---|---|---|
| SPY | -3.5% | -4.8% | 1.0bp | $-3,537 | $-3,547 | $-10 | $10 |
| BAC | -16.3% | -21.3% | 9.0bp | $-16,331 | $-5,090 | $11,240 | $-11,240 |
| C | -8.7% | -15.1% | 6.7bp | $-8,742 | $-5,067 | $3,674 | $-3,674 |
| AIG | -41.4% | -60.8% | 50.5bp | $-41,351 | $-5,505 | $35,846 | $-35,846 |
| XLF | -6.7% | -9.7% | 4.2bp | $-6,667 | $-5,042 | $1,624 | $-1,624 |

## 2008-10-10 -> 2008-10-13  G7 bank rescue rally  [rally]

After the worst week since 1933, governments guaranteed bank debt over the weekend. Monday 13 Oct was the biggest S&P point gain ever.

| ticker | gap (open) | gap (close) | premium | Hermee unprotected | Hermee protected | loss avoided | Kip net |
|---|---|---|---|---|---|---|---|
| SPY | +6.1% | +14.5% | 5.7bp | $6,068 | $6,011 | $-57 | $57 |
| C | +11.3% | +11.6% | 94.2bp | $11,269 | $10,326 | $-942 | $942 |
| BAC | +13.9% | +9.2% | 108.8bp | $13,943 | $12,856 | $-1,088 | $1,088 |
| XLF | +5.8% | +7.8% | 40.6bp | $5,828 | $5,421 | $-406 | $406 |

## 2010-05-07 -> 2010-05-10  EU EUR750bn bailout  [rally]

Flash crash Thursday, then the EU/IMF package agreed Sunday night. Monday gapped up hard.

| ticker | gap (open) | gap (close) | premium | Hermee unprotected | Hermee protected | loss avoided | Kip net |
|---|---|---|---|---|---|---|---|
| SPY | +4.1% | +4.4% | 1.0bp | $4,089 | $4,079 | $-10 | $10 |
| EEM | +6.4% | +7.2% | 1.0bp | $6,389 | $6,379 | $-10 | $10 |
| C | +8.3% | +5.5% | 6.1bp | $8,250 | $8,189 | $-61 | $61 |

## 2011-08-05 -> 2011-08-08  S&P downgrades the USA  [crash]

S&P cut the US to AA+ after Friday close. Monday: S&P 500 -6.7%, BAC -20%.

| ticker | gap (open) | gap (close) | premium | Hermee unprotected | Hermee protected | loss avoided | Kip net |
|---|---|---|---|---|---|---|---|
| SPY | -2.6% | -6.5% | 1.0bp | $-2,640 | $-2,650 | $-10 | $10 |
| BAC | -9.4% | -20.3% | 3.1bp | $-9,425 | $-5,031 | $4,394 | $-4,394 |
| C | -5.7% | -16.4% | 2.4bp | $-5,652 | $-5,024 | $628 | $-628 |
| QQQ | -3.1% | -6.0% | 1.0bp | $-3,065 | $-3,075 | $-10 | $10 |

## 2013-04-12 -> 2013-04-15  Gold crash weekend  [crash]

Gold fell 9% on Monday 15 April 2013, its worst day in 30 years. The gold weekend gap that GLD holders never saw coming.

| ticker | gap (open) | gap (close) | premium | Hermee unprotected | Hermee protected | loss avoided | Kip net |
|---|---|---|---|---|---|---|---|
| GLD | -5.5% | -8.8% | 1.0bp | $-5,523 | $-5,010 | $513 | $-513 |

## 2015-08-21 -> 2015-08-24  China Black Monday  [crash]

Shanghai -8.5% overnight, Dow futures limit-down, AAPL opened -10%. The single breach that drove backtest v1.

| ticker | gap (open) | gap (close) | premium | Hermee unprotected | Hermee protected | loss avoided | Kip net |
|---|---|---|---|---|---|---|---|
| AAPL | -10.3% | -2.5% | 1.5bp | $-10,297 | $-5,015 | $5,282 | $-5,282 |
| SPY | -5.2% | -4.2% | 1.0bp | $-5,227 | $-5,010 | $217 | $-217 |
| QQQ | -8.0% | -3.8% | 1.0bp | $-7,978 | $-5,010 | $2,968 | $-2,968 |
| NFLX | -14.6% | -6.8% | 5.7bp | $-14,631 | $-5,057 | $9,574 | $-9,574 |
| TSLA | -12.1% | -5.2% | 4.9bp | $-12,125 | $-5,049 | $7,075 | $-7,075 |

## 2016-06-24 -> 2016-06-27  Brexit Monday  [crash]

Vote result hit on Friday; Monday continued the slide. Banks gapped down again.

| ticker | gap (open) | gap (close) | premium | Hermee unprotected | Hermee protected | loss avoided | Kip net |
|---|---|---|---|---|---|---|---|
| SPY | -0.8% | -1.8% | 1.0bp | $-812 | $-822 | $-10 | $10 |
| BAC | -1.8% | -6.3% | 2.1bp | $-1,769 | $-1,790 | $-21 | $21 |
| C | -1.8% | -4.5% | 3.1bp | $-1,787 | $-1,818 | $-31 | $31 |

## 2018-02-02 -> 2018-02-05  Volmageddon  [basis]

SPY opened only -0.5% but closed -4.1%; XIV died after the close. Cover settled at the OPEN would not have paid - the settlement-basis lesson.

| ticker | gap (open) | gap (close) | premium | Hermee unprotected | Hermee protected | loss avoided | Kip net |
|---|---|---|---|---|---|---|---|
| SPY | -0.7% | -4.2% | 1.0bp | $-726 | $-736 | $-10 | $10 |
| QQQ | -0.9% | -3.9% | 1.0bp | $-936 | $-946 | $-10 | $10 |

## 2018-12-21 -> 2018-12-24  Christmas Eve 2018  [crash]

Mnuchin called the bank CEOs on Sunday; Monday 24 Dec was the worst Christmas Eve ever.

| ticker | gap (open) | gap (close) | premium | Hermee unprotected | Hermee protected | loss avoided | Kip net |
|---|---|---|---|---|---|---|---|
| SPY | -0.7% | -2.6% | 1.0bp | $-690 | $-700 | $-10 | $10 |
| AAPL | -1.7% | -2.6% | 2.2bp | $-1,712 | $-1,733 | $-22 | $22 |
| QQQ | -0.7% | -2.5% | 1.4bp | $-726 | $-740 | $-14 | $14 |

## 2018-12-24 -> 2018-12-26  Boxing Day rebound  [rally]

Holiday closed session. Dow +1,086 points on 26 Dec, the largest point gain in history at the time.

| ticker | gap (open) | gap (close) | premium | Hermee unprotected | Hermee protected | loss avoided | Kip net |
|---|---|---|---|---|---|---|---|
| SPY | +0.7% | +5.1% | 1.0bp | $696 | $686 | $-10 | $10 |
| AAPL | +1.0% | +7.0% | 2.2bp | $1,001 | $980 | $-22 | $22 |

## 2019-08-02 -> 2019-08-05  Yuan breaks 7  [crash]

China let the yuan through 7 on the Monday morning; S&P -3%.

| ticker | gap (open) | gap (close) | premium | Hermee unprotected | Hermee protected | loss avoided | Kip net |
|---|---|---|---|---|---|---|---|
| SPY | -1.5% | -3.0% | 1.0bp | $-1,548 | $-1,558 | $-10 | $10 |
| AAPL | -3.0% | -5.2% | 1.0bp | $-2,956 | $-2,966 | $-10 | $10 |
| QQQ | -2.1% | -3.5% | 1.0bp | $-2,092 | $-2,102 | $-10 | $10 |

## 2020-02-21 -> 2020-02-24  COVID reaches Italy  [crash]

Lombardy locked down over the weekend. First COVID gap-down.

| ticker | gap (open) | gap (close) | premium | Hermee unprotected | Hermee protected | loss avoided | Kip net |
|---|---|---|---|---|---|---|---|
| SPY | -3.1% | -3.3% | 1.0bp | $-3,101 | $-3,111 | $-10 | $10 |
| AAPL | -5.0% | -4.8% | 1.6bp | $-5,044 | $-5,016 | $28 | $-28 |
| QQQ | -3.7% | -3.9% | 1.0bp | $-3,730 | $-3,740 | $-10 | $10 |

## 2020-03-06 -> 2020-03-09  Oil war + COVID  [crash]

Saudi-Russia price war launched Sunday; oil -30%. Circuit breaker at the open.

| ticker | gap (open) | gap (close) | premium | Hermee unprotected | Hermee protected | loss avoided | Kip net |
|---|---|---|---|---|---|---|---|
| SPY | -7.4% | -7.8% | 2.4bp | $-7,450 | $-5,024 | $2,426 | $-2,426 |
| XOM | -12.5% | -12.2% | 4.9bp | $-12,539 | $-5,049 | $7,490 | $-7,490 |
| AAL | -6.9% | -7.6% | 15.8bp | $-6,888 | $-5,158 | $1,730 | $-1,730 |
| QQQ | -7.0% | -6.9% | 3.2bp | $-6,990 | $-5,032 | $1,958 | $-1,958 |

## 2020-03-13 -> 2020-03-16  Fed emergency cut Sunday  [crash]

Fed cut to zero on Sunday evening; futures limit-down instantly. Worst weekend gap in the dataset for most tickers.

| ticker | gap (open) | gap (close) | premium | Hermee unprotected | Hermee protected | loss avoided | Kip net |
|---|---|---|---|---|---|---|---|
| SPY | -10.4% | -10.9% | 14.5bp | $-10,449 | $-5,145 | $5,303 | $-5,303 |
| QQQ | -9.5% | -12.0% | 14.6bp | $-9,457 | $-5,146 | $4,311 | $-4,311 |
| AAPL | -13.0% | -12.9% | 26.0bp | $-12,958 | $-5,260 | $7,699 | $-7,699 |
| BA | -12.2% | -23.8% | 44.0bp | $-12,209 | $-5,440 | $6,769 | $-6,769 |
| AAL | -13.3% | +11.3% | 45.0bp | $-13,277 | $-5,450 | $7,827 | $-7,827 |
| TQQQ | -28.8% | -34.5% | 151.4bp | $-28,818 | $-6,514 | $22,304 | $-22,304 |

## 2020-04-03 -> 2020-04-06  Curve-flattening rally  [rally]

Weekend headlines on slowing case growth. Monday +7% for the S&P.

| ticker | gap (open) | gap (close) | premium | Hermee unprotected | Hermee protected | loss avoided | Kip net |
|---|---|---|---|---|---|---|---|
| SPY | +3.9% | +6.7% | 29.6bp | $3,888 | $3,592 | $-296 | $296 |
| QQQ | +3.9% | +7.1% | 28.5bp | $3,877 | $3,592 | $-285 | $285 |
| AAPL | +3.9% | +8.7% | 37.5bp | $3,931 | $3,556 | $-375 | $375 |

## 2020-11-06 -> 2020-11-09  Pfizer vaccine Monday  [mixed]

Vaccine efficacy announced Monday pre-open. Airlines +, stay-at-home names crushed: ZM -17%.

| ticker | gap (open) | gap (close) | premium | Hermee unprotected | Hermee protected | loss avoided | Kip net |
|---|---|---|---|---|---|---|---|
| SPY | +3.9% | +1.3% | 1.0bp | $3,944 | $3,934 | $-10 | $10 |
| BA | +13.5% | +13.7% | 3.6bp | $13,478 | $13,442 | $-36 | $36 |
| AAL | +25.0% | +15.2% | 6.1bp | $25,044 | $24,983 | $-61 | $61 |
| ZM | -13.4% | -17.4% | 12.1bp | $-13,419 | $-5,121 | $8,298 | $-8,298 |
| AMZN | -2.4% | -5.1% | 4.5bp | $-2,426 | $-2,472 | $-45 | $45 |
| NFLX | -5.7% | -8.6% | 4.1bp | $-5,671 | $-5,041 | $630 | $-630 |

## 2021-01-22 -> 2021-01-25  GameStop weekend  [rally]

r/wallstreetbets. GME opened +49% Monday. The weekend gap that went right - for longs.

| ticker | gap (open) | gap (close) | premium | Hermee unprotected | Hermee protected | loss avoided | Kip net |
|---|---|---|---|---|---|---|---|
| GME | +48.8% | +18.1% | 277.4bp | $48,792 | $46,019 | $-2,774 | $2,774 |
| AMC | +34.2% | +25.9% | 74.2bp | $34,188 | $33,446 | $-742 | $742 |

## 2022-06-10 -> 2022-06-13  CPI + Celsius freeze  [crash]

Hot CPI Friday, Celsius halted withdrawals Sunday night, BTC -15% over the weekend. COIN opened -14%.

| ticker | gap (open) | gap (close) | premium | Hermee unprotected | Hermee protected | loss avoided | Kip net |
|---|---|---|---|---|---|---|---|
| COIN | -21.3% | -11.4% | 69.6bp | $-21,342 | $-5,696 | $15,646 | $-15,646 |
| MSTR | -26.6% | -25.2% | 77.7bp | $-26,578 | $-5,777 | $20,801 | $-20,801 |
| SPY | -2.6% | -3.8% | 1.4bp | $-2,553 | $-2,566 | $-14 | $14 |
| QQQ | -3.1% | -4.6% | 3.1bp | $-3,147 | $-3,178 | $-31 | $31 |

## 2022-08-19 -> 2022-08-22  AMC / APE distribution  [corporate]

AMC issued APE preferred units to holders on Monday. The share price 'gapped' -37% but holders received APE. Corporate-action basis risk.

| ticker | gap (open) | gap (close) | premium | Hermee unprotected | Hermee protected | loss avoided | Kip net |
|---|---|---|---|---|---|---|---|
| AMC | -37.1% | -42.0% | 58.0bp | $-37,125 | $-5,580 | $31,546 | $-31,546 |

## 2023-03-10 -> 2023-03-13  SVB weekend  [crash]

SVB seized Friday, Signature Sunday, BTFP announced Sunday night. Regional banks gapped -10 to -60% on Monday. (SIVB/FRC delisted; proxies shown.)

| ticker | gap (open) | gap (close) | premium | Hermee unprotected | Hermee protected | loss avoided | Kip net |
|---|---|---|---|---|---|---|---|
| KRE | -12.6% | -12.3% | 2.4bp | $-12,567 | $-5,024 | $7,543 | $-7,543 |
| SCHW | -11.8% | -11.6% | 11.7bp | $-11,823 | $-5,117 | $6,706 | $-6,706 |
| WAL | -73.9% | -47.1% | 26.7bp | $-73,875 | $-5,267 | $68,608 | $-68,608 |
| BAC | -4.5% | -5.8% | 1.0bp | $-4,460 | $-4,470 | $-10 | $10 |
| C | -2.8% | -7.4% | 1.0bp | $-2,772 | $-2,782 | $-10 | $10 |

## 2024-05-10 -> 2024-05-13  Roaring Kitty returns  [rally]

One tweet on Sunday night. GME +51% at the open.

| ticker | gap (open) | gap (close) | premium | Hermee unprotected | Hermee protected | loss avoided | Kip net |
|---|---|---|---|---|---|---|---|
| GME | +50.9% | +74.4% | 69.5bp | $50,859 | $50,164 | $-695 | $695 |
| AMC | +21.0% | +78.4% | 29.9bp | $20,962 | $20,663 | $-299 | $299 |

## 2024-08-02 -> 2024-08-05  Yen carry unwind  [crash]

Nikkei -12% Monday morning; VIX 65 pre-market. NVDA opened -8%, COIN -10%.

| ticker | gap (open) | gap (close) | premium | Hermee unprotected | Hermee protected | loss avoided | Kip net |
|---|---|---|---|---|---|---|---|
| NVDA | -14.2% | -6.4% | 18.7bp | $-14,179 | $-5,187 | $8,992 | $-8,992 |
| SPY | -4.0% | -2.9% | 1.0bp | $-3,989 | $-3,999 | $-10 | $10 |
| QQQ | -5.4% | -3.0% | 1.0bp | $-5,357 | $-5,010 | $347 | $-347 |
| COIN | -20.8% | -7.3% | 20.4bp | $-20,754 | $-5,204 | $15,550 | $-15,550 |
| HOOD | -17.8% | -8.2% | 11.5bp | $-17,785 | $-5,115 | $12,670 | $-12,670 |
| SMCI | -14.3% | -2.5% | 10.7bp | $-14,258 | $-5,107 | $9,151 | $-9,151 |

## 2025-01-24 -> 2025-01-27  DeepSeek Monday  [crash]

DeepSeek R1 went viral over the weekend. NVDA opened -12.5%, closed -17%: the largest single-day market-cap loss in history.

| ticker | gap (open) | gap (close) | premium | Hermee unprotected | Hermee protected | loss avoided | Kip net |
|---|---|---|---|---|---|---|---|
| NVDA | -12.5% | -17.0% | 5.5bp | $-12,495 | $-5,055 | $7,440 | $-7,440 |
| AVGO | -12.8% | -17.4% | 1.3bp | $-12,791 | $-5,013 | $7,778 | $-7,778 |
| SMCI | -8.9% | -12.6% | 18.9bp | $-8,897 | $-5,189 | $3,708 | $-3,708 |
| MU | -8.1% | -11.7% | 9.8bp | $-8,072 | $-5,098 | $2,975 | $-2,975 |
| QQQ | -3.5% | -2.9% | 1.0bp | $-3,518 | $-3,528 | $-10 | $10 |

## 2025-04-04 -> 2025-04-07  Tariff Monday  [crash]

Liberation Day tariffs Thu/Fri, China retaliated, Monday futures limit-down overnight then a wild reversal.

| ticker | gap (open) | gap (close) | premium | Hermee unprotected | Hermee protected | loss avoided | Kip net |
|---|---|---|---|---|---|---|---|
| SPY | -3.2% | -0.2% | 1.9bp | $-3,184 | $-3,203 | $-19 | $19 |
| AAPL | -5.9% | -3.7% | 6.7bp | $-5,935 | $-5,067 | $868 | $-868 |
| NVDA | -7.3% | +3.5% | 11.1bp | $-7,263 | $-5,111 | $2,152 | $-2,152 |
| QQQ | -3.3% | +0.2% | 3.0bp | $-3,315 | $-3,345 | $-30 | $30 |

## 2025-04-11 -> 2025-04-14  Smartphone tariff exemption  [rally]

Exemption for phones and chips announced Friday night. AAPL gapped up on Monday.

| ticker | gap (open) | gap (close) | premium | Hermee unprotected | Hermee protected | loss avoided | Kip net |
|---|---|---|---|---|---|---|---|
| AAPL | +6.7% | +2.2% | 21.8bp | $6,707 | $6,489 | $-218 | $218 |
| NVDA | +2.9% | -0.2% | 29.1bp | $2,867 | $2,576 | $-291 | $291 |
| QQQ | +2.2% | +0.7% | 10.4bp | $2,214 | $2,110 | $-104 | $104 |

## 2025-10-03 -> 2025-10-06  AMD-OpenAI deal  [rally]

6GW deal announced Monday pre-open. AMD opened +37%.

| ticker | gap (open) | gap (close) | premium | Hermee unprotected | Hermee protected | loss avoided | Kip net |
|---|---|---|---|---|---|---|---|
| AMD | +37.5% | +23.7% | 1.0bp | $37,517 | $37,507 | $-10 | $10 |

## 2025-10-10 -> 2025-10-13  Crypto liquidation weekend  [crash]

Tariff tweet Friday afternoon, USD19bn liquidated, tokenized stocks on-chain traded at deep discounts all weekend while the NYSE was shut.

| ticker | gap (open) | gap (close) | premium | Hermee unprotected | Hermee protected | loss avoided | Kip net |
|---|---|---|---|---|---|---|---|
| COIN | +1.7% | -0.0% | 12.1bp | $1,734 | $1,613 | $-121 | $121 |
| MSTR | +0.6% | +3.5% | 12.7bp | $617 | $490 | $-127 | $127 |
| HOOD | +4.1% | +1.2% | 13.7bp | $4,073 | $3,936 | $-137 | $137 |
| SPY | +1.2% | +1.5% | 1.0bp | $1,168 | $1,158 | $-10 | $10 |
