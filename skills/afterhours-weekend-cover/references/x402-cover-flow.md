# x402 cover flow: exact requests and responses

Kip sells one paid resource, `POST /cover/bind`, over x402 v2 (`exact` scheme, `permit2` transfer). The price
arrives with the refusal; the retry carries the payment; Kip settles it on-chain, then binds the policy for the
buyer with `CoverMarket.coverFor`. Payouts never pass through Kip: the pool pays the buyer directly.

## 1. Ask (no payment)

```bash
curl -si -X POST https://afterhours-kip.onrender.com/cover/bind \
  -H 'content-type: application/json' \
  -d '{"buyer":"0xYourWallet","token":"0xNVDAB","notionalUsd":"1000000000","barrierBps":500}'
```

`notionalUsd` is USDT with 6 decimals ($1,000 = `1000000000`). `barrierBps` is the floor in basis points
(menu: 100, 200, 300, 500, 700, 1000). Token addresses: `GET https://afterhours-fi.onrender.com/api/config`.

## 2. 402 Payment Required

Headers: `PAYMENT-REQUIRED: <base64 JSON>`. Body (same JSON plus the offer):

```json
{
  "x402Version": 2,
  "error": "payment required to bind this weekend floor",
  "resource": { "url": "https://afterhours-kip.onrender.com/cover/bind", "description": "Weekend floor on $1,000.00 of NVDA at -5% ...", "mimeType": "application/json" },
  "accepts": [{
    "scheme": "exact",
    "network": "eip155:97",
    "amount": "164711",
    "asset": "0x<USDT>",
    "payTo": "0x6513a00FB8341ee24Af029EFAf67B19b5914ed4C",
    "maxTimeoutSeconds": 120,
    "extra": { "assetTransferMethod": "permit2", "name": "USDT", "decimals": 6 }
  }],
  "quoteId": "7700...562",
  "offer": { "ticker": "NVDA", "notionalUsd": "1000000000", "barrierBps": 500, "premiumUsd": "164711", "epochId": 1790971200, "payableUntil": 1790710330, "maxPayoutUsd": "200000000" }
}
```

Checks before paying: the offer equals the request; `amount == offer.premiumUsd`; the premium is within budget;
`scheme`/`assetTransferMethod`/`network`/`asset` are what you expect; `payTo` is Kip.

## 3. Sign with the Agentic Wallet (mainnet)

```bash
baw x402-payment preview --paymentRequirements "<PAYMENT-REQUIRED header value>" --json
# -> { "paymentId": "...", "options": [{ "index": 1, "status": "READY_TO_SIGN", "payTo": "...", "tokenAddress": "...", "amount": "..." }] }
baw x402-payment sign --paymentId <paymentId> --selectedIndex 1 --json
# -> { "paymentHeaderName": "PAYMENT-SIGNATURE", "paymentHeaderValue": "<base64>", "approveTxHash": null, "signatureExpiresAt": 1790710330 }
```

What gets signed: a Permit2 `PermitWitnessTransferFrom` for the premium, spender = the canonical
`x402ExactPermit2Proxy` (`0x402085c248EeA27D92E8b30b2C58ed07f9E20001`), witness `(to = payTo, validAfter)`.
The proxy enforces `to`, so the facilitator that submits the settlement cannot redirect the money.

## 4. Retry with the payment

```bash
curl -si -X POST https://afterhours-kip.onrender.com/cover/bind \
  -H 'content-type: application/json' \
  -H 'PAYMENT-SIGNATURE: <paymentHeaderValue>' \
  -d '{"buyer":"0xYourWallet","token":"0xNVDAB","notionalUsd":"1000000000","barrierBps":500,"quoteId":"7700...562"}'
```

`200` body:

```json
{ "ok": true, "policyId": "0", "paymentTx": "0x4546...", "bindTx": "0x34e2...", "beneficiary": "0xYourWallet",
  "underwriter": "0x6513...", "ticker": "NVDA", "premiumUsd": "164711", "notionalUsd": "1000000000", "barrierBps": 500, "epochId": 1790971200 }
```

plus `PAYMENT-RESPONSE: <base64 {success, transaction, network, payer}>`.

Errors: `402` again with `error` (verification or settlement failed, e.g. `permit2_allowance_required`);
`410` offer expired or unknown `quoteId`; `400` request does not match the offer, or payer is not the buyer;
`502` paid but binding failed, in which case Kip refunds the premium and returns `refundTx`.

## Monday

At the first official Monday open the oracle records the price and Kip's keeper calls `settleBatch`. Check:

```bash
curl -s "https://afterhours-fi.onrender.com/api/policies/0xYourWallet?chainId=97"
```

`status` becomes `Settled` (with `payoutUsd`, `gapBps`) or `Refunded` (voided weekend, premium returned).
