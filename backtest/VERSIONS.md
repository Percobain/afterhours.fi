# Pricing engine versions

All versions quote a **fair premium** per $1 of covered notional for one closed session (Friday close to Monday open reference price) at barrier *b*. The product pays `max(-b - gap, 0)` per $1, i.e. the holder is made whole below the barrier line. The **charged premium** is `max(fair * (1 + load), floor)` with `load = 50%` and `floor = 1bp` (see `config.json`). Every version is evaluated **walk-forward**: the model used for weekends in year Y is fitted only on data dated before 1 January of Y (annual refit). Nothing in a quote uses information from after the Friday it is quoted on.

| version | file | formula | what it is for | verdict |
|---|---|---|---|---|
| v1a | `versions/v1_black_scholes.py` | Black-Scholes put, K = S(1-b), sigma = trailing 60d realised vol, **T = 65.5h / 8760h** (calendar clock) | the naive retail intuition | over-charges 10x on average; regime-blind |
| v1b | same | same put, **T = 1/252** (weekend = one trading day of variance) | the textbook trading-time convention | over-charges 4-5x on average, yet under-charges the calm-regime tail; the lognormal shape is wrong in both directions |
| v2 | `versions/v2_empirical.py` | `mean(max(-b - gap_i, 0))` over the ticker's **own** prior weekend gaps (>= 104 obs, else fall back to v4) | historical simulation | under-charges (loss ratio 0.83 with the load); 11% of quotes are zero because the ticker has no breach in its history yet |
| v3 | `versions/v3_evt_gpd.py` | peaks-over-threshold: losses above the 90th percentile u follow a Generalised Pareto (xi, beta), MLE. `E[(L-b)+] = p_u (1 + xi (b-u)/beta)^(-1/xi) (beta + xi (b-u)) / (1 - xi)` for b >= u; empirical body plus GPD tail for b < u. xi clamped to [-0.5, 0.9] | the EVT engine backtest-v1 asked for | better than v2 (loss ratio 0.73) but still under-charges: a per-ticker tail fitted on ~50 exceedances is noisy and slow to learn |
| **v4** | `versions/v4_pooled_volscaled.py` | standardise every gap by that Friday's trailing 20d daily vol, `z = gap / sigma_d`; pool z across **all** tickers and all prior weekends; quote `E[max(-b - sigma_d(t) z, 0)]` | production candidate: conditions on today's vol, borrows tail shape across names, never quotes zero | loss ratio 0.57 at 5% (target 0.67 for a 50% load); best Keeper Sharpe of the empirical engines; over-charges the wildest vol quintile and slightly under-charges the calmest |

## Settlement basis
Default settlement is the **Monday open** reference price (what the RWA API `referencePrice` snaps to at the bell). The panel also carries `payout_close` (settle at Monday close) for sensitivity: Volmageddon (2 Feb 2018) is the case where open-settled cover pays nothing and close-settled cover pays 4%.

## What changed since backtest-v1 (26 Sep 2026, AAPL 2015-17)
1. Universe: 1 ticker -> 50 (every Ondo/bStock BSC ticker with usable history), 104 weekends -> 61,815 ticker-weekends, 1990/2004 -> 2026.
2. Out-of-sample: v1 fitted the premium on the same payouts it scored. v2 is walk-forward everywhere.
3. The "Black-Scholes under-prices the 5% tail 15x" claim was made with a fixed 29% vol in a calm regime. With trailing realised vol the picture is: lognormal over-charges on average and under-charges exactly when it matters (calm regimes before a shock). The correct statement is "mis-calibrated by regime", not "always too cheap". See `results/21_loss_ratio_by_vol_regime.csv`.
4. The drift leg: closed-session drift is positive for most names over 2004-2026 (SPY +9.6%/yr closed vs +0.7%/yr open) - the opposite of the v1 finding on AAPL 2015-17. It is still not a pricing input (t-stats 1.5-3, regime dependent) and is not in the pitch.
5. Data hygiene: gaps below -75% are treated as unadjusted corporate actions in the vendor feed (SOXS 2026-05-22). AMC/APE-type distributions are kept and flagged as corporate-action basis risk.

## Candidates not built (and why)
- **v5 blended-vol**: `sigma = sqrt(w rv20^2 + (1-w) rv252^2)`, a GARCH-like shrink that would stop v4 over-charging in vol spikes. Worth building if the regime table shows the wildest quintile's loss ratio far below the others.
- **Earnings-calendar flag**: needs a reliable historical earnings-date source; not available offline. Breach clustering round earnings is visible by eye (NVDA Jan 2019, META, NFLX) and should be a refuse-or-widen rule in the engine.
- **Implied vol input**: listed-option IV would sharpen v4's sigma_d; no free history offline.
