# Practising on BSC Testnet

The Binance Agentic Wallet runs on mainnet only (BSC, Base, Solana for x402), and Binance's b402 facilitator is
only reachable on BSC testnet inside Binance's QA environment. To try the full agent-to-agent flow without real
money, afterhours.fi runs everything on **BSC Testnet (chain 97)**:

- Kip's agent at `https://afterhours-kip.onrender.com` sells cover in test USDT.
- An afterhours.fi x402 facilitator plays b402's role, with the same verify/settle API, settling through the same
  canonical `x402ExactPermit2Proxy`.
- Hermee's agent signs the identical `PAYMENT-SIGNATURE` payload with a local test key instead of `baw`.

## Watch it in the browser

https://afterhoursfi.vercel.app/agents: press **Start the agents** for a live trade with BscScan links.

## Run Hermee's agent yourself

```bash
cd agents/hermee
npm install
echo "HERMEE_PRIVATE_KEY=0x<a throwaway testnet key>" > .env   # fund it with a little tBNB for gas
export KIP_AGENT_URL=https://afterhours-kip.onrender.com
npm run hermee -- status
npm run hermee -- quote   --token NVDAB --amount 1000 --floor 5    # asks Kip over MCP
npm run hermee -- protect --token NVDAB --amount 1000 --floor 5    # claims test tokens, pays over x402, asks y/N
```

On mainnet the same CLI runs with `HERMEE_WALLET=baw`, which swaps the local key for
`baw x402-payment preview/sign` (see `agents/hermee/src/bawPayer.ts`).
