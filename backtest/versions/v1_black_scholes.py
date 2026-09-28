"""v1 - Black-Scholes / lognormal put on the weekend gap. THE BASELINE THAT FAILS.
Premium = BS put(K = S(1-b), sigma = trailing realised vol, T) / S, r = q = 0.
Two clocks:  v1a calendar time  T = hours/8760   (what a naive retail user intuits)
             v1b trading time   T = 1/252         (weekend = one trading day of variance)
Kept only to quantify how badly a textbook model underprices the tail (backtest-v1: 15x at 5%, ~3700x at 7%)."""
import numpy as np
from scipy.stats import norm
NAME = "v1_black_scholes"; DESC = "lognormal put, trailing 60d realised vol"

def bs_put_over_S(sigma, T, b):
    if not np.isfinite(sigma) or sigma <= 0 or T <= 0: return np.nan
    K = 1.0 - b
    d1 = (np.log(1.0 / K) + 0.5 * sigma**2 * T) / (sigma * np.sqrt(T)); d2 = d1 - sigma * np.sqrt(T)
    return float(K * norm.cdf(-d2) - norm.cdf(-d1))

def price_calendar(barrier, ctx):
    return bs_put_over_S(ctx["rv60"], ctx["hours"] / 8760.0, barrier)

def price_trading(barrier, ctx):
    return bs_put_over_S(ctx["rv60"], 1.0 / 252.0, barrier)
