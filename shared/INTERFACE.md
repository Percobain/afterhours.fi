# afterhours.fi shared interface (contracts <-> server <-> client)

Monorepo layout: `contracts/` (Hardhat, Solidity 0.8.24, OpenZeppelin 5), `server/` (Node + TypeScript + Express + Mongo), `client/` (Next.js + wagmi + viem + RainbowKit), `shared/abi/*.json` (exported ABIs), `backtest/` (research; do not modify).

## Networks
- Ethereum Sepolia, chainId 11155111. BSC Testnet, chainId 97. Both deployed from the same scripts.
- Deployment files: `contracts/deployments/<network>.json` (network = `sepolia` | `bscTestnet`), copied by the deploy script to `client/src/deployments/<network>.json` and `server/deployments/<network>.json`. Shape:
```json
{ "network": "sepolia", "chainId": 11155111, "deployer": "0x..", "quoter": "0x..",
  "contracts": { "USDT": "0x..", "ReferenceOracle": "0x..", "KeeperVault": "0x..", "CoverMarket": "0x.." },
  "stocks": { "NVDAB": { "address": "0x..", "ticker": "NVDA", "name": "NVIDIA bStock (test)", "decimals": 18, "wrapper": "bstock" }, "SPYon": { "...": "wrapper": "ondo" } },
  "epochs": [ { "epochId": 1759521600, "expectedOpen": 1759757400 }, { "...": "..." } ] }
```
  Until a deployment exists the files may be missing: server and client must start anyway (env-var overrides `CONTRACT_*` / `NEXT_PUBLIC_*` and a friendly "not deployed on this network yet" state).
- Test tokens: `USDT` is MockERC20 with 6 decimals, `faucet()` mints 10,000. Stock tokens are MockERC20 with 18 decimals, `faucet()` mints 100.

## Units and conventions
- `notionalUsd`, `premiumUsd`, payouts: USDT units, 6 decimals.
- Prices in the oracle: USD per share, 8 decimals, already divided by the issuer sharesMultiplier.
- `barrierBps`: floor depth, e.g. 300 = "made whole below -3%". Allowed 100..2000. Product barrier menu: 100, 200, 300, 500, 700, 1000.
- `payoutCapBps` = 2000: a policy pays at most 20% of notional (put spread 3-23% for a 3% barrier). Locked collateral per policy = notional x 20%.
- `epochId` = unix timestamp of the Friday close the weekend starts at (Friday 20:00 UTC while New York is on daylight time; 21:00 UTC in winter). `expectedOpen` = epochId + 65.5h. Purchases revert after `epochs[epochId].bindDeadline` (= epochId).
- gap = openPrice / closePrice - 1 (per share). payout per $1 = min(max(-barrier - gap, 0), cap).

## Contract functions the apps use (ABIs in `shared/abi`)
CoverMarket
- `buyCover((address buyer,address token,uint64 epochId,uint256 notionalUsd,uint16 barrierBps,uint256 premiumUsd,uint64 expiry,uint256 nonce) q, bytes signature) returns (uint256 policyId)` (buyer must first `approve` USDT to CoverMarket for premiumUsd)
- `settle(uint256 policyId)`, `settleBatch(uint256[] ids)` (anyone)
- views: `policyCount()`, `getPolicy(uint256) -> Policy{buyer,token,epochId,notionalUsd,barrierBps,premiumUsd,lockedUsd,payoutUsd,gapBps(int256),status(0 None,1 Open,2 Settled,3 Refunded),boughtAt,settledAt}`, `policiesOf(address) -> uint256[]`, `tokens() -> address[]`, `tokenAllowed(address)`, `epochs(uint64) -> (bindDeadline, expectedOpen, exists)`, `capacityNotional()`, `lockFor(uint256)`, `requiredTokenBalance(address token,uint256 notionalUsd)`, `payoutCapBps()`, `minBarrierBps()`, `maxBarrierBps()`, `minNotionalUsd()`, `maxNotionalUsd()`, `requireHolding()`, `quoter()`, `hashQuote(q)`, `paused()`
- admin (owner only): `openEpoch(uint64 epochId,uint64 bindDeadline,uint64 expectedOpen)`, `setTokenAllowed(address,bool)`, `setQuoter(address)`, `setParams(...)`, `setFee(uint16,address)`, `forceSettle(uint256,int256,uint256)`, `forceRefund(uint256,string)`, `pause()`, `unpause()`, `rescue(address token,address to,uint256)`
- events: `CoverBought(uint256 indexed policyId,address indexed buyer,address indexed token,uint64 epochId,uint256 notionalUsd,uint16 barrierBps,uint256 premiumUsd,uint256 lockedUsd)`, `CoverSettled(uint256 indexed policyId,address indexed buyer,int256 gapBps,uint256 payoutUsd)`, `CoverRefunded(uint256 indexed policyId,address indexed buyer,uint256 premiumUsd,string reason)`, `EpochOpened(uint64 indexed epochId,uint64 bindDeadline,uint64 expectedOpen)`

KeeperVault (ERC-4626 over USDT, share token `kUSDT`, 9 decimals = 6 + 3 offset)
- `deposit(uint256 assets,address receiver)`, `withdraw(uint256 assets,address receiver,address owner)`, `redeem(uint256 shares,address receiver,address owner)`, `maxWithdraw(address)`, `maxRedeem(address)`, `convertToAssets(uint256 shares)`, `convertToShares(uint256 assets)`, `balanceOf(address)`, `totalAssets()`, `totalSupply()`
- views: `lockedAssets()`, `floorAssets()`, `floorBps()`, `freeCushion()`, `freeAssets()`, `utilisationBps()`, `totalPremiumsReceived()`, `totalPayoutsPaid()`, `totalRefundsPaid()`, `depositCap()`, `paused()`
- admin: `setFloorBps(uint16)`, `resetFloor()`, `setFloorAssets(uint256)`, `setDepositCap(uint256)`, `pause()`, `unpause()`, `rescue(address,address,uint256)`, `adminSetLocked(uint256)`, `setMarket(address)`

ReferenceOracle
- keeper/owner: `setLastPrice(address token,uint128 price)`, `setLastPrices(address[],uint128[])`, `postClose(address token,uint64 epochId,uint128 price)`, `postOpen(address,uint64,uint128)`, `postCloseBatch(address[],uint64,uint128[])`, `postOpenBatch(address[],uint64,uint128[])`, `voidEpoch(address,uint64,string reason)`, `setKeeper(address,bool)`
- views: `lastPrice(address)`, `lastPriceAt(address)`, `getRef(address,uint64) -> (closePrice,openPrice,closeAt,openAt,voided,voidReason)`, `isSettleable(address,uint64) -> (settled, voided)`

MockERC20: `faucet()`, `mint(address,uint256)` (owner), `decimals()`, `balanceOf`, `approve`, `allowance`.

## EIP-712 quote (signed by the server's QUOTER key, verified on-chain)
- domain: `{ name: "afterhours.fi CoverMarket", version: "1", chainId, verifyingContract: CoverMarket }`
- types: `Quote(address buyer,address token,uint64 epochId,uint256 notionalUsd,uint16 barrierBps,uint256 premiumUsd,uint64 expiry,uint256 nonce)`
- The server returns `{ quote, signature }`; the client calls `usdt.approve(CoverMarket, premiumUsd)` then `CoverMarket.buyCover(quote, signature)`.

## Pricing engine (server, port of backtest v4)
- `server/data/pooled_z.json`: `{ n, quantiles: number[4001] }` = sorted pooled standardised weekend gaps z.
- `server/data/ticker_vol.json`: `{ NVDA: { rv20, rv60, asof, close }, ... }` annualised trailing vols per underlying ticker (fallback when live klines are unavailable).
- fair premium per $1 for barrier b (fraction) and ticker with annualised 20d vol `rv20`: `sd = rv20 / sqrt(252)`; `fair = mean over quantiles of max(-b - sd * z, 0)`.
- charged = `max(fair * 1.5, 0.0001)` (50% load, 1bp floor). Refuse (HTTP 422, reason `priced_out`) if charged > 2% of notional.
- budget mode: given `budgetBps`, pick the tightest barrier in [100,200,300,500,700,1000] whose charged premium <= budget; if none, return the 1000bp quote flagged `priced_out=false, budget_short=true`.
- vol source order: live 20-day realised vol from Binance spot klines of the bStock (`{SYMBOL}USDT` daily klines, e.g. `NVDABUSDT`) when the symbol exists on api.binance.com, else `ticker_vol.json`.
- Every quote response also carries an `estimatedValue` block: `{ fairBp, chargedBp, loadBp, floorBp: 1, expectedPayoutBp: fairBp, breachProbability }` for the "issuer estimated value" line in the UI.

## Server HTTP API (base `/api`)
- `GET /health`
- `GET /config` -> networks, contract addresses per chainId, token list with tickers/wrappers, epoch info, quoter address
- `GET /market-status` -> proxy of Binance public RWA market status (`openState, marketStatus, reasonCode, nextOpenTime, nextCloseTime`) cached 60s, plus `currentEpochId`, `bindDeadline`, `secondsToBell`
- `GET /tokens?chainId=` -> tokens with `symbol, address, ticker, wrapper, lastPrice (8d), rv20, breachProb5, worstWeekend`
- `GET /quote?chainId=&buyer=&token=&notionalUsd=&barrierBps=` or `&budgetBps=` -> `{ quote, signature, estimatedValue, floorPricePerShare, requiredTokenBalance, capacityNotional }`
- `GET /policies/:address?chainId=` -> policies from Mongo (indexed) with status, gap, payout, receipt text; plus `stats: { weekendsProtected, currentStreak, longestStreak, premiumsPaid, payoutsReceived, floorsHeld, floorsPaid }`
- `GET /vault?chainId=` -> totalAssets, locked, floor, cushion, utilisation, capacityNotional, lifetime premiums/payouts, implied APY band from backtest
- `GET /stats` -> `server/data/backtest_summary.json` (for the landing/learn pages)
- `GET /famous` -> famous weekends list from the summary
- admin (header `x-admin-secret: ADMIN_SECRET`): `POST /admin/prices` (set last prices from live sources or a body override), `POST /admin/close/:epochId`, `POST /admin/open/:epochId`, `POST /admin/void`, `POST /admin/settle` (settleBatch all open policies whose epoch is settleable), `POST /admin/epochs` (open next two epochs), `POST /admin/reindex`
- Background jobs (node-cron or setInterval): indexer every 30s (getLogs from deployment block, upsert policies), price refresh every 5 min, Friday close post at epochId, Monday open post at expectedOpen + retry until a non-null underlying print, then settle.

## Environment variables
server `.env` (empty values are fine, the server must boot with defaults):
```
PORT=4000
MONGODB_URI=
QUOTER_PRIVATE_KEY=
ADMIN_SECRET=
ALCHEMY_API_KEY=
SEPOLIA_RPC_URL=            # optional override; default https://eth-sepolia.g.alchemy.com/v2/$ALCHEMY_API_KEY
BSC_TESTNET_RPC_URL=        # optional override; default https://bnb-testnet.g.alchemy.com/v2/$ALCHEMY_API_KEY
CLIENT_ORIGIN=http://localhost:3000
BINANCE_WEB3_API_KEY=
BINANCE_WEB3_API_SECRET=
```
client `.env.local`:
```
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_DEFAULT_CHAIN_ID=11155111
NEXT_PUBLIC_ALCHEMY_API_KEY=      # wagmi transports use https://eth-sepolia.g.alchemy.com/v2/<key> and https://bnb-testnet.g.alchemy.com/v2/<key>; fall back to public RPCs when empty
```

## Product language (use exactly this vocabulary in UI copy)
- "Weekend floor" (the product), "Set my floor" (buy button), "Keeper pool" (the vault), "Keep" (LP tab), "Protect" (buyer tab), "My weekends" (positions), "Floor held" / "Floor paid $X" (Monday receipt), "weekends protected" (streak), "peace-of-mind meter".
- No confetti, no leaderboards, no prizes, no red/green flashing, no "win/lose" language. Streaks reward protecting, never trading.
- Every quote shows the estimated-value line: "Fair price 4.2bp + our margin 2.1bp = 6.3bp. The engine expects to pay back about 4.2bp of this over many weekends."
- Hackathon disclosure on both apps: admin/deployer can pause, change parameters and withdraw funds; testnet only; not available in restricted jurisdictions.
