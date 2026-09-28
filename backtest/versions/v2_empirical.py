"""v2 - Per-ticker empirical (historical-simulation) expected payout, walk-forward.
premium_fair = mean( max(-b - gap, 0) ) over this ticker's OWN prior weekend gaps.
Refit once a year using strictly prior data (no look-ahead). Needs >= MIN_OBS weekends,
otherwise returns NaN and the caller falls back to v4 (pooled).
Weakness: a ticker with no breach in its history gets premium 0 -> the quiet-ticker trap."""
import numpy as np
NAME = "v2_empirical"; DESC = "own-history mean payout, annual refit"; MIN_OBS = 104

def fit(gaps):
    g = np.asarray(gaps, float); g = g[np.isfinite(g)]
    return {"gaps": g} if len(g) >= MIN_OBS else None

def price(barrier, model, ctx=None):
    if model is None: return np.nan
    return float(np.mean(np.maximum(-barrier - model["gaps"], 0.0)))
