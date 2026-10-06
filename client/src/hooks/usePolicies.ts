"use client";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAccount, useReadContracts } from "wagmi";
import type { Address } from "viem";
import { api } from "@/lib/api";
import { CoverMarketAbi, POLICY_STATUS, ReferenceOracleAbi, ZERO_ADDRESS } from "@/lib/contracts";
import { toBig } from "@/lib/format";
import type { ApiPolicy, PolicyStats } from "@/lib/types";
import { useDeployment } from "./useDeployment";

export interface PolicyRow {
  policyId: bigint;
  symbol: string;
  ticker?: string;
  epochId: number;
  expectedOpen?: number;
  notionalUsd: bigint;
  barrierBps: number;
  premiumUsd: bigint;
  payoutUsd?: bigint;
  gapBps?: bigint | null;
  status: number;
  txHash?: string;
  settleable: boolean;
}

function statusNum(s: ApiPolicy["status"]): number {
  if (typeof s === "number") return s;
  const m: Record<string, number> = { none: 0, open: 1, settled: 2, refunded: 3, protected: 1 };
  return m[String(s).toLowerCase()] ?? Number(s) ?? 0;
}

const REFRESH_MS = 15_000;

/**
 * The connected wallet's policies, merged from two sources so a new purchase shows up as soon as its block is mined:
 * - the chain, always: `policiesOf(wallet)` is one cheap call, and any policy the server hasn't indexed yet is read
 *   straight from `getPolicy` (the server's indexer can trail the chain by a minute, longer if its free instance slept);
 * - the server index, when it answers: richer rows (tx hash, expected open) and settleable flags for what it knows.
 */
export function usePolicies() {
  const { address } = useAccount();
  const { chainId, deployment, tokens, epochs } = useDeployment();
  const market = deployment?.contracts.CoverMarket;
  const oracle = deployment?.contracts.ReferenceOracle;
  const symbolOf = (addr: Address) => tokens.find((t) => t.address.toLowerCase() === addr.toLowerCase());

  const srv = useQuery({
    queryKey: ["policies", address, chainId],
    queryFn: () => api.policies(address!, chainId),
    enabled: !!address,
    staleTime: 10_000,
    refetchInterval: REFRESH_MS,
    retry: false,
  });
  const serverUp = !!srv.data;

  // the wallet's policy ids, straight from the contract, whether or not the server answered
  const ids = useReadContracts({
    contracts: [{ address: market, abi: CoverMarketAbi, functionName: "policiesOf", args: [address ?? ZERO_ADDRESS], chainId }],
    query: { enabled: !!market && !!address, refetchInterval: REFRESH_MS },
  });
  const idsResult = ids.data?.[0]?.result as readonly bigint[] | undefined;

  // ids the server doesn't have yet (all of them when the server is down) are read from the chain
  const serverIds = useMemo(() => new Set((srv.data?.policies ?? []).map((p) => toBig(p.policyId).toString())), [srv.data]);
  const chainOnlyIds = useMemo(() => (idsResult ?? []).filter((id) => !serverIds.has(id.toString())), [idsResult, serverIds]);

  const details = useReadContracts({
    contracts: chainOnlyIds.map((id) => ({ address: market, abi: CoverMarketAbi, functionName: "getPolicy" as const, args: [id] as const, chainId })),
    query: { enabled: chainOnlyIds.length > 0, refetchInterval: REFRESH_MS },
  });
  type OnChain = { token: Address; epochId: bigint; notionalUsd: bigint; barrierBps: number; premiumUsd: bigint; payoutUsd: bigint; gapBps: bigint; status: number };
  const chainPolicies = useMemo(
    () => (details.data ?? []).map((d, i) => ({ id: chainOnlyIds[i]!, p: d.result as OnChain | undefined })).filter((x) => x.p),
    [details.data, chainOnlyIds],
  );
  const openChainPolicies = useMemo(() => chainPolicies.filter((x) => x.p!.status === POLICY_STATUS.Open), [chainPolicies]);
  const settleableReads = useReadContracts({
    contracts: openChainPolicies.map((x) => ({ address: oracle, abi: ReferenceOracleAbi, functionName: "isSettleable" as const, args: [x.p!.token, x.p!.epochId] as const, chainId })),
    query: { enabled: !!oracle && oracle !== ZERO_ADDRESS && openChainPolicies.length > 0, refetchInterval: REFRESH_MS },
  });

  const rows: PolicyRow[] = useMemo(() => {
    const fromServer: PolicyRow[] = (srv.data?.policies ?? []).map((p) => {
      const t = symbolOf(p.token);
      const epochId = Number(p.epochId);
      const st = statusNum(p.status);
      return {
        policyId: toBig(p.policyId),
        symbol: p.symbol ?? t?.symbol ?? "?",
        ticker: p.ticker ?? t?.ticker,
        epochId,
        expectedOpen: p.expectedOpen ?? epochs.find((e) => e.epochId === epochId)?.expectedOpen,
        notionalUsd: toBig(p.notionalUsd),
        barrierBps: Number(p.barrierBps),
        premiumUsd: toBig(p.premiumUsd),
        payoutUsd: toBig(p.payoutUsd),
        gapBps: p.gapBps === null || p.gapBps === undefined ? null : toBig(p.gapBps),
        status: st,
        txHash: p.txHash,
        settleable: !!p.settleable && st === POLICY_STATUS.Open,
      };
    });
    let k = 0;
    const fromChain: PolicyRow[] = chainPolicies.map(({ id, p }) => {
      const t = symbolOf(p!.token);
      const isOpen = p!.status === POLICY_STATUS.Open;
      const s = isOpen ? (settleableReads.data?.[k++]?.result as readonly [boolean, boolean] | undefined) : undefined;
      const epochId = Number(p!.epochId);
      return {
        policyId: id,
        symbol: t?.symbol ?? "?",
        ticker: t?.ticker,
        epochId,
        expectedOpen: epochs.find((e) => e.epochId === epochId)?.expectedOpen,
        notionalUsd: p!.notionalUsd,
        barrierBps: p!.barrierBps,
        premiumUsd: p!.premiumUsd,
        payoutUsd: p!.payoutUsd,
        gapBps: p!.status === POLICY_STATUS.Settled ? p!.gapBps : null,
        status: p!.status,
        settleable: isOpen && !!s && (s[0] || s[1]),
      };
    });
    return [...fromServer, ...fromChain].sort((a, b) => b.epochId - a.epochId || Number(b.policyId - a.policyId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [srv.data, chainPolicies, settleableReads.data, tokens, epochs]);

  const stats: PolicyStats = useMemo(() => {
    // the server's stats are only complete when it already knows every policy the chain has
    if (srv.data?.stats && chainPolicies.length === 0) return srv.data.stats;
    const counted = rows.filter((r) => r.status !== POLICY_STATUS.Refunded);
    const weekends = [...new Set(counted.map((r) => r.epochId))].sort((a, b) => b - a);
    let streak = 0;
    for (let i = 0; i < weekends.length; i++) {
      if (i === 0 || weekends[i - 1]! - weekends[i]! === 7 * 86400) streak++;
      else break;
    }
    return {
      weekendsProtected: weekends.length,
      currentStreak: streak,
      longestStreak: Math.max(streak, srv.data?.stats?.longestStreak ?? 0),
      premiumsPaid: rows.reduce((a, r) => a + r.premiumUsd, 0n).toString(),
      payoutsReceived: rows.reduce((a, r) => a + (r.payoutUsd ?? 0n), 0n).toString(),
      floorsHeld: rows.filter((r) => r.status === POLICY_STATUS.Settled && (r.payoutUsd ?? 0n) === 0n).length,
      floorsPaid: rows.filter((r) => r.status === POLICY_STATUS.Settled && (r.payoutUsd ?? 0n) > 0n).length,
    };
  }, [srv.data, rows, chainPolicies.length]);

  // show rows as soon as either source has them; only spin while neither has answered
  const loading = rows.length === 0 && (srv.isLoading || ids.isLoading || (chainOnlyIds.length > 0 && details.isLoading));
  const refetch = () => {
    srv.refetch();
    ids.refetch();
    details.refetch();
  };
  return { rows, stats, loading, serverUp, refetch, chainId, market };
}
