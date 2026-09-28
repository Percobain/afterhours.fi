"""21 - Out-of-sample evaluation of the pricing versions on the walk-forward panel.
For each version and barrier: loss ratio (payouts / premiums charged), calibration by predicted-premium decile,
Keeper P&L per $ notional (Sharpe, worst weekend), by-year loss ratios, and the 'ruin weekend' list.
Outputs: results/21_version_scorecard.csv, results/21_calibration.csv, results/21_loss_ratio_by_year.csv, charts/21_*.png"""
import os, sys, json
import numpy as np, pandas as pd
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); sys.path.insert(0, ROOT)
from scripts.lib import viz as V
import matplotlib.pyplot as plt
RES = os.path.join(ROOT, "results"); CFG = json.load(open(os.path.join(ROOT, "config.json")))
P = pd.read_parquet(os.path.join(RES, "20_weekend_panel.parquet"))
U = json.load(open(os.path.join(ROOT, "data", "universe.json"))); P = P[P.ticker.isin(U["backtest_universe"])]
VERS = {"v1a": "v1a Black-Scholes, calendar clock", "v1b": "v1b Black-Scholes, trading clock", "v2": "v2 own-history empirical",
        "v3": "v3 EVT / GPD tail", "v4": "v4 pooled vol-scaled"}
SETTLE = "payout_open"

rows = []; byyear = []; calib = []
for b, g in P.groupby("barrier"):
    for v, name in VERS.items():
        q = g["q_" + v]; pay = g[SETTLE]; fair = g["p_" + v]
        pnl = q - pay                                       # Keeper P&L per $1 notional per weekend
        wk = pnl.groupby(g.friday).mean()                    # equal-weight book across tickers, per weekend
        rows.append({"barrier": b, "version": v, "name": name, "n": len(g), "mean_fair_bp": fair.mean()*1e4, "mean_charged_bp": q.mean()*1e4,
                     "mean_payout_bp": pay.mean()*1e4, "loss_ratio": pay.sum()/q.sum(), "fair_loss_ratio": pay.sum()/fair.sum(),
                     "keeper_net_bp_per_weekend": pnl.mean()*1e4, "keeper_sharpe_ann": wk.mean()/wk.std()*np.sqrt(52) if wk.std() > 0 else np.nan,
                     "worst_weekend_book_pct": wk.min()*100, "worst_single_pct": pnl.min()*100,
                     "share_weekends_book_negative": (wk < 0).mean(), "zero_premium_share": (fair <= 0).mean()})
        for y, gy in g.groupby("year"):
            byyear.append({"barrier": b, "version": v, "year": y, "premium_bp": gy["q_"+v].mean()*1e4, "payout_bp": gy[SETTLE].mean()*1e4,
                           "loss_ratio": gy[SETTLE].sum()/gy["q_"+v].sum()})
        # calibration: bucket by predicted fair premium, compare mean realised payout
        gg = g[np.isfinite(fair) & (fair > 0)].copy()
        if len(gg) > 1000:
            gg["dec"] = pd.qcut(gg["p_"+v].rank(method="first"), 10, labels=False)
            c = gg.groupby("dec").agg(pred_bp=("p_"+v, "mean"), real_bp=(SETTLE, "mean"), n=(SETTLE, "size")).reset_index()
            c["pred_bp"] *= 1e4; c["real_bp"] *= 1e4; c["barrier"] = b; c["version"] = v; calib.append(c)
score = pd.DataFrame(rows); score.to_csv(os.path.join(RES, "21_version_scorecard.csv"), index=False)
pd.DataFrame(byyear).to_csv(os.path.join(RES, "21_loss_ratio_by_year.csv"), index=False)
CAL = pd.concat(calib); CAL.to_csv(os.path.join(RES, "21_calibration.csv"), index=False)
pd.set_option("display.width", 220)
print(score[score.barrier == 0.05][["version","mean_fair_bp","mean_charged_bp","mean_payout_bp","loss_ratio","keeper_sharpe_ann","worst_weekend_book_pct","zero_premium_share"]].round(3).to_string())

# regime analysis: loss ratio by trailing-vol quintile per version (does the model price calm and wild regimes fairly?)
b5r = P[P.barrier == 0.05].copy(); b5r["vol_q"] = pd.qcut(b5r.rv20.rank(method="first"), 5, labels=["calmest 20%", "q2", "q3", "q4", "wildest 20%"])
reg = []
for (vq, v), g in [((vq, v), g) for vq, g0 in b5r.groupby("vol_q", observed=True) for v in VERS for g in [g0]]:
    reg.append({"vol_quintile": vq, "version": v, "mean_rv20": g.rv20.mean(), "charged_bp": g["q_"+v].mean()*1e4, "payout_bp": g[SETTLE].mean()*1e4,
                "loss_ratio": g[SETTLE].sum()/g["q_"+v].sum(), "share_below_0.5bp": (g["p_"+v] < 0.5e-4).mean()})
REG = pd.DataFrame(reg); REG.to_csv(os.path.join(RES, "21_loss_ratio_by_vol_regime.csv"), index=False)
print("loss ratio by vol regime (5% barrier):"); print(REG.pivot(index="vol_quintile", columns="version", values="loss_ratio").round(2).to_string())
print("charged bp by vol regime:"); print(REG.pivot(index="vol_quintile", columns="version", values="charged_bp").round(1).to_string())

# ruin weekends: book-level payout minus premium (v4, 5%), top 15
b5 = P[P.barrier == 0.05]
wk = b5.groupby("friday").agg(payout=(SETTLE, "mean"), premium=("q_v4", "mean"), n=("ticker", "size"), worst_ticker=("ticker", lambda s: s.iloc[np.argmax(b5.loc[s.index, SETTLE].values)]), worst_payout=(SETTLE, "max"))
wk["net"] = wk.premium - wk.payout
wk.sort_values("net").head(20).to_csv(os.path.join(RES, "21_worst_book_weekends.csv"))
print("\nworst book weekends (v4, 5% barrier, equal-weight):"); wk2 = wk.sort_values("net").head(12).copy()
for c in ("payout","premium","worst_payout","net"): wk2[c] = wk2[c]*1e4
print(wk2.round(1).to_string())

# ---- charts
print("charts:")
# loss ratio by version x barrier (grouped bars, log)
fig, ax = plt.subplots(figsize=(9, 4.6))
bars = sorted(P.barrier.unique()); w = 0.16
for i, v in enumerate(VERS):
    vals = [score[(score.barrier == b) & (score.version == v)].loss_ratio.iloc[0] for b in bars]
    ax.bar(np.arange(len(bars)) + (i - 2) * w, vals, w, color=V.CAT[i], label=VERS[v])
ax.axhline(1, color=V.INK2, lw=1, ls="--"); ax.text(len(bars) - 0.6, 1.08, "break-even (loss ratio 1)", fontsize=8, color=V.INK2)
ax.axhline(1/1.5, color=V.STATUS["good"], lw=1, ls=":"); ax.text(len(bars) - 0.6, 0.6, "target with 50% load", fontsize=8, color=V.STATUS["good"])
ax.set_yscale("log"); ax.set_xticks(range(len(bars))); ax.set_xticklabels([f"-{int(b*100)}% barrier" for b in bars]); ax.legend(fontsize=8, ncol=3, loc="upper center", bbox_to_anchor=(0.5, -0.12))
ax.set_title("Out-of-sample loss ratio (payouts / premiums charged), 2005-2026, all tickers")
V.save(fig, "21_loss_ratio_by_version.png", "Above 1 = the Keeper pool loses money. Black-Scholes with trailing vol over-charges 5-10x on average (nobody would buy) yet is mis-calibrated by regime (see vol-regime chart). Walk-forward, annual refit, strictly prior data.")

# calibration at 5%
fig, axes = plt.subplots(1, 3, figsize=(12, 4), sharey=True)
for ax, v in zip(axes, ["v2", "v3", "v4"]):
    c = CAL[(CAL.barrier == 0.05) & (CAL.version == v)]
    ax.plot([0, c.pred_bp.max()*1.1], [0, c.pred_bp.max()*1.1], color=V.INK2, lw=1, ls="--")
    ax.scatter(c.pred_bp, c.real_bp, s=40, color=V.CAT[0], zorder=3)
    ax.set_title(VERS[v]); ax.set_xlabel("predicted fair premium (bp)")
axes[0].set_ylabel("realised mean payout (bp)")
fig.suptitle("Calibration by predicted-premium decile, 5% barrier (dots on the line = well calibrated)", x=0.01, ha="left", fontsize=12, fontweight="semibold")
V.save(fig, "21_calibration_5pct.png")

# loss ratio by year, v4 vs v3 at 5%
fig, ax = plt.subplots(figsize=(10, 4.2))
by = pd.DataFrame(byyear); by = by[by.barrier == 0.05]
for i, v in enumerate(["v2", "v3", "v4"]):
    d = by[by.version == v]; ax.plot(d.year, d.loss_ratio, marker="o", ms=4, color=V.CAT[i+2], label=VERS[v])
ax.axhline(1, color=V.INK2, lw=1, ls="--"); ax.set_yscale("log"); ax.legend(fontsize=8)
ax.set_title("Loss ratio by year, 5% barrier - the years that hurt"); ax.set_ylabel("payouts / premiums")
V.save(fig, "21_loss_ratio_by_year.png", "2020 (COVID) and 2025 (DeepSeek, tariffs) are the stress years. A ratio of 3 means the pool paid out three years of premium in one.")

fig, ax = plt.subplots(figsize=(9, 4.5))
piv = REG.pivot(index="vol_quintile", columns="version", values="loss_ratio")
xx = np.arange(len(piv)); w = 0.16
for i, v in enumerate(VERS): ax.bar(xx + (i - 2) * w, piv[v].values, w, color=V.CAT[i], label=VERS[v])
ax.axhline(1, color=V.INK2, lw=1, ls="--"); ax.set_yscale("log"); ax.set_xticks(xx); ax.set_xticklabels(piv.index); ax.legend(fontsize=8, ncol=2)
ax.set_title("Loss ratio by trailing-vol regime, 5% barrier: who gets under-charged?")
V.save(fig, "21_loss_ratio_by_vol_regime.png", "Own-history engines (v2, v3) look fine on average and pay out 1.3-1.5x their premium in the wildest vol quintile. v4 is the only engine that is level across regimes.")

# premium through time: v4 mean charged premium at 5% for SPY and NVDA vs realised payouts
fig, axes = plt.subplots(2, 1, figsize=(11, 6), sharex=True)
for ax, t in zip(axes, ["NVDA", "SPY"]):
    d = b5[b5.ticker == t].set_index("friday")
    ax.plot(d.index, d.q_v4*1e4, color=V.CAT[0], lw=1.4, label="v4 charged premium")
    ax.plot(d.index, d.q_v3*1e4, color=V.CAT[2], lw=1, label="v3 charged premium")
    ax.bar(d.index, d.payout_open*1e4, width=5, color=V.CAT[7], label="realised payout")
    ax.set_title(f"{t}: weekly premium charged vs payout, 5% barrier (bp of notional)"); ax.set_yscale("symlog", linthresh=10)
axes[0].legend(fontsize=8, ncol=3)
V.save(fig, "21_premium_vs_payout_timeline.png")
