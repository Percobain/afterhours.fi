# Research 5 - Academic literature: weekend gap risk, tail pricing, portfolio insurance, DeFi risk pools

*Compiled 26 Sep 2026 by a research agent (26 searches, ~45 fetches). "verified" = confirmed against journal, RePEc, arXiv or PDF; "partially verified" = search-index only. No dedicated search was completed on day-of-week implied volatility, parametric-insurance reviews, or opening-auction liquidity provision (budget exhausted).*

## (a) Annotated bibliography

### Theme 1 - Overnight vs intraday returns; weekend effects
1. **French (1980)**, "Stock returns and the weekend effect," JFE 8:55-69. verified. Negative Monday returns; rejects both calendar-time and trading-time hypotheses. https://ideas.repec.org/a/eee/jfinec/v8y1980i1p55-69.html
2. **Keim & Stambaugh (1984)**, JF 39:819-835. verified. Negative Monday returns back to 1928.
3. **Rogalski (1984)**, JF 39. verified. The negative Monday return accrues Friday-close-to-Monday-open, not during Monday's session. *The weekend gap is the anomalous window.*
4. **Robins & Smith (2016)**, "No more weekend effect," Critical Finance Review 5:417-424. verified. Post-1975 weekend return insignificant. *Do not bake a negative weekend drift into premiums.* https://cfr.ivo-welch.org/published/papers/cfr-0038.pdf
5. **Cooper, Cliff & Gulen (2008)**, SSRN 1004081. verified. US equity premium 1993-2006 accrues entirely overnight.
6. **Kelly & Clark (2011)**, J. Asset Management 12:132-145. verified. QQQ close-to-open +23.7%/yr vs open-to-close -23.3% (1999-2006).
7. **Berkman, Koch, Tuttle & Zhang (2012)**, JFQA 47:715-741. verified. Retail attention inflates opening prices, followed by intraday reversal. *A Monday-open settlement on retail-attention stocks is biased.*
8. **Lou, Polk & Skouras (2019)**, "A tug of war," JFE 134:192-213. verified. Overnight and intraday returns each persist and offset.
9. **Hendershott, Livdan & Rosch (2020)**, "Asset pricing: a tale of night and day," JFE 138:635-662. verified. CAPM beta priced overnight, negatively intraday. *Condition gap distributions on beta.*
10. **Bogousslavsky (2021)**, JFE 141:172-194. verified. Anomalies accrue at different times of day; closing auction embeds a last-30-minute premium.
11. **Akbas, Boehmer, Jiang & Koch (2022)**, JFE 145:850-875. verified. Stock-level overnight/intraday tug of war is persistent.
12. **Bondarenko & Muravyev (2023)**, "Market return around the clock: a puzzle," JFQA 58. verified. In E-mini futures, four hours around the European open account for the entire average market return (Sharpe 1.6). *Sunday night to Monday open is where new information first prints.*
13. **Boyarchenko, Larsen & Whelan (2023)**, "The overnight drift," RFS 36:3502-3547. verified. Positive overnight drift tied to prior-close order imbalances; asymmetric after sell-offs.
14. **Boyarchenko, Larsen & Whelan (2026)**, "The disappearing overnight drift," Liberty Street Economics, 1 Jul 2026. verified. The drift has been near zero since 2021. https://libertystreeteconomics.newyorkfed.org/2026/07/the-disappearing-overnight-drift/
15. **Lu, Malliaris & Qin (2023)**, JFE 148:175-200. verified. Fast informed arbitrageurs charge large fees to absorb opening imbalances. *A gap insurer is the Monday-open liquidity provider and faces that adverse selection.*
16. **Lachance (2023)**, Review of Financial Economics 41:347-363. verified. One fifth of stocks show persistent positive overnight bias.
17. **Glasserman, Krstovski, Laliberte & Mamaysky (2025)**, arXiv:2507.04481. verified. Overnight/intraday return gap largely explained by news-topic prevalence. https://arxiv.org/abs/2507.04481
18. **Eaton, Shkilko & Werner (2025)**, "Nocturnal Trading," AFA 2026. verified. 8pm-4am trading is retail-dominated, one platform (Blue Ocean), two market makers; significant price discovery. *An overnight reference exists Sunday night, not Saturday.* https://afajof.org/management/viewp.php?n=162176
19. **Lim (2026)**, SSRN 6610883. partially verified. Overnight effective spreads ~7c wider; only about a third is adverse selection.
20. **Perreten (2026)**, "Price discovery overnight," Univ. of Fribourg. verified. Explanatory power for the close-to-open gap rises smoothly through pre-market. *Do not let policyholders buy after Friday close.*

### Theme 2 - Jump and gap risk at the open
21. **French & Roll (1986)**, JFE 17:5-26. verified. Weekend variance only slightly above a normal weekday. *A 65-hour weekend is roughly one trading day of variance.* https://www.sciencedirect.com/science/article/abs/pii/0304405X86900048
22. **Stoll & Whaley (1990)**, RFS 3:37-71. verified. Open-to-open variance exceeds close-to-close; the opening print is noisy.
23. **Amihud & Mendelson (1991)**, JF 46:1765-1789. verified. Post-halt opening calls are noisy and inefficient.
24. **Barclay & Hendershott (2003)**, RFS 16:1041-1073. verified. After-hours: less efficient prices but more information per trade.
25. **Andersen, Bollerslev & Diebold (2007)**, "Roughing it up," REStat 89:701-720. verified. Bipower-variation jump detection. https://www.nber.org/papers/w11775
26. **Ahoniemi, Fuertes & Olmo (2016)**, J. Financial Econometrics 14:525-551. verified. Joint overnight/daytime VaR; small caps' opening discovery is inefficient.
27. **Bahcivan, Dam & Gonenc (2025)**, SSRN 5648748. partially verified. Overnight jumps overreact and reverse short-term.
28. **Christensen, Timmermann & Veliyev (2026)**, "Warp speed price moves: jumps after earnings announcements," arXiv:2601.08962. verified. Earnings almost always induce jumps. https://arxiv.org/abs/2601.08962
29. **He (2026)**, "Interpretable systematic risk around the clock," arXiv:2604.13458. abstract verified. Macro news carries the largest jump premium.

### Theme 3 - EVT and pooled tail estimation
30. **Embrechts, Kluppelberg & Mikosch (1997)**, *Modelling Extremal Events*, Springer. Canonical POT/GPD reference (not fetched).
31. **McNeil & Frey (2000)**, J. Empirical Finance 7:271-300. verified. GARCH filter then GPD on standardised residuals beats unconditional EVT. *Fit EVT to vol-standardised gaps.* https://faculty.washington.edu/ezivot/econ589/EVT_Mcneil_Frey_2000.pdf
32. **Gabaix (2009)**, Annual Review of Economics 1:255-293. verified. Inverse-cubic law of returns (tail exponent ~3) across stocks. *Empirical basis for a common standardised tail.*
33. **Bollerslev & Todorov (2011)**, "Tails, fears, and risk premia," JF 66:2165-2211. verified. Market pays a large tail premium above actuarial EVT loss. *Include a risk load.*
34. **Kelly & Jiang (2014)**, "Tail risk and asset prices," RFS 27:2841-2871. verified. Pools all firm-level exceedances cross-sectionally to estimate one time-varying tail exponent. *The academic precedent for the v4 pooled engine.* https://academic.oup.com/rfs/article/27/10/2841/1607080

### Theme 4 - Option pricing over non-trading periods
35. **Jones & Shemesh (2018)**, "Option mispricing around nontrading periods," JF 73:861-900. verified. Equity option returns markedly lower over weekends and holidays, unhedged and delta-hedged; the market treats closed-period variance as trading-time variance. *Sellers of weekend optionality have been systematically overpaid; price in trading time.* https://onlinelibrary.wiley.com/doi/10.1111/jofi.12603
36. **Dubinsky, Johannes, Kaeck & Seeger (2019)**, RFS 32:646-687. verified. Announcement-day jump variance is large, time-varying, predictable. *Earnings weekends need an explicit jump-variance add-on.*

### Theme 5 - Portfolio insurance and principal protection
37. Rubinstein & Leland (1981), FAJ 37:63-72. unverified. OBPI foundation.
38. **Black & Perold (1992)**, JEDC 16:403-426. verified. CPPI theory.
39. **Bertrand & Prigent (2005)**, "OBPI versus CPPI," Finance 26:5-32. verified. OBPI is a CPPI with a time-varying multiple. https://papers.ssrn.com/sol3/papers.cfm?abstract_id=299688
40. **Balder, Brandl & Mahayni (2009)**, JEDC 33:204-220. verified. With discrete rebalancing the floor can be breached between dates; shortfall grows with multiplier. https://www.sciencedirect.com/science/article/abs/pii/S0165188908000973
41. **Cont & Tankov (2009)**, Math. Finance 19:379-401. verified. Gap risk under jumps grows with multiplier even with continuous rebalancing.
42. **Tankov (2010)**, "Pricing and hedging gap risk," J. Computational Finance 13:33-59. verified. Gap options pay on rapid downside moves; jumps are necessary to price them. *The bank instrument our product resembles.* https://papers.ssrn.com/sol3/papers.cfm?abstract_id=1263352
43. **Asness, Cao, Ilmanen & Villalon (2025)**, "Rebuffed: an empirical review of buffer funds," J. Portfolio Management 51(10). verified. 401 funds underperform; 75% of off-cycle rolling-year outcomes fall below the "protected" level. *Protection exact only at reset dates disappoints.* https://www.pm-research.com/content/iijpormgmt/51/10/120

### Theme 6 - Insurance economics and demand
44. **Rabin & Thaler (2001)**, JEP 15:219-232. verified. Loss aversion explains moderate-stakes risk aversion.
45. **Sydnor (2010)**, "(Over)insuring modest risks," AEJ Applied 2:177-199. verified. Homeowners pay ~$100/yr to lower a deductible by $500 at ~4% claim probability. https://www.aeaweb.org/articles?id=10.1257%2Fapp.2.4.177
46. **Barseghyan, Molinari, O'Donoghue & Teitelbaum (2013)**, AER 103:2499-2529. verified. Probability distortions drive deductible choices.
47. **Kunreuther & Pauly (2004)**, Foundations and Trends in Microeconomics 1(2). verified. Consumers focus on coverage/premium ratio, neglect loss probability.
48. **Celerier & Vallee (2017)**, "Catering to investors through security design," QJE 132:1469-1508. verified. Complexity correlates with distributor margins. *Keep the wrapper transparent.*

### Theme 7 - DeFi insurance, options vaults, tokenized equities
49. **Cousaert, Xu & Matsui (2022)**, arXiv:2109.07902. verified. Taxonomy of on-chain insurance.
50. **Nadler, Bekemeier & Schar (2022)**, "DeFi risk transfer," arXiv:2212.10308 (IEEE). verified. CDO-style tranched risk pool with no claims assessment or oracle. *Precedent for the junior/senior vault.* https://arxiv.org/abs/2212.10308
51. **Sterrett, Jepsen & Kim (2022)**, "Replicating portfolios," arXiv:2205.09890. verified. Options as oracle-free CFMMs.
52. **Xu et al. (2024)**, "BakUp," arXiv:2410.09341. verified. Capital-efficiency critique of Nexus/inSure.
53. **Borjigin & He (2025)**, "Intertemporal pricing of time-bound stablecoins: the liquidity-of-time premium," arXiv:2510.05711. verified. Prices "the underlying is closed" as a term structure rising in closure length and volatility. *Our weekend premium is a liquidity-of-time premium.* https://arxiv.org/abs/2510.05711
54. **Cong, Landsman, Rabetti, Zhang & Zhao (Dec 2025)**, "Tokenized stocks," SSRN 5937314. partially verified. First empirical study of price discovery in tokenized stocks under 24/7 trading.
55. **Hanson (2007)**, LMSR, J. Prediction Markets 1(1). verified. Bounded-loss AMM for binary markets.
56. **IMF Note 2026/001 "Tokenized Finance"; BIS AER 2025 Ch. III.** BIS verified. Both flag 24/7 settlement outrunning business-day backstops.

### Theme 8 - Adjacent
57. Kalshi calibration: UCD WP2025/19 (partially verified); "Decomposing crowd wisdom," arXiv:2602.19520. Short-horizon binary markets are calibrated enough to host a "Monday gap > X%" market.
58. Overnight-return harvesting: Lachance (2023), Kelly & Clark (2011), Cooper et al. (2008). Variance swaps over non-trading periods: no academic paper found.

## (b) What the literature says the product gets right
1. Overnight is a distinct risk-bearing window with its own clientele (Lou-Polk-Skouras; Hendershott et al.; Akbas et al.; Lu et al.).
2. Pooling tails cross-sectionally is well founded (Kelly-Jiang; Gabaix).
3. GARCH-then-EVT on standardised gaps is the right pipeline (McNeil-Frey).
4. Retail demand exists and pays above actuarial value for salient, modest, low-probability losses (Sydnor; Barseghyan et al.; Rabin-Thaler).
5. Tranched, oracle-light pooled capital has precedent (Nadler et al.; Sterrett et al.); gap-risk swaps are an established bank product (Tankov).
6. The overnight liquidity provider earns a fee for adverse selection (Lu et al.; Lim).

## (c) What it says we get wrong or should change
1. Price in trading time, not calendar time (French-Roll; Jones-Shemesh). Weekend variance ~1.0-1.3x a weekday gap, scaled by conditional vol.
2. Settlement reference: do not use the raw opening print (Stoll-Whaley; Amihud-Mendelson; Berkman et al.; Bahcivan et al.). Prefer the official opening auction with an outlier filter or a first-15-to-30-minute VWAP.
3. Close the sale window at Friday close (Perreten; Eaton et al.; Bondarenko-Muravyev).
4. Earnings weekends are near-certain jumps, not tail risk (Christensen et al.; Dubinsky et al.).
5. Do not count on a positive overnight drift (Boyarchenko et al. 2026; Robins-Smith).
6. Add a risk load above EVT expected loss (Bollerslev-Todorov).
7. CPPI with weekly rebalancing has real gap risk (Balder et al.; Cont-Tankov): keep multipliers low or buy the gap explicitly.
8. Reset-date problem (Asness et al.): price continuously and disclose that protection is exact only at the stated open.
9. Condition on beta and size (Hendershott et al.; Ahoniemi et al.).
10. Expect the "liquidity-of-time premium" to be the frame regulators use (Borjigin-He; IMF; BIS).

## (d) Pivot candidates the literature supports (ranked)
1. **Gap option / gap-risk swap on tokenized stocks** (Tankov; Cont-Tankov): pays only beyond a threshold; matches what banks trade; EVT-priced. Strongest fit with the existing engine.
2. **Binary "Monday gap > X%" event market with LMSR/CFMM pricing** (Hanson; Sterrett et al.; Kalshi calibration).
3. **Liquidity-of-time provision**: market-making tokenized stocks while the underlying is closed, charging the premium (Borjigin-He; Eaton et al.; Lim). Only about a third of the overnight spread is adverse selection; the rest is scarcity rent.
4. **Overnight-only exposure product** (Lachance; Kelly-Clark): documented but the aggregate drift has faded.
5. **Sell weekend variance** (Jones-Shemesh): needs listed options.
6. **Pure principal-protection wrapper**: weakest (Asness et al.; Celerier-Vallee).

## (e) Five quotable facts
1. "The variance of the total return over a weekend or a holiday is only slightly higher than the variance of the total return over a normal weekday." French & Roll, JFE 1986.
2. Equity option returns are significantly lower over weekends, reflecting "widespread and highly persistent option mispricing driven by the incorrect treatment of stock return variance during periods of market closure." Jones & Shemesh, JF 2018.
3. "Four hours around the European open account for the entire average market return" in E-mini S&P futures, Sharpe 1.6. Bondarenko & Muravyev, JFQA 2023.
4. The overnight drift of ~3.7%/yr (1998-2020) has "averaged close to zero" since 2021. Boyarchenko, Larsen & Whelan, Liberty Street Economics, July 2026.
5. Homeowners pay roughly $100 per year to reduce a deductible by $500 against a ~4% claim probability. Sydnor, AEJ Applied 2010.

## (f) Sources
French 1980 https://ideas.repec.org/a/eee/jfinec/v8y1980i1p55-69.html ; Keim & Stambaugh 1984 https://onlinelibrary.wiley.com/doi/abs/10.1111/j.1540-6261.1984.tb03675.x ; Rogalski 1984 https://onlinelibrary.wiley.com/doi/10.1111/j.1540-6261.1984.tb04927.x ; Robins & Smith 2016 https://cfr.ivo-welch.org/published/papers/cfr-0038.pdf ; Cooper, Cliff & Gulen 2008 https://papers.ssrn.com/sol3/papers.cfm?abstract_id=1004081 ; Kelly & Clark 2011 https://link.springer.com/article/10.1057/jam.2011.2 ; Berkman et al. 2012 https://www.cambridge.org/core/journals/journal-of-financial-and-quantitative-analysis/article/abs/paying-attention-overnight-returns-and-the-hidden-cost-of-buying-at-the-open/F9AAD159B512C651F09D5D52011D88E0 ; Lou, Polk & Skouras 2019 https://www.sciencedirect.com/science/article/abs/pii/S0304405X19300650 ; Hendershott, Livdan & Rosch 2020 https://papers.ssrn.com/sol3/papers.cfm?abstract_id=3117663 ; Bogousslavsky 2021 https://www.sciencedirect.com/science/article/abs/pii/S0304405X21000854 ; Akbas et al. 2022 https://ideas.repec.org/a/eee/jfinec/v145y2022i3p850-875.html ; Bondarenko & Muravyev 2023 https://www.cambridge.org/core/journals/journal-of-financial-and-quantitative-analysis/article/abs/market-return-around-the-clock-a-puzzle/089E33AC0B4D3B9A02CBA31EDF6505B3 ; Boyarchenko, Larsen & Whelan 2023 https://academic.oup.com/rfs/article-abstract/36/9/3502/7076616 ; Boyarchenko et al. 2026 https://libertystreeteconomics.newyorkfed.org/2026/07/the-disappearing-overnight-drift/ ; Lu, Malliaris & Qin 2023 https://ideas.repec.org/a/eee/jfinec/v148y2023i3p175-200.html ; Lachance 2023 https://onlinelibrary.wiley.com/doi/full/10.1002/rfe.1180 ; Glasserman et al. 2025 https://arxiv.org/abs/2507.04481 ; Eaton, Shkilko & Werner 2025 https://afajof.org/management/viewp.php?n=162176 ; Lim 2026 https://papers.ssrn.com/sol3/papers.cfm?abstract_id=6610883 ; Perreten 2026 https://mfc3.eventsadmin.com/Papers/ViewContribution?cid=14387&h=34E9F3229E21B084DE4A06E94CD0FC5F ; French & Roll 1986 https://www.sciencedirect.com/science/article/abs/pii/0304405X86900048 ; Stoll & Whaley 1990 https://econpapers.repec.org/RePEc:oup:rfinst:v:3:y:1990:i:1:p:37-71 ; Amihud & Mendelson 1991 https://ideas.repec.org/a/bla/jfinan/v46y1991i5p1765-89.html ; Barclay & Hendershott 2003 https://academic.oup.com/rfs/article/16/4/1041/1576361 ; Andersen, Bollerslev & Diebold 2007 https://www.nber.org/papers/w11775 ; Ahoniemi, Fuertes & Olmo 2016 https://ideas.repec.org/a/oup/jfinec/v14y2016i3p525-551..html ; Bahcivan, Dam & Gonenc 2025 https://papers.ssrn.com/sol3/papers.cfm?abstract_id=5648748 ; Christensen, Timmermann & Veliyev 2026 https://arxiv.org/abs/2601.08962 ; He 2026 https://arxiv.org/abs/2604.13458 ; McNeil & Frey 2000 https://faculty.washington.edu/ezivot/econ589/EVT_Mcneil_Frey_2000.pdf ; Gabaix 2009 https://pages.stern.nyu.edu/~xgabaix/papers/pl-ar.pdf ; Bollerslev & Todorov 2011 https://ideas.repec.org/a/bla/jfinan/v66y2011i6p2165-2211.html ; Kelly & Jiang 2014 https://academic.oup.com/rfs/article/27/10/2841/1607080 ; Jones & Shemesh 2018 https://onlinelibrary.wiley.com/doi/10.1111/jofi.12603 ; Dubinsky et al. 2019 https://ideas.repec.org/a/oup/rfinst/v32y2019i2p646-687..html ; Black & Perold 1992 https://ideas.repec.org/a/eee/dyncon/v16y1992i3-4p403-426.html ; Bertrand & Prigent 2005 https://papers.ssrn.com/sol3/papers.cfm?abstract_id=299688 ; Balder, Brandl & Mahayni 2009 https://www.sciencedirect.com/science/article/abs/pii/S0165188908000973 ; Cont & Tankov 2009 https://onlinelibrary.wiley.com/doi/abs/10.1111/j.1467-9965.2009.00377.x ; Tankov 2010 https://papers.ssrn.com/sol3/papers.cfm?abstract_id=1263352 ; Asness et al. 2025 https://www.pm-research.com/content/iijpormgmt/51/10/120 ; Rabin & Thaler 2001 https://ideas.repec.org/a/aea/jecper/v15y2001i1p219-232.html ; Sydnor 2010 https://www.aeaweb.org/articles?id=10.1257%2Fapp.2.4.177 ; Barseghyan et al. 2013 https://www.aeaweb.org/articles?id=10.1257/aer.103.6.2499 ; Kunreuther & Pauly 2004 https://repository.upenn.edu/hcmg_papers/4/ ; Celerier & Vallee 2017 https://ideas.repec.org/a/oup/qjecon/v132y2017i3p1469-1508..html ; Cousaert, Xu & Matsui 2022 https://arxiv.org/pdf/2109.07902 ; Nadler, Bekemeier & Schar 2022 https://arxiv.org/abs/2212.10308 ; Sterrett, Jepsen & Kim 2022 https://arxiv.org/abs/2205.09890 ; BakUp 2024 https://arxiv.org/html/2410.09341v1 ; Borjigin & He 2025 https://arxiv.org/abs/2510.05711 ; Cong et al. 2025 https://papers.ssrn.com/sol3/papers.cfm?abstract_id=5937314 ; Hanson LMSR https://mason.gmu.edu/~rhanson/mktscore.pdf ; IMF Note 2026/001 https://www.imf.org/en/publications/imf-notes/issues/2026/04/01/tokenized-finance-574921 ; BIS AER 2025 Ch. III https://www.bis.org/publ/arpdf/ar2025e3.htm ; UCD WP2025/19 https://www.ucd.ie/economics/t4media/WP2025_19.pdf ; arXiv:2602.19520 https://arxiv.org/pdf/2602.19520
