#!/usr/bin/env bash
# afterhours.fi backtest v2 - full pipeline (bash). Usage: ./run_all.sh [--refresh]
set -euo pipefail
cd "$(dirname "$0")"
python -m pip install --quiet pandas numpy scipy matplotlib requests python-dotenv yfinance pyarrow tabulate
if [[ "${1:-}" == "--refresh" ]]; then rm -f data/equities/*.csv; fi
for s in 00_fetch_equities 01_fetch_binance_bstocks 02_fetch_ondo_onchain 10_universe_stats 20_build_panel 21_pricing_eval 30_famous_weekends 40_hermee 50_keeper 60_token_weekend 70_structures 90_report; do
  echo "=== $s ==="; python "scripts/$s.py"
done
echo "done. open report/index.html"
