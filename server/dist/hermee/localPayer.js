"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.localPayer = localPayer;
// GENERATED from shared/hermee/localPayer.ts by shared/hermee/sync.mjs; do not edit this copy.
/**
 * LocalPayer: Hermee's agent pays with a local key. Used on BSC testnet, where the Binance Agentic Wallet does not
 * exist; it produces exactly the PAYMENT-SIGNATURE that `baw x402-payment sign` produces on mainnet.
 * Also handles testnet setup (faucet test tokens, one-time Permit2 approval). Node only.
 */
const viem_1 = require("viem");
const accounts_1 = require("viem/accounts");
const x402_1 = require("../x402/x402");
const ERC20 = [
    { type: "function", name: "allowance", stateMutability: "view", inputs: [{ name: "o", type: "address" }, { name: "s", type: "address" }], outputs: [{ type: "uint256" }] },
    { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "a", type: "address" }], outputs: [{ type: "uint256" }] },
    { type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{ name: "s", type: "address" }, { name: "v", type: "uint256" }], outputs: [{ type: "bool" }] },
    { type: "function", name: "faucet", stateMutability: "nonpayable", inputs: [], outputs: [] },
];
function localPayer(opts) {
    const account = (0, accounts_1.privateKeyToAccount)(opts.privateKey);
    const publicClient = (0, viem_1.createPublicClient)({ chain: opts.chain, transport: (0, viem_1.http)(opts.rpcUrl, { timeout: 15_000, retryCount: 2 }) });
    const wallet = (0, viem_1.createWalletClient)({ account, chain: opts.chain, transport: (0, viem_1.http)(opts.rpcUrl, { timeout: 20_000, retryCount: 1 }) });
    async function write(address, functionName, args) {
        const hash = await wallet.writeContract({ address, abi: ERC20, functionName, args: args });
        const r = await publicClient.waitForTransactionReceipt({ hash, timeout: 90_000 });
        if (r.status !== "success")
            throw new Error(`${functionName} reverted: ${hash}`);
        return hash;
    }
    const balanceOf = (token) => publicClient.readContract({ address: token, abi: ERC20, functionName: "balanceOf", args: [account.address] });
    /** testnet only: make sure Hermee holds the stock and some USDT, claiming from the MockERC20 faucets if needed */
    async function ensureTestFunds(p) {
        const txs = [];
        if ((await balanceOf(p.token)) < p.minToken)
            txs.push(await write(p.token, "faucet", []));
        if ((await balanceOf(p.usdt)) < p.minUsdt)
            txs.push(await write(p.usdt, "faucet", []));
        return txs;
    }
    const payer = {
        address: account.address,
        kind: "local",
        ensureTestFunds,
        balanceOf,
        async pay(required, requirements) {
            // x402 Permit2 needs a one-time ERC-20 approval of the Permit2 contract (baw's `sign` does the same when needed)
            let approveTx = null;
            const allowance = await publicClient.readContract({ address: requirements.asset, abi: ERC20, functionName: "allowance", args: [account.address, x402_1.PERMIT2_ADDRESS] });
            if (allowance < BigInt(requirements.amount))
                approveTx = await write(requirements.asset, "approve", [x402_1.PERMIT2_ADDRESS, viem_1.maxUint256]);
            const payload = await (0, x402_1.createPermit2Payment)({
                required,
                requirements,
                from: account.address,
                sign: (t) => account.signTypedData(t),
            });
            return { header: (0, x402_1.encodeHeader)(payload), approveTx };
        },
    };
    return payer;
}
//# sourceMappingURL=localPayer.js.map