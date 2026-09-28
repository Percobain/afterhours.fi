# Kip's card - the Keeper

Kip deposits **$1,000,000** (10% of a $10,000,000 diversified book) on 2015-01-02 and underwrites 5% weekend cover on every universe ticker, priced by v4 with a 50% load. Idle USDT earns 4%.

- Ending equity 2026-09-18: **$3,066,005** (total return on capital +206.6%, +10.0% a year)
- Premium income per year ~$382,637; payouts per year ~$247,094; loss ratio 0.65
- Weekends underwritten 612; weekends he lost money 49 (8%); weekends costing >10% of capital 4
- Max drawdown from peak equity -63.0%; worst weekend 2020-03-13 cost $617,203 = 62% of capital

## The eight weekends that hurt most

| Friday | book payout ($) | premium collected ($) | net ($) | % of capital | worst ticker | its payout |
|---|---|---|---|---|---|---|
| 2020-03-13 | 649,566 | 32,363 | -617,203 | -62% | TQQQ | 23.8% |
| 2020-03-06 | 313,027 | 10,503 | -302,524 | -30% | TQQQ | 14.9% |
| 2024-08-02 | 300,663 | 9,960 | -290,702 | -29% | MSTR | 22.4% |
| 2015-08-21 | 197,120 | 2,707 | -194,413 | -19% | TQQQ | 13.4% |
| 2022-06-10 | 100,253 | 17,591 | -82,662 | -8% | MSTR | 21.6% |
| 2025-01-24 | 80,441 | 6,525 | -73,916 | -7% | AVGO | 7.8% |
| 2025-04-04 | 84,823 | 16,288 | -68,535 | -7% | MSTR | 6.4% |
| 2023-08-11 | 66,025 | 6,465 | -59,560 | -6% | AMC | 31.7% |

## Every book, v4, 2005-2026

| book                         |   roc_annualised |   sharpe_weekly_ann |   max_drawdown_pct_of_peak |   worst_weekend_pct_capital |   loss_ratio | ruined_in_sample   |
|:-----------------------------|-----------------:|--------------------:|---------------------------:|----------------------------:|-------------:|:-------------------|
| diversified (all 50)         |            0.073 |               0.902 |                     -0.316 |                      -0.617 |        0.566 | False              |
| ETFs only                    |            0.065 |               0.955 |                     -0.263 |                      -0.393 |        0.615 | False              |
| single names only            |            0.074 |               0.849 |                     -0.331 |                      -0.685 |        0.554 | False              |
| crypto/meme beta             |            0.101 |               0.935 |                     -0.351 |                      -0.798 |        0.563 | False              |
| NVDA only                    |            0.04  |               0.152 |                     -0.534 |                      -0.969 |        0.923 | False              |
| bStocks on Binance spot (15) |            0.058 |               0.445 |                     -0.394 |                      -0.636 |        0.737 | False              |

## One-year ruin probability by capital ratio (block bootstrap, v4)

|   capital_ratio |   ETFs only |   NVDA only |   bStocks on Binance spot (15) |   crypto/meme beta |   diversified (all 50) |   single names only |
|----------------:|------------:|------------:|-------------------------------:|-------------------:|-----------------------:|--------------------:|
|            0.02 |      0.0666 |      0.2426 |                         0.1511 |             0.161  |                 0.0832 |              0.0925 |
|            0.05 |      0.0309 |      0.1752 |                         0.077  |             0.0773 |                 0.0432 |              0.0431 |
|            0.1  |      0.0006 |      0.0464 |                         0.0136 |             0.0236 |                 0.0036 |              0.0087 |
|            0.15 |      0      |      0.0122 |                         0.0016 |             0.0026 |                 0.0007 |              0.0008 |
|            0.2  |      0      |      0.0026 |                         0.0002 |             0.0004 |                 0      |              0      |
|            0.3  |      0      |      0.0001 |                         0      |             0      |                 0      |              0      |