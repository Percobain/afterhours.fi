"use client";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAccount, useChainId, useReadContracts } from "wagmi";
import type { Address } from "viem";
import { api, normaliseTokens } from "@/lib/api";
import { CoverMarketAbi, MockERC20Abi, ReferenceOracleAbi, ZERO_ADDRESS, getStaticDeployment, homeChainId, isSupportedChain, stocksToTokens } from "@/lib/contracts";
import { useNetworkMode } from "@/lib/networkMode";
import { toBig } from "@/lib/format";
import type { ApiToken, Deployment, EpochInfo, TokenInfo, Wrapper } from "@/lib/types";

/** The chain the UI works against: the wallet's chain when the network mode offers it, else the mode's home chain. */
export function useActiveChainId(): { chainId: number; walletChainId: number | undefined; wrongNetwork: boolean } {
  const mode = useNetworkMode();
  const wagmiChainId = useChainId();
  const { chainId: walletChainId, isConnected } = useAccount();
  const supported = isSupportedChain(walletChainId, mode) ? walletChainId : isSupportedChain(wagmiChainId, mode) ? wagmiChainId : homeChainId(mode);
  return { chainId: supported, walletChainId, wrongNetwork: isConnected && !isSupportedChain(walletChainId, mode) };
}

export interface ResolvedDeployment {
  chainId: number;
  deployment: Deployment | null;
  tokens: TokenInfo[];
  epochs: EpochInfo[];
  source: "deployment" | "env" | "server" | "none";
  serverOnline: boolean;
  isLoading: boolean;
}

function pickChain<T>(v: Record<string, T[]> | T[] | undefined, chainId: number): T[] | undefined {
  if (!v) return undefined;
  if (Array.isArray(v)) return v;
  const hit = v[String(chainId)];
  return Array.isArray(hit) ? hit : undefined;
}

/**
 * Resolves contracts + token list for the active chain. Priority: NEXT_PUBLIC_* env > src/deployments/<network>.json
 * > server GET /api/config. Token metadata is enriched from GET /api/tokens (prices, vol) and, failing that, from chain reads.
 */
export function useDeployment(): ResolvedDeployment {
  const { chainId } = useActiveChainId();
  const stat = useMemo(() => getStaticDeployment(chainId), [chainId]);

  const cfg = useQuery({ queryKey: ["server-config"], queryFn: api.config, staleTime: 60_000, retry: false });
  const srvTokens = useQuery({ queryKey: ["server-tokens", chainId], queryFn: () => api.tokens(chainId), staleTime: 30_000, refetchInterval: 60_000, retry: false });

  const serverDeployment = useMemo<Deployment | null>(() => {
    const c = cfg.data;
    if (!c) return null;
    const contracts = c.contracts?.[String(chainId)];
    if (!contracts?.CoverMarket || !contracts.KeeperVault || !contracts.USDT) return null;
    const toks = pickChain<ApiToken>(c.tokens, chainId) ?? [];
    const stocks: Deployment["stocks"] = {};
    for (const t of toks) stocks[t.symbol] = { address: t.address, ticker: t.ticker, name: t.name ?? t.symbol, decimals: t.decimals ?? 18, wrapper: t.wrapper };
    return {
      network: String(chainId),
      chainId,
      quoter: c.quoter,
      contracts: { CoverMarket: contracts.CoverMarket, KeeperVault: contracts.KeeperVault, USDT: contracts.USDT, ReferenceOracle: contracts.ReferenceOracle ?? ZERO_ADDRESS },
      stocks,
      epochs: pickChain<EpochInfo>(c.epochs, chainId) ?? [],
    };
  }, [cfg.data, chainId]);

  const deployment = stat ?? serverDeployment;
  const market = deployment?.contracts.CoverMarket;
  const oracle = deployment?.contracts.ReferenceOracle;
  const staticTokens = useMemo(() => (deployment ? stocksToTokens(deployment.stocks) : []), [deployment]);
  const needOnChainList = !!market && staticTokens.length === 0;

  // Fallback: the token list straight from the market when neither JSON nor server lists it.
  const chainList = useReadContracts({
    contracts: [{ address: market, abi: CoverMarketAbi, functionName: "tokens", chainId }],
    query: { enabled: needOnChainList },
  });
  const listedResult = chainList.data?.[0]?.result as readonly Address[] | undefined;
  const listed = useMemo(() => listedResult ?? [], [listedResult]);
  const symbolReads = useReadContracts({
    contracts: listed.flatMap((a) => [
      { address: a, abi: MockERC20Abi, functionName: "symbol" as const, chainId },
      { address: a, abi: MockERC20Abi, functionName: "name" as const, chainId },
    ]),
    query: { enabled: listed.length > 0 },
  });

  const baseTokens: TokenInfo[] = useMemo(() => {
    if (staticTokens.length) return staticTokens;
    return listed.map((a, i) => {
      const symbol = (symbolReads.data?.[i * 2]?.result as string | undefined) ?? `TOKEN${i + 1}`;
      const name = (symbolReads.data?.[i * 2 + 1]?.result as string | undefined) ?? symbol;
      const wrapper: Wrapper = symbol.toLowerCase().endsWith("on") ? "ondo" : "bstock";
      return { symbol, name, address: a, ticker: symbol.replace(/(B|on)$/i, ""), decimals: 18, wrapper };
    });
  }, [staticTokens, listed, symbolReads.data]);

  // Live prices: server first, then the oracle's lastPrice.
  const serverList = useMemo(() => normaliseTokens(srvTokens.data ?? null), [srvTokens.data]);
  const needOraclePrices = baseTokens.length > 0 && !!oracle && oracle !== ZERO_ADDRESS && serverList.length === 0;
  const oraclePrices = useReadContracts({
    contracts: baseTokens.map((t) => ({ address: oracle, abi: ReferenceOracleAbi, functionName: "lastPrice" as const, args: [t.address] as const, chainId })),
    query: { enabled: needOraclePrices, refetchInterval: 60_000 },
  });

  const tokens = useMemo<TokenInfo[]>(
    () =>
      baseTokens.map((t, i) => {
        const s = serverList.find((x) => x.address?.toLowerCase() === t.address.toLowerCase() || x.symbol === t.symbol);
        const chainPrice = oraclePrices.data?.[i]?.result as bigint | undefined;
        const lastPrice = s?.lastPrice !== undefined ? toBig(s.lastPrice) : chainPrice;
        return { ...t, lastPrice: lastPrice && lastPrice > 0n ? lastPrice : undefined, rv20: s?.rv20, breachProb5: s?.breachProb5, worstWeekend: s?.worstWeekend };
      }),
    [baseTokens, serverList, oraclePrices.data]
  );

  const source: ResolvedDeployment["source"] = stat ? (Object.keys(stat.stocks).length ? "deployment" : "env") : serverDeployment ? "server" : "none";
  return {
    chainId,
    deployment,
    tokens,
    epochs: deployment?.epochs ?? [],
    source,
    serverOnline: cfg.data !== null && cfg.data !== undefined,
    isLoading: cfg.isLoading || (needOnChainList && chainList.isLoading),
  };
}
