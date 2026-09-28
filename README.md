# afterhours.fi - weekend floors for tokenized stocks

**Live app:** https://afterhoursfi.vercel.app · **API:** https://afterhours-fi.onrender.com/api/health

The US market closes Friday at 4pm New York and reopens Monday at 9:30. Tokenized stocks (bStocks, Ondo) keep trading through the weekend on BNB Chain, priced off a reference that has not moved. afterhours.fi lets a holder set a **floor** under that weekend for a few basis points, and lets a **Keeper pool** earn those premiums for carrying the risk, fully collateralised and CPPI-sized.

> **Methodology, research and intuition** — how the idea came about, the market research, the history of bad weekends, the two-sided model, the backtest with real numbers and charts, and what it concludes for both sides — is written up at **[afterhoursfi.vercel.app/docs](https://afterhoursfi.vercel.app/docs)**. Start there if you are curious about the *why*; this README covers the *how*.

| folder | what |
|---|---|
| `backtest/` | the research: 61,815 ticker-weekends 2005-2026, four pricing engines, Hermee (buyer) and Kip (Keeper) case studies, principal-protection structures, market research, literature, hackathon strategy. Start with `backtest/CONCLUSIONS.md` and `backtest/report/index.html`. |
| `contracts/` | Hardhat project: `KeeperVault` (ERC-4626, CPPI floor), `CoverMarket` (EIP-712 signed quotes, Friday bell, Monday-open settlement, 20% payout cap), `ReferenceOracle`, test tokens. Deployed on Ethereum Sepolia; BSC Testnet deploy script ready. |
| `server/` | Node + TypeScript + Express + MongoDB: the v4 pricing engine (pooled vol-scaled tail), quote signing, Binance market-status and price feeds, event indexer, Friday/Monday epoch jobs, admin routes. Ships precompiled in `server/dist/`. |
| `client/` | Next.js + wagmi + viem + RainbowKit: landing page, the app (Protect / Earn / My activity) and `/docs`. Dark, calm, gamified-not-gambling. |
| `shared/` | `INTERFACE.md` (the contract between the three apps) and exported ABIs. |

## Quick start
```powershell
# contracts (already deployed to Sepolia; see contracts/deployments/sepolia.json)
cd contracts; npm install; npm test

# server
cd ../server; npm install; copy .env.example .env   # fill MONGODB_URI, QUOTER_PRIVATE_KEY (= deployer key for now), ADMIN_SECRET, ALCHEMY_API_KEY
npm run dev                                          # http://localhost:4000/api/health

# client
cd ../client; npm install; copy .env.example .env.local   # fill NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID, NEXT_PUBLIC_ALCHEMY_API_KEY
npm run dev                                          # http://localhost:3000
```
The client also runs with no server and no deployment: every server call has a 5s timeout and a static backtest fallback.

## Hosting
- **Client → Vercel** (`afterhoursfi`, root directory `client`). Every push to `main` deploys production. Env: `NEXT_PUBLIC_API_URL` (the Render URL), `NEXT_PUBLIC_DEFAULT_CHAIN_ID`. `NEXT_PUBLIC_*` values are baked in at build time, so change them and redeploy.
- **Server → Render** web service. Build `npm ci --omit=dev`, start `node dist/index.js`, health check `/health`. The server is committed precompiled, so after changing anything in `server/src` run `npm run build` in `server/` and commit `server/dist/` in the same commit.
- **Keep-alive.** Render's free tier sleeps after 15 idle minutes, which would also pause the indexer and the Friday/Monday jobs. An uptime pinger (cron-job.org) hits `GET /health` every 10 minutes; that route skips the rate limiter and touches no DB or RPC.

## Deployments
- **Ethereum Sepolia (11155111)**: `contracts/deployments/sepolia.json`. Deployer/admin/quoter `0x1d83F122EF31885B83139ABCb4f8fB4eF319DDF9`.
- **BSC Testnet (97)**: `cd contracts; npm run deploy:bscTestnet` once the deployer holds test BNB.

## How a weekend works
1. **Friday, before the bell.** The holder picks a token and a weekly budget (or a floor). The server prices it with the pooled vol-scaled engine, signs an EIP-712 quote, and the holder calls `buyCover`. The premium goes into the Keeper vault; the vault locks 20% of the notional as the policy's maximum payout.
2. **The bell.** No more purchases (`bindDeadline`). The oracle records the Friday close per share.
3. **Monday, 9:30 New York.** The oracle records the first official opening print. Anyone calls `settle`: payout per $1 = min(max(-barrier - gap, 0), 20%). The holder gets a receipt: "Floor held" or "Floor paid $X". Corporate actions void the weekend and refund the premium.

For the full story in plain numbers (Hermee's weekend, Kip's vault) and the quant methodology behind the pricing, see **[/docs](https://afterhoursfi.vercel.app/docs)**.

## Hackathon disclosure
Testnet only. The deployer address owns every contract and can pause, change parameters, force-settle, correct prices and withdraw funds. Not available in restricted jurisdictions. Built for BNB Hack: Tokenized Stocks Edition.
