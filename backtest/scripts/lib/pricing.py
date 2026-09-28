"""Walk-forward premium panel: for every ticker x weekend x barrier, premiums under every version.
Annual refit: the model used for weekends in year Y is fitted on data with date < Jan 1 of Y (no look-ahead)."""
import os, sys, json
import numpy as np, pandas as pd
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, ROOT)
from scripts.lib import sessions as S
from versions import v1_black_scholes as V1, v2_empirical as V2, v3_evt_gpd as V3, v4_pooled_volscaled as V4

CFG = json.load(open(os.path.join(ROOT, "config.json")))
BARRIERS = CFG["barriers"]; LOAD = CFG["risk_load"]; FLOOR = CFG["premium_floor"]
VERSIONS = ["v1a", "v1b", "v2", "v3", "v4"]

def raw_panel(tickers):
    frames = []
    for t in tickers:
        try: s = S.weekend_like(S.sessions(t))
        except FileNotFoundError: continue
        if len(s): frames.append(s.reset_index().rename(columns={"Date": "friday"}))
    panel = pd.concat(frames, ignore_index=True)
    # young listings: no 20d vol for the first month -> use 2x the cross-sectional median vol that Friday (new listings are volatile)
    med = panel.groupby("friday")["rv20"].transform("median")
    panel["rv20_filled"] = panel["rv20"].isna(); panel["rv20"] = panel["rv20"].fillna(2.0 * med)
    panel["rv60"] = panel["rv60"].fillna(panel["rv20"])
    panel["year"] = panel["friday"].dt.year
    panel["sigma_d"] = panel["rv20"] / np.sqrt(252)
    panel["z"] = panel["gap_open"] / panel["sigma_d"]
    return panel.sort_values(["friday", "ticker"]).reset_index(drop=True)

def build_panel(tickers, start_year=None):
    start_year = start_year or CFG["backtest_start_year"]
    panel = raw_panel(tickers)
    years = sorted(y for y in panel["year"].unique() if y >= start_year)
    rows = []; fits = []
    for y in years:
        prior = panel[panel["year"] < y]
        m4 = V4.fit(prior["z"].values)
        cur = panel[panel["year"] == y]
        for t, g in cur.groupby("ticker"):
            hist = prior.loc[prior["ticker"] == t, "gap_open"].values
            m2 = V2.fit(hist); m3 = V3.fit(hist)
            fits.append({"year": y, "ticker": t, "n_hist": len(hist), "v3_xi": m3["xi"] if m3 else np.nan,
                         "v3_beta": m3["beta"] if m3 else np.nan, "v3_u": m3["u"] if m3 else np.nan, "v4_n": m4["n"] if m4 else 0})
            for r in g.itertuples(index=False):
                ctx = {"rv60": r.rv60, "rv20": r.rv20, "hours": r.hours}
                base = r._asdict()
                for b in BARRIERS:
                    rec = dict(base); rec["barrier"] = b
                    rec["payout_open"] = max(-b - r.gap_open, 0.0); rec["payout_close"] = max(-b - r.gap_close, 0.0)
                    rec["p_v1a"] = V1.price_calendar(b, ctx); rec["p_v1b"] = V1.price_trading(b, ctx)
                    rec["p_v2"] = V2.price(b, m2); rec["p_v3"] = V3.price(b, m3, ctx); rec["p_v4"] = V4.price(b, m4, ctx)
                    rows.append(rec)
    out = pd.DataFrame(rows)
    for v in ("p_v2", "p_v3"):                       # own-history models fall back to the pooled model
        out[v + "_fb"] = out[v].isna(); out[v] = out[v].fillna(out["p_v4"])
    for v in VERSIONS:                               # charged premium = fair * (1 + load), floored
        out["q_" + v] = np.maximum(out["p_" + v] * (1 + LOAD), FLOOR)
    return out, pd.DataFrame(fits)
