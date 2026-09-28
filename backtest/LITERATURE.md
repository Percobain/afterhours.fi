# What the academic literature says about afterhours.fi

58 papers reviewed (full annotated bibliography with links: `research/05_literature.md`). Verdict first, then what changes, then the pivot question.

## Verdict: the design is on solid academic ground; three concrete changes; no pivot

**Validated**
- **Pooling tails across stocks (v4) is the published method, not a shortcut.** Kelly and Jiang (RFS 2014) estimate one time-varying tail exponent by pooling every firm's exceedances cross-sectionally, then rescale per stock. Gabaix (2009) shows standardised return tails follow a near-universal power law with exponent about 3. McNeil and Frey (2000) show that filtering by conditional vol before fitting the tail beats unconditional EVT, which is exactly why v4 beats v3 in our out-of-sample tests.
- **The weekend is roughly one trading day of variance, not 2.7 days.** French and Roll (1986). Our measured variance ratios (0.19 to 0.69 of a day, median 0.34) sit slightly below that; either way calendar-time pricing is wrong.
- **Sellers of weekend optionality have been systematically overpaid.** Jones and Shemesh (JF 2018): equity option returns are markedly lower over weekends and holidays, hedged or not, because the market treats closed-period variance as trading-time variance. That is the margin the Keeper pool earns, and it also means a calendar-time quote will be undercut by anyone who has read the paper.
- **Retail will pay above actuarial value for salient, modest, low-probability losses.** Sydnor (2010): households pay ~$100 a year to cut an expected $20 loss. Barseghyan et al. (2013): small probabilities are overweighted in deductible choices. Rabin and Thaler (2001): loss aversion explains it. Our certainty-equivalent test with gamma 4 is a conservative version of this.
- **The overnight window is a distinct market with a distinct clientele.** Lou, Polk and Skouras (2019); Hendershott, Livdan and Rosch (2020); Akbas et al. (2022). A product that isolates it is coherent.
- **Tranched, oracle-light risk pools and gap-risk swaps both have precedent.** Nadler, Bekemeier and Schar (2022, IEEE) describe a CDO-style DeFi risk pool without claims assessment; Tankov (2010) prices gap options, the bank instrument our payoff most resembles.
- **The premium has a name.** Borjigin and He (arXiv 2025) call the price of holding an asset while its primary market is closed the "liquidity-of-time premium" and derive a term structure rising in closure length and volatility. That is the frame to present quotes in.

**Three changes to make**
1. **Settlement print.** Stoll and Whaley (1990) and Amihud and Mendelson (1991) show the post-halt opening print is noisier than the close; Berkman et al. (2012) show retail-attention stocks open systematically high; Bahcivan et al. (2025) show overnight jumps overreact. Our backtest settles on the official opening auction print because that is the reference the RWA API will publish. Keep it as the default, add an outlier filter, and test a first-15-minute VWAP as the v3 alternative once intraday data is available. Disclose that protection is exact only at that print (Asness et al. 2025 show buffer-fund buyers are disappointed exactly when they misunderstand the reset).
2. **Sale window closes at Friday's bell, hard.** Perreten (2026) shows the gap becomes progressively predictable through pre-market; Bondarenko and Muravyev (2023) show the information arrives in the hours around the European open; Eaton, Shkilko and Werner (2025) show the Sunday-night nocturnal session already discovers prices for liquid names. Our token data (0% of the gap discovered by Sunday night, 95% by Monday 13:00 UTC) confirms the token itself does not leak, but futures and Blue Ocean do. Anyone allowed to buy after Friday close is buying with information.
3. **Earnings weekends are jumps, not tail risk.** Christensen, Timmermann and Veliyev (2026) and Dubinsky et al. (2019): announcements almost always produce jumps with predictable variance. Price them separately from option-implied jump variance or refuse cover. This was already the top v3 item; the literature makes it non-negotiable.

**Smaller adjustments**
- Do not expect a positive overnight drift to subsidise the pool (Boyarchenko, Larsen and Whelan, July 2026: near zero since 2021; Robins and Smith 2016: the negative weekend drift disappeared after 1975). Our pricing assumes zero drift already.
- Keep the risk load (Bollerslev and Todorov 2011: the market pays a large tail premium above actuarial loss). Our 50% is in range.
- CPPI with weekly rebalancing carries gap risk that rises with the multiplier (Balder, Brandl and Mahayni 2009; Cont and Tankov 2009). Our m = 10 is aggressive by CPPI standards; it survived because the worst observed weekly book loss was 6.7% of covered notional against a 10% breaking point. Offer m = 5 (20% capital) as the conservative Keeper tier and say so.
- Condition on beta and size (Hendershott et al.; Ahoniemi, Fuertes and Olmo 2016): a v5 refinement of the vol-scaling.

## The pivot question

Ranked by how well the literature supports each alternative:

1. **Gap option on tokenized stocks.** This is what we built. Tankov's gap option pays on a rapid downside move beyond a threshold; our policy pays on the Friday-close-to-Monday-open move beyond a barrier. No pivot needed; adopt the vocabulary.
2. **Binary "Monday gap beyond X%" market with an LMSR or CFMM market maker** (Hanson; Sterrett et al.; Kalshi calibration studies). Bounded pool loss and price discovery instead of underwriting. Worth a v2 experiment as a second instrument on the same settlement oracle, not a replacement: binary payouts do not make a holder whole.
3. **Liquidity-of-time provision.** Only about a third of the overnight spread is adverse selection (Lim 2026); the rest is scarcity rent. The Keeper pool, which knows the tail, is the natural weekend market maker in the token within EVT-based inventory bands. This is the most interesting extension: it turns the pool from a pure put-seller into the venue's weekend liquidity, and it is the "Space" and "Form" legs of the original spec. Roadmap, not hackathon.
4. **Overnight-only exposure vault** (Lachance 2023): documented but the aggregate drift has faded; a stock-selected version might work; weak.
5. **Selling weekend variance** (Jones and Shemesh): the most profitable side historically but it needs listed options; not on-chain.
6. **Pure principal-protection wrapper**: the literature is least kind here (Asness et al.; Celerier and Vallee). Our simulations agree: yield-funded sleeves are rate-regime products and static tranches do not remove the correlated loss. Keep principal protection as the Keeper's CPPI discipline and the holder's visible floor, not as the headline wrapper.

## One-line answers for the pitch

- "Is this academically defensible?" Kelly-Jiang 2014 for the pooled tail, McNeil-Frey 2000 for the vol filter, French-Roll 1986 for the clock, Jones-Shemesh 2018 for why sellers get paid, Sydnor 2010 for why buyers buy.
- "Why hasn't it been built?" Because until tokenization the closed session was not transferable, and the one attempt that exists (AfterHours, September 2026) uses the Black-Scholes clock the literature says is wrong.
- "What would a professor change?" The settlement print, the sale window, and earnings weekends. All three are in the build plan.
