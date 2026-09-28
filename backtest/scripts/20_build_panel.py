"""20 - Build the walk-forward premium panel (every ticker x weekend x barrier x pricing version).
Output: results/20_weekend_panel.parquet (+ .csv), results/20_model_fits.csv"""
import os, sys, json, time
import pandas as pd
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); sys.path.insert(0, ROOT)
from scripts.lib import pricing as P
RES = os.path.join(ROOT, "results"); os.makedirs(RES, exist_ok=True)
U = json.load(open(os.path.join(ROOT, "data", "universe.json")))
t0 = time.time()
panel, fits = P.build_panel(sorted(set(U["backtest_universe"]) | set(U.get("panel_extras", []))))
panel.to_parquet(os.path.join(RES, "20_weekend_panel.parquet"))
panel.to_csv(os.path.join(RES, "20_weekend_panel.csv"), index=False)
fits.to_csv(os.path.join(RES, "20_model_fits.csv"), index=False)
print(f"panel rows: {len(panel):,}  tickers: {panel.ticker.nunique()}  weekends: {panel.friday.nunique()}  years {panel.year.min()}-{panel.year.max()}  ({time.time()-t0:.0f}s)")
print("fallback share v2:", panel.p_v2_fb.mean().round(3), " v3:", panel.p_v3_fb.mean().round(3))
b5 = panel[panel.barrier == 0.05]
print("\nmean fair premium (bp) at 5% barrier by version:")
print((b5[["p_v1a","p_v1b","p_v2","p_v3","p_v4"]].mean()*1e4).round(2).to_string())
print("mean realised payout (bp):", round(b5.payout_open.mean()*1e4, 2))
