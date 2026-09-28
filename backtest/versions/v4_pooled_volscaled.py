"""v4 - Pooled, vol-scaled empirical tail (the production candidate).
Standardise every weekend gap in the universe by the ticker's trailing 20d daily vol known at that Friday:
   z = gap / sigma_d,   sigma_d = rv20 / sqrt(252)
Pool z across ALL tickers and ALL prior weekends (tens of thousands of obs -> the tail is populated).
Premium for ticker i on Friday t:  E[ max(-b - sigma_d(i,t) * z, 0) ]  over the pooled z.
Conditions on the current vol regime (sigma_d) and borrows tail information across names,
so a young or historically-quiet ticker is never priced at zero. Annual refit, strictly prior data.
Known weakness: assumes the standardised tail shape is common across names (tested in 10_universe_stats)."""
import numpy as np
NAME = "v4_pooled_volscaled"; DESC = "pooled z-gaps scaled by trailing 20d vol, annual refit"

def fit(pooled_z):
    z = np.asarray(pooled_z, float); z = z[np.isfinite(z)]
    if len(z) < 500: return None
    return {"z": np.sort(z), "n": len(z)}

def price(barrier, m, ctx):
    if m is None: return np.nan
    sd = ctx["rv20"] / np.sqrt(252.0)
    if not np.isfinite(sd) or sd <= 0: return np.nan
    return float(np.mean(np.maximum(-barrier - sd * m["z"], 0.0)))
