/**
 * POST /cover/bind: the paid x402 v2 resource Kip sells.
 *
 *   1. Hermee's agent POSTs { buyer, token, notionalUsd, barrierBps } without payment.
 *      Kip prices it with the pricing engine and answers 402 + PAYMENT-REQUIRED:
 *      pay `premium` USDT to Kip via the exact scheme (Permit2, canonical x402 proxy). Body carries the offer + quoteId.
 *   2. Hermee's agent signs (locally on testnet, `baw x402-payment sign` on mainnet) and retries with PAYMENT-SIGNATURE.
 *   3. Kip checks the payload against the offer, has the facilitator verify and settle it (USDT moves Hermee -> Kip),
 *      then binds the policy on-chain for Hermee with coverFor. Payouts go from the vault to Hermee, never via Kip.
 *   4. 200 + PAYMENT-RESPONSE with the policy id and both transaction hashes. If binding fails after the money
 *      arrived, Kip refunds the premium to the payer before answering.
 */
import express, { type Request, type Response } from "express";
import { getAddress, isAddress, isAddressEqual, type Address, type Hex } from "viem";
import { AH } from "./config.js";
import { ERC20_ABI, MARKET_ABI, agentAddress, encode, policyIdFrom, publicClient, sendTx } from "./chain.js";
import { track } from "./keeper.js";
import { deployment, fetchQuote, UpstreamError, type QuoteResponse } from "./market.js";
import {
  HEADER_PAYMENT_REQUIRED,
  HEADER_PAYMENT_RESPONSE,
  HEADER_PAYMENT_SIGNATURE,
  X402_VERSION,
  decodeHeader,
  encodeHeader,
  type PaymentPayload,
  type PaymentRequired,
  type PaymentRequirements,
  type SettleResponse,
  type VerifyResponse,
} from "./x402.js";

interface Offer {
  quote: QuoteResponse;
  requirements: PaymentRequirements;
  required: PaymentRequired;
  ticker: string;
  expiresAt: number;
}

const offers = new Map<string, Offer>();
const MAX_UINT = (1n << 256n) - 1n;

function prune(): void {
  const now = Date.now() / 1000;
  for (const [k, o] of offers) if (o.expiresAt < now) offers.delete(k);
}

async function facilitator<T>(path: "verify" | "settle", p: PaymentPayload, r: PaymentRequirements): Promise<T> {
  const res = await fetch(`${AH.facilitator}/${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ x402Version: X402_VERSION, paymentPayload: p, paymentRequirements: r }),
    signal: AbortSignal.timeout(90_000),
  });
  return (await res.json()) as T;
}

function sameRequirements(a: PaymentRequirements, b: PaymentRequirements): boolean {
  return a.scheme === b.scheme && a.network === b.network && a.amount === b.amount && isAddressEqual(a.asset, b.asset) && isAddressEqual(a.payTo, b.payTo);
}

function parseBody(body: unknown): { buyer: Address; token: Address; notionalUsd: string; barrierBps: number; quoteId?: string } | string {
  const b = (body ?? {}) as Record<string, unknown>;
  if (typeof b.buyer !== "string" || !isAddress(b.buyer)) return "buyer must be an address";
  if (typeof b.token !== "string" || !isAddress(b.token)) return "token must be an address";
  const notional = String(b.notionalUsd ?? "");
  if (!/^\d+$/.test(notional)) return "notionalUsd must be USDT atomic units (6 decimals), e.g. 1000000000 for $1,000";
  const barrier = Number(b.barrierBps);
  if (!Number.isInteger(barrier) || barrier <= 0) return "barrierBps must be a positive integer, e.g. 500 for a -5% floor";
  return { buyer: getAddress(b.buyer), token: getAddress(b.token), notionalUsd: notional, barrierBps: barrier, quoteId: typeof b.quoteId === "string" ? b.quoteId : undefined };
}

async function offer(req: Request, res: Response, p: Exclude<ReturnType<typeof parseBody>, string>): Promise<void> {
  const dep = await deployment();
  const q = await fetchQuote(p);
  if (!q.signature) {
    res.status(503).json({ error: "pricing server has no quote signer configured" });
    return;
  }
  const tok = dep.tokens.find((t) => isAddressEqual(t.address, p.token));
  const ticker = tok?.ticker ?? "stock";
  const requirements: PaymentRequirements = {
    scheme: "exact",
    network: `eip155:${AH.chainId}`,
    amount: q.quote.premiumUsd,
    asset: dep.contracts.USDT,
    payTo: agentAddress(),
    maxTimeoutSeconds: AH.offerTtlSec,
    extra: { assetTransferMethod: "permit2", name: "USDT", decimals: 6 },
  };
  const usd = (a: string) => (Number(a) / 1e6).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
  const required: PaymentRequired = {
    x402Version: X402_VERSION,
    error: "payment required to bind this weekend floor",
    resource: {
      url: `${AH.publicUrl}/cover/bind`,
      description: `Weekend floor on ${usd(p.notionalUsd)} of ${ticker} at -${(p.barrierBps / 100).toFixed(0)}% for the weekend closing ${new Date(q.quote.epochId * 1000).toUTCString()}`,
      mimeType: "application/json",
    },
    accepts: [requirements],
  };
  prune();
  const expiresAt = Math.min(q.quote.expiry, Math.floor(Date.now() / 1000) + AH.offerTtlSec);
  offers.set(q.quote.nonce, { quote: q, requirements, required, ticker, expiresAt });
  res
    .status(402)
    .set(HEADER_PAYMENT_REQUIRED, encodeHeader(required))
    .json({
      ...required,
      quoteId: q.quote.nonce,
      offer: {
        ticker,
        token: p.token,
        buyer: p.buyer,
        notionalUsd: p.notionalUsd,
        barrierBps: p.barrierBps,
        premiumUsd: q.quote.premiumUsd,
        epochId: q.quote.epochId,
        payableUntil: expiresAt,
        maxPayoutUsd: ((BigInt(p.notionalUsd) * 2000n) / 10_000n).toString(),
        estimatedValue: q.estimatedValue ?? null,
      },
    });
}

async function paid(req: Request, res: Response, p: Exclude<ReturnType<typeof parseBody>, string>, header: string): Promise<void> {
  let payload: PaymentPayload;
  try {
    payload = decodeHeader<PaymentPayload>(header);
  } catch {
    res.status(400).json({ error: "PAYMENT-SIGNATURE is not base64 JSON" });
    return;
  }
  const o = p.quoteId ? offers.get(p.quoteId) : undefined;
  if (!o || o.expiresAt < Date.now() / 1000) {
    res.status(410).json({ error: "unknown or expired offer; POST again without payment for a fresh 402" });
    return;
  }
  const q = o.quote.quote;
  const payer = payload.payload?.permit2Authorization?.from;
  if (!isAddressEqual(q.buyer, p.buyer) || !isAddressEqual(q.token, p.token) || q.notionalUsd !== p.notionalUsd || q.barrierBps !== p.barrierBps) {
    res.status(400).json({ error: "request does not match the offer it pays for" });
    return;
  }
  if (!payload.accepted || !sameRequirements(payload.accepted, o.requirements)) {
    res.status(400).json({ error: "payment does not match the offered requirements" });
    return;
  }
  if (!payer || !isAddressEqual(payer, q.buyer)) {
    res.status(400).json({ error: "the buyer must pay for their own cover" });
    return;
  }
  offers.delete(p.quoteId!); // single use, even if settlement fails below

  const v = await facilitator<VerifyResponse>("verify", payload, o.requirements);
  if (!v.isValid) {
    res.status(402).set(HEADER_PAYMENT_REQUIRED, encodeHeader({ ...o.required, error: v.invalidReason })).json({ ...o.required, error: v.invalidReason });
    return;
  }
  const s = await facilitator<SettleResponse>("settle", payload, o.requirements);
  if (!s.success) {
    res.status(402).set(HEADER_PAYMENT_REQUIRED, encodeHeader({ ...o.required, error: s.errorReason })).json({ ...o.required, error: s.errorReason });
    return;
  }

  // the premium is in Kip's wallet now: bind the policy for the buyer, or give the money back
  const dep = await deployment();
  const market = dep.contracts.CoverMarket;
  try {
    const allowance = await publicClient.readContract({ address: dep.contracts.USDT, abi: ERC20_ABI, functionName: "allowance", args: [agentAddress(), market] });
    if (allowance < BigInt(q.premiumUsd)) await sendTx(dep.contracts.USDT, encode(ERC20_ABI, "approve", [market, MAX_UINT]));
    const quoteArg = { ...q, epochId: BigInt(q.epochId), notionalUsd: BigInt(q.notionalUsd), premiumUsd: BigInt(q.premiumUsd), expiry: BigInt(q.expiry), nonce: BigInt(q.nonce) };
    const { hash, receipt } = await sendTx(market, encode(MARKET_ABI, "coverFor", [quoteArg, o.quote.signature as Hex]));
    const policyId = policyIdFrom(receipt, market);
    if (policyId !== null) track(policyId);
    res
      .status(200)
      .set(HEADER_PAYMENT_RESPONSE, encodeHeader(s))
      .json({
        ok: true,
        policyId: policyId?.toString() ?? null,
        bindTx: hash,
        paymentTx: s.transaction ?? null,
        chainId: AH.chainId,
        explorer: dep.explorer,
        ticker: o.ticker,
        premiumUsd: q.premiumUsd,
        notionalUsd: q.notionalUsd,
        barrierBps: q.barrierBps,
        epochId: q.epochId,
        beneficiary: q.buyer,
        underwriter: agentAddress(),
      });
  } catch (e) {
    const reason = ((e as Error).message.split("\n")[0] ?? "bind failed").slice(0, 200);
    let refundTx: Hex | null = null;
    try {
      refundTx = (await sendTx(dep.contracts.USDT, encode(ERC20_ABI, "transfer", [payer, BigInt(q.premiumUsd)]))).hash;
    } catch (re) {
      console.error("[kip] refund failed", (re as Error).message);
    }
    res.status(502).json({ ok: false, error: `payment received but binding failed: ${reason}`, paymentTx: s.transaction ?? null, refundTx });
  }
}

export const bindCoverRouter = express.Router();

bindCoverRouter.post("/cover/bind", express.json({ limit: "64kb" }), async (req, res) => {
  const p = parseBody(req.body);
  if (typeof p === "string") {
    res.status(400).json({ error: p });
    return;
  }
  try {
    const header = req.header(HEADER_PAYMENT_SIGNATURE);
    if (header) await paid(req, res, p, header);
    else await offer(req, res, p);
  } catch (e) {
    const status = e instanceof UpstreamError ? (e.status >= 500 ? 502 : e.status) : 500;
    res.status(status).json({ error: (e as Error).message });
  }
});
