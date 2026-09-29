/**
 * Kip's on-chain layer. Every write is FIXED code signed by the Studio wallet (`getWallet()`, the agent's sole key):
 * approve USDT to the market, coverFor (bind a paid policy for a buyer), settleBatch, and refunds.
 * Nothing here is reachable from an LLM tool.
 */
import { getWallet } from "@bnbagent/studio-runtime/wallet";
import { createPublicClient, decodeEventLog, encodeFunctionData, http, type Address, type Hex, type TransactionReceipt } from "viem";
import { bsc, bscTestnet } from "viem/chains";
import { AH } from "./config.js";

export const chain = AH.chainId === 56 ? bsc : bscTestnet;
export const publicClient = createPublicClient({ chain, transport: http(AH.rpcUrl, { timeout: 15_000, retryCount: 2, retryDelay: 500 }) });

export const QUOTE_COMPONENTS = [
  { name: "buyer", type: "address" },
  { name: "token", type: "address" },
  { name: "epochId", type: "uint64" },
  { name: "notionalUsd", type: "uint256" },
  { name: "barrierBps", type: "uint16" },
  { name: "premiumUsd", type: "uint256" },
  { name: "expiry", type: "uint64" },
  { name: "nonce", type: "uint256" },
] as const;

export const MARKET_ABI = [
  { type: "function", name: "coverFor", stateMutability: "nonpayable", inputs: [{ name: "q", type: "tuple", components: QUOTE_COMPONENTS }, { name: "signature", type: "bytes" }], outputs: [{ name: "policyId", type: "uint256" }] },
  { type: "function", name: "settleBatch", stateMutability: "nonpayable", inputs: [{ name: "ids", type: "uint256[]" }], outputs: [] },
  { type: "function", name: "isBinder", stateMutability: "view", inputs: [{ name: "a", type: "address" }], outputs: [{ type: "bool" }] },
  {
    type: "function",
    name: "getPolicy",
    stateMutability: "view",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "buyer", type: "address" },
          { name: "token", type: "address" },
          { name: "epochId", type: "uint64" },
          { name: "notionalUsd", type: "uint256" },
          { name: "barrierBps", type: "uint16" },
          { name: "premiumUsd", type: "uint256" },
          { name: "lockedUsd", type: "uint256" },
          { name: "payoutUsd", type: "uint256" },
          { name: "gapBps", type: "int256" },
          { name: "status", type: "uint8" },
          { name: "boughtAt", type: "uint64" },
          { name: "settledAt", type: "uint64" },
        ],
      },
    ],
  },
  {
    type: "event",
    name: "CoverBought",
    inputs: [
      { name: "policyId", type: "uint256", indexed: true },
      { name: "buyer", type: "address", indexed: true },
      { name: "token", type: "address", indexed: true },
      { name: "epochId", type: "uint64", indexed: false },
      { name: "notionalUsd", type: "uint256", indexed: false },
      { name: "barrierBps", type: "uint16", indexed: false },
      { name: "premiumUsd", type: "uint256", indexed: false },
      { name: "lockedUsd", type: "uint256", indexed: false },
    ],
  },
] as const;

export const ORACLE_ABI = [
  { type: "function", name: "isSettleable", stateMutability: "view", inputs: [{ name: "token", type: "address" }, { name: "epochId", type: "uint64" }], outputs: [{ type: "bool" }, { type: "string" }] },
] as const;

export const ERC20_ABI = [
  { type: "function", name: "allowance", stateMutability: "view", inputs: [{ name: "o", type: "address" }, { name: "s", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "a", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{ name: "s", type: "address" }, { name: "v", type: "uint256" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "transfer", stateMutability: "nonpayable", inputs: [{ name: "to", type: "address" }, { name: "v", type: "uint256" }], outputs: [{ type: "bool" }] },
] as const;

export function agentAddress(): Address {
  return (getWallet() as unknown as { address: Address }).address;
}

// one write at a time: the pending nonce is read inside the lock, so concurrent requests never collide
let queue: Promise<unknown> = Promise.resolve();

export function sendTx(to: Address, data: Hex): Promise<{ hash: Hex; receipt: TransactionReceipt }> {
  const run = async () => {
    const from = agentAddress();
    const [nonce, gasPrice, gas] = await Promise.all([
      publicClient.getTransactionCount({ address: from, blockTag: "pending" }),
      publicClient.getGasPrice(),
      publicClient.estimateGas({ account: from, to, data }),
    ]);
    const wallet = getWallet() as unknown as { signTransaction(tx: Record<string, unknown>): Promise<{ rawTransaction: Hex }> };
    const signed = await wallet.signTransaction({ to, data, nonce, gasPrice, gas: (gas * 12n) / 10n, value: 0n, chainId: AH.chainId, type: "legacy" });
    const hash = await publicClient.sendRawTransaction({ serializedTransaction: signed.rawTransaction });
    const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 90_000 });
    if (receipt.status !== "success") throw new Error(`transaction reverted: ${hash}`);
    return { hash, receipt };
  };
  const p = queue.then(run, run);
  queue = p.catch(() => undefined);
  return p;
}

const encodeLoose = encodeFunctionData as unknown as (p: { abi: readonly unknown[]; functionName: string; args: readonly unknown[] }) => Hex;

/** calldata for one of the fixed ABIs above; the typed ABIs keep the call sites honest at review time */
export function encode(abi: readonly unknown[], functionName: string, args: readonly unknown[]): Hex {
  return encodeLoose({ abi, functionName, args });
}

/** policy id from the CoverBought log in a bind receipt */
export function policyIdFrom(receipt: TransactionReceipt, market: Address): bigint | null {
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== market.toLowerCase()) continue;
    try {
      const ev = decodeEventLog({ abi: MARKET_ABI, data: log.data, topics: log.topics });
      if (ev.eventName === "CoverBought") return ev.args.policyId;
    } catch {
      // not a CoverBought log
    }
  }
  return null;
}
