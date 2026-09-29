"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EXACT_PERMIT2_PROXY_ABI = exports.PERMIT2_WITNESS_TYPES = exports.chainIdOf = exports.HEADER_PAYMENT_RESPONSE = exports.HEADER_PAYMENT_SIGNATURE = exports.HEADER_PAYMENT_REQUIRED = exports.EXACT_PERMIT2_PROXY = exports.PERMIT2_ADDRESS = exports.X402_VERSION = void 0;
exports.encodeHeader = encodeHeader;
exports.decodeHeader = decodeHeader;
exports.permit2Domain = permit2Domain;
exports.permit2TypedData = permit2TypedData;
exports.randomPermit2Nonce = randomPermit2Nonce;
exports.createPermit2Payment = createPermit2Payment;
exports.settleArgs = settleArgs;
exports.verifyPermit2Payment = verifyPermit2Payment;
// GENERATED from shared/x402/x402.ts by shared/hermee/sync.mjs; do not edit this copy.
/**
 * x402 v2, "exact" scheme, Permit2 transfer method, for EVM chains. Single source of truth, copied into
 * server/src/x402, agents/kip and agents/hermee by their build scripts (do not edit the copies).
 *
 * Spec: https://github.com/coinbase/x402/blob/main/specs/schemes/exact/scheme_exact_evm.md
 * - The payer signs a Permit2 PermitWitnessTransferFrom whose spender is the canonical x402ExactPermit2Proxy and
 *   whose witness commits to the recipient (`to` = payTo) and a not-before time. The proxy enforces the recipient,
 *   so whoever submits the settlement (the facilitator) cannot redirect funds.
 * - Headers: server -> client `PAYMENT-REQUIRED` (with HTTP 402), client -> server `PAYMENT-SIGNATURE`,
 *   server -> client `PAYMENT-RESPONSE`. Each carries base64-encoded JSON.
 * - Permit2 and the proxy share one address on every chain (checked on BSC testnet and mainnet), so the same code
 *   works on eip155:97 with our facilitator and on eip155:56 with Binance's b402 facilitator.
 *
 * Depends on viem only, and runs in Node and the browser.
 */
const viem_1 = require("viem");
exports.X402_VERSION = 2;
exports.PERMIT2_ADDRESS = "0x000000000022D473030F116dDEE9F6B43aC78BA3";
exports.EXACT_PERMIT2_PROXY = "0x402085c248EeA27D92E8b30b2C58ed07f9E20001";
exports.HEADER_PAYMENT_REQUIRED = "PAYMENT-REQUIRED";
exports.HEADER_PAYMENT_SIGNATURE = "PAYMENT-SIGNATURE";
exports.HEADER_PAYMENT_RESPONSE = "PAYMENT-RESPONSE";
// ------------------------------------------------------------------ headers
function encodeHeader(value) {
    const json = JSON.stringify(value);
    if (typeof Buffer !== "undefined")
        return Buffer.from(json, "utf8").toString("base64");
    return btoa(String.fromCharCode(...new TextEncoder().encode(json)));
}
function decodeHeader(value) {
    if (typeof Buffer !== "undefined")
        return JSON.parse(Buffer.from(value, "base64").toString("utf8"));
    return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(value), (c) => c.charCodeAt(0))));
}
const chainIdOf = (network) => Number(network.split(":")[1]);
exports.chainIdOf = chainIdOf;
// ------------------------------------------------------------------ Permit2 typed data
exports.PERMIT2_WITNESS_TYPES = {
    PermitWitnessTransferFrom: [
        { name: "permitted", type: "TokenPermissions" },
        { name: "spender", type: "address" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" },
        { name: "witness", type: "Witness" },
    ],
    TokenPermissions: [
        { name: "token", type: "address" },
        { name: "amount", type: "uint256" },
    ],
    Witness: [
        { name: "to", type: "address" },
        { name: "validAfter", type: "uint256" },
    ],
};
function permit2Domain(chainId) {
    return { name: "Permit2", chainId, verifyingContract: exports.PERMIT2_ADDRESS };
}
function permit2TypedData(auth, chainId) {
    return {
        domain: permit2Domain(chainId),
        types: exports.PERMIT2_WITNESS_TYPES,
        primaryType: "PermitWitnessTransferFrom",
        message: {
            permitted: { token: auth.permitted.token, amount: BigInt(auth.permitted.amount) },
            spender: auth.spender,
            nonce: BigInt(auth.nonce),
            deadline: BigInt(auth.deadline),
            witness: { to: auth.witness.to, validAfter: BigInt(auth.witness.validAfter) },
        },
    };
}
/** Permit2 signature-transfer nonces are unordered (a bitmap), so a random 256-bit value is the standard choice. */
function randomPermit2Nonce() {
    const b = new Uint8Array(32);
    globalThis.crypto.getRandomValues(b);
    return BigInt("0x" + Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("")).toString();
}
/**
 * Build a PAYMENT-SIGNATURE payload for one of the server's accepted requirements.
 * `sign` abstracts the wallet: a viem account locally, the user's browser wallet, or `baw sign-message` on mainnet.
 */
async function createPermit2Payment(opts) {
    const { requirements: r } = opts;
    if (r.scheme !== "exact" || r.extra?.assetTransferMethod !== "permit2")
        throw new Error("only exact/permit2 is supported");
    const now = opts.nowSec ?? Math.floor(Date.now() / 1000);
    const auth = {
        permitted: { token: (0, viem_1.getAddress)(r.asset), amount: r.amount },
        from: (0, viem_1.getAddress)(opts.from),
        spender: exports.EXACT_PERMIT2_PROXY,
        nonce: randomPermit2Nonce(),
        deadline: String(now + r.maxTimeoutSeconds),
        // a small backdate so clock skew between payer and chain never makes a fresh payment "too early"
        witness: { to: (0, viem_1.getAddress)(r.payTo), validAfter: String(now - 60) },
    };
    const signature = await opts.sign(permit2TypedData(auth, (0, exports.chainIdOf)(r.network)));
    return { x402Version: exports.X402_VERSION, resource: opts.required.resource, accepted: r, payload: { signature, permit2Authorization: auth } };
}
// ------------------------------------------------------------------ facilitator side
const ERC20_ABI = [
    { type: "function", name: "allowance", stateMutability: "view", inputs: [{ name: "o", type: "address" }, { name: "s", type: "address" }], outputs: [{ type: "uint256" }] },
    { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "a", type: "address" }], outputs: [{ type: "uint256" }] },
];
exports.EXACT_PERMIT2_PROXY_ABI = [
    {
        type: "function",
        name: "settle",
        stateMutability: "nonpayable",
        inputs: [
            {
                name: "permit",
                type: "tuple",
                components: [
                    { name: "permitted", type: "tuple", components: [{ name: "token", type: "address" }, { name: "amount", type: "uint256" }] },
                    { name: "nonce", type: "uint256" },
                    { name: "deadline", type: "uint256" },
                ],
            },
            { name: "owner", type: "address" },
            { name: "witness", type: "tuple", components: [{ name: "to", type: "address" }, { name: "validAfter", type: "uint256" }] },
            { name: "signature", type: "bytes" },
        ],
        outputs: [],
    },
    { type: "error", name: "InvalidAmount", inputs: [] },
    { type: "error", name: "InvalidDestination", inputs: [] },
    { type: "error", name: "InvalidOwner", inputs: [] },
    { type: "error", name: "PaymentTooEarly", inputs: [] },
];
function settleArgs(p) {
    const a = p.payload.permit2Authorization;
    return [
        { permitted: { token: a.permitted.token, amount: BigInt(a.permitted.amount) }, nonce: BigInt(a.nonce), deadline: BigInt(a.deadline) },
        a.from,
        { to: a.witness.to, validAfter: BigInt(a.witness.validAfter) },
        p.payload.signature,
    ];
}
/** The seven facilitator checks from the spec, ending with a simulation of the proxy settlement. */
async function verifyPermit2Payment(client, p, r, nowSec) {
    const bad = (invalidReason) => ({ isValid: false, invalidReason, payer: p?.payload?.permit2Authorization?.from });
    if (p?.x402Version !== exports.X402_VERSION)
        return bad("unsupported_x402_version");
    const a = p.payload?.permit2Authorization;
    if (!a || !p.payload.signature)
        return bad("invalid_payload");
    if (r.scheme !== "exact" || r.extra?.assetTransferMethod !== "permit2")
        return bad("unsupported_scheme");
    if (p.accepted?.network !== r.network)
        return bad("network_mismatch");
    const chainId = (0, exports.chainIdOf)(r.network);
    if (client.chain && client.chain.id !== chainId)
        return bad("network_mismatch");
    // 6. token and recipient match the requirements; spender is the canonical proxy
    if (!(0, viem_1.isAddressEqual)(a.permitted.token, r.asset))
        return bad("asset_mismatch");
    if (!(0, viem_1.isAddressEqual)(a.witness.to, r.payTo))
        return bad("recipient_mismatch");
    if (!(0, viem_1.isAddressEqual)(a.spender, exports.EXACT_PERMIT2_PROXY))
        return bad("invalid_spender");
    // 4. amount covers the price
    if (BigInt(a.permitted.amount) < BigInt(r.amount))
        return bad("insufficient_amount");
    // 5. time window
    const now = BigInt(nowSec ?? Math.floor(Date.now() / 1000));
    if (BigInt(a.deadline) <= now)
        return bad("expired");
    if (BigInt(a.witness.validAfter) > now)
        return bad("not_yet_valid");
    // 1. signature recovers to `from`
    const ok = await (0, viem_1.verifyTypedData)({ address: a.from, ...permit2TypedData(a, chainId), signature: p.payload.signature }).catch(() => false);
    if (!ok)
        return bad("invalid_signature");
    // 2. Permit2 allowance and 3. balance
    const [allowance, balance] = await Promise.all([
        client.readContract({ address: r.asset, abi: ERC20_ABI, functionName: "allowance", args: [a.from, exports.PERMIT2_ADDRESS] }),
        client.readContract({ address: r.asset, abi: ERC20_ABI, functionName: "balanceOf", args: [a.from] }),
    ]);
    if (allowance < BigInt(r.amount))
        return bad("permit2_allowance_required");
    if (balance < BigInt(r.amount))
        return bad("insufficient_funds");
    // 7. simulate the settlement
    try {
        await client.simulateContract({ address: exports.EXACT_PERMIT2_PROXY, abi: exports.EXACT_PERMIT2_PROXY_ABI, functionName: "settle", args: settleArgs(p) });
    }
    catch (e) {
        return bad(`simulation_failed: ${(e.message.split("\n")[0] ?? "error").slice(0, 160)}`);
    }
    return { isValid: true, payer: a.from };
}
//# sourceMappingURL=x402.js.map