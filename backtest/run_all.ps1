# afterhours.fi backtest v2 - full pipeline (Windows PowerShell 5.1)
# Usage:  .\run_all.ps1            (uses cached data if < 6h old)
#         .\run_all.ps1 -Refresh   (re-pull equities, bStock klines, Ondo snapshot)
param([switch]$Refresh)
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
python -m pip install --quiet pandas numpy scipy matplotlib requests python-dotenv yfinance pyarrow tabulate
if ($Refresh) { Remove-Item -Force -ErrorAction SilentlyContinue data\equities\*.csv }
$steps = @(
  "scripts\00_fetch_equities.py",
  "scripts\01_fetch_binance_bstocks.py",
  "scripts\02_fetch_ondo_onchain.py",
  "scripts\10_universe_stats.py",
  "scripts\20_build_panel.py",
  "scripts\21_pricing_eval.py",
  "scripts\30_famous_weekends.py",
  "scripts\40_hermee.py",
  "scripts\50_keeper.py",
  "scripts\60_token_weekend.py",
  "scripts\90_report.py"
)
foreach ($s in $steps) {
  Write-Host "=== $s ===" -ForegroundColor Cyan
  python $s
  if ($LASTEXITCODE -ne 0) { throw "step failed: $s" }
}
Write-Host "done. open report\index.html" -ForegroundColor Green
