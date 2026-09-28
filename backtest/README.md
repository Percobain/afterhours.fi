# afterhours.fi backtest v2

Weekend (closed-session) tail insurance on tokenized US equities: does it pay, for whom, and what kills the pool.

- **Start here**: `CONCLUSIONS.md` (findings), `RISK_MEMO.md` (diligence memo), `VERSIONS.md` (the four pricing formulas and why v4 wins), `MARKET_RESEARCH.md` (is it needed, alternatives, competitors), `PRODUCT_STRATEGY.md` (optimal structure for both sides and the hackathon plan), `LITERATURE.md` (academic papers), `results/70_structures.md` (principal-protection simulations), `research/` (the five source reports), `report/index.html` (every chart and table in one page).
- **Characters**: Hermee is the Sleeper (holds the stock, buys cover every Friday). Kip is the Keeper (LP in the USDT pool that sells it).

## Run
```powershell
cd backtest
.\run_all.ps1            # cached data (~4 min)
.\run_all.ps1 -Refresh   # re-pull equities and Binance klines
```
or `./run_all.sh`. Python 3.12; deps are installed by the runner. Binance keys in the repo `.env` are **not needed**: every endpoint used is public. Fetchers read `X-MBX-USED-WEIGHT-1M`, sleep above 40% of the 6000/min budget and back off on 429/418; a full pull uses < 100 weight.

## Layout
| path | what |
|---|---|
| `config.json` | barriers, 50% load, 1bp floor, capital ratio, bootstrap paths, settlement basis |
| `data/universe.json` | tickers by wrapper (from the Binance RWA token list intersected with available history) |
| `data/equities/*.csv` | daily OHLC, adjusted (yfinance) |
| `data/bstocks/*_1h.csv` | bStock hourly spot klines (Binance) |
| `data/binance_rwa_token_list_raw.json` | 1,925 tokenized-stock tokens across chains from the public RWA endpoint |
| `versions/v1..v4_*.py` | pricing engines (see `VERSIONS.md`) |
| `scripts/lib/sessions.py` | closed-session decomposition (weekend / long weekend / holiday / overnight), payout function, data hygiene |
| `scripts/lib/pricing.py` | walk-forward premium panel builder (annual refit, strictly prior data) |
| `scripts/00-02_*` | data pulls |
| `scripts/10_universe_stats.py` | tail statistics, variance ratios, Black-Scholes comparison, tail-shape homogeneity |
| `scripts/20_build_panel.py`, `21_pricing_eval.py` | panel and out-of-sample scorecard, calibration, vol-regime and by-year loss ratios |
| `scripts/30_famous_weekends.py` | 29 events x tickers: gaps, premiums, Hermee and Kip P&L; cards in `results/30_famous_weekends.md` |
| `scripts/40_hermee.py` | 12 holding scenarios; CVaR, CRRA certainty equivalent, Peace-of-Mind Index; cards in `results/40_hermee_cards.md` |
| `scripts/50_keeper.py` | pool equity curves by book and by engine, block-bootstrap ruin, capital-for-1%-ruin; card in `results/50_keeper_card.md` |
| `scripts/60_token_weekend.py` | bStock behaviour across the closed session; Ondo snapshot |
| `scripts/70_structures.py` | principal-protection structures: puts, spreads, T-bill sleeves, fixed budgets for the holder; T-bill collateral, payout caps, tranches, CPPI for the pool |
| `data/tbill_3m.csv` | 13-week T-bill yield 1990-2026 (yield leg) |
| `scripts/90_report.py` | builds `report/index.html` |

## Conventions
- gap = Monday open / Friday close - 1 on the adjusted series. Product pays `max(-barrier - gap, 0)` per $1 covered.
- All premiums are per weekend per $1 of covered notional. "Charged" = fair x 1.5, floored at 1bp.
- Walk-forward: quotes for year Y use only data before 1 Jan Y. No premium in any table was fitted on the payout it is scored against.
- Gaps below -75% are treated as vendor corporate-action errors and dropped (one case: SOXS 2026-05-22).
