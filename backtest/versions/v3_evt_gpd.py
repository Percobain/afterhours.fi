"""v3 - Extreme Value Theory: peaks-over-threshold with a Generalised Pareto tail.
Losses L = -gap. Threshold u = 90th percentile of L. Excesses Y = L - u ~ GPD(xi, beta), MLE (scipy, floc=0).
  P(L > u + y)       = p_u * (1 + xi*y/beta)^(-1/xi)
  mean excess e(y)   = (beta + xi*y) / (1 - xi)                      (xi < 1)
  E[(L - b)+], b>=u  = p_u * (1 + xi*(b-u)/beta)^(-1/xi) * (beta + xi*(b-u)) / (1 - xi)
  E[(L - b)+], b< u  = empirical body part on (b, u] + p_u * ((u - b) + beta/(1-xi))
xi is clamped to [-0.5, 0.9]; xi -> 1 means infinite mean (uninsurable). Annual refit, prior data only."""
import numpy as np
from scipy.stats import genpareto
NAME = "v3_evt_gpd"; DESC = "POT/GPD tail on own history, annual refit"; MIN_OBS = 150; Q = 0.90

def fit(gaps):
    L = -np.asarray(gaps, float); L = L[np.isfinite(L)]
    if len(L) < MIN_OBS: return None
    u = np.quantile(L, Q); exc = L[L > u] - u
    if len(exc) < 12: return None
    try:
        xi, _, beta = genpareto.fit(exc, floc=0)
    except Exception:
        return None
    xi = float(np.clip(xi, -0.5, 0.9)); beta = float(max(beta, 1e-6))
    return {"u": float(u), "xi": xi, "beta": beta, "p_u": float(np.mean(L > u)), "L": L, "n_exc": int(len(exc))}

def tail_expected_shortfall_over(b, m):
    u, xi, beta, p_u = m["u"], m["xi"], m["beta"], m["p_u"]
    y = b - u
    base = 1 + xi * y / beta
    if base <= 0: return 0.0                       # beyond the finite endpoint of a short-tailed GPD
    surv = base ** (-1 / xi) if abs(xi) > 1e-9 else np.exp(-y / beta)
    return p_u * surv * (beta + xi * y) / (1 - xi)

def price(barrier, m, ctx=None):
    if m is None: return np.nan
    L, u = m["L"], m["u"]
    if barrier >= u:
        return float(tail_expected_shortfall_over(barrier, m))
    body = L[(L > barrier) & (L <= u)] - barrier
    return float(body.sum() / len(L) + m["p_u"] * ((u - barrier) + m["beta"] / (1 - m["xi"])))
