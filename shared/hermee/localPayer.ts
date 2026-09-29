/**
 * LocalPayer: Hermee's agent pays with a local key. Used on BSC testnet, where the Binance Agentic Wallet does not
 * exist; it produces exactly the PAYMENT-SIGNATURE that `baw x402-payment sign` produces on mainnet.
 * Also handles testnet setup (faucet test tokens, one-time Permit2 approval). Node only.
 */
import { createPublicClient, createWalletClient, http, maxUint256, type Address, type Chain, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { PERMIT2_ADDRESS, createPermit2Payment, encodeHeader, type PaymentRequired, type PaymentRequirements } from "../x402/x402";
import type { HermeePayer } from "./core";

const ERC20 = [
  { type: "function", name: "allowance", stateMutability: "view", inputs: [{ name: "o", type: "address" }, { name: "s", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "a", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{ name: "s", type: "address" }, { name: "v", type: "uint256" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "faucet", stateMutability: "nonpayable", inputs: [], outputs: [] },
] as const;

export function localPayer(opts: { privateKey: Hex; chain: Chain; rpcUrl: string }) {
  const account = privateKeyToAccount(opts.privateKey);
  const publicClient = createPublicClient({ chain: opts.chain, transport: http(opts.rpcUrl, { timeout: 15_000, retryCount: 2 }) });
  const wallet = createWalletClient({ account, chain: opts.chain, transport: http(opts.rpcUrl, { timeout: 20_000, retryCount: 1 }) });

  async function write(address: Address, functionName: "approve" | "faucet", args: readonly unknown[]): Promise<Hex> {
    const hash = await wallet.writeContract({ address, abi: ERC20, functionName, args: args as never });
    const r = await publicClient.waitForTransactionReceipt({ hash, timeout: 90_000 });
    if (r.status !== "success") throw new Error(`${functionName} reverted: ${hash}`);
    return hash;
  }

  const balanceOf = (token: Address) => publicClient.readContract({ address: token, abi: ERC20, functionName: "balanceOf", args: [account.address] });

  /** testnet only: make sure Hermee holds the stock and some USDT, claiming from the MockERC20 faucets if needed */
  async function ensureTestFunds(p: { token: Address; minToken: bigint; usdt: Address; minUsdt: bigint }): Promise<Hex[]> {
    const txs: Hex[] = [];
    if ((await balanceOf(p.token)) < p.minToken) txs.push(await write(p.token, "faucet", []));
    if ((await balanceOf(p.usdt)) < p.minUsdt) txs.push(await write(p.usdt, "faucet", []));
    return txs;
  }

  const payer: HermeePayer & { ensureTestFunds: typeof ensureTestFunds; balanceOf: typeof balanceOf } = {
    address: account.address,
    kind: "local",
    ensureTestFunds,
    balanceOf,
    async pay(required: PaymentRequired, requirements: PaymentRequirements) {
      // x402 Permit2 needs a one-time ERC-20 approval of the Permit2 contract (baw's `sign` does the same when needed)
      let approveTx: Hex | null = null;
      const allowance = await publicClient.readContract({ address: requirements.asset, abi: ERC20, functionName: "allowance", args: [account.address, PERMIT2_ADDRESS] });
      if (allowance < BigInt(requirements.amount)) approveTx = await write(requirements.asset, "approve", [PERMIT2_ADDRESS, maxUint256]);
      const payload = await createPermit2Payment({
        required,
        requirements,
        from: account.address,
        sign: (t) => account.signTypedData(t as never),
      });
      return { header: encodeHeader(payload), approveTx };
    },
  };
  return payer;
}
