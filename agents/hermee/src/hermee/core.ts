// GENERATED from shared/hermee/core.ts by shared/hermee/sync.mjs; do not edit this copy.
/**
 * Hermee's agent: buys a weekend floor from Kip's underwriting agent over x402. Single source of truth, synced into
 * agents/hermee (CLI + Binance Agentic Wallet skill), server/src/agents (the site's live demo) and the client (so a
 * visitor can be Hermee with their own wallet). Runs in Node and the browser.
 *
 * The payment step is abstracted behind `HermeePayer`, so the same flow runs with:
 *   - LocalPayer:   a local key signs the Permit2 payload (BSC testnet; the Agentic Wallet has no testnet)
 *   - BawPayer:     `baw x402-payment preview/sign` on the Binance Agentic Wallet (BSC mainnet)
 *   - BrowserPayer: the visitor's wallet signs the same typed data
 *
 * Guardrails mirror the Agentic Wallet skill's x402 rules: never pay more than the budget, never pay a different
 * recipient/asset/network than offered, ask before signing when a confirm hook is given, retry at most once.
 */
import { isAddressEqual, type Address, type Hex } from "viem";
import { HEADER_PAYMENT_REQUIRED, HEADER_PAYMENT_RESPONSE, HEADER_PAYMENT_SIGNATURE, decodeHeader, type PaymentRequired, type PaymentRequirements, type SettleResponse } from "../x402/x402";

export type HermeeStep = "ask" | "offer" | "check" | "confirm" | "pay" | "bind" | "done" | "error";

export interface HermeeEvent {
  step: HermeeStep;
  status: "info" | "ok" | "warn" | "error";
  message: string;
  data?: Record<string, unknown>;
  at: string;
}

export interface HermeePayer {
  address: Address;
  kind: "local" | "baw" | "browser";
  /** produce the PAYMENT-SIGNATURE header value for one of the offered requirements */
  pay(required: PaymentRequired, requirements: PaymentRequirements): Promise<{ header: string; approveTx?: Hex | null }>;
}

export interface Offer {
  quoteId: string;
  required: PaymentRequired;
  requirements: PaymentRequirements;
  offer: {
    ticker: string;
    token: Address;
    notionalUsd: string;
    barrierBps: number;
    premiumUsd: string;
    epochId: number;
    payableUntil: number;
    maxPayoutUsd: string;
    estimatedValue?: Record<string, unknown> | null;
  };
}

export interface ProtectRequest {
  /** base URL of Kip's agent, e.g. https://kip.example.com */
  kipUrl: string;
  token: Address;
  /** USDT atomic units (6 decimals) */
  notionalUsd: bigint;
  /** floor below Friday's close, e.g. 500 = -5% */
  barrierBps: number;
  /** the most Hermee will pay, as bps of the protected amount (e.g. 50 = 0.5%) */
  maxPremiumBps: number;
  /** human-in-the-loop hook: return false to walk away (the Agentic Wallet skill asks before every sign) */
  confirm?: (o: Offer) => Promise<boolean>;
  fetchImpl?: typeof fetch;
}

export interface ProtectResult {
  ok: boolean;
  policyId: string | null;
  bindTx: Hex | null;
  paymentTx: Hex | null;
  premiumUsd: string | null;
  offer: Offer | null;
  settlement: SettleResponse | null;
  error?: string;
}

const now = () => new Date().toISOString();
const usd = (atomic: string | bigint) => `$${(Number(atomic) / 1e6).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export async function protectWeekend(req: ProtectRequest, payer: HermeePayer, onEvent: (e: HermeeEvent) => void = () => undefined): Promise<ProtectResult> {
  const emit = (step: HermeeStep, status: HermeeEvent["status"], message: string, data?: Record<string, unknown>) => onEvent({ step, status, message, data, at: now() });
  const f = req.fetchImpl ?? fetch;
  const url = `${req.kipUrl.replace(/\/+$/, "")}/cover/bind`;
  const body = { buyer: payer.address, token: req.token, notionalUsd: req.notionalUsd.toString(), barrierBps: req.barrierBps };
  const fail = (error: string, offer: Offer | null = null): ProtectResult => {
    emit("error", "error", error);
    return { ok: false, policyId: null, bindTx: null, paymentTx: null, premiumUsd: offer?.offer.premiumUsd ?? null, offer, settlement: null, error };
  };

  // 1. ask for cover without paying: Kip answers 402 Payment Required with the price
  emit("ask", "info", `Asking Kip's agent to cover ${usd(req.notionalUsd)} below -${req.barrierBps / 100}%`, { url, buyer: payer.address });
  let res = await f(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  if (res.status !== 402) return fail(`expected 402 Payment Required, got ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const offerBody = (await res.json()) as Omit<Offer, "requirements"> & PaymentRequired;
  const headerRequired = res.headers.get(HEADER_PAYMENT_REQUIRED);
  const required = headerRequired ? decodeHeader<PaymentRequired>(headerRequired) : offerBody;
  const requirements = required.accepts?.[0];
  if (!requirements) return fail("402 carried no payment options");
  const o: Offer = { quoteId: offerBody.quoteId, required, requirements, offer: offerBody.offer };
  emit("offer", "ok", `Kip quotes ${usd(o.offer.premiumUsd)} to cover ${o.offer.ticker} this weekend (max payout ${usd(o.offer.maxPayoutUsd)})`, {
    premiumUsd: o.offer.premiumUsd,
    payTo: requirements.payTo,
    asset: requirements.asset,
    network: requirements.network,
    scheme: `${requirements.scheme}/${requirements.extra.assetTransferMethod}`,
  });

  // 2. guardrails before signing anything
  const budget = (req.notionalUsd * BigInt(req.maxPremiumBps)) / 10_000n;
  if (BigInt(requirements.amount) > budget) return fail(`premium ${usd(requirements.amount)} is above the budget of ${usd(budget)} (${req.maxPremiumBps / 100}% of the amount); not paying`, o);
  if (requirements.amount !== o.offer.premiumUsd) return fail("payment amount differs from the quoted premium; not paying", o);
  if (requirements.scheme !== "exact" || requirements.extra?.assetTransferMethod !== "permit2") return fail(`unsupported payment scheme ${requirements.scheme}`, o);
  emit("check", "ok", `Within budget (${usd(requirements.amount)} of ${usd(budget)} allowed); paying Kip ${requirements.payTo.slice(0, 10)}… on ${requirements.network}`);

  if (req.confirm) {
    emit("confirm", "info", "Waiting for the owner to approve the payment");
    if (!(await req.confirm(o))) return fail("owner declined the payment", o);
  }

  // 3. sign the x402 payment (local key on testnet, baw x402-payment sign on mainnet, or the visitor's wallet)
  emit("pay", "info", `Signing the x402 payment with the ${payer.kind === "baw" ? "Binance Agentic Wallet" : payer.kind === "browser" ? "connected wallet" : "agent's testnet key"}`);
  let signed: { header: string; approveTx?: Hex | null };
  try {
    signed = await payer.pay(required, requirements);
  } catch (e) {
    return fail(`signing failed: ${(e as Error).message}`, o);
  }
  if (signed.approveTx) emit("pay", "info", "Enabled Permit2 for USDT (one-time approval)", { approveTx: signed.approveTx });

  // 4. retry with PAYMENT-SIGNATURE; at most one automatic retry, as the Agentic Wallet guardrails require
  emit("bind", "info", "Sending the signed payment; Kip settles it and binds the policy on-chain");
  res = await f(url, { method: "POST", headers: { "content-type": "application/json", [HEADER_PAYMENT_SIGNATURE]: signed.header }, body: JSON.stringify({ ...body, quoteId: o.quoteId }) });
  const out = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (res.status !== 200 || out.ok !== true) return fail(`Kip did not bind the cover (${res.status}): ${String(out.error ?? "unknown error")}${out.refundTx ? `; premium refunded in ${String(out.refundTx)}` : ""}`, o);
  const settleHeader = res.headers.get(HEADER_PAYMENT_RESPONSE);
  const settlement = settleHeader ? decodeHeader<SettleResponse>(settleHeader) : null;
  if (settlement && out.paymentTx && settlement.transaction && settlement.transaction !== out.paymentTx) emit("bind", "warn", "PAYMENT-RESPONSE and body disagree on the payment transaction");
  if (out.beneficiary && !isAddressEqual(out.beneficiary as Address, payer.address)) return fail("policy was bound to someone else; contact the underwriter", o);

  emit("done", "ok", `Protected: policy #${String(out.policyId)} on ${o.offer.ticker}. If Monday opens below -${req.barrierBps / 100}%, the pool pays this wallet automatically.`, out);
  return { ok: true, policyId: (out.policyId as string) ?? null, bindTx: (out.bindTx as Hex) ?? null, paymentTx: (out.paymentTx as Hex) ?? null, premiumUsd: o.offer.premiumUsd, offer: o, settlement };
}
