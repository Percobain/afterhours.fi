"""Closed-session decomposition of daily OHLC.

A *closed session* is Close[i] -> Open[i+1]. We classify:
  overnight     : next trading day is the next calendar day (1 night, ~17.5h)
  weekend       : Friday close -> Monday open (3 nights, 65h)
  long_weekend  : Fri/Thu close -> Mon/Tue open spanning a weekend + holiday (4-5 nights)
  holiday       : midweek closure (2 nights, not spanning a weekend)
  closure       : anything longer (e.g. 9/11 week)
gap_open  = Open[i+1]/Close[i] - 1  (settlement basis used by the product: Monday reference price)
gap_close = Close[i+1]/Close[i] - 1 (sensitivity: settle at Monday close)
"""
import os, functools
import numpy as np, pandas as pd

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
EQ = os.path.join(ROOT, "data", "equities")
WEEKEND_HOURS = 65.5  # Fri 16:00 ET -> Mon 09:30 ET

@functools.lru_cache(maxsize=None)
def load_equity(ticker: str) -> pd.DataFrame:
    fp = os.path.join(EQ, f"{ticker}.csv")
    df = pd.read_csv(fp, parse_dates=["Date"], index_col="Date")
    df = df[(df["Open"] > 0) & (df["Close"] > 0)].copy()
    return df

def available_tickers():
    return sorted(f[:-4] for f in os.listdir(EQ) if f.endswith(".csv"))

def sessions(ticker: str) -> pd.DataFrame:
    df = load_equity(ticker)
    d = df.index.to_series()
    nxt = d.shift(-1)
    out = pd.DataFrame(index=df.index)
    out["ticker"] = ticker
    out["close"] = df["Close"]; out["next_open"] = df["Open"].shift(-1); out["next_close"] = df["Close"].shift(-1)
    out["next_date"] = nxt
    out["nights"] = (nxt - d).dt.days
    out["hours"] = out["nights"] * 24 - 6.5
    out["gap_open"] = out["next_open"] / out["close"] - 1
    out["gap_close"] = out["next_close"] / out["close"] - 1
    out["intraday"] = df["Close"] / df["Open"] - 1
    out["cc_ret"] = df["Close"].pct_change()
    wd = d.dt.weekday; nwd = nxt.dt.weekday
    spans_weekend = (nwd < wd) | (out["nights"] >= 7)
    kind = np.where(out["nights"] == 1, "overnight",
           np.where((wd == 4) & (nwd == 0) & (out["nights"] == 3), "weekend",
           np.where(spans_weekend & (out["nights"] <= 5), "long_weekend",
           np.where(out["nights"] >= 6, "closure", "holiday"))))
    out["kind"] = kind
    # trailing realized vols (close-to-close), annualised, known at the Friday close
    for w in (20, 60, 252):
        out[f"rv{w}"] = out["cc_ret"].rolling(w).std() * np.sqrt(252)
    out = out.dropna(subset=["next_open"])
    # data hygiene: an unadjusted split/reverse-split in the vendor feed shows up as an impossible gap
    # (e.g. SOXS 2026-05-22: fund price 1132 -> 61). No listed equity in this universe opened -75% on a Monday.
    bad = (out["gap_open"] < -0.75) | (out["gap_open"] > 2.0)
    out.loc[bad, ["gap_open", "gap_close", "cc_ret"]] = np.nan
    out["data_flag"] = np.where(bad, "suspected_unadjusted_corporate_action", "")
    out = out.dropna(subset=["gap_open"])
    return out

def weekend_like(s: pd.DataFrame) -> pd.DataFrame:
    """Sessions the product covers: any closed session that spans a weekend (3-5 nights)."""
    return s[s["kind"].isin(["weekend", "long_weekend"])]

def vix_series() -> pd.Series:
    try:
        v = load_equity("^VIX")["Close"]; v.name = "vix"; return v
    except FileNotFoundError:
        return pd.Series(dtype=float)

def payout(gap: np.ndarray, barrier: float) -> np.ndarray:
    """Sleeper is made whole below the barrier line: payout per $1 notional."""
    return np.maximum(-barrier - gap, 0.0)
