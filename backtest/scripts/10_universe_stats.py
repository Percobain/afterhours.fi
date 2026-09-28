"""10 - Universe statistics: session decomposition, variance ratios, tail shape, breach frequencies.
Reproduces backtest-v1 section 1-3 on the full bStocks+Ondo universe, 1990/2004 -> 2026.
Outputs: results/10_session_stats.csv, results/10_breach_table.csv, results/10_tail_shape.csv, charts/10_*.png"""
import os, sys, json
import numpy as np, pandas as pd
from scipy import stats
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); sys.path.insert(0, ROOT)
from scripts.lib import sessions as S, viz as V
import matplotlib.pyplot as plt

RES = os.path.join(ROOT, "results"); os.makedirs(RES, exist_ok=True)
U = json.load(open(os.path.join(ROOT, "data", "universe.json")))
TICKERS = U["backtest_universe"]; ETFS = set(U["etfs"]); BST = set(U["bstock_bsc_with_data"])
BARRIERS = [0.03, 0.05, 0.07, 0.10]

rows = []; breach = []; allw = []
for t in TICKERS:
    s = S.sessions(t)
    w = S.weekend_like(s); o = s[s.kind == "overnight"]
    if len(w) < 100: continue
    r = {"ticker": t, "wrapper": ("bStock+Ondo" if t in BST else "Ondo"), "etf": t in ETFS,
         "first": s.index[0].date(), "n_weekends": len(w), "n_overnight": len(o), "n_days": len(s)}
    for name, x in (("weekend", w.gap_open), ("overnight", o.gap_open), ("intraday", s.intraday), ("cc", s.cc_ret)):
        x = x.dropna(); r[f"{name}_mean"] = x.mean(); r[f"{name}_sd"] = x.std()
        r[f"{name}_skew"] = stats.skew(x); r[f"{name}_exkurt"] = stats.kurtosis(x)
    r["var_ratio_weekend_vs_day"] = r["weekend_sd"]**2 / r["cc_sd"]**2
    r["var_ratio_weekend_vs_overnight"] = r["weekend_sd"]**2 / r["overnight_sd"]**2
    r["weekend_ann_vol"] = r["weekend_sd"] * np.sqrt(52)
    r["worst_weekend"] = w.gap_open.min(); r["worst_weekend_date"] = w.gap_open.idxmin().date()
    r["best_weekend"] = w.gap_open.max(); r["best_weekend_date"] = w.gap_open.idxmax().date()
    # closed vs open session drift (annualised, log)
    yrs = (s.index[-1] - s.index[0]).days / 365.25
    r["closed_drift_pa"] = np.log1p(s.gap_open).sum() / yrs; r["open_drift_pa"] = np.log1p(s.intraday).sum() / yrs
    r["weekend_drift_pa"] = np.log1p(w.gap_open).sum() / yrs
    r["weekend_tstat"] = w.gap_open.mean() / (w.gap_open.std() / np.sqrt(len(w)))
    for b in BARRIERS:
        n = int((w.gap_open < -b).sum()); r[f"breach_{int(b*100)}"] = n; r[f"breach_{int(b*100)}_pct"] = n / len(w)
        r[f"epay_{int(b*100)}_bp"] = np.maximum(-b - w.gap_open, 0).mean() * 1e4
        # lognormal comparison with trailing 60d vol, trading-time clock
        sd = (w.rv60 / np.sqrt(252)).dropna(); g = w.gap_open.loc[sd.index]
        p_bs = stats.norm.cdf(np.log(1 - b) / sd).mean()
        r[f"bs_prob_{int(b*100)}"] = p_bs; r[f"bs_underprice_{int(b*100)}x"] = (n / len(w)) / p_bs if p_bs > 0 else np.inf
    rows.append(r)
    ww = w[["gap_open", "gap_close", "rv20", "rv60", "nights"]].copy(); ww["ticker"] = t; ww["etf"] = t in ETFS; allw.append(ww)

st = pd.DataFrame(rows).sort_values("n_weekends", ascending=False)
st.to_csv(os.path.join(RES, "10_session_stats.csv"), index=False)
W = pd.concat(allw); W["z"] = W.gap_open / (W.rv20 / np.sqrt(252)); W = W.dropna(subset=["z"])
W.to_csv(os.path.join(RES, "10_all_weekend_gaps.csv"))

# ---- pooled tables
pool = {}
for grp, sub in (("single names", W[~W.etf]), ("ETFs", W[W.etf]), ("all", W)):
    x = sub.gap_open
    pool[grp] = {"n_weekends": len(x), "mean_bp": x.mean()*1e4, "sd": x.std(), "skew": stats.skew(x), "exkurt": stats.kurtosis(x),
                 **{f"P(gap<-{int(b*100)}%)": (x < -b).mean() for b in BARRIERS},
                 **{f"E[payout] {int(b*100)}% (bp)": np.maximum(-b - x, 0).mean()*1e4 for b in BARRIERS},
                 "z_skew": stats.skew(sub.z), "z_exkurt": stats.kurtosis(sub.z), "P(z<-3)": (sub.z < -3).mean(), "P(z<-5)": (sub.z < -5).mean()}
pooled = pd.DataFrame(pool).T; pooled.to_csv(os.path.join(RES, "10_pooled_tail.csv"))
print(pooled.round(4).to_string())

# ---- tail-shape homogeneity test for v4: standardised tail quantiles per ticker vs pooled
q = [0.005, 0.01, 0.025, 0.05]
tail = W.groupby("ticker").z.quantile(q).unstack(); tail.columns = [f"z_q{c}" for c in q]
tail["n"] = W.groupby("ticker").size(); tail["pooled_q0.01"] = W.z.quantile(0.01); tail["pooled_q0.05"] = W.z.quantile(0.05)
tail.to_csv(os.path.join(RES, "10_tail_shape.csv"))

# ---- charts
print("charts:")
# 1. variance ratio per ticker (dot plot, sorted) with the 'weekend = 0.2 of a day' myth line
fig, ax = plt.subplots(figsize=(8, 10))
d = st.sort_values("var_ratio_weekend_vs_day")
ax.hlines(range(len(d)), 0, d.var_ratio_weekend_vs_day, color=V.GRID, lw=1)
cols = [V.CAT[0] if not e else V.CAT[2] for e in d.etf]
ax.scatter(d.var_ratio_weekend_vs_day, range(len(d)), s=36, c=cols, zorder=3)
ax.set_yticks(range(len(d))); ax.set_yticklabels(d.ticker, fontsize=8)
ax.axvline(1.0, color=V.INK2, lw=1, ls="--"); ax.text(1.02, len(d)-1, "weekend = one full trading day", color=V.INK2, fontsize=8, va="top")
ax.axvline(0.2, color=V.STATUS["critical"], lw=1, ls=":"); ax.text(0.22, 0.5, "index-literature prior (0.2)", color=V.STATUS["critical"], fontsize=8)
ax.set_title("Weekend gap variance / close-to-close daily variance, per ticker")
ax.scatter([], [], c=V.CAT[0], label="single name"); ax.scatter([], [], c=V.CAT[2], label="ETF"); ax.legend(loc="lower right")
V.save(fig, "10_variance_ratio.png", "Fri close -> Mon open gap variance divided by daily close-to-close variance. Adjusted for splits and dividends. Source: Yahoo daily OHLC.")

# 2. pooled weekend gap distribution vs normal, log scale
fig, ax = plt.subplots(figsize=(9, 5))
x = W.gap_open.clip(-0.35, 0.35)
bins = np.linspace(-0.35, 0.35, 141)
ax.hist(x[~W.etf], bins=bins, density=True, histtype="step", color=V.CAT[0], lw=1.6, label="single names")
ax.hist(x[W.etf], bins=bins, density=True, histtype="step", color=V.CAT[2], lw=1.6, label="ETFs")
xx = np.linspace(-0.35, 0.35, 500); sd = W.gap_open[~W.etf].std()
ax.plot(xx, stats.norm.pdf(xx, 0, sd), color=V.CAT[7], lw=1.4, ls="--", label=f"normal, same sd ({sd:.1%})")
ax.set_yscale("log"); ax.set_ylim(1e-3, 1e2); V.pct(ax, "x")
for b in (0.05, 0.10): ax.axvline(-b, color=V.INK2, lw=0.8, ls=":"); ax.text(-b, 40, f"-{int(b*100)}%", ha="right", fontsize=8, color=V.INK2)
ax.set_title(f"Weekend gap distribution, {len(W):,} ticker-weekends (log density)"); ax.legend()
V.save(fig, "10_gap_distribution_log.png", "Left tail is orders of magnitude fatter than a normal with the same standard deviation. That gap is the whole business.")

# 3. Black-Scholes underpricing multiple per barrier (median across tickers) - bar
fig, ax = plt.subplots(figsize=(7, 4.2))
med = [st[f"bs_underprice_{int(b*100)}x"].replace(np.inf, np.nan).median() for b in BARRIERS]
ax.bar([f"-{int(b*100)}%" for b in BARRIERS], med, color=V.CAT[0], width=0.55)
for i, m in enumerate(med): ax.text(i, m*1.05, f"{m:.0f}x", ha="center", fontsize=9)
ax.set_yscale("log"); ax.set_title("How many times the lognormal model underprices weekend breach frequency (median ticker)")
V.save(fig, "10_bs_underpricing.png", "Empirical breach frequency divided by lognormal probability with trailing 60d vol on a one-trading-day clock.")

# 4. tail shape homogeneity: 1% standardised quantile per ticker vs pooled
fig, ax = plt.subplots(figsize=(8, 9))
d = tail.sort_values("z_q0.01")
ax.hlines(range(len(d)), d["z_q0.01"], d["pooled_q0.01"], color=V.GRID, lw=1)
ax.scatter(d["z_q0.01"], range(len(d)), s=30, c=V.CAT[0], zorder=3, label="ticker 1% z-quantile")
ax.axvline(d["pooled_q0.01"].iloc[0], color=V.CAT[1], lw=1.4, label="pooled 1% z-quantile")
ax.set_yticks(range(len(d))); ax.set_yticklabels(d.index, fontsize=8); ax.legend(loc="lower right")
ax.set_title("Is the standardised tail common across names? (gap / trailing 20d daily vol)")
V.save(fig, "10_tail_shape_homogeneity.png", "If dots cluster round the pooled line, one pooled tail (v4) is a fair approximation; outliers need a ticker-specific loading.")

# 5. breach frequency heatmap ticker x barrier
fig, ax = plt.subplots(figsize=(6, 11))
d = st.set_index("ticker")[[f"breach_{int(b*100)}_pct" for b in BARRIERS]].sort_values("breach_5_pct", ascending=False)
im = ax.imshow(d.values, aspect="auto", cmap=plt.matplotlib.colors.LinearSegmentedColormap.from_list("seq", V.SEQ))
ax.set_xticks(range(4)); ax.set_xticklabels([f"-{int(b*100)}%" for b in BARRIERS]); ax.set_yticks(range(len(d))); ax.set_yticklabels(d.index, fontsize=7.5)
for i in range(len(d)):
    for j in range(4): ax.text(j, i, f"{d.values[i,j]*100:.1f}%", ha="center", va="center", fontsize=6.5, color=V.INK if d.values[i,j] < 0.04 else "white")
ax.grid(False); ax.set_title("Share of weekends breaching each barrier")
V.save(fig, "10_breach_heatmap.png")

print("\ntop breach rates at 5%:"); print(st.sort_values("breach_5_pct", ascending=False)[["ticker","n_weekends","breach_5_pct","epay_5_bp","worst_weekend","worst_weekend_date","weekend_exkurt","var_ratio_weekend_vs_day"]].head(15).round(4).to_string())
print("\nETFs:"); print(st[st.etf][["ticker","n_weekends","breach_5_pct","epay_5_bp","worst_weekend","worst_weekend_date","weekend_exkurt","var_ratio_weekend_vs_day","weekend_drift_pa","weekend_tstat"]].round(4).to_string())
