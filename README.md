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
**BSC Testnet is the home network**: the app connects to it by default. Ethereum Sepolia runs the same stack. The deployer `0x1d83F122EF31885B83139ABCb4f8fB4eF319DDF9` is owner, admin and quoter on both.

| contract | BSC Testnet (97) | Ethereum Sepolia (11155111) |
|---|---|---|
| Protection market | [`0x73A30DAf8e3561848bC5561d30dFc50830aa5d00`](https://testnet.bscscan.com/address/0x73A30DAf8e3561848bC5561d30dFc50830aa5d00) | [`0x8f80d31BaF2AbFC91fF4837107871Ed0930B091C`](https://sepolia.etherscan.io/address/0x8f80d31BaF2AbFC91fF4837107871Ed0930B091C) |
| Protection pool (kUSDT) | [`0xd2f6f89b8880a621D2b2e26E4b725cD3Cc3F6924`](https://testnet.bscscan.com/address/0xd2f6f89b8880a621D2b2e26E4b725cD3Cc3F6924) | [`0x3eD15ce2936909016D6767d9D109D839E4E40B52`](https://sepolia.etherscan.io/address/0x3eD15ce2936909016D6767d9D109D839E4E40B52) |
| Price oracle | [`0x67faAb9FA857c5f3B564D950474A0e58c6073721`](https://testnet.bscscan.com/address/0x67faAb9FA857c5f3B564D950474A0e58c6073721) | [`0x0fC24edC4A70A37E8EB5f953132550696d9F18fB`](https://sepolia.etherscan.io/address/0x0fC24edC4A70A37E8EB5f953132550696d9F18fB) |
| Test USDT (6 decimals) | [`0xB5297E51C700EcE40912C0857F866eCd09348484`](https://testnet.bscscan.com/address/0xB5297E51C700EcE40912C0857F866eCd09348484) | [`0x4513E017E0C77D82e920DAEDD47F653510Bb52c5`](https://sepolia.etherscan.io/address/0x4513E017E0C77D82e920DAEDD47F653510Bb52c5) |
| NVDAB · bStock NVDA (test) | [`0x59205D7a546Bd28bbE3A8C8BE4Eec256d9c34bC4`](https://testnet.bscscan.com/address/0x59205D7a546Bd28bbE3A8C8BE4Eec256d9c34bC4) | [`0x7832f47D5b13255d5F745F83837Bd4ffA8f2a9F4`](https://sepolia.etherscan.io/address/0x7832f47D5b13255d5F745F83837Bd4ffA8f2a9F4) |
| TSLAB · bStock TSLA (test) | [`0x6ea034B50D2053A83c0d8193F907F91691a03601`](https://testnet.bscscan.com/address/0x6ea034B50D2053A83c0d8193F907F91691a03601) | [`0x519F2841905FB4c3e6Cf4D7D4FE0793dBcf4b602`](https://sepolia.etherscan.io/address/0x519F2841905FB4c3e6Cf4D7D4FE0793dBcf4b602) |
| AAPLB · bStock AAPL (test) | [`0x7A0aA73824cE1E523c903af8fDF8D67a249FD2a8`](https://testnet.bscscan.com/address/0x7A0aA73824cE1E523c903af8fDF8D67a249FD2a8) | [`0x90D58a2B63Df22baFd8F6Ae3315D5728aAD9C0d6`](https://sepolia.etherscan.io/address/0x90D58a2B63Df22baFd8F6Ae3315D5728aAD9C0d6) |
| SPYB · bStock SPY (test) | [`0x167a116213EfE0Be71A3CB1d31802559b65db71b`](https://testnet.bscscan.com/address/0x167a116213EfE0Be71A3CB1d31802559b65db71b) | [`0x02B08180aFC524c7a81C4723E25608957D702c6a`](https://sepolia.etherscan.io/address/0x02B08180aFC524c7a81C4723E25608957D702c6a) |
| COINB · bStock COIN (test) | [`0x1019DE31d6710DfE1B33A87c31a4b65f4B803306`](https://testnet.bscscan.com/address/0x1019DE31d6710DfE1B33A87c31a4b65f4B803306) | [`0x029bcCb1dfeAc2f846D43a9ca318C18083EEf108`](https://sepolia.etherscan.io/address/0x029bcCb1dfeAc2f846D43a9ca318C18083EEf108) |
| MSTRB · bStock MSTR (test) | [`0xA64f0E730399de66fA6278c64BBb4A708d6d17f3`](https://testnet.bscscan.com/address/0xA64f0E730399de66fA6278c64BBb4A708d6d17f3) | [`0x05C366016264E82dA6b4582e0554Be8568C8dE36`](https://sepolia.etherscan.io/address/0x05C366016264E82dA6b4582e0554Be8568C8dE36) |
| NVDAon · Ondo NVDA (test) | [`0xa0DaaFe98808145f717a764C940e4F3c26248651`](https://testnet.bscscan.com/address/0xa0DaaFe98808145f717a764C940e4F3c26248651) | [`0xf37b92a7dD0824D0A1b1Fb761A380E0065Fc8Cf1`](https://sepolia.etherscan.io/address/0xf37b92a7dD0824D0A1b1Fb761A380E0065Fc8Cf1) |
| SPYon · Ondo SPY (test) | [`0x474c99BFa66Eb98B7e3EFbb9430fFC9CDc209C5f`](https://testnet.bscscan.com/address/0x474c99BFa66Eb98B7e3EFbb9430fFC9CDc209C5f) | [`0xb737520d65DC1a8D20353f960d2cB4E7E0Fe53f1`](https://sepolia.etherscan.io/address/0xb737520d65DC1a8D20353f960d2cB4E7E0Fe53f1) |

| | BSC Testnet | Ethereum Sepolia |
|---|---|---|
| deploy block | [133,686,889](https://testnet.bscscan.com/block/133686889) | [11,800,197](https://sepolia.etherscan.io/block/11800197) |
| open weekends (epochId) | 1790971200, 1791576000 | 1790971200, 1791576000 |

Core contracts are source-verified on BscScan and Etherscan. The raw address books are `contracts/deployments/bscTestnet.json` and `contracts/deployments/sepolia.json` (copied into `server/deployments` and `client/src/deployments`).

## How a weekend works
1. **Friday, before the bell.** The holder picks a token and a weekly budget (or a floor). The server prices it with the pooled vol-scaled engine, signs an EIP-712 quote, and the holder calls `buyCover`. The premium goes into the Keeper vault; the vault locks 20% of the notional as the policy's maximum payout.
2. **The bell.** No more purchases (`bindDeadline`). The oracle records the Friday close per share.
3. **Monday, 9:30 New York.** The oracle records the first official opening print. Anyone calls `settle`: payout per $1 = min(max(-barrier - gap, 0), 20%). The holder gets a receipt: "Floor held" or "Floor paid $X". Corporate actions void the weekend and refund the premium.

For the full story in plain numbers (Hermee's weekend, Kip's vault) and the quant methodology behind the pricing, see **[/docs](https://afterhoursfi.vercel.app/docs)**.

## Hackathon disclosure
Testnet only. The deployer address owns every contract and can pause, change parameters, force-settle, correct prices and withdraw funds. Not available in restricted jurisdictions. Built for BNB Hack: Tokenized Stocks Edition.
