/**
 * BawPayer: Hermee's agent pays through the Binance Agentic Wallet CLI (`baw`, skill binance-agentic-wallet 1.12.0).
 * Mainnet only: the Agentic Wallet supports BSC (56), Base and Solana for x402, and has no testnet.
 *
 *   baw x402-payment preview --paymentRequirements <PAYMENT-REQUIRED header> --json
 *     -> paymentId, options[] (index is 1-based; status READY_TO_SIGN | ACTION_REQUIRED | NOT_SIGNABLE)
 *   baw x402-payment sign --paymentId <id> --selectedIndex <n> --json
 *     -> paymentHeaderName ("PAYMENT-SIGNATURE"), paymentHeaderValue, approveTxHash (Permit2 approve, if it was needed)
 *
 * The MPC key never leaves Binance; spending limits and token scope are set by the human in the Binance App.
 * Guardrails from the skill: confirm with the user before `sign`, never switch option/token/network silently,
 * retry at most once. `protectWeekend` enforces the budget and one-retry rules; the CLI adds the confirm prompt.
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { isAddressEqual, type Address, type Hex } from "viem";
import type { HermeePayer } from "./hermee/core";
import { encodeHeader, type PaymentRequired, type PaymentRequirements } from "./x402/x402";

const run = promisify(execFile);

async function baw<T>(args: string[]): Promise<T> {
  const bin = process.env.BAW_BIN ?? "baw";
  const { stdout } = await run(bin, [...args, "--json"], { timeout: 120_000, maxBuffer: 4 * 1024 * 1024, shell: process.platform === "win32" });
  const out = JSON.parse(stdout) as T & { error?: unknown; code?: unknown };
  if ((out as { error?: unknown }).error) throw new Error(`baw ${args[0]} ${args[1] ?? ""}: ${JSON.stringify((out as { error?: unknown }).error)}`);
  return out;
}

interface PreviewOption {
  index: number;
  status: "READY_TO_SIGN" | "ACTION_REQUIRED" | "NOT_SIGNABLE";
  reasons?: string[];
  scheme: string;
  assetTransferMethod?: string;
  binanceChainId: string | number;
  tokenAddress: Address;
  amount: string;
  payTo: Address;
  userWalletAddress: Address;
  needApproveFirst?: boolean;
}

export async function bawAddress(): Promise<Address> {
  // the Agentic Wallet's EVM address, as shown by `baw wallet view`
  const v = await baw<{ addresses?: { chain?: string; address: Address }[]; evmAddress?: Address; address?: Address }>(["wallet", "view"]);
  const a = v.evmAddress ?? v.address ?? v.addresses?.find((x) => !x.chain || /bsc|evm|eth/i.test(x.chain))?.address;
  if (!a) throw new Error("could not read the Agentic Wallet address from `baw wallet view`");
  return a;
}

export function bawPayer(address: Address): HermeePayer {
  return {
    address,
    kind: "baw",
    async pay(required: PaymentRequired, requirements: PaymentRequirements) {
      const preview = await baw<{ paymentId: string; options: PreviewOption[] }>(["x402-payment", "preview", "--paymentRequirements", encodeHeader(required)]);
      // pick exactly the option we agreed to: same recipient, asset and amount (never substitute silently)
      const opt = preview.options.find((o) => isAddressEqual(o.payTo, requirements.payTo) && isAddressEqual(o.tokenAddress, requirements.asset) && o.amount === requirements.amount);
      if (!opt) throw new Error("the Agentic Wallet offered no payment option matching Kip's requirements");
      if (opt.status === "NOT_SIGNABLE") throw new Error(`the Agentic Wallet cannot sign this payment: ${(opt.reasons ?? []).join(", ") || "not signable"}`);
      const signed = await baw<{ paymentHeaderName: string; paymentHeaderValue: string; approveTxHash: Hex | null; signatureExpiresAt: number }>([
        "x402-payment",
        "sign",
        "--paymentId",
        preview.paymentId,
        "--selectedIndex",
        String(opt.index),
      ]);
      if (signed.paymentHeaderName.toUpperCase() !== "PAYMENT-SIGNATURE") throw new Error(`unexpected header ${signed.paymentHeaderName}`);
      return { header: signed.paymentHeaderValue, approveTx: signed.approveTxHash };
    },
  };
}
