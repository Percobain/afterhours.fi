# Token behaviour during the closed session (bStocks, Binance spot, hourly)

165 token-weekends across 15 bStocks, 2026-06-12 to 2026-09-18.

- Median |underlying Monday gap| 0.81%; median |token move Fri close -> Mon 13:00 UTC (pre-open)| 0.83%
- Regression of token pre-open move on the actual gap: beta **0.95**, correlation **0.96**. Sunday-night beta 0.02. The token discovers roughly that share of Monday's gap before the bell.
- Token 30 minutes before the open vs the official Monday open: median |deviation| 0.31%, 90th percentile 0.84% - the tracking error a Keeper who hedges on the token, or a Sleeper who sells it Sunday, is exposed to.
- Median weekend token range (high/low) 3.01%; weekend share of the week's quote volume 20.8%; share of weekend hours with any trade 100%.
- Largest underlying gap in the sample: {'symbol': 'CRCLBUSDT', 'friday': datetime.date(2026, 7, 31), 'tok_move_preopen': -0.060393034030995385} = -5.80%.

## Ondo snapshot (public RWA dynamic endpoint, at run time)

| symbol   |   token_price |   shares_mult |   reference_price |   stock_price |   token_premium_vs_stock |   holders | market_status   | reason        |
|:---------|--------------:|--------------:|------------------:|--------------:|-------------------------:|----------:|:----------------|:--------------|
| AAPLon   |       341.354 |        1.0034 |           340.205 |       340.205 |                   0      |     33664 | offhours        | TRADING       |
| AMZNon   |       249.625 |        1      |           249.625 |       249.62  |                   0      |      3040 | offhours        | TRADING       |
| COINon   |       194.99  |        1      |           194.99  |       194.98  |                   0.0001 |      1493 | offhours        | TRADING       |
| CRCLon   |        87.785 |        1      |            87.785 |        87.745 |                   0.0005 |      4682 | offhours        | TRADING       |
| GOOGLon  |       344.25  |        1.0025 |           343.405 |       343.555 |                  -0.0004 |     26210 | offhours        | TRADING       |
| HOODon   |       118.96  |        1      |           118.96  |       118.96  |                   0      |       740 | closed          | MARKET_CLOSED |
| METAon   |       747.858 |        1.0028 |           745.75  |       745.71  |                   0.0001 |      2256 | offhours        | TRADING       |
| MSFTon   |       520.018 |        1.0057 |           517.055 |       517.085 |                  -0.0001 |     19474 | offhours        | TRADING       |
| MSTRon   |       158.725 |        1      |           158.725 |       158.705 |                   0.0001 |      1800 | offhours        | TRADING       |
| NVDAon   |       224.95  |        1.0017 |           224.565 |       224.505 |                   0.0003 |     57517 | offhours        | TRADING       |
| QQQon    |       747.695 |        1.0041 |           744.655 |       744.655 |                   0      |     22977 | offhours        | TRADING       |
| SPYon    |       777.996 |        1.0095 |           770.695 |       770.695 |                   0      |     24344 | offhours        | TRADING       |
| TSLAon   |       372.015 |        1      |           372.015 |       372.005 |                   0      |     29719 | offhours        | TRADING       |