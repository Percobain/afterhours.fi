"use client";
import { useCallback, useState } from "react";
import { usePublicClient, useWriteContract } from "wagmi";
import type { Hash, TransactionReceipt } from "viem";
import { explainError, explorerTx } from "@/lib/contracts";
import { useToast } from "./useToast";

export type TxStatus = "idle" | "signing" | "pending" | "success" | "error";

/**
 * Runs one contract write: wallet signature -> mined receipt, with plain-English toasts.
 * `run` resolves with the receipt or null when the user cancelled / the tx failed.
 */
export function useTx(chainId: number) {
  const { writeContractAsync } = useWriteContract();
  const client = usePublicClient({ chainId });
  const { toast } = useToast();
  const [status, setStatus] = useState<TxStatus>("idle");
  const [hash, setHash] = useState<Hash | undefined>();
  const [error, setError] = useState<string | undefined>();

  const run = useCallback(
    async (
      label: string,
      write: () => Promise<Hash>,
      opts: { successTitle?: string; successBody?: string; silent?: boolean } = {}
    ): Promise<TransactionReceipt | null> => {
      setStatus("signing");
      setError(undefined);
      setHash(undefined);
      try {
        const h = await write();
        setHash(h);
        setStatus("pending");
        if (!opts.silent) toast({ kind: "info", title: `${label} sent`, body: "Waiting for confirmation…", href: explorerTx(chainId, h) });
        if (!client) throw new Error("No RPC client for this chain");
        const receipt = await client.waitForTransactionReceipt({ hash: h, confirmations: 1, timeout: 180_000 });
        if (receipt.status !== "success") throw new Error(`${label} reverted on-chain`);
        setStatus("success");
        if (!opts.silent) toast({ kind: "success", title: opts.successTitle ?? `${label} confirmed`, body: opts.successBody, href: explorerTx(chainId, h) });
        return receipt;
      } catch (e) {
        const msg = explainError(e);
        setError(msg);
        setStatus("error");
        toast({ kind: "error", title: `${label} did not go through`, body: msg });
        return null;
      }
    },
    [chainId, client, toast]
  );

  const reset = useCallback(() => {
    setStatus("idle");
    setHash(undefined);
    setError(undefined);
  }, []);

  return { run, status, hash, error, reset, busy: status === "signing" || status === "pending", writeContractAsync };
}
