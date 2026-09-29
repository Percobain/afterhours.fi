/**
 * Hermee's agent, command line.
 *
 *   npm run hermee -- status                              wallet, holdings, Kip's status
 *   npm run hermee -- quote   --token NVDAB --amount 1000 --floor 5        ask Kip over MCP (free)
 *   npm run hermee -- protect --token NVDAB --amount 1000 --floor 5 [--budget 1] [--yes]
 *
 * Network: HERMEE_WALLET=local (default, BSC testnet, key from HERMEE_PRIVATE_KEY) or HERMEE_WALLET=baw
 * (Binance Agentic Wallet via the `baw` CLI, BSC mainnet). The flow is identical; only the payer changes.
 */
import "dotenv/config";
import readline from "node:readline/promises";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { isAddress, type Address, type Hex } from "viem";
import { bsc, bscTestnet } from "viem/chains";
import { bawAddress, bawPayer } from "./bawPayer";
import { protectWeekend, type HermeeEvent, type HermeePayer } from "./hermee/core";
import { localPayer } from "./hermee/localPayer";

const KIP = (process.env.KIP_AGENT_URL ?? "http://localhost:9000").replace(/\/+$/, "");
const API = (process.env.AFTERHOURS_API_URL ?? "https://afterhours-fi.onrender.com").replace(/\/+$/, "");
const MODE = (process.env.HERMEE_WALLET ?? "local") as "local" | "baw";
const CHAIN = MODE === "baw" ? bsc : bscTestnet;
const RPC = process.env.HERMEE_RPC_URL ?? (MODE === "baw" ? "https://bsc-dataseed.bnbchain.org" : "https://data-seed-prebsc-1-s1.bnbchain.org:8545");

function arg(name: string, def?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : def;
}
const flag = (name: string) => process.argv.includes(`--${name}`);
const json = (x: unknown) => JSON.stringify(x, (_k, v) => (typeof v === "bigint" ? v.toString() : v), 2);

async function deployment() {
  const cfg = (await (await fetch(`${API}/api/config`)).json()) as { networks: { chainId: number; contracts: { CoverMarket: Address; KeeperVault: Address; ReferenceOracle: Address; USDT: Address }; tokens: { symbol: string; ticker: string; address: Address }[] }[] };
  const net = cfg.networks.find((n) => n.chainId === CHAIN.id);
  if (!net) throw new Error(`afterhours.fi is not deployed on chain ${CHAIN.id}`);
  return net;
}

async function resolveToken(t: string) {
  const net = await deployment();
  const tok = isAddress(t) ? net.tokens.find((x) => x.address.toLowerCase() === t.toLowerCase()) : net.tokens.find((x) => x.symbol.toLowerCase() === t.toLowerCase() || x.ticker.toLowerCase() === t.toLowerCase());
  if (!tok) throw new Error(`unknown token ${t}; try one of ${net.tokens.map((x) => x.symbol).join(", ")}`);
  return { net, tok };
}

async function makePayer(): Promise<HermeePayer & Partial<ReturnType<typeof localPayer>>> {
  if (MODE === "baw") return bawPayer(await bawAddress());
  const k = process.env.HERMEE_PRIVATE_KEY as Hex | undefined;
  if (!k) throw new Error("HERMEE_PRIVATE_KEY is not set (agents/hermee/.env)");
  return localPayer({ privateKey: k, chain: CHAIN, rpcUrl: RPC });
}

function print(e: HermeeEvent) {
  const icon = { info: "·", ok: "✓", warn: "!", error: "✗" }[e.status];
  console.log(`${icon} [${e.step}] ${e.message}`);
}

async function mcpQuote(token: string, amountUsd: number, floorPct: number, buyer: Address) {
  const client = new Client({ name: "hermee-agent", version: "0.1.0" });
  await client.connect(new StreamableHTTPClientTransport(new URL(`${KIP}/mcp`)));
  try {
    const r = await client.callTool({ name: "quote_cover", arguments: { token, amountUsd, floorPct, buyer } });
    const text = (r.content as { type: string; text?: string }[])[0]?.text ?? "{}";
    return JSON.parse(text) as Record<string, unknown>;
  } finally {
    await client.close();
  }
}

async function main() {
  const cmd = process.argv[2] ?? "status";
  const payer = await makePayer();

  if (cmd === "status") {
    const [kip, net] = await Promise.all([fetch(`${KIP}/afterhours/status`).then((r) => r.json()).catch((e) => ({ error: String(e) })), deployment()]);
    const holdings: Record<string, string> = {};
    if (payer.balanceOf) for (const t of net.tokens.slice(0, 3)) holdings[t.symbol] = (await payer.balanceOf(t.address)).toString();
    if (payer.balanceOf) holdings.USDT = (await payer.balanceOf(net.contracts.USDT)).toString();
    console.log(json({ hermee: payer.address, wallet: MODE === "baw" ? "Binance Agentic Wallet (mainnet)" : "local testnet key", chainId: CHAIN.id, holdings, kip }));
    return;
  }

  const token = arg("token", "NVDAB")!;
  const amountUsd = Number(arg("amount", "1000"));
  const floorPct = Number(arg("floor", "5"));
  const { net, tok } = await resolveToken(token);

  if (cmd === "quote") {
    console.log(json(await mcpQuote(tok.symbol, amountUsd, floorPct, payer.address)));
    return;
  }

  if (cmd === "protect") {
    if (MODE === "local" && payer.ensureTestFunds) {
      const txs = await payer.ensureTestFunds({ token: tok.address, minToken: 10n ** 18n, usdt: net.contracts.USDT, minUsdt: 10n * 10n ** 6n });
      if (txs.length) console.log(`· [setup] claimed test tokens from the faucets: ${txs.join(", ")}`);
    }
    const budgetPct = Number(arg("budget", "1"));
    const confirm = flag("yes")
      ? undefined
      : async (o: { offer: { premiumUsd: string; ticker: string } }) => {
          const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
          const a = await rl.question(`Pay Kip $${(Number(o.offer.premiumUsd) / 1e6).toFixed(2)} to protect ${o.offer.ticker} this weekend? [y/N] `);
          rl.close();
          return /^y(es)?$/i.test(a.trim());
        };
    const r = await protectWeekend(
      { kipUrl: KIP, token: tok.address, notionalUsd: BigInt(Math.round(amountUsd * 1e6)), barrierBps: Math.round(floorPct * 100), maxPremiumBps: Math.round(budgetPct * 100), confirm },
      payer,
      print,
    );
    console.log(json(r));
    process.exitCode = r.ok ? 0 : 1;
    return;
  }

  throw new Error(`unknown command ${cmd}; use status | quote | protect`);
}

main().catch((e) => {
  console.error(`✗ ${(e as Error).message}`);
  process.exitCode = 1;
});
