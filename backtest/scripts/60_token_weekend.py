"""60 - What the tokenized stock actually does while the NYSE is shut (bStocks on Binance spot, hourly, Jun-Sep 2026).
Per bStock x weekend: token price at Friday 20:00 UTC (NYSE close, EDT), Saturday noon, Sunday 20:00, Monday 13:00 (30 min pre-open),
Monday 14:00 (after the open); the underlying's official Friday close and Monday open; weekend token range and volume.
Questions: how much of Monday's gap does the token discover before the bell? How far does it drift from the reference price?
Is there a weekend liquidity hole? Also a snapshot of Ondo token price vs reference from the RWA dynamic endpoint.
Outputs: results/60_token_weekends.csv, results/60_token_summary.md, charts/60_*.png"""
import os, sys, json, glob
import numpy as np, pandas as pd
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); sys.path.insert(0, ROOT)
from scripts.lib import sessions as S, viz as V
import matplotlib.pyplot as plt
RES = os.path.join(ROOT, "results"); BS = os.path.join(ROOT, "data", "bstocks")

rows = []; paths = {}
for fp in sorted(glob.glob(os.path.join(BS, "*_1h.csv"))):
    sym = os.path.basename(fp).split("_")[0]; t = sym.replace("USDT", "")[:-1]
    k = pd.read_csv(fp); k["ts"] = pd.to_datetime(k.openTime, unit="ms", utc=True); k = k.set_index("ts")
    k[["open", "high", "low", "close", "volume", "quoteVolume"]] = k[["open", "high", "low", "close", "volume", "quoteVolume"]].astype(float)
    try: eq = S.sessions(t)
    except FileNotFoundError: continue
    wk = S.weekend_like(eq); wk = wk[wk.index >= k.index[0].tz_convert(None) - pd.Timedelta(days=1)]
    for fri, r in wk.iterrows():
        f = pd.Timestamp(fri, tz="UTC"); mon = pd.Timestamp(r.next_date, tz="UTC")
        def px(ts):  # close of the hourly candle that ENDS at ts
            c = k.loc[:ts - pd.Timedelta(minutes=1)]
            return c.close.iloc[-1] if len(c) else np.nan
        seg = k.loc[f + pd.Timedelta(hours=20): mon + pd.Timedelta(hours=13, minutes=30)]
        if len(seg) < 20: continue
        p_fri = px(f + pd.Timedelta(hours=20)); p_sat = px(f + pd.Timedelta(days=1, hours=12)); p_sun = px(f + pd.Timedelta(days=2, hours=20))
        p_pre = px(mon + pd.Timedelta(hours=13)); p_post = px(mon + pd.Timedelta(hours=15))
        wkvol = seg.quoteVolume.sum(); wdvol = k.loc[f - pd.Timedelta(days=4, hours=4): f + pd.Timedelta(hours=20)].quoteVolume.sum()
        rows.append({"symbol": sym, "ticker": t, "friday": fri.date(), "monday": r.next_date.date(), "nights": int(r.nights), "under_close": r.close, "under_open": r.next_open,
                     "under_gap": r.gap_open, "tok_fri": p_fri, "tok_sat": p_sat, "tok_sun": p_sun, "tok_preopen": p_pre, "tok_postopen": p_post,
                     "tok_vs_ref_fri": p_fri / r.close - 1, "tok_move_sun": p_sun / p_fri - 1, "tok_move_preopen": p_pre / p_fri - 1,
                     "tok_move_postopen": p_post / p_fri - 1, "tok_preopen_vs_monopen": p_pre / r.next_open - 1, "tok_postopen_vs_monopen": p_post / r.next_open - 1,
                     "wk_range": seg.high.max() / seg.low.min() - 1, "wk_low_vs_fri": seg.low.min() / p_fri - 1, "wk_quote_vol": wkvol, "weekday_quote_vol": wdvol,
                     "wk_vol_share": wkvol / (wkvol + wdvol) if (wkvol + wdvol) > 0 else np.nan, "hours_with_trades": int((seg.volume > 0).sum()), "hours": len(seg)})
        paths[(sym, fri.date())] = (seg.close / p_fri - 1)
T = pd.DataFrame(rows); T.to_csv(os.path.join(RES, "60_token_weekends.csv"), index=False)
pd.set_option("display.width", 250)
print(T[["symbol", "friday", "under_gap", "tok_move_sun", "tok_move_preopen", "tok_preopen_vs_monopen", "wk_range", "wk_vol_share", "hours_with_trades"]].round(4).to_string())

# regressions: how much of the gap is discovered before the bell?
ok = T.dropna(subset=["under_gap", "tok_move_preopen"])
slope_pre, icpt_pre = np.polyfit(ok.under_gap, ok.tok_move_preopen, 1)
slope_sun, _ = np.polyfit(ok.under_gap, ok.tok_move_sun, 1)
corr_pre = np.corrcoef(ok.under_gap, ok.tok_move_preopen)[0, 1]
summ = {"n_token_weekends": len(T), "tokens": T.symbol.nunique(), "median_abs_under_gap": ok.under_gap.abs().median(), "median_abs_tok_preopen_move": ok.tok_move_preopen.abs().median(),
        "beta_preopen_on_gap": slope_pre, "corr_preopen_gap": corr_pre, "beta_sunday_on_gap": slope_sun,
        "median_abs_tok_preopen_vs_monopen": ok.tok_preopen_vs_monopen.abs().median(), "p90_abs_tok_preopen_vs_monopen": ok.tok_preopen_vs_monopen.abs().quantile(0.9),
        "median_wk_range": T.wk_range.median(), "median_wk_vol_share": T.wk_vol_share.median(), "median_hours_with_trades_share": (T.hours_with_trades / T.hours).median(),
        "largest_under_gap": ok.under_gap.min(), "largest_under_gap_row": ok.loc[ok.under_gap.idxmin(), ["symbol", "friday", "tok_move_preopen"]].to_dict()}
json.dump(summ, open(os.path.join(RES, "60_token_summary.json"), "w"), indent=1, default=str)

# Ondo snapshot
snap = []
for fp in glob.glob(os.path.join(ROOT, "data", "ondo", "*_dynamic.json")):
    j = json.load(open(fp)).get("data") or {}
    ti, si, st = j.get("tokenInfo", {}), j.get("stockInfo", {}), j.get("statusInfo", {})
    try:
        ref = float(ti["price"]) / float(ti["sharesMultiplier"]); snap.append({"symbol": j["symbol"], "token_price": float(ti["price"]), "shares_mult": float(ti["sharesMultiplier"]),
              "reference_price": ref, "stock_price": float(si["price"]), "token_premium_vs_stock": ref / float(si["price"]) - 1, "holders": int(ti["totalHolders"]),
              "market_status": st.get("marketStatus"), "reason": st.get("reasonCode")})
    except Exception: pass
SN = pd.DataFrame(snap); SN.to_csv(os.path.join(RES, "60_ondo_snapshot.csv"), index=False)

md = ["# Token behaviour during the closed session (bStocks, Binance spot, hourly)\n",
      f"{summ['n_token_weekends']} token-weekends across {summ['tokens']} bStocks, {T.friday.min()} to {T.friday.max()}.\n",
      f"- Median |underlying Monday gap| {summ['median_abs_under_gap']:.2%}; median |token move Fri close -> Mon 13:00 UTC (pre-open)| {summ['median_abs_tok_preopen_move']:.2%}",
      f"- Regression of token pre-open move on the actual gap: beta **{slope_pre:.2f}**, correlation **{corr_pre:.2f}**. Sunday-night beta {slope_sun:.2f}. The token discovers roughly that share of Monday's gap before the bell.",
      f"- Token 30 minutes before the open vs the official Monday open: median |deviation| {summ['median_abs_tok_preopen_vs_monopen']:.2%}, 90th percentile {summ['p90_abs_tok_preopen_vs_monopen']:.2%} - the tracking error a Keeper who hedges on the token, or a Sleeper who sells it Sunday, is exposed to.",
      f"- Median weekend token range (high/low) {summ['median_wk_range']:.2%}; weekend share of the week's quote volume {summ['median_wk_vol_share']:.1%}; share of weekend hours with any trade {summ['median_hours_with_trades_share']:.0%}.",
      f"- Largest underlying gap in the sample: {summ['largest_under_gap_row']} = {summ['largest_under_gap']:+.2%}.\n",
      "## Ondo snapshot (public RWA dynamic endpoint, at run time)\n", SN.round(4).to_markdown(index=False) if len(SN) else "n/a"]
open(os.path.join(RES, "60_token_summary.md"), "w", encoding="utf-8").write("\n".join(md))
print(json.dumps(summ, indent=1, default=str))

# ---- charts
print("charts:")
fig, ax = plt.subplots(figsize=(7.5, 6.5))
ax.plot([-0.12, 0.12], [-0.12, 0.12], color=V.INK2, lw=1, ls="--", label="token = gap (full discovery)")
ax.axhline(0, color=V.GRID); ax.axvline(0, color=V.GRID)
ax.scatter(ok.under_gap, ok.tok_move_sun, s=22, color=V.CAT[1], alpha=0.8, label="token move by Sunday 20:00 UTC")
ax.scatter(ok.under_gap, ok.tok_move_preopen, s=26, color=V.CAT[0], label="token move by Monday 13:00 UTC (pre-open)")
xx = np.linspace(ok.under_gap.min(), ok.under_gap.max(), 10); ax.plot(xx, icpt_pre + slope_pre * xx, color=V.CAT[0], lw=1.2)
V.pct(ax, "x", 1); V.pct(ax, "y", 1); ax.set_xlabel("underlying gap: Friday close -> Monday 9:30 ET open"); ax.set_ylabel("bStock token move since Friday close"); ax.legend(fontsize=8)
ax.set_title(f"How much of Monday's gap does the token find over the weekend? (beta {slope_pre:.2f}, r {corr_pre:.2f})")
V.save(fig, "60_token_discovery_scatter.png", "Each dot is one bStock x one weekend, June-Sept 2026. Slope 1 would mean the token fully prices the Monday gap before the bell.")

# small multiples: the six largest |gap| weekends, token path vs reference
big = ok.reindex(ok.under_gap.abs().sort_values(ascending=False).index).drop_duplicates(["friday"]).head(6)
fig, axes = plt.subplots(2, 3, figsize=(13, 7)); axes = axes.ravel()
for ax, r in zip(axes, big.itertuples()):
    p = paths[(r.symbol, r.friday)]; hrs = (p.index - p.index[0]).total_seconds() / 3600
    ax.plot(hrs, p, color=V.CAT[0], lw=1.6, label="token vs Fri close")
    ax.axhline(0, color=V.INK2, lw=0.8); ax.axhline(r.under_gap, color=V.CAT[7], lw=1.2, ls="--", label=f"Mon open gap {r.under_gap:+.1%}")
    ax.axhline(-0.05, color=V.STATUS["critical"], lw=0.8, ls=":")
    for h, lbl in ((0, "Fri close"), (24 + 4, "Sat"), (48 + 4, "Sun"), (65.5, "Mon open")): ax.axvline(h, color=V.GRID, lw=0.8); ax.text(h, ax.get_ylim()[1] if False else p.max(), lbl, fontsize=7, color=V.INK2, ha="center", va="bottom")
    ax.set_title(f"{r.symbol} weekend of {r.friday}", fontsize=10); V.pct(ax, "y", 1); ax.set_xlabel("hours since Friday close")
axes[0].legend(fontsize=7)
fig.suptitle("Token path across the closed session on the six largest-gap weekends", x=0.01, ha="left", fontsize=13, fontweight="semibold"); fig.tight_layout(rect=(0, 0.02, 1, 0.96))
V.save(fig, "60_token_paths_largest_gaps.png", "Blue = bStock hourly close relative to the underlying's Friday close. Red dashed = where the NYSE actually opened Monday. Dotted = the 5% barrier.")

# weekend volume profile by hour since Friday close (median across token-weekends)
prof = []
for (sym, fri), p in paths.items():
    pass
allseg = []
for fp in sorted(glob.glob(os.path.join(BS, "*_1h.csv"))):
    k = pd.read_csv(fp); k["ts"] = pd.to_datetime(k.openTime, unit="ms", utc=True); k = k.set_index("ts"); k["quoteVolume"] = k.quoteVolume.astype(float)
    k["dow"] = k.index.dayofweek; k["hr"] = k.index.hour; k["sym"] = os.path.basename(fp).split("_")[0]
    allseg.append(k[["dow", "hr", "quoteVolume", "sym"]])
A = pd.concat(allseg); A["slot"] = A.dow * 24 + A.hr
prof = A.groupby("slot").quoteVolume.median()
fig, ax = plt.subplots(figsize=(12, 4))
cols = [V.CAT[0] if (s < 4 * 24 + 20 and s >= 0 * 24 + 13) and not (s % 24 >= 20 or s % 24 < 13) else V.CAT[1] for s in prof.index]
closed = [(s >= 4 * 24 + 20) or (s % 24 >= 20) or (s % 24 < 13) for s in prof.index]
ax.bar(prof.index, prof.values, width=1, color=[V.CAT[1] if c else V.CAT[0] for c in closed])
for d, n in enumerate(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]): ax.text(d * 24 + 12, prof.max() * 0.95, n, ha="center", fontsize=9, color=V.INK2); ax.axvline(d * 24, color=V.GRID, lw=0.8)
ax.set_title("Median hourly quote volume of bStocks by hour of week (UTC). Orange = NYSE shut"); ax.set_ylabel("USDT"); ax.set_xlim(0, 168); ax.set_xticks(range(0, 169, 12))
ax.bar([], [], color=V.CAT[0], label="NYSE open (13:30-20:00 UTC)"); ax.bar([], [], color=V.CAT[1], label="NYSE shut"); ax.legend(fontsize=8)
V.save(fig, "60_token_volume_by_hour.png", "Where the liquidity is when the Sleeper would need to sell. Payouts settle into the orange hours' book.")
