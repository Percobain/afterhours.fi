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
- **Kip's agent → Render** (`afterhours-kip`, root `agents/kip/app/agent`). It ships as one prebuilt bundle (`npm run bundle`, commit `bundle/kip.mjs`), so Render runs `node bundle/kip.mjs` with no install or build. The keystore comes from `WALLET_KEYSTORE_JSON` + `WALLET_PASSWORD`.
- **Keep-alive.** Render's free tier sleeps after 15 idle minutes, which would pause the indexer, the Friday/Monday jobs and Kip's keeper. An uptime pinger (cron-job.org) hits `GET /health` on both services every 10 minutes: `https://afterhours-fi.onrender.com/health` and `https://afterhours-kip.onrender.com/health`. Neither route touches a DB or RPC.

## Agent-to-agent: x402, Agent Studio and the Agentic Wallet
Two agents trade weekend cover with each other on BSC Testnet. Watch or run one live at **[afterhoursfi.vercel.app/agents](https://afterhoursfi.vercel.app/agents)**.

| | Hermee's agent (buyer) | Kip's agent (underwriter) |
|---|---|---|
| Code | `agents/hermee` (CLI) + `shared/hermee` (shared with the server demo and the site) | `agents/kip` (scaffolded with BNB Agent Studio, `bag init`) |
| Wallet | Binance Agentic Wallet via `baw x402-payment` on mainnet; a local test key on testnet (the Agentic Wallet has no testnet) | Agent Studio keystore, the sole signer; ERC-8004 agent #2530 on BSC Testnet |
| Does | asks for cover, checks the price against its budget, pays with one signature | prices cover, sells it over x402 (`POST /cover/bind`), binds it on-chain with `coverFor`, settles its book at the Monday open |
| Live | server demo `POST /api/agents/demo/protect` (streams each step) | https://afterhours-kip.onrender.com (`/health`, `/mcp`, `/.well-known/agent-card.json`) |

**The handshake (x402 v2, `exact` scheme, Permit2):**
1. `POST /cover/bind` with the terms returns `402` + `PAYMENT-REQUIRED` (price, pay-to, USDT, network).
2. Hermee's agent signs a Permit2 witness transfer and retries with `PAYMENT-SIGNATURE`.
3. The facilitator verifies it and settles through the canonical `x402ExactPermit2Proxy`, so USDT goes Hermee → Kip.
4. Kip calls `CoverMarket.coverFor`: the policy is Hermee's and the premium goes into the pool.
5. Kip returns `200` + `PAYMENT-RESPONSE`.

Payouts and refunds always go from the pool to Hermee; Kip can only relay the premium, and only because the market owner authorised it as a binder.

**Testnet vs mainnet.** b402, Binance's facilitator, serves BSC testnet only inside Binance's QA environment, so `server/src/x402/facilitator.ts` implements the same verify/settle API for chain 97, limited to our marketplace's payments. Mainnet is configuration only:
- Hermee: `HERMEE_WALLET=baw`.
- Kip: `AFTERHOURS_CHAIN_ID=56`, with `X402_FACILITATOR_URL` pointing at b402.

The Permit2 and proxy contracts share one address on every chain. The Binance Agentic Wallet skill lives in [`skills/afterhours-weekend-cover`](skills/afterhours-weekend-cover/SKILL.md).

**Other agents** get free MCP tools on Kip (`quote_cover`, `market_status`, `gap_history`, `pool_health`, `my_book`) and can buy cover through the same x402 route.

## Deployments
**BSC Testnet is the home network**: the app connects to it by default. Ethereum Sepolia runs the same stack. The deployer `0x1d83F122EF31885B83139ABCb4f8fB4eF319DDF9` is owner, admin and quoter on both.

| contract | BSC Testnet (97) | Ethereum Sepolia (11155111) |
|---|---|---|
| Protection market | [`0xDF7DE17d60876a32b902dc4f4698633C7d849e1f`](https://testnet.bscscan.com/address/0xDF7DE17d60876a32b902dc4f4698633C7d849e1f) | [`0x8f80d31BaF2AbFC91fF4837107871Ed0930B091C`](https://sepolia.etherscan.io/address/0x8f80d31BaF2AbFC91fF4837107871Ed0930B091C) |
| Protection pool (kUSDT) | [`0x721380dc07a44f6B783825aCecb0b626F8177275`](https://testnet.bscscan.com/address/0x721380dc07a44f6B783825aCecb0b626F8177275) | [`0x3eD15ce2936909016D6767d9D109D839E4E40B52`](https://sepolia.etherscan.io/address/0x3eD15ce2936909016D6767d9D109D839E4E40B52) |
| Price oracle | [`0x3Db10b1c68B09803b19bd7fc538C848C20158701`](https://testnet.bscscan.com/address/0x3Db10b1c68B09803b19bd7fc538C848C20158701) | [`0x0fC24edC4A70A37E8EB5f953132550696d9F18fB`](https://sepolia.etherscan.io/address/0x0fC24edC4A70A37E8EB5f953132550696d9F18fB) |
| Test USDT (6 decimals) | [`0x029bcCb1dfeAc2f846D43a9ca318C18083EEf108`](https://testnet.bscscan.com/address/0x029bcCb1dfeAc2f846D43a9ca318C18083EEf108) | [`0x4513E017E0C77D82e920DAEDD47F653510Bb52c5`](https://sepolia.etherscan.io/address/0x4513E017E0C77D82e920DAEDD47F653510Bb52c5) |
| NVDAB · bStock NVDA (test) | [`0x05C366016264E82dA6b4582e0554Be8568C8dE36`](https://testnet.bscscan.com/address/0x05C366016264E82dA6b4582e0554Be8568C8dE36) | [`0x7832f47D5b13255d5F745F83837Bd4ffA8f2a9F4`](https://sepolia.etherscan.io/address/0x7832f47D5b13255d5F745F83837Bd4ffA8f2a9F4) |
| TSLAB · bStock TSLA (test) | [`0xf37b92a7dD0824D0A1b1Fb761A380E0065Fc8Cf1`](https://testnet.bscscan.com/address/0xf37b92a7dD0824D0A1b1Fb761A380E0065Fc8Cf1) | [`0x519F2841905FB4c3e6Cf4D7D4FE0793dBcf4b602`](https://sepolia.etherscan.io/address/0x519F2841905FB4c3e6Cf4D7D4FE0793dBcf4b602) |
| AAPLB · bStock AAPL (test) | [`0xb737520d65DC1a8D20353f960d2cB4E7E0Fe53f1`](https://testnet.bscscan.com/address/0xb737520d65DC1a8D20353f960d2cB4E7E0Fe53f1) | [`0x90D58a2B63Df22baFd8F6Ae3315D5728aAD9C0d6`](https://sepolia.etherscan.io/address/0x90D58a2B63Df22baFd8F6Ae3315D5728aAD9C0d6) |
| SPYB · bStock SPY (test) | [`0x0fC24edC4A70A37E8EB5f953132550696d9F18fB`](https://testnet.bscscan.com/address/0x0fC24edC4A70A37E8EB5f953132550696d9F18fB) | [`0x02B08180aFC524c7a81C4723E25608957D702c6a`](https://sepolia.etherscan.io/address/0x02B08180aFC524c7a81C4723E25608957D702c6a) |
| COINB · bStock COIN (test) | [`0x3eD15ce2936909016D6767d9D109D839E4E40B52`](https://testnet.bscscan.com/address/0x3eD15ce2936909016D6767d9D109D839E4E40B52) | [`0x029bcCb1dfeAc2f846D43a9ca318C18083EEf108`](https://sepolia.etherscan.io/address/0x029bcCb1dfeAc2f846D43a9ca318C18083EEf108) |
| MSTRB · bStock MSTR (test) | [`0x8f80d31BaF2AbFC91fF4837107871Ed0930B091C`](https://testnet.bscscan.com/address/0x8f80d31BaF2AbFC91fF4837107871Ed0930B091C) | [`0x05C366016264E82dA6b4582e0554Be8568C8dE36`](https://sepolia.etherscan.io/address/0x05C366016264E82dA6b4582e0554Be8568C8dE36) |
| NVDAon · Ondo NVDA (test) | [`0x6a1D6a53D8886c4F94ddc5BBC975ef1B1850B4Ba`](https://testnet.bscscan.com/address/0x6a1D6a53D8886c4F94ddc5BBC975ef1B1850B4Ba) | [`0xf37b92a7dD0824D0A1b1Fb761A380E0065Fc8Cf1`](https://sepolia.etherscan.io/address/0xf37b92a7dD0824D0A1b1Fb761A380E0065Fc8Cf1) |
| SPYon · Ondo SPY (test) | [`0x4597b0f5Ae9fd15f374726C5F916f2F841a38F20`](https://testnet.bscscan.com/address/0x4597b0f5Ae9fd15f374726C5F916f2F841a38F20) | [`0xb737520d65DC1a8D20353f960d2cB4E7E0Fe53f1`](https://sepolia.etherscan.io/address/0xb737520d65DC1a8D20353f960d2cB4E7E0Fe53f1) |

| | BSC Testnet | Ethereum Sepolia |
|---|---|---|
| deploy block | [133,916,239](https://testnet.bscscan.com/block/133916239) | [11,800,197](https://sepolia.etherscan.io/block/11800197) |
| open weekends (epochId) | 1790971200, 1791576000 | 1790971200, 1791576000 |
| authorised binders (agents) | [`0x6513a00FB8341ee24Af029EFAf67B19b5914ed4C`](https://testnet.bscscan.com/address/0x6513a00FB8341ee24Af029EFAf67B19b5914ed4C) | — |

**Agent-to-agent (x402)** on BSC Testnet uses the canonical, chain-independent contracts: Permit2 [`0x000000000022D473030F116dDEE9F6B43aC78BA3`](https://testnet.bscscan.com/address/0x000000000022D473030F116dDEE9F6B43aC78BA3) and x402ExactPermit2Proxy [`0x402085c248EeA27D92E8b30b2C58ed07f9E20001`](https://testnet.bscscan.com/address/0x402085c248EeA27D92E8b30b2C58ed07f9E20001).

Core contracts are source-verified on BscScan and Etherscan. The raw address books are `contracts/deployments/bscTestnet.json` and `contracts/deployments/sepolia.json` (copied into `server/deployments` and `client/src/deployments`).

## How a weekend works
1. **Friday, before the bell.** The holder picks a token and a weekly budget (or a floor). The server prices it with the pooled vol-scaled engine, signs an EIP-712 quote, and the holder calls `buyCover`. The premium goes into the Keeper vault; the vault locks 20% of the notional as the policy's maximum payout.
2. **The bell.** No more purchases (`bindDeadline`). The oracle records the Friday close per share.
3. **Monday, 9:30 New York.** The oracle records the first official opening print. Anyone calls `settle`: payout per $1 = min(max(-barrier - gap, 0), 20%). The holder gets a receipt: "Floor held" or "Floor paid $X". Corporate actions void the weekend and refund the premium.

For the full story in plain numbers (Hermee's weekend, Kip's vault) and the quant methodology behind the pricing, see **[/docs](https://afterhoursfi.vercel.app/docs)**.

## Hackathon disclosure
Testnet only. The deployer address owns every contract and can pause, change parameters, force-settle, correct prices and withdraw funds. Not available in restricted jurisdictions. Built for BNB Hack: Tokenized Stocks Edition.
