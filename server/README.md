# afterhours.fi server

Node + TypeScript + Express backend for the weekend floor: the v4 pricing engine, the EIP-712 quote signer, the policy indexer, the Keeper/oracle jobs and the HTTP API consumed by `client/`. The contract between the three apps is `../shared/INTERFACE.md`; this server follows it.

## Run

```bash
cd server
cp .env.example .env        # every value may stay empty
npm install
npm run dev                 # tsx watch, http://localhost:4000/api/health
npm run typecheck
npm run build && npm start  # tsc -> dist/, node dist/index.js
npm run seed:prices         # one-shot: push live per-share prices to ReferenceOracle.setLastPrices (needs QUOTER_PRIVATE_KEY)
npm run settle              # one-shot: index, then settleBatch everything settleable (needs QUOTER_PRIVATE_KEY)
```

`copy-abi` runs before dev/typecheck/build: it copies `../shared/abi/*.json` into `src/abi/*.ts` as `as const` arrays, so viem infers types and `dist/` is self-contained.

The server boots with an empty `.env`: no Mongo means an in-memory store (policies/stats are session-scoped, the indexer re-walks the chain on restart), no quoter key means unsigned quotes (`signature: null, signerConfigured: false`) and idle keeper jobs, no admin secret means admin routes answer `403 admin_disabled`.

## Environment

| variable | default | purpose |
|---|---|---|
| `PORT` | `4000` | HTTP port |
| `MONGODB_URI` | empty | MongoDB connection string; empty or unreachable falls back to memory with a warning and background retries |
| `QUOTER_PRIVATE_KEY` | empty | signs quotes and every oracle/market write. Must equal `CoverMarket.quoter()` (the deploy script uses `QUOTER_ADDRESS` or the deployer) and be whitelisted as an oracle keeper |
| `ADMIN_SECRET` | empty | value of the `x-admin-secret` header for `/api/admin/*` |
| `ALCHEMY_API_KEY` | empty | RPC policy is Alchemy first: `https://eth-sepolia.g.alchemy.com/v2/$KEY` and `https://bnb-testnet.g.alchemy.com/v2/$KEY` |
| `SEPOLIA_RPC_URL`, `BSC_TESTNET_RPC_URL` | empty | optional explicit overrides; public RPCs are used only when both the key and the override are empty (logged as a warning) |
| `CLIENT_ORIGIN` | `http://localhost:3000` | CORS allow-list (comma separated; localhost is always allowed) |
| `BINANCE_WEB3_API_KEY`, `BINANCE_WEB3_API_SECRET` | empty | reserved for signed Binance Web3 endpoints; the public status/price endpoints used here need no key |
| `CONTRACT_COVER_MARKET_<chainId>`, `CONTRACT_KEEPER_VAULT_<chainId>`, `CONTRACT_REFERENCE_ORACLE_<chainId>`, `CONTRACT_USDT_<chainId>` | from `deployments/<network>.json` | address overrides when the deployment file is missing |
| `DEPLOY_BLOCK_<chainId>` | file / `latest - INDEXER_LOOKBACK_BLOCKS` | first block the indexer scans |
| `TOKENS_<chainId>` | from file | JSON array `[{symbol,address,ticker,wrapper}]` when there is no deployment file; the on-chain `tokens()` list is merged in either way |
| `JOBS_ENABLED`, `INDEXER_ENABLED` | `true` | switches |
| `INDEXER_INTERVAL_MS`, `INDEXER_CHUNK_BLOCKS`, `INDEXER_LOOKBACK_BLOCKS`, `INDEXER_CONFIRMATIONS` | `30000`, `5000`, `100000`, `2` | indexer tuning |
| `PRICE_REFRESH_CRON` | `*/5 * * * *` | live price refresh |
| `EPOCH_CLOSE_HOUR_UTC` | `20` | Friday bell hour used to compute `epochId` (same rule as `contracts/scripts/deploy.ts`) |
| `CLOSE_WINDOW_MINUTES` | `360` | how long after the bell the close job keeps trying |
| `OPEN_RETRY_MINUTES`, `OPEN_RETRY_WINDOW_MINUTES`, `OPEN_FALLBACK_AFTER_MINUTES` | `2`, `120`, `120` | Monday open retry cadence; after the fallback delay the best available price (spot/last known) is posted |
| `QUOTE_TTL_SECONDS` | `900` | quote expiry |
| `PRICING_LOAD`, `PRICING_FLOOR_FRACTION`, `PRICING_MAX_CHARGED_FRACTION`, `DEFAULT_VOL` | `1.5`, `0.0001`, `0.02`, `0.4` | engine parameters (50% load, 1bp floor, 2% priced-out cap, 40% vol for unknown tickers) |
| `BINANCE_KLINES_ENABLED`, `BINANCE_MAX_RPM` | `true`, `20` | live vol switch and request budget |
| `LOG_LEVEL`, `LOG_PRETTY`, `TRUST_PROXY`, `NODE_ENV` | `info`, pretty in dev, `false`, `development` | misc |

Deployment files land in `server/deployments/<network>.json` (the deploy script copies them). Chains: Ethereum Sepolia `11155111`, BSC Testnet `97`.

## Layout

```
src/
  index.ts            boot: data files, signer, Mongo (optional), HTTP, jobs
  app.ts              express app: helmet, cors, rate limits, bigint-safe JSON, error -> { error, code }
  config.ts           env + chain map + deployments/<network>.json + CONTRACT_* overrides
  chains.ts           viem public/wallet clients per chain, quoter account
  abi.ts, abi/        ABIs copied from ../shared/abi (generated)
  data.ts             pooled_z.json, ticker_vol.json, backtest_summary.json loaders
  pricing/engine.ts   v4 port: fair, load, floor, priced_out, budget mode, menu, estimatedValue
  pricing/vol.ts      live rv20 from Binance klines (10 min cache, ~20 req/min budget, 429/418 back-off) -> ticker_vol.json -> 40%
  pricing/quote.ts    builds + signs the EIP-712 Quote, chain reads (capacity, required balance, last price)
  market/status.ts    Binance RWA market status proxy (60s cache) + computed fallback + epoch clock
  market/prices.ts    underlying price: override -> RWA dynamic (stockInfo/tokenInfo) -> spot -> last known
  market/tokens.ts    token registry (file + chain), epoch registry (file + events + chain)
  indexer/index.ts    getLogs poller (5,000-block chunks, stored cursor), Policy upserts, user stats
  jobs/epoch.ts       postCloseBatch / postOpenBatch / settleBatch / openEpoch / voidEpoch / setLastPrices
  jobs/scheduler.ts   node-cron wiring (price refresh, one-minute keeper tick), indexer interval
  models/             mongoose models: Policy, UserStats, EpochPrice, Cursor, QuoteLog
  store/index.ts      Mongo-or-memory facade used by everything
  receipts.ts         plain-English receipts ("Floor held...", "Floor paid $X...", "Weekend voided (...)")
  routes/             /health /config /market-status /tokens /quote /policies/:address /vault /stats /famous /learn
  admin/routes.ts     x-admin-secret guarded operations
  scripts/            seedPrices.ts, settle.ts
data/                 pooled_z.json, ticker_vol.json, backtest_summary.json
deployments/          <network>.json written by contracts/scripts/deploy.ts
```

## Units

`notionalUsd`, `premiumUsd`, payouts: USDT units (6 decimals) as decimal strings. Prices: USD per share, 8 decimals, as strings. `barrierBps` 100..2000; menu `100, 200, 300, 500, 700, 1000`. `epochId` = unix seconds of the Friday bell (20:00 UTC by default, matching the deploy script); `expectedOpen = epochId + 65.5h`. All bigints are serialised as strings.

## Endpoints (base `/api`)

| method + path | returns |
|---|---|
| `GET /health` | store mode, signer, chains, indexer cursors, job clock, Binance budget |
| `GET /config` | networks (contracts, tokens, epochs, redacted RPC), quoter address, product constants, EIP-712 domain, disclosure |
| `GET /market-status` | Binance RWA status (`openState, marketStatus, reasonCode, nextOpenTime, nextCloseTime`, raw body) + `currentEpochId, bindDeadline, expectedOpen, secondsToBell, secondsToOpen, source` (`binance` or `fallback`) |
| `GET /tokens?chainId=` | `symbol, address, ticker, wrapper, lastPrice (8d, oracle else live), livePrice, rv20 (+source), breachProb5, worstWeekend, menu` |
| `GET /quote?chainId=&buyer=&token=&notionalUsd=&barrierBps=` or `&budgetBps=` | `{ quote, signature, signerConfigured, estimatedValue, floorPricePerShare, requiredTokenBalance, capacityNotional, pricing: { menu, rv20, volSource, tokenUnknown, budgetShort }, epoch, notes }`; `422 priced_out` when charged > 2% |
| `GET /policies/:address?chainId=` | indexed policies with `status, gapBps, payoutUsd, receipt, statusText` and `stats { weekendsProtected, currentStreak, longestStreak, premiumsPaid, payoutsReceived, floorsHeld, floorsPaid }`; falls back to `policiesOf` on-chain when the store is empty |
| `GET /vault?chainId=` | totalAssets, locked, floor, cushion, utilisation, capacityNotional, lifetime premiums/payouts/refunds, share price, `impliedApyBand` from the backtest |
| `GET /stats` | `data/backtest_summary.json` |
| `GET /famous?kind=&ticker=` | famous weekends with a headline sentence |
| `GET /learn` | 3 steps, Hermee (H1 NVDA) and Kip example numbers, 6 FAQ items, product vocabulary |

Errors are always `{ error, code }` (`bad_request`, `unsupported_chain`, `notional_out_of_range`, `priced_out`, `not_found`, `rate_limited`, `admin_disabled`, `unauthorized`, `signer_not_configured`, `not_deployed`, `rpc_unavailable`, `internal`).

### Admin (`x-admin-secret: $ADMIN_SECRET`)

| method + path | body | action |
|---|---|---|
| `GET /admin/status` | | store, indexer, jobs, overrides, last known prices, recent quotes |
| `POST /admin/prices` | `{ chainId, prices?: { NVDAB: 224.5 }, overrides?: { NVDA: 224.5 } }` | `setLastPrices` from live sources (or body) |
| `GET/POST /admin/overrides` | `{ ticker, price \| null }` | demo override map for live prices |
| `POST /admin/close/:epochId` | `{ chainId, prices? }` | `postCloseBatch` for tokens without a close |
| `POST /admin/open/:epochId` | `{ chainId, prices?, allowFallback? }` | `postOpenBatch` with the underlying print (or fallback) |
| `POST /admin/void` | `{ chainId, token, epochId, reason }` | `voidEpoch` |
| `POST /admin/settle` | `{ chainId, epochId? }` | `settleBatch` of every open policy whose epoch is settleable, chunks of 50 |
| `POST /admin/epochs` | `{ chainId }` | `openEpoch` for the next two Fridays (owner-only) |
| `POST /admin/reindex` | `{ chainId, fromBlock? }` | wipe + rescan |
| `POST /admin/index` | `{ chainId }` | one indexer pass |
| `POST /admin/refresh-prices` | | refresh live prices now |

```bash
S=http://localhost:4000/api; H='x-admin-secret: change-me'
curl -s -H "$H" $S/admin/status
curl -s -H "$H" -H 'content-type: application/json' -d '{"chainId":11155111}' $S/admin/prices
curl -s -H "$H" -H 'content-type: application/json' -d '{"chainId":11155111}' $S/admin/close/1790971200
curl -s -H "$H" -H 'content-type: application/json' -d '{"chainId":11155111,"allowFallback":true}' $S/admin/open/1790971200
curl -s -H "$H" -H 'content-type: application/json' -d '{"chainId":11155111}' $S/admin/settle
curl -s -H "$H" -H 'content-type: application/json' -d '{"chainId":11155111}' $S/admin/epochs
curl -s -H "$H" -H 'content-type: application/json' -d '{"chainId":11155111,"token":"0x...","epochId":1790971200,"reason":"stock_split"}' $S/admin/void
curl -s -H "$H" -H 'content-type: application/json' -d '{"chainId":11155111,"fromBlock":0}' $S/admin/reindex
```

More samples in `requests.http`.

## Pricing

Port of `backtest/versions/v4_pooled_volscaled.py`. `sd = rv20 / sqrt(252)`; `fair = mean_z max(-b - sd*z, 0)` over the 4,001 pooled quantiles in `data/pooled_z.json`; `charged = max(1.5 * fair, 1bp)`; `priced_out` (HTTP 422) when `charged > 2%`. Budget mode picks the tightest menu barrier with `chargedBp <= budgetBps`, else the 10% quote with `budgetShort: true`. The premium in USDT units is rounded up. `estimatedValue = { fairBp, loadBp, chargedBp, floorBp: 1, expectedPayoutBp: fairBp, breachProbability, sentence }` where the sentence is the product line ("Fair price 4.2bp + our margin 2.1bp = 6.3bp. The engine expects to pay back about 4.2bp of this over many weekends.").

Vol order: live 20-day realised vol from `api.binance.com/api/v3/klines?symbol={SYMBOL}USDT&interval=1d&limit=40` (bStock symbol, or `{TICKER}BUSDT` for Ondo tokens of the same underlying; the forming candle is dropped; cached 10 min; `x-mbx-used-weight-1m` is read, at most ~20 requests/min, back-off on 429/418, unknown symbols negatively cached), else `data/ticker_vol.json`, else 40% with `tokenUnknown: true` when the token is not in the allow-list.

## How quotes are signed

`GET /quote` resolves the token (deployment file + on-chain `tokens()`), the vol, the current epoch (computed next Friday bell, verified with `epochs(id)` on-chain when possible) and prices the barrier. It then builds

```
domain  { name: "afterhours.fi CoverMarket", version: "1", chainId, verifyingContract: CoverMarket }
Quote   (address buyer, address token, uint64 epochId, uint256 notionalUsd, uint16 barrierBps, uint256 premiumUsd, uint64 expiry, uint256 nonce)
```

with `nonce` a random 256-bit integer, `expiry = min(now + 15 min, bindDeadline)`, and signs it with `privateKeyToAccount(QUOTER_PRIVATE_KEY).signTypedData`. The client calls `USDT.approve(CoverMarket, premiumUsd)` then `CoverMarket.buyCover(quote, signature)`; the contract recovers the signer and requires it to equal `quoter()`. Without a key the same payload is returned with `signature: null` and `signerConfigured: false`. Every quote is logged (`QuoteLog`).

## How settlement works

1. **Friday, at the bell** (`epochId`): the one-minute keeper tick sees tokens without a close for the epoch and calls `ReferenceOracle.postCloseBatch(tokens, epochId, prices)` with the current per-share price (RWA `stockInfo.price`, else `tokenInfo.price / sharesMultiplier`, else the bStock spot price divided by its multiplier, else last known). Non-owners cannot re-post, so already-posted tokens are skipped.
2. **Monday, from `expectedOpen`**: every 2 minutes for 2 hours the tick asks the RWA dynamic endpoint for a non-null `stockInfo.price` (the official opening print) and posts `postOpenBatch` for the tokens that have one. After `OPEN_FALLBACK_AFTER_MINUTES` it falls back to the best available price so the demo settles even if the endpoint stays dark.
3. **Settle**: once `isSettleable(token, epochId)` is true (both prints or voided), open policy ids for the epoch (from the store, else a chain scan) are sent to `CoverMarket.settleBatch` in chunks of 50. The contract computes `gapBps`, pays `min(max(-barrier - gap, 0), cap) x notional` from locked collateral and releases the rest; voided epochs refund the premium.
4. The indexer picks up `CoverSettled` / `CoverRefunded`, updates the policy and the buyer's stats, and `/policies/:address` shows the receipt: "Floor held. NVDAB opened +1.2% on Monday; your 3% floor was not needed. Premium $6.10." / "Floor paid $412. NVDAB opened -7.1%; you were made whole below -3%." / "Weekend voided (stock_split). Premium $6.10 returned."
5. **Mondays** the tick also opens the next two epochs. `openEpoch` is owner-only; when the quoter is not the owner the server logs `cd contracts && npm run epoch:<network>` instead of failing.

All writes are simulated first (`simulateContract`) and waited for one confirmation. Everything above is also reachable through the admin routes and the `settle` script.

## Indexer and stats

Every 30s per deployed chain: `getLogs` for `CoverBought, CoverSettled, CoverRefunded, EpochOpened` from the stored cursor (`Cursor` doc; first run from `DEPLOY_BLOCK_<chainId>`, else the last 100,000 blocks) to `latest - 2`, in 5,000-block chunks. Policies are upserted by `(chainId, policyId)`; events for unknown policies are backfilled with `getPolicy`. Per-buyer stats: `weekendsProtected` = distinct non-refunded epochIds, streaks over consecutive weekly epochIds (`currentStreak` is alive only if the latest protected weekend is this or last week's), `premiumsPaid`, `payoutsReceived`, `floorsHeld` = settled with payout 0, `floorsPaid` = settled with payout > 0.

## Disclosure

Hackathon build on testnets. The deployer can pause, change parameters, void or force-settle policies and rescue funds. Not available in restricted jurisdictions.
