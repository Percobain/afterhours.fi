# afterhours.fi client

Web app for **weekend protection** on tokenized US stocks (bStocks / Ondo) for the BNB Hack: Tokenized Stocks Edition.
Next.js 14 (App Router, TypeScript strict), Tailwind, RainbowKit 2 + wagmi 2 + viem 2, TanStack Query, framer-motion, lucide-react.

## Run

```bash
cd client
cp .env.example .env.local      # fill in what you have; everything is optional
npm install
npm run dev                     # http://localhost:3000
npm run build && npm start      # production
npm run lint && npm run typecheck
```

`predev` / `prebuild` run `scripts/gen-deployments.mjs`, which turns whatever `src/deployments/<network>.json` files exist into `src/deployments/index.ts`. With no JSON the registry is empty and the app shows a "not deployed on this network yet" card instead of failing to build. `npm run gen` additionally regenerates `src/abi/*.ts` from `../shared/abi/*.json`.

## Environment (`.env.local`)

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | WalletConnect Cloud id. Empty = injected (browser-extension) wallets only; the app still runs. |
| `NEXT_PUBLIC_API_URL` | afterhours.fi server base (default `http://localhost:4000`). All calls go to `${API_URL}/api/...` with a 5 s timeout and safe fallbacks. |
| `NEXT_PUBLIC_DEFAULT_CHAIN_ID` | `11155111` (Sepolia) or `97` (BSC Testnet). Used when no wallet is connected. |
| `NEXT_PUBLIC_ALCHEMY_API_KEY` | RPC policy: wagmi transports use `https://eth-sepolia.g.alchemy.com/v2/<key>` and `https://bnb-testnet.g.alchemy.com/v2/<key>`; when empty they fall back to the chains' public RPCs. |
| `NEXT_PUBLIC_SEPOLIA_{COVER_MARKET,KEEPER_VAULT,USDT,ORACLE}` / `NEXT_PUBLIC_BSC_TESTNET_*` | Optional address overrides; take precedence over the deployment JSON. |

## Pages

- `/` landing: glass nav, aurora hero with a looping live demo card (Nvidia through the DeepSeek weekend: week line, market closed, −12.5% Monday open, the part below the 3% line paid), famous-drops marquee, the problem in three numbers, how it works in three moments with the live weekend timer, an interactive "What would Monday do to you?" simulator, Protect vs Earn cards, a bento of backtest proof, safety rules, FAQ, final CTA.
- `/protect`: a four-step guided flow. 1 pick a stock (cards with price, what you hold, a plain risk label and "drops 5%+ about 1 in N weekends"); 2 say how much in dollars (quick amounts, "All I hold", inline faucet); 3 choose a protection line (Tight 2% / Recommended 3% / Standard 5% / Crash only 10%, each with its live dollar cost from the quote menu and how often it would have paid, plus an optional weekly-budget mode and the Monday simulator using the real fee); 4 review in one sentence plus a numbers table and a checklist of exactly what the wallet will ask for (hold the stock → have the fee → allow the exact fee → confirm). Success screen shows the Friday → weekend → Monday timeline.
- `/earn`: add or take out USDT with a checklist, "What could I earn?" calculator (typical year vs worst weekend on record), where the pool’s money is right now (safety reserve / set aside this weekend / free), lifetime fees and payouts, and an honest-risk note.
- `/activity`: streak and totals, active protection with a countdown to Monday’s open and a Settle button when ready, and a plain-English receipt per past weekend ("We paid you $40.00" / "Your stock held up").
- `/docs`: Part I tells the product as a story with round numbers (Hermee protects $10,000 of Nvidia; Kip earns in a $100,000 pool; the five steps underneath). Part II is the research methodology: the journey from the RecurOS log, market research, famous weekends, the model, data and method, results with charts, conclusions for both sides, technology, and limitations. `/learn` redirects here.
- Every app page: an "Explain this page" guide drawer, hover/tap definitions for every term, the weekend timer, and a "Getting started" checklist that reads wallet state and always shows the one next step (connect → switch network → gas → free test money → first protection → check back Monday). Phones get a bottom tab bar; `/app?tab=` links redirect to the new pages.
- `/learn`: plain-English explainer, "why the price is what it is", breach-probability tiles, glossary, FAQ. Renders `GET /api/learn` and `GET /api/stats` when available, otherwise static copy with the same numbers.

## How it talks to the server and the contracts

- `src/lib/api.ts`: typed fetchers for exactly the endpoints in `shared/INTERFACE.md` (`/health`, `/config`, `/market-status`, `/tokens`, `/quote`, `/policies/:address`, `/vault`, `/stats`, `/famous`, plus `/learn`). Every call has a 5 s timeout; all but `quote` return `null` on failure so the UI can fall back (static backtest numbers, indicative non-tradable quotes, on-chain reads).
- `src/lib/contracts.ts`: chain metadata, address resolution (env > `src/deployments/<network>.json` > server `/config`), unit helpers (USD 6 decimals, prices 8 decimals, bps, notional <-> tokens, floor price, payout maths, peace-of-mind), epoch helpers, and a plain-English map of contract errors.
- `src/abi/*.ts`: `as const` ABIs generated from `shared/abi`.
- `src/hooks/useDeployment.ts`: merges the three address sources and enriches tokens with prices from `/api/tokens` or `ReferenceOracle.lastPrice`.
- `src/hooks/useTx.ts`: one contract write = wallet signature -> mined receipt, with toasts in plain English.
- Buy flow: `USDT.approve(CoverMarket, premiumUsd)` then `CoverMarket.buyCover(quote, signature)` with the EIP-712 quote returned by the server, untouched.

## Design rules (enforced in the code)

Dark, calm, web3-standard: glass nav, aurora gradients, gradient hairline borders, Geist. Amber for protecting, cyan for earning, green only for good outcomes, red only for real drops. Words first: no "bp", "notional", "epoch" or "barrier" in the UI; dollars and sentences instead (`src/lib/copy.ts`). Gamified but not gambling: streaks count careful weekends, never trades; no confetti, leaderboards, prizes or odds. Entrance animations are CSS/IntersectionObserver based so content never gets stuck hidden, and everything respects `prefers-reduced-motion`.

## Layout

```
client/
  scripts/gen-abi.mjs, gen-deployments.mjs
  src/abi/                 generated ABIs
  src/deployments/         <network>.json (from contracts deploy) + generated index.ts
  src/lib/                 api, contracts, chains, wagmi, format, time, backtest, types
  src/hooks/               useDeployment, useTx, useToast, useNow (+debounce, mounted, reduced motion)
  src/components/          WorldClock, QuoteCard, PeaceOfMindMeter, StreakRing, Receipt, TokenSelect,
                           ChainGuard, TxButton, StatTile, Disclosure, Reveal, Nav, Footer, Logo
  src/components/app/      AppFrame, NetworkGate, protect/ProtectFlow, earn/EarnFlow, activity/ActivityFeed
  src/components/ui/       Term (glossary popovers), HelpDrawer, Steps/ActionChecklist, WeekendBar/Countdown, Badge, StockMark
  src/components/onboarding/ GettingStarted
  src/lib/copy.ts          all plain-English copy: glossary, risk labels, levels, page guides
  src/components/landing/  Landing, Characters, FamousStrip, Faq
  src/components/learn/    Learn
  src/app/                 layout, providers, page (/), protect, earn, activity, learn, app (redirect)
```
