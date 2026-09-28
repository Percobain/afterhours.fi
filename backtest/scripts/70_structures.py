"""70 - Principal-protection structures, simulated on the walk-forward panel (2005-2026, v4 pricing).

HERMEE (buyer) structures, evaluated on every ticker-weekend:
  S1 plain put at barrier b, paid out of pocket
  S2 put spread b .. b+15pts (payout capped at 15% of notional), cheaper
  S3 yield-funded sleeve: (1-w) stock + w T-bill token; the sleeve's weekly yield buys the tightest affordable barrier
  S4 fixed weekly budget (e.g. 5bp of holding) buys the tightest affordable barrier ("constant premium, floating floor")
KIP (pool) structures on the diversified 50-name book, capital = 10% of covered notional:
  K0 baseline (flat 4% idle yield)        K1 capital in T-bills at the actual historical 3m yield
  K2 payout cap 20% per ticker            K3 junior/senior tranches (junior takes first loss, senior earns T-bill + spread)
  K4 CPPI sizing: covered notional = m x (equity - floor)     K5 the combination
Outputs: results/70_*.csv, results/70_structures.md, charts/70_*.png"""
import os, sys, json
import numpy as np, pandas as pd
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); sys.path.insert(0, ROOT)
from scripts.lib import viz as V
import matplotlib.pyplot as plt
RES = os.path.join(ROOT, "results"); CFG = json.load(open(os.path.join(ROOT, "config.json")))
U = json.load(open(os.path.join(ROOT, "data", "universe.json"))); UNIV = set(U["backtest_universe"]); ETF = set(U["etfs"])
P = pd.read_parquet(os.path.join(RES, "20_weekend_panel.parquet")); P = P[P.ticker.isin(UNIV)]
TB = pd.read_csv(os.path.join(ROOT, "data", "tbill_3m.csv"), parse_dates=["Date"], index_col="Date")["tbill_3m_pct"] / 100
GAMMA = 4.0; LOAD = CFG["risk_load"]; FLOOR = CFG["premium_floor"]; NPATH = CFG["bootstrap_paths"]; rng = np.random.default_rng(11)
BARS = sorted(P.barrier.unique())                      # 0.03, 0.05, 0.07, 0.10
GROUPS = {"index ETFs": lambda t: t in {"SPY", "QQQ", "IWM", "EEM", "TLT", "GLD", "HYG"}, "mega caps": lambda t: t in {"AAPL", "MSFT", "GOOGL", "AMZN", "META", "NVDA", "AVGO", "JPM", "V", "MA", "LLY", "UNH", "XOM"},
          "high beta": lambda t: t in {"TSLA", "COIN", "MSTR", "HOOD", "PLTR", "SMCI", "AMD", "NFLX", "RIVN", "SOFI", "GME", "AMC", "MRNA", "CRCL"}, "all 50": lambda t: True}

def ce(r, g=GAMMA):
    r = np.clip(np.asarray(r, float), -0.95, None); return (np.mean((1 + r) ** (1 - g))) ** (1 / (1 - g)) - 1
def cvar(x, q): x = np.sort(np.asarray(x)); return x[:max(1, int(np.ceil(len(x) * q)))].mean()
def pmi(bare, prot):
    a, b = cvar(bare, .01), cvar(prot, .01); c, d = cvar(bare, .05), cvar(prot, .05)
    return 100 * np.clip(.5 * (1 - b / a) + .5 * (1 - d / c), 0, 1) if a < 0 else 0.0

# ---------- wide panel: one row per ticker-weekend, premium & payout per barrier
W = P.pivot_table(index=["ticker", "friday"], columns="barrier", values=["q_v4", "payout_open"]).reset_index()
W.columns = ["ticker", "friday"] + [f"{a}_{int(b*100)}" for a, b in W.columns[2:]]
base = P[P.barrier == 0.05][["ticker", "friday", "gap_open", "rv20"]]
W = W.merge(base, on=["ticker", "friday"]).sort_values(["friday", "ticker"]).reset_index(drop=True)
W["tbill"] = TB.reindex(W.friday, method="ffill").values; W["tbill"] = W["tbill"].fillna(0.04)
# put-spread scaling: share of full payout retained when the payout is capped at 15pts (from the realised pooled distribution)
cap_ratio = {b: np.minimum(W[f"payout_open_{int(b*100)}"], 0.15).sum() / W[f"payout_open_{int(b*100)}"].sum() for b in BARS}
gap = W.gap_open.values

def struct_returns(kind, **kw):
    """weekly return per $1 of Hermee's holding under a structure; returns (r_struct, r_reference, cost_per_week, barrier_bought)"""
    if kind == "bare": return gap, gap, np.zeros_like(gap), np.full(len(gap), np.nan)
    if kind == "put":
        b = kw["b"]; q = W[f"q_v4_{int(b*100)}"].values; pay = W[f"payout_open_{int(b*100)}"].values
        return gap - q + pay, gap, q, np.full(len(gap), b)
    if kind == "spread":
        b = kw["b"]; q = W[f"q_v4_{int(b*100)}"].values * cap_ratio[b]; pay = np.minimum(W[f"payout_open_{int(b*100)}"].values, 0.15)
        return gap - q + pay, gap, q, np.full(len(gap), b)
    if kind in ("sleeve", "budget"):
        if kind == "sleeve":
            w = kw["w"]; y = (W.tbill.values if kw.get("actual_rates", True) else 0.04); budget = w * y / 52 / (1 - w)   # per $ of stock
            ref = (1 - w) * gap + w * y / 52
        else:
            budget = np.full(len(gap), kw["bp"] * 1e-4); ref = gap; w = 0.0
        # tightest affordable barrier per row (cover only the stock part)
        r = gap.copy(); bought = np.full(len(gap), np.nan); cost = np.zeros(len(gap))
        for b in BARS:                         # ascending: 3% first
            q = W[f"q_v4_{int(b*100)}"].values; pay = W[f"payout_open_{int(b*100)}"].values
            m = np.isnan(bought) & (q <= budget)
            r[m] = gap[m] - q[m] + pay[m]; bought[m] = b; cost[m] = q[m]
        if kind == "sleeve": r = (1 - w) * r + w * y / 52
        return r, ref, cost, bought

STRUCTS = [("bare", {}), ("put 3%", {"kind": "put", "b": .03}), ("put 5%", {"kind": "put", "b": .05}), ("put 7%", {"kind": "put", "b": .07}), ("put 10%", {"kind": "put", "b": .10}),
           ("spread 5-20%", {"kind": "spread", "b": .05}), ("spread 3-18%", {"kind": "spread", "b": .03}),
           ("sleeve 10% T-bill", {"kind": "sleeve", "w": .10}), ("sleeve 20% T-bill", {"kind": "sleeve", "w": .20}), ("sleeve 30% T-bill", {"kind": "sleeve", "w": .30}), ("sleeve 50% T-bill", {"kind": "sleeve", "w": .50}),
           ("sleeve 20% @4% fixed", {"kind": "sleeve", "w": .20, "actual_rates": False}),
           ("budget 2bp/wk", {"kind": "budget", "bp": 2}), ("budget 5bp/wk", {"kind": "budget", "bp": 5}), ("budget 10bp/wk", {"kind": "budget", "bp": 10}), ("budget 25bp/wk", {"kind": "budget", "bp": 25})]
rows = []
for name, kw in STRUCTS:
    kind = kw.pop("kind", "bare") if kw else "bare"
    r, ref, cost, bought = struct_returns(kind, **kw)
    for gname, fn in GROUPS.items():
        m = W.ticker.map(fn).values
        rs, rf, cs, bs = r[m], ref[m], cost[m], bought[m]
        rows.append({"structure": name, "group": gname, "n": int(m.sum()), "cost_bp_per_week": cs.mean() * 1e4, "cost_pct_pa": cs.mean() * 52 * 100,
                     "mean_ret_bp": rs.mean() * 1e4, "ref_mean_ret_bp": rf.mean() * 1e4, "ce_gain_bp": (ce(rs) - ce(rf)) * 1e4, "cvar99": cvar(rs, .01), "cvar99_ref": cvar(rf, .01),
                     "worst": rs.min(), "worst_ref": rf.min(), "pmi": pmi(rf, rs), "share_weeks_covered": np.isfinite(bs).mean(),
                     "avg_barrier_bought": np.nanmean(bs) if np.isfinite(bs).any() else np.nan, "share_3pct": (bs == .03).mean(), "share_5pct": (bs == .05).mean()})
H = pd.DataFrame(rows); H.to_csv(os.path.join(RES, "70_hermee_structures.csv"), index=False)
pd.set_option("display.width", 250)
print("HERMEE structures (v4 charged, 2005-2026):")
print(H[H.group == "mega caps"][["structure", "cost_pct_pa", "ce_gain_bp", "worst", "worst_ref", "pmi", "share_weeks_covered", "avg_barrier_bought"]].round(3).to_string())
print(H[H.group == "high beta"][["structure", "cost_pct_pa", "ce_gain_bp", "worst", "pmi", "share_weeks_covered", "avg_barrier_bought"]].round(3).to_string())

# sleeve affordability by rate regime: what barrier does a 20% sleeve buy, by year, for SPY / AAPL / NVDA
aff = []
for t in ["SPY", "QQQ", "AAPL", "NVDA", "TSLA", "COIN"]:
    d = W[W.ticker == t]
    for w in (.1, .2, .3, .5):
        budget = w * d.tbill.values / 52 / (1 - w); bought = np.full(len(d), np.nan)
        for b in BARS:
            m = np.isnan(bought) & (d[f"q_v4_{int(b*100)}"].values <= budget); bought[m] = b
        for y, g in pd.DataFrame({"y": d.friday.dt.year.values, "b": bought}).groupby("y"):
            aff.append({"ticker": t, "sleeve": w, "year": y, "share_covered": np.isfinite(g.b).mean(), "avg_barrier": np.nanmean(g.b) if np.isfinite(g.b).any() else np.nan})
AFF = pd.DataFrame(aff); AFF.to_csv(os.path.join(RES, "70_sleeve_affordability.csv"), index=False)

# ---------- KIP structures on the diversified book
b5 = P[P.barrier == 0.05]
book = b5.groupby("friday").agg(prem=("q_v4", "mean"), pay=("payout_open", "mean"), pay_cap20=("payout_open", lambda s: np.minimum(s, .20).mean()), n=("ticker", "size"))
book["prem_cap20"] = book.prem * cap_ratio_20 if (cap_ratio_20 := np.minimum(b5.payout_open, .20).sum() / b5.payout_open.sum()) else book.prem
book["tbill"] = TB.reindex(book.index, method="ffill").fillna(0.04).values
COVERED = 10_000_000; CAP = 0.10; capital0 = COVERED * CAP

def run_pool(net, yld, capital=capital0, covered=COVERED):
    pnl = net.values * covered + capital * yld.values / 52; eq = capital + np.cumsum(pnl); return pnl, eq

def boot(net_arr, yld_arr, cap_ratio, weeks=52, block=4, npath=NPATH):
    n = len(net_arr); nb = int(np.ceil(weeks / block)); st = rng.integers(0, n - block, size=(npath, nb))
    idx = np.concatenate([st[:, [j]] + np.arange(block) for j in range(nb)], axis=1)[:, :weeks]
    sample = net_arr[idx] + cap_ratio * yld_arr[idx] / 52
    eq = cap_ratio + np.cumsum(sample, axis=1)
    return eq  # in units of covered notional

def summarize(name, net, yld, extra=None):
    pnl, eq = run_pool(net, yld); yrs = (book.index[-1] - book.index[0]).days / 365.25
    eqb = boot(net.values, yld.values, CAP)
    out = {"structure": name, "roc_pa": (eq[-1] / capital0) ** (1 / yrs) - 1, "sharpe": pnl.mean() / pnl.std() * np.sqrt(52), "max_dd": (eq / np.maximum.accumulate(eq) - 1).min(),
           "worst_week_pct_cap": (net.values * COVERED).min() / capital0, "loss_ratio": book.pay.sum() / book.prem.sum() if "cap" not in name else book.pay_cap20.sum() / book.prem_cap20.sum(),
           "ruin_1y": (eqb.min(axis=1) <= 0).mean(), "median_roc_1y": np.median(eqb[:, -1] / CAP - 1), "p05_roc_1y": np.quantile(eqb[:, -1] / CAP - 1, .05)}
    if extra: out.update(extra)
    return out

K = []
flat4 = pd.Series(0.04, index=book.index)
K.append(summarize("K0 baseline: USDT idle @4% flat", book.prem - book.pay, flat4))
K.append(summarize("K1 capital in T-bills (actual 3m yield)", book.prem - book.pay, book.tbill))
K.append(summarize("K2 payout cap 20% per ticker", book.prem_cap20 - book.pay_cap20, flat4))
K.append(summarize("K1+K2 T-bills + cap", book.prem_cap20 - book.pay_cap20, book.tbill))

# K3 tranches: capital split junior J / senior 1-J. Weekly: premiums + yield -> senior coupon first (tbill + spread), rest to junior; losses -> junior first.
def tranche_sim(net_arr, yld_arr, J, spread=0.04, cap_ratio=CAP, weeks=52, npath=NPATH, block=4):
    n = len(net_arr); nb = int(np.ceil(weeks / block)); st = rng.integers(0, n - block, size=(npath, nb))
    idx = np.concatenate([st[:, [j]] + np.arange(block) for j in range(nb)], axis=1)[:, :weeks]
    jun = np.full(npath, cap_ratio * J); sen = np.full(npath, cap_ratio * (1 - J)); sen_paid = np.zeros(npath); jun_paid = np.zeros(npath); sen_imp = np.zeros(npath, bool)
    for k in range(weeks):
        cash = net_arr[idx[:, k]] + cap_ratio * yld_arr[idx[:, k]] / 52          # book net + yield on all capital, per $ notional
        coupon = np.minimum(np.maximum(cash, 0), sen * (yld_arr[idx[:, k]] + spread) / 52)   # senior coupon paid first out of positive cash
        sen_paid += coupon; resid = cash - coupon
        jun = jun + resid                                                   # residual (positive or negative) to junior
        short = np.minimum(jun, 0); sen = sen + short; jun = np.maximum(jun, 0)  # junior exhausted -> senior eats the rest
        sen_imp |= short < 0
    return {"J": J, "senior_impaired_1y": sen_imp.mean(), "senior_loss_p99": np.quantile((sen + sen_paid) / (cap_ratio * (1 - J)) - 1, .01), "senior_median_return": np.median((sen + sen_paid) / (cap_ratio * (1 - J)) - 1),
            "junior_median_return": np.median(jun / (cap_ratio * J) - 1), "junior_p05_return": np.quantile(jun / (cap_ratio * J) - 1, .05), "junior_wiped_1y": (jun <= 1e-9).mean()}
TR = []
for J in (.2, .3, .4, .5, .6, .7):
    for spr in (.02, .04):
        for nm, net, yld in (("plain", book.prem - book.pay, book.tbill), ("cap20", book.prem_cap20 - book.pay_cap20, book.tbill)):
            r = tranche_sim(net.values, yld.values, J, spr); r.update({"book": nm, "senior_spread": spr}); TR.append(r)
TR = pd.DataFrame(TR); TR.to_csv(os.path.join(RES, "70_kip_tranches.csv"), index=False)
print("\nTRANCHES (capital 10%, T-bill yield, 1-year block bootstrap):"); print(TR[(TR.senior_spread == .04)].round(4).to_string())

# in-sample tranche path (plain book, J=50%, spread 4%)
def tranche_path(net, yld, J, spread=.04):
    jun = capital0 * J; sen = capital0 * (1 - J); rows = []
    for d, x, y in zip(book.index, net.values, yld.values):
        cash = x * COVERED + capital0 * y / 52; coupon = min(max(cash, 0), sen * (y + spread) / 52); resid = cash - coupon; jun += resid
        if jun < 0: sen += jun; jun = 0
        rows.append({"date": d, "junior": jun, "senior": sen, "coupon": coupon})
    return pd.DataFrame(rows).set_index("date")
TP = tranche_path(book.prem - book.pay, book.tbill, .5)

# K4 CPPI: covered notional_t = m * (equity_t - floor), floor = F * capital0, m = 1/CAP = 10 (so it starts at $10M)
def cppi(net, yld, m=10, F=.5, capital=capital0):
    eq = capital; floor = F * capital; eqs = []; cov = []
    for x, y in zip(net.values, yld.values):
        N = max(min(m * (eq - floor), 3 * COVERED), 0); pnl = x * N + eq * y / 52; eq += pnl; eqs.append(eq); cov.append(N)
    return np.array(eqs), np.array(cov)
def cppi_boot(net_arr, yld_arr, m, F, weeks=52, npath=NPATH, block=4):
    n = len(net_arr); nb = int(np.ceil(weeks / block)); st = rng.integers(0, n - block, size=(npath, nb))
    idx = np.concatenate([st[:, [j]] + np.arange(block) for j in range(nb)], axis=1)[:, :weeks]
    eq = np.full(npath, 1.0); floor = F
    for k in range(weeks):
        N = np.clip(m * (eq - floor), 0, 3 / CAP); eq = eq + net_arr[idx[:, k]] * N + eq * yld_arr[idx[:, k]] / 52
    return eq
CP = []
for m, F in ((10, 0), (10, .5), (10, .7), (7, .5), (15, .7)):
    eqp, covp = cppi(book.prem - book.pay, book.tbill, m, F); yrs = (book.index[-1] - book.index[0]).days / 365.25
    eb = cppi_boot((book.prem - book.pay).values, book.tbill.values, m, F)
    CP.append({"m": m, "floor": F, "roc_pa": (eqp[-1] / capital0) ** (1 / yrs) - 1, "min_equity_pct": eqp.min() / capital0, "avg_covered_$M": covp.mean() / 1e6, "min_covered_$M": covp.min() / 1e6,
               "ruin_1y": (eb <= 0).mean(), "p_below_floor_1y": (eb < F).mean(), "median_ret_1y": np.median(eb) - 1, "p05_ret_1y": np.quantile(eb, .05) - 1})
CP = pd.DataFrame(CP); CP.to_csv(os.path.join(RES, "70_kip_cppi.csv"), index=False)
print("\nCPPI:"); print(CP.round(4).to_string())
KD = pd.DataFrame(K); KD.to_csv(os.path.join(RES, "70_kip_structures.csv"), index=False)
print("\nKIP structures:"); print(KD.round(4).to_string())

# ---------- markdown
best_tr = TR[(TR.book == "cap20") & (TR.senior_spread == .04) & (TR.senior_impaired_1y <= .005)].sort_values("J").head(1)
md = ["# Principal-protection structures - simulation results\n", "All Hermee numbers are per $1 of her stock holding, every ticker-weekend 2005-2026, v4 charged premiums (walk-forward), T-bill yield = actual 13-week bill yield that Friday unless stated. CE gain = certainty-equivalent weekly return gain vs the same portfolio without cover (CRRA gamma 4), in bp per week; positive means a risk-averse holder prefers the structure.\n",
      "## Hermee\n", H[H.group != "all 50"].pivot_table(index="structure", columns="group", values="ce_gain_bp").round(2).to_markdown(), "\n",
      "Cost (% of holding per year), worst weekend and Peace-of-Mind Index by structure, all 50 names:\n", H[H.group == "all 50"][["structure", "cost_pct_pa", "worst", "worst_ref", "pmi", "share_weeks_covered", "avg_barrier_bought"]].round(3).to_markdown(index=False), "\n",
      "Sleeve affordability: share of weekends where a 20% T-bill sleeve fully funds at least the 10% barrier, by rate regime:\n",
      AFF[AFF.sleeve == .2].pivot_table(index="year", columns="ticker", values="share_covered").round(2).to_markdown(), "\n",
      "## Kip\n", KD.round(4).to_markdown(index=False), "\n", "### Tranches (junior share J of the 10% capital; senior earns T-bill + spread first; junior takes first loss)\n", TR[TR.senior_spread == .04].round(4).to_markdown(index=False), "\n",
      "### CPPI sizing (covered notional = m x (equity - floor))\n", CP.round(4).to_markdown(index=False), "\n",
      f"### In-sample tranche path, J = 50%, spread 4%: senior ended at ${TP.senior.iloc[-1]:,.0f} of ${capital0*.5:,.0f} (+${TP.coupon.sum():,.0f} coupons), junior ended at ${TP.junior.iloc[-1]:,.0f} of ${capital0*.5:,.0f}; senior impaired in-sample: {bool((TP.senior < capital0*.5 - 1).any())}\n"]
open(os.path.join(RES, "70_structures.md"), "w", encoding="utf-8").write("\n".join(md))

# ---------- charts
print("charts:")
fig, ax = plt.subplots(figsize=(10, 6))
d = H[H.group != "all 50"].pivot_table(index="structure", columns="group", values="ce_gain_bp").loc[[s for s, _ in STRUCTS if s != "bare"]]
y = np.arange(len(d)); w = 0.26
for i, g in enumerate(["index ETFs", "mega caps", "high beta"]): ax.barh(y + (i - 1) * w, d[g], w, color=V.CAT[i], label=g)
ax.axvline(0, color=V.INK2, lw=1); ax.set_xscale("symlog", linthresh=0.5); ax.set_yticks(y); ax.set_yticklabels(d.index, fontsize=8); ax.invert_yaxis(); ax.legend(fontsize=8, loc="lower left")
ax.set_title("Is the structure worth it to a risk-averse holder? Certainty-equivalent gain, bp per weekend (CRRA 4)")
V.save(fig, "70_hermee_ce_by_structure.png", "Right of zero: the holder prefers the structure even after the 50% load. Sleeves and budgets buy the tightest affordable barrier each Friday.")

fig, ax = plt.subplots(figsize=(10, 4.6))
for i, t in enumerate(["SPY", "AAPL", "NVDA", "COIN"]):
    d = AFF[(AFF.ticker == t) & (AFF.sleeve == .2)]; ax.plot(d.year, d.share_covered, marker="o", ms=3.5, color=V.CAT[i], label=t)
tb_y = TB.resample("YE").mean(); ax2 = ax.twinx(); ax2.fill_between(tb_y.index.year, 0, tb_y.values, color=V.GRID, alpha=.6, lw=0, step="mid"); ax2.set_ylim(0, .12); ax2.set_yticks([]); ax2.grid(False)
ax.set_ylim(0, 1.05); V.pct(ax); ax.legend(fontsize=8, loc="center left"); ax.set_title("A 20% T-bill sleeve: share of weekends the yield fully pays for cover (grey = 3m T-bill yield)")
V.save(fig, "70_sleeve_affordability.png", "Yield-funded protection only exists when rates exist: 2009-2016 and 2020-2021 the sleeve bought nothing. Grey band peaks at ~5%.")

fig, axes = plt.subplots(1, 2, figsize=(12, 4.5))
for i, (bk, ls) in enumerate((("plain", "-"), ("cap20", "--"))):
    d = TR[(TR.book == bk) & (TR.senior_spread == .04)]
    axes[0].plot(d.J, d.senior_impaired_1y, marker="o", ms=4, color=V.CAT[0], ls=ls, label=f"senior impaired ({bk})")
    axes[0].plot(d.J, d.junior_wiped_1y, marker="o", ms=4, color=V.CAT[1], ls=ls, label=f"junior wiped ({bk})")
    axes[1].plot(d.J, d.junior_median_return, marker="o", ms=4, color=V.CAT[1], ls=ls, label=f"junior median ({bk})")
    axes[1].plot(d.J, d.junior_p05_return, marker="o", ms=4, color=V.CAT[7], ls=ls, label=f"junior 5th pct ({bk})")
    axes[1].plot(d.J, d.senior_median_return, marker="o", ms=4, color=V.CAT[0], ls=ls, label=f"senior median ({bk})")
axes[0].axhline(.01, color=V.STATUS["critical"], lw=1, ls=":"); axes[0].set_yscale("log"); axes[0].set_ylim(1e-4, 1); V.pct(axes[0], "x"); axes[0].set_xlabel("junior share of pool capital"); axes[0].legend(fontsize=7); axes[0].set_title("One-year probability of loss by tranche")
V.pct(axes[1]); V.pct(axes[1], "x"); axes[1].axhline(0, color=V.INK2, lw=1); axes[1].set_xlabel("junior share of pool capital"); axes[1].legend(fontsize=7); axes[1].set_title("One-year tranche returns (senior coupon = T-bill + 4%)")
V.save(fig, "70_kip_tranches.png", "Capital 10% of covered notional, diversified 50-name book, 20,000 block-bootstrap years. Dashed = payouts capped at 20% per ticker.")

fig, ax = plt.subplots(figsize=(11, 4.8))
ax.plot(TP.index, TP.junior / (capital0 * .5), color=V.CAT[1], lw=1.4, label="junior tranche (50% of capital), value / start")
ax.plot(TP.index, (TP.senior + TP.coupon.cumsum()) / (capital0 * .5), color=V.CAT[0], lw=1.4, label="senior tranche incl. coupons, value / start")
ax.axhline(1, color=V.INK2, lw=.8); ax.axhline(0, color=V.STATUS["critical"], lw=1, ls="--"); ax.legend(fontsize=8); ax.set_title("In-sample tranche paths 2005-2026, diversified book, T-bill collateral")
V.save(fig, "70_kip_tranche_paths.png", "Junior absorbs March 2020; senior is never touched and compounds T-bill + 4%.")
