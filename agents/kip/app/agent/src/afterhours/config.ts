/**
 * Kip's runtime settings. Everything network-specific is here, so moving to mainnet is configuration:
 * AFTERHOURS_CHAIN_ID=56, X402_FACILITATOR_URL=<Binance b402>, AFTERHOURS_RPC_URL=<mainnet RPC>.
 */
const trim = (s: string) => s.replace(/\/+$/, "");
const api = trim(process.env.AFTERHOURS_API_URL ?? "https://afterhours-fi.onrender.com");

export const AH = {
  /** afterhours.fi pricing server: quotes, market status, backtest data, deployment addresses */
  api,
  /** x402 facilitator: our testnet stand-in by default; Binance b402 on mainnet */
  facilitator: trim(process.env.X402_FACILITATOR_URL ?? `${api}/api/x402/facilitator`),
  chainId: Number(process.env.AFTERHOURS_CHAIN_ID ?? 97),
  rpcUrl: process.env.AFTERHOURS_RPC_URL ?? "https://data-seed-prebsc-1-s1.bnbchain.org:8545",
  /** public base URL of this agent, used in the x402 resource description and the agent card */
  publicUrl: trim(process.env.AGENT_PUBLIC_URL ?? `http://localhost:${process.env.AGENT_PORT ?? "9000"}`),
  /** browser origins allowed to read the agent's status and buy cover (the afterhours.fi site) */
  corsOrigins: (process.env.AFTERHOURS_CORS_ORIGINS ?? "https://afterhoursfi.vercel.app,http://localhost:3000").split(",").map((s) => s.trim()),
  /** how long an offered quote can be paid for, capped by the quote's own expiry */
  offerTtlSec: Number(process.env.OFFER_TTL_SECONDS ?? 120),
  keeperIntervalMs: Number(process.env.KEEPER_INTERVAL_MS ?? 60_000),
};
