"""v2 data pull: underlying US equity/ETF daily OHLC (split+dividend adjusted) via yfinance.
Cached to data/equities/<TICKER>.csv. Re-run is idempotent (skips fresh files)."""
import os, sys, time, json
import yfinance as yf, pandas as pd
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
OUT = os.path.join(ROOT, "data", "equities"); os.makedirs(OUT, exist_ok=True)
UNIVERSE = json.load(open(os.path.join(ROOT, "data", "universe.json")))
tickers = sorted({t for grp in UNIVERSE.values() for t in grp})
START = "1990-01-01"
for t in tickers:
    fp = os.path.join(OUT, f"{t}.csv")
    if os.path.exists(fp) and (time.time() - os.path.getmtime(fp)) < 6*3600:
        continue
    for attempt in range(3):
        try:
            df = yf.download(t, start=START, end="2026-09-27", auto_adjust=True, progress=False, threads=False)
            if isinstance(df.columns, pd.MultiIndex):
                df.columns = df.columns.get_level_values(0)
            df = df[["Open","High","Low","Close","Volume"]].dropna()
            df.index.name = "Date"
            df.to_csv(fp)
            print(f"{t}: {len(df)} rows {df.index[0].date()} -> {df.index[-1].date()}")
            break
        except Exception as e:
            print(f"{t}: attempt {attempt} failed: {e}"); time.sleep(2*(attempt+1))
    time.sleep(0.4)
