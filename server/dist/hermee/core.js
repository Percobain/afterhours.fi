"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.protectWeekend = protectWeekend;
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
const viem_1 = require("viem");
const x402_1 = require("../x402/x402");
const now = () => new Date().toISOString();
const usd = (atomic) => `$${(Number(atomic) / 1e6).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
async function protectWeekend(req, payer, onEvent = () => undefined) {
    const emit = (step, status, message, data) => onEvent({ step, status, message, data, at: now() });
    const f = req.fetchImpl ?? fetch;
    const url = `${req.kipUrl.replace(/\/+$/, "")}/cover/bind`;
    const body = { buyer: payer.address, token: req.token, notionalUsd: req.notionalUsd.toString(), barrierBps: req.barrierBps };
    const fail = (error, offer = null) => {
        emit("error", "error", error);
        return { ok: false, policyId: null, bindTx: null, paymentTx: null, premiumUsd: offer?.offer.premiumUsd ?? null, offer, settlement: null, error };
    };
    // 1. ask for cover without paying: Kip answers 402 Payment Required with the price
    emit("ask", "info", `Asking Kip's agent to cover ${usd(req.notionalUsd)} below -${req.barrierBps / 100}%`, { url, buyer: payer.address });
    let res = await f(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    if (res.status !== 402)
        return fail(`expected 402 Payment Required, got ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const offerBody = (await res.json());
    const headerRequired = res.headers.get(x402_1.HEADER_PAYMENT_REQUIRED);
    const required = headerRequired ? (0, x402_1.decodeHeader)(headerRequired) : offerBody;
    const requirements = required.accepts?.[0];
    if (!requirements)
        return fail("402 carried no payment options");
    const o = { quoteId: offerBody.quoteId, required, requirements, offer: offerBody.offer };
    emit("offer", "ok", `Kip quotes ${usd(o.offer.premiumUsd)} to cover ${o.offer.ticker} this weekend (max payout ${usd(o.offer.maxPayoutUsd)})`, {
        premiumUsd: o.offer.premiumUsd,
        payTo: requirements.payTo,
        asset: requirements.asset,
        network: requirements.network,
        scheme: `${requirements.scheme}/${requirements.extra.assetTransferMethod}`,
    });
    // 2. guardrails before signing anything
    const budget = (req.notionalUsd * BigInt(req.maxPremiumBps)) / 10000n;
    if (BigInt(requirements.amount) > budget)
        return fail(`premium ${usd(requirements.amount)} is above the budget of ${usd(budget)} (${req.maxPremiumBps / 100}% of the amount); not paying`, o);
    if (requirements.amount !== o.offer.premiumUsd)
        return fail("payment amount differs from the quoted premium; not paying", o);
    if (requirements.scheme !== "exact" || requirements.extra?.assetTransferMethod !== "permit2")
        return fail(`unsupported payment scheme ${requirements.scheme}`, o);
    emit("check", "ok", `Within budget (${usd(requirements.amount)} of ${usd(budget)} allowed); paying Kip ${requirements.payTo.slice(0, 10)}… on ${requirements.network}`);
    if (req.confirm) {
        emit("confirm", "info", "Waiting for the owner to approve the payment");
        if (!(await req.confirm(o)))
            return fail("owner declined the payment", o);
    }
    // 3. sign the x402 payment (local key on testnet, baw x402-payment sign on mainnet, or the visitor's wallet)
    emit("pay", "info", `Signing the x402 payment with the ${payer.kind === "baw" ? "Binance Agentic Wallet" : payer.kind === "browser" ? "connected wallet" : "agent's testnet key"}`);
    let signed;
    try {
        signed = await payer.pay(required, requirements);
    }
    catch (e) {
        return fail(`signing failed: ${e.message}`, o);
    }
    if (signed.approveTx)
        emit("pay", "info", "Enabled Permit2 for USDT (one-time approval)", { approveTx: signed.approveTx });
    // 4. retry with PAYMENT-SIGNATURE; at most one automatic retry, as the Agentic Wallet guardrails require
    emit("bind", "info", "Sending the signed payment; Kip settles it and binds the policy on-chain");
    res = await f(url, { method: "POST", headers: { "content-type": "application/json", [x402_1.HEADER_PAYMENT_SIGNATURE]: signed.header }, body: JSON.stringify({ ...body, quoteId: o.quoteId }) });
    const out = (await res.json().catch(() => ({})));
    if (res.status !== 200 || out.ok !== true)
        return fail(`Kip did not bind the cover (${res.status}): ${String(out.error ?? "unknown error")}${out.refundTx ? `; premium refunded in ${String(out.refundTx)}` : ""}`, o);
    const settleHeader = res.headers.get(x402_1.HEADER_PAYMENT_RESPONSE);
    const settlement = settleHeader ? (0, x402_1.decodeHeader)(settleHeader) : null;
    if (settlement && out.paymentTx && settlement.transaction && settlement.transaction !== out.paymentTx)
        emit("bind", "warn", "PAYMENT-RESPONSE and body disagree on the payment transaction");
    if (out.beneficiary && !(0, viem_1.isAddressEqual)(out.beneficiary, payer.address))
        return fail("policy was bound to someone else; contact the underwriter", o);
    emit("done", "ok", `Protected: policy #${String(out.policyId)} on ${o.offer.ticker}. If Monday opens below -${req.barrierBps / 100}%, the pool pays this wallet automatically.`, out);
    return { ok: true, policyId: out.policyId ?? null, bindTx: out.bindTx ?? null, paymentTx: out.paymentTx ?? null, premiumUsd: o.offer.premiumUsd, offer: o, settlement };
}
//# sourceMappingURL=core.js.map