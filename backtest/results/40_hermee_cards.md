# Hermee's weekends

Hermee holds a fixed number of shares bought on the start date and buys cover on every weekend-spanning closed session. Premium = v4 pooled vol-scaled quote (walk-forward, 50% load, 1bp floor). Settlement at Monday open reference price.

Certainty equivalent uses CRRA utility with gamma = 4. 'Worth it' means a holder that risk-averse prefers the insured weekend return stream even after paying the premium.

Peace-of-Mind Index (0-100) = average reduction of 95% and 99% weekend CVaR. 100 means the tail is gone; 0 means nothing changed.

## H1  NVDA  2024-01-05 -> 2026-09-18  ($100,000 invested; AI winner through the yen unwind (Aug 2024) and DeepSeek Monday (Jan 2025))

- Weekends covered: **142** of 142 (priced out above 2% on 0), breaches of 5%: **3**, average premium **6.4bp** per weekend
- Premiums paid **$24,265**, payouts received **$46,184**, net cost **$-21,920** = -2.67% of holdings per year
- Worst weekend (2024-08-02, gap -14.2%): unprotected **$-36,306**, protected **$-14,689**
- Weekend CVaR99: -13.34% -> -5.15%; CVaR95: -6.61% -> -4.37%
- Certainty-equivalent gain: **+12.95bp/weekend** -> worth it to a gamma-4 holder. Peace-of-Mind Index **48/100**

| barrier | premium bp | paid | received | net cost | net %/yr | worst wknd unprot | worst wknd prot | CE gain bp | PMI |
|---|---|---|---|---|---|---|---|---|---|
| 3% | 13.4 | $51,582 | $71,034 | $-19,452 | -2.37% | $-36,306 | $-13,873 | +14.31 | 63 |
| 5% | 6.4 | $24,265 | $46,184 | $-21,920 | -2.67% | $-36,306 | $-14,689 | +12.95 | 48 |
| 7% | 3.7 | $13,767 | $32,159 | $-18,393 | -2.24% | $-36,306 | $-20,424 | +10.29 | 35 |
| 10% | 2.1 | $7,843 | $16,381 | $-8,538 | -1.04% | $-36,306 | $-29,094 | +5.64 | 18 |

## H2  AAPL  2015-01-02 -> 2017-12-29  ($100,000 invested; the backtest-v1 window: one breach (China Black Monday) in three years)

- Weekends covered: **157** of 157 (priced out above 2% on 0), breaches of 5%: **1**, average premium **1.1bp** per weekend
- Premiums paid **$2,041**, payouts received **$5,189**, net cost **$-3,148** = -0.89% of holdings per year
- Worst weekend (2015-08-21, gap -10.3%): unprotected **$-10,087**, protected **$-4,913**
- Weekend CVaR99: -6.41% -> -3.77%; CVaR95: -2.76% -> -2.11%
- Certainty-equivalent gain: **+3.53bp/weekend** -> worth it to a gamma-4 holder. Peace-of-Mind Index **32/100**

| barrier | premium bp | paid | received | net cost | net %/yr | worst wknd unprot | worst wknd prot | CE gain bp | PMI |
|---|---|---|---|---|---|---|---|---|---|
| 3% | 1.7 | $2,982 | $7,148 | $-4,166 | -1.18% | $-10,087 | $-4,085 | +4.46 | 44 |
| 5% | 1.1 | $2,041 | $5,189 | $-3,148 | -0.89% | $-10,087 | $-4,913 | +3.53 | 32 |
| 7% | 1.0 | $1,899 | $3,230 | $-1,331 | -0.38% | $-10,087 | $-6,867 | +1.99 | 20 |
| 10% | 1.0 | $1,849 | $291 | $1,558 | 0.44% | $-10,087 | $-9,806 | -0.71 | 2 |

## H3  SPY  2019-01-04 -> 2021-12-31  ($100,000 invested; index holder through COVID)

- Weekends covered: **157** of 157 (priced out above 2% on 0), breaches of 5%: **2**, average premium **1.7bp** per weekend
- Premiums paid **$3,367**, payouts received **$8,866**, net cost **$-5,499** = -1.30% of holdings per year
- Worst weekend (2020-03-13, gap -10.4%): unprotected **$-11,361**, protected **$-6,030**
- Weekend CVaR99: -8.95% -> -5.07%; CVaR95: -3.76% -> -2.80%
- Certainty-equivalent gain: **+5.11bp/weekend** -> worth it to a gamma-4 holder. Peace-of-Mind Index **34/100**

| barrier | premium bp | paid | received | net cost | net %/yr | worst wknd unprot | worst wknd prot | CE gain bp | PMI |
|---|---|---|---|---|---|---|---|---|---|
| 3% | 2.6 | $4,851 | $13,578 | $-8,727 | -2.07% | $-11,361 | $-4,052 | +7.32 | 52 |
| 5% | 1.7 | $3,367 | $8,866 | $-5,499 | -1.30% | $-11,361 | $-6,030 | +5.11 | 34 |
| 7% | 1.4 | $2,850 | $4,290 | $-1,440 | -0.34% | $-11,361 | $-8,419 | +2.16 | 17 |
| 10% | 1.2 | $2,529 | $488 | $2,041 | 0.48% | $-11,361 | $-10,915 | -0.75 | 2 |

## H4  COIN  2021-04-16 -> 2026-09-18  ($50,000 invested; crypto beta: weekends are when crypto crashes and the NYSE is shut)

- Weekends covered: **284** of 284 (priced out above 2% on 0), breaches of 5%: **9**, average premium **24.9bp** per weekend
- Premiums paid **$15,826**, payouts received **$9,604**, net cost **$6,221** = 4.28% of holdings per year
- Worst weekend (2022-06-10, gap -21.3%): unprotected **$-6,203**, protected **$-2,186**
- Weekend CVaR99: -17.29% -> -5.55%; CVaR95: -7.87% -> -5.15%
- Certainty-equivalent gain: **+1.48bp/weekend** -> worth it to a gamma-4 holder. Peace-of-Mind Index **51/100**

| barrier | premium bp | paid | received | net cost | net %/yr | worst wknd unprot | worst wknd prot | CE gain bp | PMI |
|---|---|---|---|---|---|---|---|---|---|
| 3% | 44.2 | $28,855 | $19,235 | $9,620 | 6.62% | $-6,203 | $-1,414 | -2.70 | 63 |
| 5% | 24.9 | $15,826 | $9,604 | $6,221 | 4.28% | $-6,203 | $-2,186 | +1.48 | 51 |
| 7% | 15.7 | $9,823 | $6,673 | $3,151 | 2.17% | $-6,203 | $-2,715 | +5.23 | 42 |
| 10% | 8.9 | $5,468 | $4,188 | $1,280 | 0.88% | $-6,203 | $-3,009 | +6.42 | 30 |

## H5  TSLA  2020-01-03 -> 2026-09-18  ($50,000 invested; high-vol single name, six years)

- Weekends covered: **351** of 351 (priced out above 2% on 0), breaches of 5%: **9**, average premium **12.5bp** per weekend
- Premiums paid **$161,496**, payouts received **$86,674**, net cost **$74,821** = 2.60% of holdings per year
- Worst weekend (2020-09-04, gap -14.9%): unprotected **$-40,800**, protected **$-35,054**
- Weekend CVaR99: -13.44% -> -5.38%; CVaR95: -6.94% -> -4.87%
- Certainty-equivalent gain: **+4.72bp/weekend** -> worth it to a gamma-4 holder. Peace-of-Mind Index **45/100**

| barrier | premium bp | paid | received | net cost | net %/yr | worst wknd unprot | worst wknd prot | CE gain bp | PMI |
|---|---|---|---|---|---|---|---|---|---|
| 3% | 24.2 | $319,449 | $220,177 | $99,272 | 3.45% | $-40,800 | $-22,640 | +5.62 | 61 |
| 5% | 12.5 | $161,496 | $86,674 | $74,821 | 2.60% | $-40,800 | $-35,054 | +4.72 | 45 |
| 7% | 7.5 | $94,714 | $45,165 | $49,549 | 1.72% | $-40,800 | $-41,122 | +4.33 | 33 |
| 10% | 4.0 | $50,404 | $20,077 | $30,327 | 1.06% | $-40,800 | $-40,949 | +2.57 | 17 |

## H6  QQQ  2007-01-05 -> 2009-12-31  ($100,000 invested; Nasdaq holder through the GFC (Lehman weekend included))

- Weekends covered: **157** of 157 (priced out above 2% on 0), breaches of 5%: **1**, average premium **1.6bp** per weekend
- Premiums paid **$2,206**, payouts received **$577**, net cost **$1,629** = 0.57% of holdings per year
- Worst weekend (2008-01-18, gap -5.6%): unprotected **$-5,764**, protected **$-5,197**
- Weekend CVaR99: -4.32% -> -4.06%; CVaR95: -2.72% -> -2.67%
- Certainty-equivalent gain: **-1.18bp/weekend** -> not worth it to a gamma-4 holder. Peace-of-Mind Index **4/100**

| barrier | premium bp | paid | received | net cost | net %/yr | worst wknd unprot | worst wknd prot | CE gain bp | PMI |
|---|---|---|---|---|---|---|---|---|---|
| 3% | 2.7 | $3,520 | $2,714 | $806 | 0.28% | $-5,764 | $-3,130 | -0.73 | 20 |
| 5% | 1.6 | $2,206 | $577 | $1,629 | 0.57% | $-5,764 | $-5,197 | -1.18 | 4 |
| 7% | 1.3 | $1,824 | $0 | $1,824 | 0.63% | $-5,764 | $-5,774 | -1.28 | 0 |
| 10% | 1.1 | $1,645 | $0 | $1,645 | 0.57% | $-5,764 | $-5,774 | -1.12 | 0 |

## H7  ZM  2020-01-03 -> 2021-12-31  ($50,000 invested; stay-at-home winner hit by Pfizer Monday)

- Weekends covered: **105** of 105 (priced out above 2% on 0), breaches of 5%: **5**, average premium **14.5bp** per weekend
- Premiums paid **$34,358**, payouts received **$41,145**, net cost **$-6,787** = -1.58% of holdings per year
- Worst weekend (2020-11-06, gap -13.4%): unprotected **$-49,874**, protected **$-18,944**
- Weekend CVaR99: -12.39% -> -5.70%; CVaR95: -7.87% -> -5.15%
- Certainty-equivalent gain: **+10.01bp/weekend** -> worth it to a gamma-4 holder. Peace-of-Mind Index **44/100**

| barrier | premium bp | paid | received | net cost | net %/yr | worst wknd unprot | worst wknd prot | CE gain bp | PMI |
|---|---|---|---|---|---|---|---|---|---|
| 3% | 27.0 | $62,909 | $64,651 | $-1,741 | -0.41% | $-49,874 | $-12,159 | +9.96 | 61 |
| 5% | 14.5 | $34,358 | $41,145 | $-6,787 | -1.58% | $-49,874 | $-18,944 | +10.01 | 44 |
| 7% | 9.0 | $21,330 | $28,995 | $-7,666 | -1.79% | $-49,874 | $-26,224 | +7.88 | 32 |
| 10% | 5.1 | $12,255 | $14,008 | $-1,753 | -0.41% | $-49,874 | $-37,277 | +2.14 | 13 |

## H8  GLD  2012-01-06 -> 2013-12-27  ($100,000 invested; gold holder through the April 2013 gold crash)

- Weekends covered: **104** of 104 (priced out above 2% on 0), breaches of 5%: **1**, average premium **1.0bp** per weekend
- Premiums paid **$1,021**, payouts received **$479**, net cost **$542** = 0.29% of holdings per year
- Worst weekend (2013-04-12, gap -5.5%): unprotected **$-5,057**, protected **$-4,588**
- Weekend CVaR99: -3.41% -> -3.15%; CVaR95: -1.80% -> -1.73%
- Certainty-equivalent gain: **-0.41bp/weekend** -> not worth it to a gamma-4 holder. Peace-of-Mind Index **6/100**

| barrier | premium bp | paid | received | net cost | net %/yr | worst wknd unprot | worst wknd prot | CE gain bp | PMI |
|---|---|---|---|---|---|---|---|---|---|
| 3% | 1.3 | $1,228 | $2,310 | $-1,082 | -0.58% | $-5,057 | $-2,756 | +1.62 | 30 |
| 5% | 1.0 | $1,021 | $479 | $542 | 0.29% | $-5,057 | $-4,588 | -0.41 | 6 |
| 7% | 1.0 | $989 | $0 | $989 | 0.53% | $-5,057 | $-5,066 | -1.00 | 0 |
| 10% | 1.0 | $987 | $0 | $987 | 0.53% | $-5,057 | $-5,066 | -1.00 | 0 |

## H9  MSTR  2024-01-05 -> 2026-09-18  ($50,000 invested; levered bitcoin proxy)

- Weekends covered: **142** of 142 (priced out above 2% on 0), breaches of 5%: **11**, average premium **30.4bp** per weekend
- Premiums paid **$72,770**, payouts received **$58,125**, net cost **$14,645** = 3.16% of holdings per year
- Worst weekend (2024-08-02, gap -27.4%): unprotected **$-31,402**, protected **$-14,447**
- Weekend CVaR99: -19.39% -> -5.64%; CVaR95: -9.69% -> -5.41%
- Certainty-equivalent gain: **+18.80bp/weekend** -> worth it to a gamma-4 holder. Peace-of-Mind Index **58/100**

| barrier | premium bp | paid | received | net cost | net %/yr | worst wknd unprot | worst wknd prot | CE gain bp | PMI |
|---|---|---|---|---|---|---|---|---|---|
| 3% | 52.8 | $125,335 | $108,518 | $16,817 | 3.63% | $-31,402 | $-11,542 | +22.76 | 67 |
| 5% | 30.4 | $72,770 | $58,125 | $14,645 | 3.16% | $-31,402 | $-14,447 | +18.80 | 58 |
| 7% | 19.5 | $46,769 | $34,679 | $12,090 | 2.61% | $-31,402 | $-19,027 | +17.60 | 46 |
| 10% | 11.3 | $27,207 | $23,185 | $4,022 | 0.87% | $-31,402 | $-23,713 | +19.36 | 35 |

## H10  GME  2020-06-05 -> 2021-12-31  ($25,000 invested; meme stock: huge up-gaps AND down-gaps)

- Weekends covered: **69** of 83 (priced out above 2% on 14), breaches of 5%: **1**, average premium **37.6bp** per weekend
- Premiums paid **$148,474**, payouts received **$0**, net cost **$148,474** = 14.25% of holdings per year
- Worst weekend (2021-04-01, gap -10.7%): unprotected **$-123,490**, protected **$-123,490**
- Weekend CVaR99: -10.68% -> -10.68%; CVaR95: -5.09% -> -5.53%
- Certainty-equivalent gain: **-32.26bp/weekend** -> not worth it to a gamma-4 holder. Peace-of-Mind Index **0/100**

| barrier | premium bp | paid | received | net cost | net %/yr | worst wknd unprot | worst wknd prot | CE gain bp | PMI |
|---|---|---|---|---|---|---|---|---|---|
| 3% | 60.5 | $246,570 | $11,869 | $234,701 | 22.53% | $-123,490 | $-123,490 | -46.61 | 2 |
| 5% | 37.6 | $148,474 | $0 | $148,474 | 14.25% | $-123,490 | $-123,490 | -32.26 | 0 |
| 7% | 30.5 | $131,788 | $0 | $131,788 | 12.65% | $-123,490 | $-123,490 | -25.86 | 0 |
| 10% | 24.8 | $126,630 | $7,880 | $118,750 | 11.40% | $-123,490 | $-135,010 | -20.64 | 0 |

## H11  SPY  2005-01-07 -> 2026-09-18  ($100,000 invested; twenty-one years of buy-and-hold, every weekend insured)

- Weekends covered: **1133** of 1133 (priced out above 2% on 0), breaches of 5%: **3**, average premium **1.3bp** per weekend
- Premiums paid **$40,796**, payouts received **$25,515**, net cost **$15,281** = 0.23% of holdings per year
- Worst weekend (2020-03-13, gap -10.4%): unprotected **$-32,095**, protected **$-26,052**
- Weekend CVaR99: -4.37% -> -3.72%; CVaR95: -2.15% -> -2.03%
- Certainty-equivalent gain: **-0.28bp/weekend** -> not worth it to a gamma-4 holder. Peace-of-Mind Index **10/100**

| barrier | premium bp | paid | received | net cost | net %/yr | worst wknd unprot | worst wknd prot | CE gain bp | PMI |
|---|---|---|---|---|---|---|---|---|---|
| 3% | 1.7 | $53,216 | $52,058 | $1,159 | 0.02% | $-32,095 | $-19,606 | +0.17 | 21 |
| 5% | 1.3 | $40,796 | $25,515 | $15,281 | 0.23% | $-32,095 | $-26,052 | -0.28 | 10 |
| 7% | 1.1 | $37,387 | $12,119 | $25,269 | 0.39% | $-32,095 | $-26,052 | -0.63 | 5 |
| 10% | 1.1 | $35,541 | $1,378 | $34,163 | 0.52% | $-32,095 | $-30,836 | -0.99 | 0 |

## H12  SMCI  2023-01-06 -> 2026-09-18  ($50,000 invested; AI-server high flyer with accounting scares)

- Weekends covered: **194** of 194 (priced out above 2% on 0), breaches of 5%: **8**, average premium **33.8bp** per weekend
- Premiums paid **$166,267**, payouts received **$75,833**, net cost **$90,434** = 10.40% of holdings per year
- Worst weekend (2024-08-02, gap -14.3%): unprotected **$-52,767**, protected **$-31,574**
- Weekend CVaR99: -13.91% -> -6.14%; CVaR95: -8.24% -> -5.36%
- Certainty-equivalent gain: **-8.90bp/weekend** -> not worth it to a gamma-4 holder. Peace-of-Mind Index **45/100**

| barrier | premium bp | paid | received | net cost | net %/yr | worst wknd unprot | worst wknd prot | CE gain bp | PMI |
|---|---|---|---|---|---|---|---|---|---|
| 3% | 54.7 | $264,683 | $137,939 | $126,744 | 14.58% | $-52,767 | $-32,054 | -12.09 | 58 |
| 5% | 33.8 | $166,267 | $75,833 | $90,434 | 10.40% | $-52,767 | $-31,574 | -8.90 | 45 |
| 7% | 22.0 | $108,819 | $48,800 | $60,019 | 6.90% | $-52,767 | $-29,225 | -6.15 | 32 |
| 10% | 13.0 | $64,544 | $23,430 | $41,114 | 4.73% | $-52,767 | $-37,121 | -5.96 | 17 |
