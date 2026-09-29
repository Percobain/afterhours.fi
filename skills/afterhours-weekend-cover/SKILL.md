---
name: afterhours-weekend-cover
description: |
  Protect a tokenized US stock (Binance bStocks, Ondo) over the weekend with afterhours.fi weekend cover,
  paid over x402 from the Binance Agentic Wallet. The US market is shut from Friday's close to Monday's open;
  the cover pays the part of a Monday-open drop below a chosen floor (e.g. -5%), up to 20% of the amount,
  straight from a collateralised pool on BNB Chain.

  Use when the user mentions: protect / insure / hedge my stock over the weekend, weekend gap, Monday open
  risk, gap down, floor under my NVDA/TSLA/bStock/Ondo position, weekend cover, stop-loss that works over
  the weekend, "what if it opens lower on Monday", afterhours.fi, Kip, or paying an agent for cover via x402.

  NOT for: trading the stock itself (use binance-agentic-wallet market-order), perps or leverage,
  intraday stops, or crypto tokens (BTC, ETH).
metadata:
  author: afterhours.fi
  version: '0.1.0'
  requiredSkills:
    - binance-agentic-wallet
    - binance-tokenized-securities-info
  openclaw:
    requires:
      bins:
        - baw
        - curl
---

# afterhours.fi Weekend Cover Skill

Buys a weekend floor for a tokenized stock the user holds. The seller is **Kip**, an underwriting agent built on
BNB Agent Studio (ERC-8004 identity). The buyer is the user's **Binance Agentic Wallet**, which pays Kip over
**x402 v2** (`exact` scheme, `permit2` transfer) with `baw x402-payment`.

| Term | Meaning |
|---|---|
| Floor | How far below Friday's close the cover starts paying, e.g. 500 bps = -5% |
| Amount | Dollar value protected (`notionalUsd`, USDT with 6 decimals: $1,000 = `1000000000`) |
| Premium | What the user pays once for this weekend; priced from 21 years of weekends |
| Payout | `amount x min(max(drop - floor, 0), 20%)`, paid by the pool on Monday, to the user's wallet |

## Command Routing

| User intent | What to do | Reference |
|---|---|---|
| "How risky is my weekend?" / price check | MCP `quote_cover` on Kip, or step 1 below without paying | [x402-cover-flow.md](references/x402-cover-flow.md) |
| "Protect my NVDA this weekend" | Full workflow below | [x402-cover-flow.md](references/x402-cover-flow.md) |
| Is the market open / when is the bell | MCP `market_status` on Kip, or `binance-tokenized-securities-info` market status | |
| "Did my cover pay?" | `GET https://afterhours-fi.onrender.com/api/policies/<wallet>?chainId=<id>` | [x402-cover-flow.md](references/x402-cover-flow.md#monday) |
| Try it without real money | BSC Testnet with the local payer | [testnet.md](references/testnet.md) |

## Workflow: protect a position for this weekend

1. **Check the wallet and position.** `baw wallet view --json` for the address; confirm the user holds the stock
   token (Kip checks on-chain that the buyer holds enough of it for the amount).
2. **Check the asset can be covered.** With `binance-tokenized-securities-info` asset market status: if
   `reasonCode` is `ASSET_PAUSED` or `reasonMsg` is `earnings`, `stock_split`, `cash_dividend`, `merger`, etc.,
   stop and explain. Corporate-action weekends are voided and refunded, and earnings weekends are not sold.
3. **Ask Kip for a price.** `POST <KIP>/cover/bind` with `{buyer, token, notionalUsd, barrierBps}` and **no**
   payment header. Expect `402` with a `PAYMENT-REQUIRED` header and a JSON body carrying `offer` and `quoteId`.
4. **Check the offer.** It must match what the user asked: same token, amount and floor. `accepts[0]` must be
   `scheme: exact`, `extra.assetTransferMethod: permit2`, `payTo` = Kip's address, asset = USDT, on the user's
   chain. Compute the premium as a share of the amount; refuse above the user's budget (default 1%).
5. **Confirm with the user** before signing. Show: stock, amount, floor, premium, max payout, Kip's full
   `payTo` address, the weekend (Friday close to Monday open) and that sales close at Friday's bell.
6. **Pay.** `baw x402-payment preview --paymentRequirements <PAYMENT-REQUIRED header> --json`, pick the option
   whose `payTo`, `tokenAddress` and `amount` equal the offer (never a different one), then
   `baw x402-payment sign --paymentId <id> --selectedIndex <n> --json`. A first payment may need a one-time
   Permit2 approval; `sign` handles it and returns `approveTxHash`.
7. **Retry once with the signature.** `POST <KIP>/cover/bind` with the same JSON plus `quoteId`, and header
   `PAYMENT-SIGNATURE: <paymentHeaderValue>`. Expect `200` with `policyId`, `paymentTx`, `bindTx` and a
   `PAYMENT-RESPONSE` header. The policy's `beneficiary` must be the user's wallet.
8. **Report** the policy id and both transaction links. Nothing else to do: on Monday the pool pays the
   user's wallet automatically if the stock opens below the floor.

## Guardrails (must follow)

- Confirm with the user before `baw x402-payment sign`. Never pay silently, even in autopilot, unless the user
  set an explicit weekly budget and stock list for it.
- Never pay a different recipient, token, network or amount than the offer; never switch options silently.
- Retry at most once automatically. On `402` again (e.g. `permit2_allowance_required`, `expired`), show the
  reason and ask before trying again. On `410`, the offer expired: start over from step 3.
- Respect the wallet's own limits (daily limit, token scope, set in the Binance App). If `baw` returns
  `BLOCKED_DAILY_LIMIT_REACHED`, stop and tell the user.
- Cover is sold only until **Friday's US close** (the bell). After that, say the next weekend opens Monday.
- Always show full contract addresses when asked to sign or when reporting.
- The Agentic Wallet is mainnet-only. For practice use [testnet.md](references/testnet.md).

## Endpoints

| | BSC Testnet (live) | BSC Mainnet |
|---|---|---|
| Kip's agent | `https://afterhours-kip.onrender.com` | same agent with `AFTERHOURS_CHAIN_ID=56` |
| Kip's MCP tools | `https://afterhours-kip.onrender.com/mcp` | same path |
| Kip's identity | ERC-8004 agent #2530, registry `0x8004A818BFB912233c491871b3d84c89A494BD9e` (chain 97) | registry `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` (chain 56) |
| x402 facilitator | afterhours.fi stand-in (b402 testnet is internal-only) | Binance b402 |
| Permit2 / x402 proxy | `0x000000000022D473030F116dDEE9F6B43aC78BA3` / `0x402085c248EeA27D92E8b30b2C58ed07f9E20001` | same addresses |
