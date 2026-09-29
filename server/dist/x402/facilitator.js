"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.facilitatorAddress = facilitatorAddress;
exports.supported = supported;
exports.verify = verify;
exports.settle = settle;
/**
 * Testnet x402 facilitator (x402 v2, exact scheme, Permit2 method): the stand-in for Binance's b402 facilitator,
 * which only serves BSC testnet inside Binance's internal QA environment. Same verify/settle contract as any x402
 * facilitator, so an agent switches to b402 on mainnet by changing its facilitator URL.
 *
 * Settlement goes through the canonical x402ExactPermit2Proxy. The payer's Permit2 witness fixes the recipient, so
 * this service only pays gas and cannot redirect funds. To avoid being a free gas tap for arbitrary x402 sellers it
 * settles only our marketplace's payments: our chains, our test USDT, and an authorised binder as payTo.
 */
const viem_1 = require("viem");
const accounts_1 = require("viem/accounts");
const chains_1 = require("../chains");
const config_1 = require("../config");
const logger_1 = require("../logger");
const store_1 = require("../store");
const x402_1 = require("./x402");
let account;
function facilitatorAccount() {
    if (account !== undefined)
        return account;
    const k = config_1.config.x402.facilitatorPrivateKey.trim();
    try {
        account = k ? (0, accounts_1.privateKeyToAccount)((k.startsWith("0x") ? k : `0x${k}`)) : (0, chains_1.getQuoterAccount)();
    }
    catch {
        account = null;
    }
    return account;
}
function facilitatorAddress() {
    return facilitatorAccount()?.address ?? null;
}
function supported() {
    const addr = facilitatorAddress();
    return {
        kinds: config_1.config.x402.networks.map((id) => ({ x402Version: x402_1.X402_VERSION, scheme: "exact", network: `eip155:${id}`, extra: { assetTransferMethod: "permit2" } })),
        extensions: [],
        signers: addr ? { "eip155:*": [addr] } : {},
    };
}
/** marketplace policy on top of the spec checks */
function policy(r) {
    if (!config_1.config.x402.facilitatorEnabled)
        return "facilitator_disabled";
    const chainId = (0, x402_1.chainIdOf)(r.network);
    if (!config_1.config.x402.networks.includes(chainId))
        return "unsupported_network";
    const c = (0, config_1.getChain)(chainId);
    if (!c?.contracts.USDT || !(0, viem_1.isAddressEqual)(r.asset, c.contracts.USDT))
        return "unsupported_asset";
    if (!c.binders.some((b) => (0, viem_1.isAddressEqual)(b, r.payTo)))
        return "payto_not_allowed";
    return null;
}
async function verify(p, r) {
    const denied = policy(r);
    if (denied)
        return { isValid: false, invalidReason: denied, payer: p?.payload?.permit2Authorization?.from };
    return (0, x402_1.verifyPermit2Payment)((0, chains_1.getPublicClient)((0, x402_1.chainIdOf)(r.network)), p, r);
}
async function settle(p, r) {
    const network = r.network;
    const chainId = (0, x402_1.chainIdOf)(network);
    const v = await verify(p, r);
    if (!v.isValid)
        return { success: false, network, payer: v.payer, errorReason: v.invalidReason };
    const acct = facilitatorAccount();
    const c = (0, config_1.getChain)(chainId);
    if (!acct || !c)
        return { success: false, network, payer: v.payer, errorReason: "facilitator_not_configured" };
    const wallet = (0, viem_1.createWalletClient)({ account: acct, chain: c.viemChain, transport: (0, viem_1.http)(c.rpcUrl, { timeout: 20_000, retryCount: 1 }) });
    try {
        const hash = await wallet.writeContract({ address: x402_1.EXACT_PERMIT2_PROXY, abi: x402_1.EXACT_PERMIT2_PROXY_ABI, functionName: "settle", args: (0, x402_1.settleArgs)(p) });
        const receipt = await (0, chains_1.getPublicClient)(chainId).waitForTransactionReceipt({ hash, timeout: 60_000 });
        if (receipt.status !== "success")
            throw new Error(`settlement reverted in ${hash}`);
        const amount = p.payload.permit2Authorization.permitted.amount;
        await store_1.store.agentEvents.add({
            chainId,
            kind: "x402_settled",
            payer: v.payer ?? null,
            payee: r.payTo,
            amount,
            tx: hash,
            policyId: null,
            note: `x402 payment of ${(Number(amount) / 1e6).toFixed(2)} USDT settled to the underwriting agent`,
            meta: { resource: p.resource?.url ?? null, block: Number(receipt.blockNumber) },
            at: new Date(),
        });
        logger_1.logger.info({ chainId, payer: v.payer, payTo: r.payTo, amount, tx: hash }, "x402 settled");
        return { success: true, transaction: hash, network, payer: v.payer };
    }
    catch (e) {
        const msg = e.message.split("\n")[0] ?? "settlement_failed";
        logger_1.logger.warn({ chainId, payer: v.payer, err: msg }, "x402 settlement failed");
        return { success: false, network, payer: v.payer, errorReason: `settlement_failed: ${msg.slice(0, 160)}` };
    }
}
//# sourceMappingURL=facilitator.js.map