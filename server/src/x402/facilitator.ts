/**
 * Testnet x402 facilitator (x402 v2, exact scheme, Permit2 method): the stand-in for Binance's b402 facilitator,
 * which only serves BSC testnet inside Binance's internal QA environment. Same verify/settle contract as any x402
 * facilitator, so an agent switches to b402 on mainnet by changing its facilitator URL.
 *
 * Settlement goes through the canonical x402ExactPermit2Proxy. The payer's Permit2 witness fixes the recipient, so
 * this service only pays gas and cannot redirect funds. To avoid being a free gas tap for arbitrary x402 sellers it
 * settles only our marketplace's payments: our chains, our test USDT, and an authorised binder as payTo.
 */
import { createWalletClient, http, isAddressEqual, type Address, type Hex } from "viem";
import { privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";
import { getPublicClient, getQuoterAccount } from "../chains";
import { config, getChain } from "../config";
import { logger } from "../logger";
import { store } from "../store";
import {
  EXACT_PERMIT2_PROXY,
  EXACT_PERMIT2_PROXY_ABI,
  X402_VERSION,
  chainIdOf,
  settleArgs,
  verifyPermit2Payment,
  type PaymentPayload,
  type PaymentRequirements,
  type SettleResponse,
  type VerifyResponse,
} from "./x402";

let fixedAccount: PrivateKeyAccount | null | undefined;

/** X402_FACILITATOR_PRIVATE_KEY when set (every chain), otherwise the chain quoter signer (QUOTER_PRIVATE_KEY_<chainId> or QUOTER_PRIVATE_KEY). */
function facilitatorAccount(chainId: number): PrivateKeyAccount | null {
  if (fixedAccount === undefined) {
    const k = config.x402.facilitatorPrivateKey.trim();
    try {
      fixedAccount = k ? privateKeyToAccount((k.startsWith("0x") ? k : `0x${k}`) as Hex) : null;
    } catch {
      fixedAccount = null;
    }
  }
  return fixedAccount ?? getQuoterAccount(chainId);
}

export function facilitatorAddress(chainId: number): Address | null {
  return facilitatorAccount(chainId)?.address ?? null;
}

export function supported() {
  const signers: Record<string, Address[]> = {};
  for (const id of config.x402.networks) {
    const addr = facilitatorAddress(id);
    if (addr) signers[`eip155:${id}`] = [addr];
  }
  return {
    kinds: config.x402.networks.map((id) => ({ x402Version: X402_VERSION, scheme: "exact", network: `eip155:${id}`, extra: { assetTransferMethod: "permit2" } })),
    extensions: [],
    signers,
  };
}

/** marketplace policy on top of the spec checks */
function policy(r: PaymentRequirements): string | null {
  if (!config.x402.facilitatorEnabled) return "facilitator_disabled";
  const chainId = chainIdOf(r.network);
  if (!config.x402.networks.includes(chainId)) return "unsupported_network";
  const c = getChain(chainId);
  if (!c?.contracts.USDT || !isAddressEqual(r.asset, c.contracts.USDT)) return "unsupported_asset";
  if (!c.binders.some((b) => isAddressEqual(b, r.payTo))) return "payto_not_allowed";
  return null;
}

export async function verify(p: PaymentPayload, r: PaymentRequirements): Promise<VerifyResponse> {
  const denied = policy(r);
  if (denied) return { isValid: false, invalidReason: denied, payer: p?.payload?.permit2Authorization?.from };
  return verifyPermit2Payment(getPublicClient(chainIdOf(r.network)), p, r);
}

export async function settle(p: PaymentPayload, r: PaymentRequirements): Promise<SettleResponse> {
  const network = r.network;
  const chainId = chainIdOf(network);
  const v = await verify(p, r);
  if (!v.isValid) return { success: false, network, payer: v.payer, errorReason: v.invalidReason };
  const acct = facilitatorAccount(chainId);
  const c = getChain(chainId);
  if (!acct || !c) return { success: false, network, payer: v.payer, errorReason: "facilitator_not_configured" };

  const wallet = createWalletClient({ account: acct, chain: c.viemChain, transport: http(c.rpcUrl, { timeout: 20_000, retryCount: 1 }) });
  try {
    const hash = await wallet.writeContract({ address: EXACT_PERMIT2_PROXY, abi: EXACT_PERMIT2_PROXY_ABI, functionName: "settle", args: settleArgs(p) as never });
    const receipt = await getPublicClient(chainId).waitForTransactionReceipt({ hash, timeout: 60_000 });
    if (receipt.status !== "success") throw new Error(`settlement reverted in ${hash}`);
    const amount = p.payload.permit2Authorization.permitted.amount;
    await store.agentEvents.add({
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
    logger.info({ chainId, payer: v.payer, payTo: r.payTo, amount, tx: hash }, "x402 settled");
    return { success: true, transaction: hash, network, payer: v.payer };
  } catch (e) {
    const msg = (e as Error).message.split("\n")[0] ?? "settlement_failed";
    logger.warn({ chainId, payer: v.payer, err: msg }, "x402 settlement failed");
    return { success: false, network, payer: v.payer, errorReason: `settlement_failed: ${msg.slice(0, 160)}` };
  }
}
