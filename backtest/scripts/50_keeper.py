"""50 - Kip, the Keeper (LP). Deposits USDT into the pool at 10% of covered notional and underwrites every weekend.
Book: equal covered notional across every universe ticker available that Friday (several book variants), 5% barrier,
premium per pricing version (walk-forward), idle collateral earns CFG idle yield. Bootstrap ruin analysis across capital ratios.
Outputs: results/50_keeper_*.csv, results/50_keeper_card.md, charts/50_*.png"""
import os, sys, json
import numpy as np, pandas as pd
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); sys.path.insert(0, ROOT)
from scripts.lib import viz as V
import matplotlib.pyplot as plt
RES = os.path.join(ROOT, "results"); CFG = json.load(open(os.path.join(ROOT, "config.json")))
U = json.load(open(os.path.join(ROOT, "data", "universe.json")))
P = pd.read_parquet(os.path.join(RES, "20_weekend_panel.parquet"))
B = CFG["default_barrier"]; CAP = CFG["keeper_capital_ratio"]; YIELD = CFG["keeper_idle_yield_apy"]; NPATH = CFG["bootstrap_paths"]
COVERED = 10_000_000  # $ of notional the pool covers each weekend (book size)
rng = np.random.default_rng(7)

ETF = set(U["etfs"]); UNIV = set(U["backtest_universe"])
BOOKS = {
  "diversified (all 50)": lambda t: t in UNIV,
  "ETFs only": lambda t: t in ETF,
  "single names only": lambda t: t in UNIV and t not in ETF,
  "crypto/meme beta": lambda t: t in {"COIN", "MSTR", "HOOD", "GME", "AMC", "PLTR", "TSLA", "SOXS", "TQQQ", "SQQQ", "RIVN", "SOFI", "SMCI"},
  "NVDA only": lambda t: t == "NVDA",
  "bStocks on Binance spot (15)": lambda t: t in set(U["bstocks_binance_spot"]),
}

def book_series(version, book_fn, barrier=B):
    d = P[(P.barrier == barrier) & (P.ticker.map(book_fn))]
    # per weekend: equal-weight mean premium and payout per $ notional
    w = d.groupby("friday").agg(prem=("q_" + version, "mean"), pay=("payout_open", "mean"), n=("ticker", "size"),
                                worst=("payout_open", "max"), worst_t=("payout_open", lambda s: d.loc[s.idxmax(), "ticker"]))
    w["net"] = w.prem - w.pay                                   # per $ of covered notional
    return w

def equity_curve(w, cap_ratio=CAP, covered=COVERED):
    capital = covered * cap_ratio
    pnl = w.net * covered + capital * YIELD / 52.0
    eq = capital + pnl.cumsum()
    return pnl, eq, capital

def metrics(w, cap_ratio=CAP):
    pnl, eq, capital = equity_curve(w, cap_ratio)
    yrs = (w.index[-1] - w.index[0]).days / 365.25
    dd = (eq / eq.cummax() - 1)
    roc = pnl.sum() / capital
    return {"weekends": len(w), "years": yrs, "capital": capital, "total_pnl": pnl.sum(), "return_on_capital_total": roc,
            "roc_annualised": (1 + roc) ** (1 / yrs) - 1 if roc > -1 else -1.0, "sharpe_weekly_ann": pnl.mean() / pnl.std() * np.sqrt(52),
            "max_drawdown_pct_of_peak": dd.min(), "worst_weekend_pct_capital": (w.net * COVERED).min() / capital,
            "worst_weekend_date": (w.net).idxmin().date(), "weekends_losing": int((w.net < 0).sum()), "share_weekends_losing": (w.net < 0).mean(),
            "weekends_loss_gt_10pct_capital": int(((w.net * COVERED) < -0.10 * capital).sum()), "min_equity": eq.min(), "ruined_in_sample": bool((eq <= 0).any()),
            "premium_income_pa": w.prem.mean() * 52 * COVERED, "payouts_pa": w.pay.mean() * 52 * COVERED, "loss_ratio": w.pay.sum() / w.prem.sum()}

def bootstrap_ruin(w, cap_ratios, npath=NPATH, weeks=52, block=4):
    """Stationary block bootstrap of weekly book net P&L (per $ notional). Ruin = equity <= 0 at any point within the year."""
    net = w.net.values; n = len(net); out = {}
    idx = np.arange(n)
    # build paths of `weeks` weeks from random blocks of length `block`
    nblocks = int(np.ceil(weeks / block))
    starts = rng.integers(0, n - block, size=(npath, nblocks))
    sample = np.concatenate([net[(starts[:, [j]] + np.arange(block))] for j in range(nblocks)], axis=1)[:, :weeks]
    for c in cap_ratios:
        eq = c + np.cumsum(sample + c * YIELD / 52.0, axis=1)
        ruin = (eq.min(axis=1) <= 0).mean()
        endret = eq[:, -1] / c - 1
        out[c] = {"ruin_1y": ruin, "median_roc": np.median(endret), "p05_roc": np.quantile(endret, 0.05), "p95_roc": np.quantile(endret, 0.95),
                  "p01_roc": np.quantile(endret, 0.01)}
    return pd.DataFrame(out).T

# ---- main run: every book x version
summary = []; curves = {}; ruin_tables = []
for bname, fn in BOOKS.items():
    for v in ["v2", "v3", "v4", "v1b"]:
        w = book_series(v, fn)
        if len(w) < 100: continue
        m = metrics(w); m.update({"book": bname, "version": v}); summary.append(m)
        if v == "v4":
            curves[bname] = w
            rt = bootstrap_ruin(w, [0.02, 0.05, 0.10, 0.15, 0.20, 0.30]); rt["book"] = bname; ruin_tables.append(rt.reset_index().rename(columns={"index": "capital_ratio"}))
SUM = pd.DataFrame(summary); SUM.to_csv(os.path.join(RES, "50_keeper_summary.csv"), index=False)
RUIN = pd.concat(ruin_tables); RUIN.to_csv(os.path.join(RES, "50_keeper_ruin_bootstrap.csv"), index=False)
pd.set_option("display.width", 250)
print(SUM[SUM.version == "v4"][["book","years","roc_annualised","sharpe_weekly_ann","max_drawdown_pct_of_peak","worst_weekend_pct_capital","worst_weekend_date","share_weekends_losing","weekends_loss_gt_10pct_capital","loss_ratio","ruined_in_sample"]].round(3).to_string())
print("\nruin bootstrap (v4, 52 weeks, block bootstrap):"); print(RUIN.round(3).to_string())

# capital needed for <= 1% 1-yr ruin per book (interpolate on the grid)
need = []
for bname, g in RUIN.groupby("book"):
    g = g.sort_values("capital_ratio"); ok = g[g.ruin_1y <= 0.01]
    need.append({"book": bname, "capital_ratio_for_1pct_ruin": ok.capital_ratio.min() if len(ok) else ">30%"})
pd.DataFrame(need).to_csv(os.path.join(RES, "50_keeper_capital_for_1pct_ruin.csv"), index=False); print(pd.DataFrame(need).to_string())

# ---- Kip's card: $1M into the diversified pool, Jan 2015 -> today, v4
w = curves["diversified (all 50)"]; w15 = w[w.index >= "2015-01-01"]
pnl, eq, capital = equity_curve(w15)
worst = w15.sort_values("net").head(8)
card = ["# Kip's card - the Keeper\n", f"Kip deposits **${capital:,.0f}** (10% of a ${COVERED:,.0f} diversified book) on {w15.index[0].date()} and underwrites 5% weekend cover on every universe ticker, priced by v4 with a 50% load. Idle USDT earns {YIELD:.0%}.\n",
        f"- Ending equity {w15.index[-1].date()}: **${eq.iloc[-1]:,.0f}** (total return on capital {eq.iloc[-1]/capital-1:+.1%}, {((eq.iloc[-1]/capital)**(1/((w15.index[-1]-w15.index[0]).days/365.25))-1):+.1%} a year)",
        f"- Premium income per year ~${w15.prem.mean()*52*COVERED:,.0f}; payouts per year ~${w15.pay.mean()*52*COVERED:,.0f}; loss ratio {w15.pay.sum()/w15.prem.sum():.2f}",
        f"- Weekends underwritten {len(w15)}; weekends he lost money {(w15.net<0).sum()} ({(w15.net<0).mean():.0%}); weekends costing >10% of capital {int(((w15.net*COVERED) < -0.1*capital).sum())}",
        f"- Max drawdown from peak equity {(eq/eq.cummax()-1).min():.1%}; worst weekend {w15.net.idxmin().date()} cost ${-w15.net.min()*COVERED:,.0f} = {-w15.net.min()*COVERED/capital:.0%} of capital",
        "\n## The eight weekends that hurt most\n", "| Friday | book payout ($) | premium collected ($) | net ($) | % of capital | worst ticker | its payout |", "|---|---|---|---|---|---|---|"]
for r in worst.itertuples():
    card.append(f"| {r.Index.date()} | {r.pay*COVERED:,.0f} | {r.prem*COVERED:,.0f} | {r.net*COVERED:,.0f} | {r.net*COVERED/capital:+.0%} | {r.worst_t} | {r.worst:.1%} |")
card += ["\n## Every book, v4, 2005-2026\n", SUM[SUM.version=="v4"][["book","roc_annualised","sharpe_weekly_ann","max_drawdown_pct_of_peak","worst_weekend_pct_capital","loss_ratio","ruined_in_sample"]].round(3).to_markdown(index=False),
         "\n## One-year ruin probability by capital ratio (block bootstrap, v4)\n", RUIN.pivot(index="capital_ratio", columns="book", values="ruin_1y").round(4).to_markdown()]
open(os.path.join(RES, "50_keeper_card.md"), "w", encoding="utf-8").write("\n".join(card))

# ---- charts
print("charts:")
fig, axes = plt.subplots(2, 1, figsize=(12, 7), sharex=True, gridspec_kw={"height_ratios": [3, 1.3]})
for i, (bname, wv) in enumerate(curves.items()):
    pnl_, eq_, cap_ = equity_curve(wv)
    axes[0].plot(eq_.index, eq_ / cap_, color=V.CAT[i], lw=1.4 if bname.startswith("diversified") else 1, label=bname)
axes[0].axhline(1, color=V.INK2, lw=0.8); axes[0].axhline(0, color=V.STATUS["critical"], lw=1, ls="--"); axes[0].set_yscale("symlog", linthresh=1)
axes[0].set_title(f"Kip's equity as a multiple of starting capital (capital = 10% of ${COVERED/1e6:.0f}M covered, 5% barrier, v4 pricing)"); axes[0].legend(fontsize=8, ncol=3)
wd = curves["diversified (all 50)"]; pnl_, eq_, cap_ = equity_curve(wd)
axes[1].bar(wd.index, wd.net * COVERED / cap_, width=6, color=np.where(wd.net >= 0, V.KIP, V.CAT[7]))
axes[1].set_title("Diversified book: weekly P&L as % of capital"); V.pct(axes[1])
V.save(fig, "50_keeper_equity_curves.png", "Symlog y-axis. The single-name (NVDA-only) book loses ~97% of capital in one weekend; diversified and ETF books compound. Walk-forward premiums, no look-ahead.")

fig, ax = plt.subplots(figsize=(9, 5))
for i, (bname, g) in enumerate(RUIN.groupby("book")):
    g = g.sort_values("capital_ratio"); ax.plot(g.capital_ratio, g.ruin_1y, marker="o", ms=4, color=V.CAT[i], label=bname)
ax.axhline(0.01, color=V.STATUS["critical"], lw=1, ls="--"); ax.text(0.205, 0.012, "1% ruin target", fontsize=8, color=V.STATUS["critical"])
ax.axvline(CAP, color=V.INK2, lw=1, ls=":"); ax.text(CAP + 0.003, 0.5, "on-chain minimum 10%", fontsize=8, color=V.INK2)
ax.set_yscale("log"); ax.set_ylim(1e-4, 1); V.pct(ax, "x"); ax.set_ylabel("P(ruin within 52 weeks)"); ax.set_xlabel("pool capital / covered notional"); ax.legend(fontsize=8)
ax.set_title("One-year ruin probability vs capital ratio, by book composition")
V.save(fig, "50_keeper_ruin_curves.png", f"{NPATH:,} block-bootstrap paths of 52 weekends drawn from 2005-2026 book P&L. Concentration, not capital, is what kills the pool.")

fig, ax = plt.subplots(figsize=(9, 4.5))
x = wd.net * COVERED / cap_
ax.hist(x.clip(-1.5, 0.3), bins=80, color=V.KIP)
ax.axvline(0, color=V.INK2, lw=1); V.pct(ax, "x"); ax.set_yscale("log")
ax.set_title("Distribution of Kip's weekly P&L as % of capital (diversified book)")
V.save(fig, "50_keeper_weekly_pnl_hist.png", "Many small wins, a few catastrophic weekends: the signature of a short-tail-risk book. Log count axis.")

# version comparison for the diversified book
fig, ax = plt.subplots(figsize=(11, 4.8))
for i, v in enumerate(["v1b", "v2", "v3", "v4"]):
    wv = book_series(v, BOOKS["diversified (all 50)"]); pnl_, eq_, cap_ = equity_curve(wv)
    ax.plot(eq_.index, eq_ / cap_, color=V.CAT[i], lw=1.3, label={"v1b": "v1b Black-Scholes (trading clock)", "v2": "v2 own-history", "v3": "v3 EVT/GPD", "v4": "v4 pooled vol-scaled"}[v])
ax.axhline(0, color=V.STATUS["critical"], lw=1, ls="--"); ax.axhline(1, color=V.INK2, lw=0.8); ax.set_yscale("symlog", linthresh=1); ax.legend(fontsize=8)
ax.set_title("Same book, four pricing engines: Kip's equity multiple")
V.save(fig, "50_keeper_by_pricing_version.png")
