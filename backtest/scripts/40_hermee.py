"""40 - Hermee, the Sleeper. She holds a fixed number of shares and buys weekend cover every Friday.
For each scenario: premiums paid, payouts received, terminal wealth protected vs unprotected, worst weekend,
weekend CVaR before/after, a CRRA certainty-equivalent test (is the cover worth it to a risk-averse holder?),
and a Peace-of-Mind Index. Premiums are v4 walk-forward (annual refit, prior data only), 50% load, 1bp floor.
Outputs: results/40_hermee_scenarios.csv, results/40_hermee_cards.md, charts/40_*.png"""
import os, sys, json
import numpy as np, pandas as pd
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); sys.path.insert(0, ROOT)
from scripts.lib import viz as V
import matplotlib.pyplot as plt, matplotlib.dates as mdates
RES = os.path.join(ROOT, "results"); CFG = json.load(open(os.path.join(ROOT, "config.json")))
P = pd.read_parquet(os.path.join(RES, "20_weekend_panel.parquet"))
MAX_PREMIUM = 0.02  # Hermee will not pay more than 2% of her holding for one weekend of cover (she is priced out above that)
GAMMA = 4.0   # CRRA risk aversion for the certainty-equivalent test (4 = a clearly risk-averse retail holder)

SCENARIOS = [
 # id, ticker, start, end, dollars invested at start, why this one
 ("H1", "NVDA", "2024-01-05", "2026-09-25", 100_000, "AI winner through the yen unwind (Aug 2024) and DeepSeek Monday (Jan 2025)"),
 ("H2", "AAPL", "2015-01-02", "2017-12-29", 100_000, "the backtest-v1 window: one breach (China Black Monday) in three years"),
 ("H3", "SPY", "2019-01-04", "2021-12-31", 100_000, "index holder through COVID"),
 ("H4", "COIN", "2021-04-16", "2026-09-25", 50_000, "crypto beta: weekends are when crypto crashes and the NYSE is shut"),
 ("H5", "TSLA", "2020-01-03", "2026-09-25", 50_000, "high-vol single name, six years"),
 ("H6", "QQQ", "2007-01-05", "2009-12-31", 100_000, "Nasdaq holder through the GFC (Lehman weekend included)"),
 ("H7", "ZM", "2020-01-03", "2021-12-31", 50_000, "stay-at-home winner hit by Pfizer Monday"),
 ("H8", "GLD", "2012-01-06", "2013-12-27", 100_000, "gold holder through the April 2013 gold crash"),
 ("H9", "MSTR", "2024-01-05", "2026-09-25", 50_000, "levered bitcoin proxy"),
 ("H10", "GME", "2020-06-05", "2021-12-31", 25_000, "meme stock: huge up-gaps AND down-gaps"),
 ("H11", "SPY", "2005-01-07", "2026-09-25", 100_000, "twenty-one years of buy-and-hold, every weekend insured"),
 ("H12", "SMCI", "2023-01-06", "2026-09-25", 50_000, "AI-server high flyer with accounting scares"),
]

def cvar(x, q):
    x = np.sort(np.asarray(x)); k = max(1, int(np.ceil(len(x) * q))); return x[:k].mean()

def ce_crra(r, g=GAMMA):
    r = np.asarray(r); r = np.clip(r, -0.95, None)
    return (np.mean((1 + r) ** (1 - g))) ** (1 / (1 - g)) - 1

rows = []; paths = {}
for sid, t, a, b_, dollars, why in SCENARIOS:
    d = P[(P.ticker == t) & (P.friday >= a) & (P.friday <= b_)].sort_values("friday")
    if len(d) == 0: print("no data", sid); continue
    for B in CFG["barriers"]:
        g = d[d.barrier == B].copy()
        if len(g) == 0: continue
        shares = dollars / g.close.iloc[0]
        g["notional"] = shares * g.close
        g["bought"] = g.q_v4 <= MAX_PREMIUM
        g["prem"] = np.where(g.bought, g.q_v4 * g.notional, 0.0); g["pay"] = np.where(g.bought, g.payout_open * g.notional, 0.0)
        g["wk_unprot"] = g.gap_open * g.notional
        g["wk_prot"] = g.wk_unprot - g.prem + g.pay
        yrs = (g.friday.iloc[-1] - g.friday.iloc[0]).days / 365.25
        avg_n = g.notional.mean()
        r_u = g.gap_open.values; r_p = np.where(g.bought, g.gap_open - g.q_v4 + g.payout_open, g.gap_open)
        ce_u, ce_p = ce_crra(r_u), ce_crra(r_p)
        c95u, c95p = cvar(r_u, 0.05), cvar(r_p, 0.05); c99u, c99p = cvar(r_u, 0.01), cvar(r_p, 0.01)
        pmi = 100 * np.clip(0.5 * (1 - c99p / c99u) + 0.5 * (1 - c95p / c95u), 0, 1) if c99u < 0 else 0.0
        rows.append({"scenario": sid, "ticker": t, "start": g.friday.iloc[0].date(), "end": g.friday.iloc[-1].date(), "years": yrs, "invested": dollars,
                     "barrier": B, "weekends": len(g), "avg_notional": avg_n, "premiums_paid": g.prem.sum(), "payouts": g.pay.sum(),
                     "net_cost": g.prem.sum() - g.pay.sum(), "net_cost_pct_pa": (g.prem.sum() - g.pay.sum()) / avg_n / yrs,
                     "avg_premium_bp": g.q_v4[g.bought].mean()*1e4, "weekends_priced_out": int((~g.bought).sum()), "breaches": int((g.gap_open < -B).sum()),
                     "weekend_pnl_unprotected": g.wk_unprot.sum(), "weekend_pnl_protected": g.wk_prot.sum(),
                     "worst_weekend_unprotected": g.wk_unprot.min(), "worst_weekend_protected": g.wk_prot.min(),
                     "worst_weekend_date": g.friday.iloc[int(np.argmin(r_u))].date(), "worst_gap": r_u.min(),
                     "cvar95_unprot": c95u, "cvar95_prot": c95p, "cvar99_unprot": c99u, "cvar99_prot": c99p,
                     "ce_unprot_bp": ce_u*1e4, "ce_prot_bp": ce_p*1e4, "ce_gain_bp_per_weekend": (ce_p - ce_u)*1e4,
                     "worth_it_to_risk_averse": ce_p > ce_u, "peace_of_mind_index": pmi, "why": why})
        if B == CFG["default_barrier"]:
            paths[sid] = g[["friday", "close", "notional", "prem", "pay", "wk_unprot", "wk_prot", "gap_open"]].copy()
H = pd.DataFrame(rows); H.to_csv(os.path.join(RES, "40_hermee_scenarios.csv"), index=False)
pd.set_option("display.width", 250)
h5 = H[H.barrier == 0.05]
print(h5[["scenario","ticker","years","weekends","weekends_priced_out","avg_premium_bp","premiums_paid","payouts","net_cost","net_cost_pct_pa","breaches","worst_weekend_unprotected","worst_weekend_protected","ce_gain_bp_per_weekend","worth_it_to_risk_averse","peace_of_mind_index"]].round(2).to_string())

# ---- cards
md = ["# Hermee's weekends\n", "Hermee holds a fixed number of shares bought on the start date and buys cover on every weekend-spanning closed session. "
      "Premium = v4 pooled vol-scaled quote (walk-forward, 50% load, 1bp floor). Settlement at Monday open reference price.\n",
      f"Certainty equivalent uses CRRA utility with gamma = {GAMMA:.0f}. 'Worth it' means a holder that risk-averse prefers the insured weekend return stream even after paying the premium.\n",
      "Peace-of-Mind Index (0-100) = average reduction of 95% and 99% weekend CVaR. 100 means the tail is gone; 0 means nothing changed.\n"]
for sid, g in H.groupby("scenario", sort=False):
    r = g[g.barrier == 0.05].iloc[0]
    md.append(f"## {sid}  {r.ticker}  {r.start} -> {r.end}  (${r.invested:,.0f} invested; {r.why})\n")
    md.append(f"- Weekends covered: **{r.weekends - r.weekends_priced_out}** of {r.weekends} (priced out above {MAX_PREMIUM:.0%} on {r.weekends_priced_out}), breaches of 5%: **{r.breaches}**, average premium **{r.avg_premium_bp:.1f}bp** per weekend")
    md.append(f"- Premiums paid **${r.premiums_paid:,.0f}**, payouts received **${r.payouts:,.0f}**, net cost **${r.net_cost:,.0f}** = {r.net_cost_pct_pa:.2%} of holdings per year")
    md.append(f"- Worst weekend ({r.worst_weekend_date}, gap {r.worst_gap:+.1%}): unprotected **${r.worst_weekend_unprotected:,.0f}**, protected **${r.worst_weekend_protected:,.0f}**")
    md.append(f"- Weekend CVaR99: {r.cvar99_unprot:+.2%} -> {r.cvar99_prot:+.2%}; CVaR95: {r.cvar95_unprot:+.2%} -> {r.cvar95_prot:+.2%}")
    md.append(f"- Certainty-equivalent gain: **{r.ce_gain_bp_per_weekend:+.2f}bp/weekend** -> {'worth it' if r.worth_it_to_risk_averse else 'not worth it'} to a gamma-{GAMMA:.0f} holder. Peace-of-Mind Index **{r.peace_of_mind_index:.0f}/100**")
    md.append("\n| barrier | premium bp | paid | received | net cost | net %/yr | worst wknd unprot | worst wknd prot | CE gain bp | PMI |")
    md.append("|---|---|---|---|---|---|---|---|---|---|")
    for x in g.itertuples():
        md.append(f"| {x.barrier:.0%} | {x.avg_premium_bp:.1f} | ${x.premiums_paid:,.0f} | ${x.payouts:,.0f} | ${x.net_cost:,.0f} | {x.net_cost_pct_pa:.2%} | ${x.worst_weekend_unprotected:,.0f} | ${x.worst_weekend_protected:,.0f} | {x.ce_gain_bp_per_weekend:+.2f} | {x.peace_of_mind_index:.0f} |")
    md.append("")
open(os.path.join(RES, "40_hermee_cards.md"), "w", encoding="utf-8").write("\n".join(md))

# ---- charts
print("charts:")
ids = [s for s in paths]
fig, axes = plt.subplots(4, 3, figsize=(14, 13)); axes = axes.ravel()
for ax in axes[len(ids):]: ax.axis("off")
for ax, sid in zip(axes, ids):
    g = paths[sid]; r = h5[h5.scenario == sid].iloc[0]
    cum_u = g.wk_unprot.cumsum(); cum_p = g.wk_prot.cumsum()
    ax.plot(g.friday, cum_u, color=V.CAT[7], lw=1.4, label="weekend P&L, unprotected")
    ax.plot(g.friday, cum_p, color=V.HERMEE, lw=1.6, label="weekend P&L, protected 5%")
    ax.fill_between(g.friday, cum_u, cum_p, where=cum_p > cum_u, color=V.HERMEE, alpha=0.12, lw=0)
    ax.set_title(f"{sid} {r.ticker}: net cost ${r.net_cost:,.0f}, PMI {r.peace_of_mind_index:.0f}", fontsize=10); V.money(ax)
    ax.tick_params(axis="x", labelsize=7); ax.xaxis.set_major_locator(mdates.AutoDateLocator(maxticks=5)); ax.xaxis.set_major_formatter(mdates.DateFormatter("%Y-%m"))
axes[0].legend(fontsize=7, loc="upper left")
fig.suptitle("Hermee: cumulative P&L earned ONLY across closed sessions, insured vs not (5% barrier)", x=0.01, ha="left", fontsize=13, fontweight="semibold")
fig.tight_layout(rect=(0, 0.02, 1, 0.97))
V.save(fig, "40_hermee_weekend_pnl_paths.png", "Gap between the lines = payouts minus premiums. Insurance costs a slow drip and pays in lumps; the shaded area is where she is ahead.")

# premium vs payout bars per scenario
fig, ax = plt.subplots(figsize=(10, 5))
y = np.arange(len(h5)); ax.barh(y - 0.2, h5.premiums_paid, 0.4, color=V.CAT[0], label="premiums paid")
ax.barh(y + 0.2, h5.payouts, 0.4, color=V.HERMEE, label="payouts received")
ax.set_yticks(y); ax.set_yticklabels([f"{r.scenario} {r.ticker} {str(r.start)[:4]}-{str(r.end)[:4]}" for r in h5.itertuples()], fontsize=8); V.money(ax, "x"); ax.legend()
ax.set_title("What Hermee paid vs what she got back, 5% barrier")
V.save(fig, "40_hermee_paid_vs_received.png")

# worst weekend protected vs unprotected
fig, ax = plt.subplots(figsize=(10, 5))
ax.barh(y - 0.2, h5.worst_weekend_unprotected, 0.4, color=V.CAT[7], label="worst weekend, unprotected")
ax.barh(y + 0.2, h5.worst_weekend_protected, 0.4, color=V.HERMEE, label="worst weekend, protected")
ax.set_yticks(y); ax.set_yticklabels([f"{r.scenario} {r.ticker}" for r in h5.itertuples()], fontsize=8); V.money(ax, "x"); ax.legend(loc="lower left")
ax.set_title("The Monday morning she remembers: worst single weekend, $")
V.save(fig, "40_hermee_worst_weekend.png")

# PMI and CE gain by barrier (small multiples of lines)
fig, axes = plt.subplots(1, 2, figsize=(12, 4.5))
for i, (sid, g) in enumerate(H.groupby("scenario", sort=False)):
    c = V.CAT[i % 8]; ls = "-" if i < 8 else "--"
    axes[0].plot(g.barrier, g.peace_of_mind_index, marker="o", ms=4, color=c, ls=ls, label=f"{sid} {g.ticker.iloc[0]}")
    axes[1].plot(g.barrier, g.ce_gain_bp_per_weekend, marker="o", ms=4, color=c, ls=ls)
axes[0].set_title("Peace-of-Mind Index by barrier"); axes[0].set_ylim(0, 100); V.pct(axes[0], "x"); axes[0].legend(fontsize=7, ncol=2)
axes[1].set_title(f"Certainty-equivalent gain (bp/weekend, CRRA gamma={GAMMA:.0f})"); axes[1].axhline(0, color=V.INK2, lw=1); V.pct(axes[1], "x")
V.save(fig, "40_hermee_pmi_ce_by_barrier.png", "Above zero on the right: a risk-averse holder is better off insured even after the 50% load. Tighter barriers buy more peace but cost more.")
