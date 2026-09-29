/**
 * Kip's free, read-only MCP tools. Any agent (a router, an arbitrage bot, Hermee's agent) can check weekend risk
 * before it trades. Buying is the paid x402 resource POST /cover/bind, never an MCP tool.
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { isAddressEqual } from "viem";
import { z } from "zod";
import { AH } from "./config.js";
import { agentAddress } from "./chain.js";
import { api, deployment, fetchQuote } from "./market.js";

const READONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true } as const;
const result = (value: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }] });
const fail = (e: unknown) => ({ isError: true, content: [{ type: "text" as const, text: (e as Error).message }] });

async function resolveToken(tickerOrAddress: string) {
  const dep = await deployment();
  const t = dep.tokens.find((x) => x.symbol.toLowerCase() === tickerOrAddress.toLowerCase() || x.ticker.toLowerCase() === tickerOrAddress.toLowerCase() || x.address.toLowerCase() === tickerOrAddress.toLowerCase());
  if (!t) throw new Error(`unknown token ${tickerOrAddress}; available: ${dep.tokens.map((x) => x.symbol).join(", ")}`);
  return t;
}

export function registerAfterhoursTools(server: McpServer): void {
  server.registerTool(
    "quote_cover",
    {
      description:
        "Price a weekend floor: pays the part of a Monday-open drop below the floor, up to 20% of the amount. Returns the premium, fair value and odds. To buy, POST the same terms to /cover/bind and pay the x402 challenge.",
      inputSchema: {
        token: z.string().describe("symbol (NVDAB, TSLAB, SPYon...), ticker (NVDA) or token address"),
        amountUsd: z.number().positive().describe("dollar value of the position to protect, e.g. 1000"),
        floorPct: z.number().positive().max(20).describe("floor below Friday's close in percent, e.g. 5 for -5%"),
        buyer: z.string().optional().describe("wallet that holds the stock; defaults to this agent for a price check"),
      },
      annotations: READONLY,
    },
    async (a) => {
      try {
        const t = await resolveToken(a.token);
        const q = await fetchQuote({ buyer: (a.buyer as `0x${string}`) ?? agentAddress(), token: t.address, notionalUsd: String(Math.round(a.amountUsd * 1e6)), barrierBps: Math.round(a.floorPct * 100) });
        return result({ token: t.symbol, ticker: t.ticker, weekendEpochId: q.quote.epochId, premiumUsd: Number(q.quote.premiumUsd) / 1e6, maxPayoutUsd: a.amountUsd * 0.2, estimatedValue: q.estimatedValue, buy: { method: "POST", url: `${AH.publicUrl}/cover/bind`, payment: "x402 v2 exact/permit2" } });
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "market_status",
    { description: "Is the US market open? When is the next Friday close (last moment to buy cover) and Monday open (settlement)?", inputSchema: {}, annotations: READONLY },
    async () => {
      try {
        return result(await api("/api/market-status"));
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "gap_history",
    {
      description: "Backtest evidence: how often Monday opens gap down past a floor (61,815 ticker-weekends, 2005-2026) and the famous weekends, optionally for one ticker.",
      inputSchema: { ticker: z.string().optional().describe("e.g. NVDA; omit for the pooled universe") },
      annotations: READONLY,
    },
    async (a) => {
      try {
        const [stats, famous] = await Promise.all([api<Record<string, unknown>>("/api/stats"), api<unknown>("/api/famous")]);
        const list = (Array.isArray(famous) ? famous : ((famous as { famous?: unknown[] }).famous ?? [])) as { ticker?: string }[];
        const mine = a.ticker ? list.filter((f) => f.ticker?.toUpperCase() === a.ticker!.toUpperCase()) : list.slice(0, 12);
        return result({ stats, famousWeekends: mine });
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "pool_health",
    { description: "The protection pool backing every policy: assets, CPPI floor, cushion, locked collateral and remaining capacity.", inputSchema: {}, annotations: READONLY },
    async () => {
      try {
        return result(await api(`/api/vault?chainId=${AH.chainId}`));
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "my_book",
    { description: "Policies this underwriting agent bound for buyers over x402, and the agent's recent activity.", inputSchema: {}, annotations: READONLY },
    async () => {
      try {
        const r = await api<{ events: { payee: string | null; payer: string | null }[] }>(`/api/agents/activity?chainId=${AH.chainId}&limit=100`);
        const me = agentAddress();
        return result(r.events.filter((e) => (e.payee && isAddressEqual(e.payee as `0x${string}`, me)) || (e.payer && isAddressEqual(e.payer as `0x${string}`, me))));
      } catch (e) {
        return fail(e);
      }
    },
  );
}
