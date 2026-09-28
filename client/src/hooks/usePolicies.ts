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

/** The connected wallet's policies: server index first (fast, with settleable flags), chain reads as fallback. */
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
    staleTime: 15_000,
    refetchInterval: 30_000,
    retry: false,
  });
  const serverUp = !!srv.data;

  const ids = useReadContracts({
    contracts: [{ address: market, abi: CoverMarketAbi, functionName: "policiesOf", args: [address ?? ZERO_ADDRESS], chainId }],
    query: { enabled: !!market && !!address && !serverUp, refetchInterval: 30_000 },
  });
  const idsResult = ids.data?.[0]?.result as readonly bigint[] | undefined;
  const idList = useMemo(() => idsResult ?? [], [idsResult]);
  const details = useReadContracts({
    contracts: idList.map((id) => ({ address: market, abi: CoverMarketAbi, functionName: "getPolicy" as const, args: [id] as const, chainId })),
    query: { enabled: idList.length > 0 && !serverUp, refetchInterval: 30_000 },
  });
  type OnChain = { token: Address; epochId: bigint; notionalUsd: bigint; barrierBps: number; premiumUsd: bigint; payoutUsd: bigint; gapBps: bigint; status: number };
  const chainPolicies = useMemo(() => (details.data ?? []).map((d, i) => ({ id: idList[i], p: d.result as OnChain | undefined })).filter((x) => x.p), [details.data, idList]);
  const settleableReads = useReadContracts({
    contracts: chainPolicies
      .filter((x) => x.p!.status === POLICY_STATUS.Open)
      .map((x) => ({ address: oracle, abi: ReferenceOracleAbi, functionName: "isSettleable" as const, args: [x.p!.token, x.p!.epochId] as const, chainId })),
    query: { enabled: !!oracle && oracle !== ZERO_ADDRESS && !serverUp && chainPolicies.some((x) => x.p!.status === POLICY_STATUS.Open), refetchInterval: 30_000 },
  });

  const rows: PolicyRow[] = useMemo(() => {
    if (srv.data?.policies) {
      return srv.data.policies
        .map((p) => {
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
        })
        .sort((a, b) => b.epochId - a.epochId || Number(b.policyId - a.policyId));
    }
    let k = 0;
    return chainPolicies
      .map(({ id, p }) => {
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
      })
      .sort((a, b) => b.epochId - a.epochId || Number(b.policyId - a.policyId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [srv.data, chainPolicies, settleableReads.data, tokens, epochs]);

  const stats: PolicyStats = useMemo(() => {
    if (srv.data?.stats) return srv.data.stats;
    const counted = rows.filter((r) => r.status !== POLICY_STATUS.Refunded);
    const weekends = [...new Set(counted.map((r) => r.epochId))].sort((a, b) => b - a);
    let streak = 0;
    for (let i = 0; i < weekends.length; i++) {
      if (i === 0 || weekends[i - 1] - weekends[i] === 7 * 86400) streak++;
      else break;
    }
    return {
      weekendsProtected: weekends.length,
      currentStreak: streak,
      longestStreak: streak,
      premiumsPaid: rows.reduce((a, r) => a + r.premiumUsd, 0n).toString(),
      payoutsReceived: rows.reduce((a, r) => a + (r.payoutUsd ?? 0n), 0n).toString(),
      floorsHeld: rows.filter((r) => r.status === POLICY_STATUS.Settled && (r.payoutUsd ?? 0n) === 0n).length,
      floorsPaid: rows.filter((r) => r.status === POLICY_STATUS.Settled && (r.payoutUsd ?? 0n) > 0n).length,
    };
  }, [srv.data, rows]);

  const loading = srv.isLoading || (!serverUp && (ids.isLoading || details.isLoading));
  const refetch = () => {
    srv.refetch();
    details.refetch();
    ids.refetch();
  };
  return { rows, stats, loading, serverUp, refetch, chainId, market };
}
