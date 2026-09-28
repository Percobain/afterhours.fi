"""30 - Famous weekends: the crashes, the rallies, and the scares that fizzled.
For each event and ticker: the actual Fri-close -> Mon-open gap, the v4 premium Hermee would have paid that Friday
for 5% cover on $100k, the payout, her net, and Kip's (the Keeper's) net.
Outputs: results/30_famous_weekends.csv, results/30_famous_weekends.md, charts/30_*.png"""
import os, sys, json
import numpy as np, pandas as pd
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); sys.path.insert(0, ROOT)
from scripts.lib import sessions as S, viz as V, pricing as PR
from versions import v4_pooled_volscaled as V4
import matplotlib.pyplot as plt
RES = os.path.join(ROOT, "results"); CFG = json.load(open(os.path.join(ROOT, "config.json")))
NOTIONAL = 100_000; B = 0.05; LOAD = CFG["risk_load"]; FLOOR = CFG["premium_floor"]

EVENTS = [
 # friday, label, tickers, kind, story
 ("1987-10-16", "Black Monday 1987", ["^GSPC"], "crash", "Dow -22.6% on the Monday. Index open data pre-1982 is unreliable, so this row uses close-to-close and is an anchor, not a backtest point."),
 ("2001-09-07", "9/11 - market shut a week", ["SPY", "QQQ", "BA", "DIS"], "crash", "Exchanges closed 11-14 Sep. Holders were locked in for 10 days. SPY reopened -4.9%."),
 ("2008-09-12", "Lehman weekend", ["SPY", "BAC", "C", "AIG", "XLF"], "crash", "Lehman filed Sunday night, Merrill sold to BofA, AIG on the brink. The archetypal weekend where the world changed while the market was shut."),
 ("2008-10-10", "G7 bank rescue rally", ["SPY", "C", "BAC", "XLF"], "rally", "After the worst week since 1933, governments guaranteed bank debt over the weekend. Monday 13 Oct was the biggest S&P point gain ever."),
 ("2010-05-07", "EU EUR750bn bailout", ["SPY", "EEM", "C"], "rally", "Flash crash Thursday, then the EU/IMF package agreed Sunday night. Monday gapped up hard."),
 ("2011-08-05", "S&P downgrades the USA", ["SPY", "BAC", "C", "QQQ"], "crash", "S&P cut the US to AA+ after Friday close. Monday: S&P 500 -6.7%, BAC -20%."),
 ("2013-04-12", "Gold crash weekend", ["GLD"], "crash", "Gold fell 9% on Monday 15 April 2013, its worst day in 30 years. The gold weekend gap that GLD holders never saw coming."),
 ("2015-08-21", "China Black Monday", ["AAPL", "SPY", "QQQ", "NFLX", "TSLA"], "crash", "Shanghai -8.5% overnight, Dow futures limit-down, AAPL opened -10%. The single breach that drove backtest v1."),
 ("2016-06-24", "Brexit Monday", ["SPY", "BAC", "C"], "crash", "Vote result hit on Friday; Monday continued the slide. Banks gapped down again."),
 ("2018-02-02", "Volmageddon", ["SPY", "QQQ"], "basis", "SPY opened only -0.5% but closed -4.1%; XIV died after the close. Cover settled at the OPEN would not have paid - the settlement-basis lesson."),
 ("2018-12-21", "Christmas Eve 2018", ["SPY", "AAPL", "QQQ"], "crash", "Mnuchin called the bank CEOs on Sunday; Monday 24 Dec was the worst Christmas Eve ever."),
 ("2018-12-24", "Boxing Day rebound", ["SPY", "AAPL"], "rally", "Holiday closed session. Dow +1,086 points on 26 Dec, the largest point gain in history at the time."),
 ("2019-08-02", "Yuan breaks 7", ["SPY", "AAPL", "QQQ"], "crash", "China let the yuan through 7 on the Monday morning; S&P -3%."),
 ("2020-02-21", "COVID reaches Italy", ["SPY", "AAPL", "QQQ"], "crash", "Lombardy locked down over the weekend. First COVID gap-down."),
 ("2020-03-06", "Oil war + COVID", ["SPY", "XOM", "AAL", "QQQ"], "crash", "Saudi-Russia price war launched Sunday; oil -30%. Circuit breaker at the open."),
 ("2020-03-13", "Fed emergency cut Sunday", ["SPY", "QQQ", "AAPL", "BA", "AAL", "TQQQ"], "crash", "Fed cut to zero on Sunday evening; futures limit-down instantly. Worst weekend gap in the dataset for most tickers."),
 ("2020-04-03", "Curve-flattening rally", ["SPY", "QQQ", "AAPL"], "rally", "Weekend headlines on slowing case growth. Monday +7% for the S&P."),
 ("2020-11-06", "Pfizer vaccine Monday", ["SPY", "BA", "AAL", "ZM", "AMZN", "NFLX"], "mixed", "Vaccine efficacy announced Monday pre-open. Airlines +, stay-at-home names crushed: ZM -17%."),
 ("2021-01-22", "GameStop weekend", ["GME", "AMC"], "rally", "r/wallstreetbets. GME opened +49% Monday. The weekend gap that went right - for longs."),
 ("2022-06-10", "CPI + Celsius freeze", ["COIN", "MSTR", "SPY", "QQQ"], "crash", "Hot CPI Friday, Celsius halted withdrawals Sunday night, BTC -15% over the weekend. COIN opened -14%."),
 ("2022-08-19", "AMC / APE distribution", ["AMC"], "corporate", "AMC issued APE preferred units to holders on Monday. The share price 'gapped' -37% but holders received APE. Corporate-action basis risk."),
 ("2023-03-10", "SVB weekend", ["KRE", "SCHW", "WAL", "BAC", "C"], "crash", "SVB seized Friday, Signature Sunday, BTFP announced Sunday night. Regional banks gapped -10 to -60% on Monday. (SIVB/FRC delisted; proxies shown.)"),
 ("2024-05-10", "Roaring Kitty returns", ["GME", "AMC"], "rally", "One tweet on Sunday night. GME +51% at the open."),
 ("2024-08-02", "Yen carry unwind", ["NVDA", "SPY", "QQQ", "COIN", "HOOD", "SMCI"], "crash", "Nikkei -12% Monday morning; VIX 65 pre-market. NVDA opened -8%, COIN -10%."),
 ("2025-01-24", "DeepSeek Monday", ["NVDA", "AVGO", "SMCI", "MU", "QQQ"], "crash", "DeepSeek R1 went viral over the weekend. NVDA opened -12.5%, closed -17%: the largest single-day market-cap loss in history."),
 ("2025-04-04", "Tariff Monday", ["SPY", "AAPL", "NVDA", "QQQ"], "crash", "Liberation Day tariffs Thu/Fri, China retaliated, Monday futures limit-down overnight then a wild reversal."),
 ("2025-04-11", "Smartphone tariff exemption", ["AAPL", "NVDA", "QQQ"], "rally", "Exemption for phones and chips announced Friday night. AAPL gapped up on Monday."),
 ("2025-10-03", "AMD-OpenAI deal", ["AMD"], "rally", "6GW deal announced Monday pre-open. AMD opened +37%."),
 ("2025-10-10", "Crypto liquidation weekend", ["COIN", "MSTR", "HOOD", "SPY"], "crash", "Tariff tweet Friday afternoon, USD19bn liquidated, tokenized stocks on-chain traded at deep discounts all weekend while the NYSE was shut."),
]

# v4 premium fitted strictly on data before the event Friday (pooled z, all tickers)
U = json.load(open(os.path.join(ROOT, "data", "universe.json")))
raw = PR.raw_panel(U["backtest_universe"])
def v4_premium(ticker, friday, rv20):
    prior = raw[raw.friday < friday]
    m = V4.fit(prior.z.values)
    p = V4.price(B, m, {"rv20": rv20})
    return p, max(p * (1 + LOAD), FLOOR)

rows = []
for fri, label, tickers, kind, story in EVENTS:
    fri = pd.Timestamp(fri)
    for t in tickers:
        try: s = S.sessions(t)
        except FileNotFoundError: continue
        if fri not in s.index: continue
        r = s.loc[fri]
        gap = r.gap_open; gapc = r.gap_close
        if t == "^GSPC" and fri.year < 1990: gap = gapc         # index open unreliable pre-1982
        fair, q = v4_premium(t, fri, r.rv20) if np.isfinite(r.rv20) else (np.nan, np.nan)
        pay = max(-B - gap, 0)
        rows.append({"friday": fri.date(), "monday": r.next_date.date(), "event": label, "kind": kind, "ticker": t, "nights": int(r.nights),
                     "gap_open": gap, "gap_close": gapc, "rv20": r.rv20, "premium_fair_bp": fair*1e4, "premium_charged_bp": q*1e4,
                     "hermee_unprotected_pnl": NOTIONAL*gap, "hermee_premium_paid": -NOTIONAL*q, "hermee_payout": NOTIONAL*pay,
                     "hermee_protected_pnl": NOTIONAL*(gap - q + pay), "hermee_loss_avoided": NOTIONAL*(pay - q),
                     "kip_net_per_100k": NOTIONAL*(q - pay), "breach": gap < -B, "story": story})
F = pd.DataFrame(rows); F.to_csv(os.path.join(RES, "30_famous_weekends.csv"), index=False)
pd.set_option("display.width", 250)
print(F[["friday","event","ticker","gap_open","gap_close","premium_charged_bp","hermee_unprotected_pnl","hermee_protected_pnl","kip_net_per_100k"]].round(3).to_string())

# ---- markdown cards
md = ["# Famous weekends - Hermee vs Kip, $100k per ticker, 5% barrier, v4 pricing (fitted on data before each event)\n",
      "Hermee = the Sleeper (holds the stock, buys weekend cover). Kip = the Keeper (LP in the pool, sells the cover).",
      "All premiums are what v4 would have quoted on that Friday, using only history before it. Gaps are Friday close to Monday open, split/dividend adjusted.\n"]
for (fri, label, kind, story), g in F.groupby(["friday", "event", "kind", "story"], sort=True):
    md.append(f"## {fri} -> {g.monday.iloc[0]}  {label}  [{kind}]\n\n{story}\n")
    md.append("| ticker | gap (open) | gap (close) | premium | Hermee unprotected | Hermee protected | loss avoided | Kip net |")
    md.append("|---|---|---|---|---|---|---|---|")
    for r in g.itertuples():
        md.append(f"| {r.ticker} | {r.gap_open:+.1%} | {r.gap_close:+.1%} | {r.premium_charged_bp:.1f}bp | ${r.hermee_unprotected_pnl:,.0f} | ${r.hermee_protected_pnl:,.0f} | ${r.hermee_loss_avoided:,.0f} | ${r.kip_net_per_100k:,.0f} |")
    md.append("")
open(os.path.join(RES, "30_famous_weekends.md"), "w", encoding="utf-8").write("\n".join(md))

# ---- chart: every event-ticker gap as a dot, barrier lines, coloured by kind
fig, ax = plt.subplots(figsize=(11, 10))
d = F.sort_values(["friday", "ticker"]).reset_index(drop=True)
labels = [f"{r.friday}  {r.event}  {r.ticker}" for r in d.itertuples()]
kc = {"crash": V.CAT[7], "rally": V.CAT[2], "mixed": V.CAT[3], "basis": V.CAT[6], "corporate": V.CAT[1]}
ax.hlines(range(len(d)), 0, d.gap_open, color=V.GRID, lw=1)
ax.scatter(d.gap_open, range(len(d)), c=[kc[k] for k in d.kind], s=34, zorder=3)
ax.scatter(d.gap_close, range(len(d)), facecolors="none", edgecolors=V.INK2, s=30, zorder=2, lw=0.8)
ax.axvline(-0.05, color=V.STATUS["critical"], lw=1.2, ls="--"); ax.text(-0.052, len(d)-0.5, "5% barrier", color=V.STATUS["critical"], ha="right", fontsize=8)
ax.axvline(0, color=V.INK2, lw=0.8)
ax.set_yticks(range(len(d))); ax.set_yticklabels(labels, fontsize=7); ax.invert_yaxis(); V.pct(ax, "x")
for k, c in kc.items(): ax.scatter([], [], c=c, label=k)
ax.scatter([], [], facecolors="none", edgecolors=V.INK2, label="Mon close (hollow)"); ax.legend(loc="lower right", fontsize=8)
ax.set_title("Famous weekends: Friday close -> Monday open gap per ticker")
V.save(fig, "30_famous_weekends_gaps.png", "Filled dot = gap to Monday open (the product settles here). Hollow = gap to Monday close. Left of the dashed line the Sleeper is paid.")

# ---- chart: Hermee protected vs unprotected on breach events (paired bars)
br = F[F.breach].sort_values("hermee_unprotected_pnl")
fig, ax = plt.subplots(figsize=(10, 7))
y = np.arange(len(br))
ax.barh(y - 0.2, br.hermee_unprotected_pnl, 0.4, color=V.CAT[7], label="unprotected")
ax.barh(y + 0.2, br.hermee_protected_pnl, 0.4, color=V.HERMEE, label="protected at 5%")
ax.set_yticks(y); ax.set_yticklabels([f"{r.event} - {r.ticker}" for r in br.itertuples()], fontsize=7.5); V.money(ax, "x"); ax.legend()
ax.set_title("Hermee's Monday-morning P&L on $100k, every breach weekend in the case list")
V.save(fig, "30_hermee_breach_events.png", "Protected = gap + payout - premium. The floor is -5% (minus premium) by construction.")
