/**
 * Deploys the full afterhours.fi stack to the selected network and writes deployments/<network>.json
 * (also copied to ../client/src/deployments and ../server/deployments when those folders exist).
 *
 *   npx hardhat run scripts/deploy.ts --network sepolia
 *   npx hardhat run scripts/deploy.ts --network bscTestnet
 *   CONFIRM_MAINNET=yes npx hardhat run scripts/deploy.ts --network bsc     (same mock stack on BSC mainnet, about 14.4M gas)
 *
 * Testnet stock tokens are MockERC20 stand-ins for bStocks/Ondo tokens (faucet: 100 tokens per call).
 * USDT is a MockERC20 with 6 decimals (faucet: 10,000 per call).
 * The deployer is minted INITIAL_SUPPLY (default 1B) of every mock up front, so nobody pays gas to mint more later.
 *
 * Gas: every transaction is legacy at the price from scripts/gas.ts (GAS_PRICE_GWEI, else the network's eth_gasPrice),
 * signed locally and sent raw, with a gas limit of the estimate + 20% (unused gas is not charged).
 * BSC mainnet writes contracts/deployment-mainnet.json only (no client/server copies).
 * Every transaction is checkpointed to <output>.progress.json: a rerun after a crash or RPC hiccup skips
 * what is mined and waits on what was sent, instead of paying twice. Delete that file to start a fresh deploy.
 */
import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";
import { txOverrides } from "./gas";

const STOCKS = [
  { symbol: "NVDAB", name: "NVIDIA bStock (test)", ticker: "NVDA", price: 224.5 },
  { symbol: "TSLAB", name: "Tesla bStock (test)", ticker: "TSLA", price: 430.0 },
  { symbol: "AAPLB", name: "Apple bStock (test)", ticker: "AAPL", price: 341.07 },
  { symbol: "SPYB", name: "SPDR S&P 500 bStock (test)", ticker: "SPY", price: 690.0 },
  { symbol: "COINB", name: "Coinbase bStock (test)", ticker: "COIN", price: 310.0 },
  { symbol: "MSTRB", name: "Strategy bStock (test)", ticker: "MSTR", price: 320.0 },
  { symbol: "NVDAon", name: "NVIDIA Ondo Stock (test)", ticker: "NVDA", price: 224.5 },
  { symbol: "SPYon", name: "SPDR S&P 500 Ondo Stock (test)", ticker: "SPY", price: 690.0 },
];

const INITIAL_SUPPLY = BigInt(process.env.INITIAL_SUPPLY || "1000000000");
// Sanity check only: a full run measured 14.4M gas on a local chain. The balance must cover this much at the chosen price.
const FULL_RUN_GAS = 16_000_000n;

function nextFridayClose(from = new Date()): { epochId: number; expectedOpen: number } {
  // Friday 20:00 UTC (16:00 New York during EDT). Good enough for the hackathon; production reads nextOpenTime from the RWA API.
  const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate(), 20, 0, 0));
  const day = d.getUTCDay();
  let add = (5 - day + 7) % 7;
  if (add === 0 && from.getTime() > d.getTime()) add = 7;
  d.setUTCDate(d.getUTCDate() + add);
  const epochId = Math.floor(d.getTime() / 1000);
  return { epochId, expectedOpen: epochId + 65.5 * 3600 };
}

type Step = { hash: string; mined?: boolean; contract?: string; block?: number };
type Progress = { chainId: number; steps: Record<string, Step>; epochs?: { epochId: number; expectedOpen: number }[] };

async function main() {
  const [deployer] = await ethers.getSigners();
  const chainId = Number((await ethers.provider.getNetwork()).chainId);
  const quoter = process.env.QUOTER_ADDRESS && process.env.QUOTER_ADDRESS.length > 0 ? process.env.QUOTER_ADDRESS : deployer.address;
  const ov = await txOverrides();
  const balance = await ethers.provider.getBalance(deployer.address);
  const need = ov.gasPrice * FULL_RUN_GAS;
  console.log(`network ${network.name} (${chainId}) deployer ${deployer.address} quoter ${quoter}`);
  console.log(`gas price ${ethers.formatUnits(ov.gasPrice, "gwei")} gwei (legacy) · balance ${ethers.formatEther(balance)} · a full run needs up to ${ethers.formatEther(need)}`);
  if (balance < need) throw new Error("balance too low for a full run; nothing was sent");
  if (chainId === 56 && process.env.CONFIRM_MAINNET !== "yes") throw new Error("BSC mainnet: set CONFIRM_MAINNET=yes to send real transactions; nothing was sent");

  // BSC mainnet keeps everything in one file, contracts/deployment-mainnet.json, and is not copied to client/server
  const mainnet = chainId === 56;
  const dir = path.join(__dirname, "..", "deployments");
  fs.mkdirSync(dir, { recursive: true });
  const fp = mainnet ? path.join(__dirname, "..", "deployment-mainnet.json") : path.join(dir, `${network.name}.json`);
  const local = network.name === "hardhat";
  const progressFile = fp.replace(/\.json$/, ".progress.json");
  let progress: Progress = { chainId, steps: {} };
  if (!local && fs.existsSync(progressFile)) {
    progress = JSON.parse(fs.readFileSync(progressFile, "utf8"));
    if (progress.chainId !== chainId) throw new Error(`${progressFile} belongs to chain ${progress.chainId}`);
    console.log(`resuming: ${Object.values(progress.steps).filter((x) => x.mined).length} steps already mined`);
  }
  const save = () => {
    if (!local) fs.writeFileSync(progressFile, JSON.stringify(progress, null, 2));
  };

  // Transactions are signed here and sent raw (eth_sendRawTransaction), and receipts are read raw. The hash is known and
  // checkpointed before the broadcast, and nothing depends on how an RPC formats a pending transaction (some return
  // `to: ""` for contract creations, which the Hardhat ethers wrapper rejects after the transaction is already out).
  const pk = (process.env.DEPLOYER_PRIVATE_KEY ?? "").trim();
  if (!pk) throw new Error("DEPLOYER_PRIVATE_KEY is required");
  const wallet = new ethers.Wallet(pk.startsWith("0x") ? pk : `0x${pk}`);
  if (wallet.address !== deployer.address) throw new Error("DEPLOYER_PRIVATE_KEY does not match the network signer");
  const rpc = (method: string, params: unknown[]) => ethers.provider.send(method, params);
  type Receipt = { status: number; contractAddress?: string; block: number; gasUsed: bigint };

  async function receipt(hash: string, timeoutMs: number): Promise<Receipt | null> {
    const until = Date.now() + timeoutMs;
    while (Date.now() < until) {
      const r = await rpc("eth_getTransactionReceipt", [hash]).catch(() => null);
      if (r) return { status: Number(r.status), contractAddress: r.contractAddress ? ethers.getAddress(r.contractAddress) : undefined, block: Number(r.blockNumber), gasUsed: BigInt(r.gasUsed) };
      await new Promise((res) => setTimeout(res, 1500));
    }
    return null;
  }

  let nextNonce = -1;
  type Req = { to?: string; data: string };

  async function step(key: string, build: () => Promise<Req>): Promise<Step> {
    const prev = progress.steps[key];
    if (prev?.mined) return prev;
    if (prev?.hash) {
      let r = await receipt(prev.hash, 30_000);
      if (!r && (await rpc("eth_getTransactionByHash", [prev.hash]).catch(() => null))) r = await receipt(prev.hash, 300_000);
      if (r && r.status === 1) {
        progress.steps[key] = { hash: prev.hash, mined: true, contract: r.contractAddress, block: r.block };
        save();
        return progress.steps[key];
      }
      console.log(`${key}: earlier tx ${prev.hash} ${r ? "reverted" : "was never seen by the network"}, sending again`);
    }
    const req = await build();
    const pending = Number(await rpc("eth_getTransactionCount", [wallet.address, "pending"]));
    const nonce = Math.max(pending, nextNonce);
    const estimate = BigInt(await rpc("eth_estimateGas", [{ from: wallet.address, to: req.to, data: req.data }]));
    const signed = await wallet.signTransaction({ type: 0, chainId, nonce, gasPrice: ov.gasPrice, gasLimit: (estimate * 12n) / 10n, to: req.to ?? null, data: req.data, value: 0n });
    const hash = ethers.keccak256(signed);
    progress.steps[key] = { hash };
    save();
    try {
      await rpc("eth_sendRawTransaction", [signed]);
    } catch (e) {
      if (!/already known/i.test((e as Error).message)) {
        delete progress.steps[key];
        save();
        throw e;
      }
    }
    nextNonce = nonce + 1;
    const r = await receipt(hash, 300_000);
    if (!r || r.status !== 1) throw new Error(`${key}: tx ${hash} ${r ? "reverted" : "not mined yet"} (rerun to resume)`);
    progress.steps[key] = { hash, mined: true, contract: r.contractAddress, block: r.block };
    save();
    console.log(`  ok ${key}  ${hash}  gas ${r.gasUsed}`);
    return progress.steps[key];
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const deploy = (factory: any, ...args: unknown[]) => async (): Promise<Req> => ({ data: (await factory.getDeployTransaction(...args)).data });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const call = (factory: any, to: string, fn: string, ...args: unknown[]) => async (): Promise<Req> => ({ to, data: factory.interface.encodeFunctionData(fn, args) });

  const Mock = await ethers.getContractFactory("MockERC20");
  const usdtAddr = (await step("deploy:USDT", deploy(Mock, "Test USDT", "USDT", 6, 10_000n * 10n ** 6n, deployer.address))).contract!;
  console.log("USDT", usdtAddr);

  const stocks: Record<string, any> = {};
  for (const s of STOCKS) {
    const addr = (await step(`deploy:${s.symbol}`, deploy(Mock, s.name, s.symbol, 18, ethers.parseEther("100"), deployer.address))).contract!;
    await step(`mint:${s.symbol}`, call(Mock, addr, "mint", deployer.address, INITIAL_SUPPLY * 10n ** 18n));
    stocks[s.symbol] = { address: addr, ticker: s.ticker, name: s.name, decimals: 18, wrapper: s.symbol.endsWith("on") ? "ondo" : "bstock" };
    console.log(s.symbol, addr);
  }

  const Oracle = await ethers.getContractFactory("ReferenceOracle");
  const oracleAddr = (await step("deploy:ReferenceOracle", deploy(Oracle, deployer.address))).contract!;
  console.log("ReferenceOracle", oracleAddr);

  const Vault = await ethers.getContractFactory("KeeperVault");
  const vaultAddr = (await step("deploy:KeeperVault", deploy(Vault, usdtAddr, deployer.address))).contract!;
  console.log("KeeperVault", vaultAddr);

  const Market = await ethers.getContractFactory("CoverMarket");
  const marketStep = await step("deploy:CoverMarket", deploy(Market, usdtAddr, vaultAddr, oracleAddr, quoter, deployer.address));
  const marketAddr = marketStep.contract!;
  const deployBlock = marketStep.block!;
  console.log("CoverMarket", marketAddr, "block", deployBlock);

  // wiring
  await step("vault.setMarket", call(Vault, vaultAddr, "setMarket", marketAddr));
  if (quoter.toLowerCase() !== deployer.address.toLowerCase()) await step("oracle.setKeeper", call(Oracle, oracleAddr, "setKeeper", quoter, true));
  for (const s of STOCKS) await step(`market.setTokenAllowed:${s.symbol}`, call(Market, marketAddr, "setTokenAllowed", stocks[s.symbol].address, true));
  const addrs = STOCKS.map((s) => stocks[s.symbol].address);
  const prices = STOCKS.map((s) => BigInt(Math.round(s.price * 1e8)));
  await step("oracle.setLastPrices", call(Oracle, oracleAddr, "setLastPrices", addrs, prices));

  // agent-to-agent flow: authorise the underwriting agent (Kip's Agent Studio wallet) to bind cover for buyers
  const binders = (process.env.BINDER_ADDRESSES ?? "").split(",").map((x) => x.trim()).filter(Boolean);
  for (const b of binders) await step(`market.setBinder:${b}`, call(Market, marketAddr, "setBinder", b, true));
  if (binders.length) console.log("binders", binders.join(", "));

  // mint the deployer's USDT supply, then seed the vault with 50k of it so the demo has capacity
  await step("mint:USDT", call(Mock, usdtAddr, "mint", deployer.address, INITIAL_SUPPLY * 10n ** 6n));
  await step("usdt.approve", call(Mock, usdtAddr, "approve", vaultAddr, 50_000n * 10n ** 6n));
  await step("vault.deposit", call(Vault, vaultAddr, "deposit", 50_000n * 10n ** 6n, deployer.address));

  // open the current epoch (next Friday 20:00 UTC) and the one after; fixed on the first run so a resume opens the same ones
  if (!progress.epochs) {
    const first = nextFridayClose();
    progress.epochs = [first, { epochId: first.epochId + 7 * 86400, expectedOpen: first.expectedOpen + 7 * 86400 }];
    save();
  }
  const [e1, e2] = progress.epochs;
  await step(`market.openEpoch:${e1.epochId}`, call(Market, marketAddr, "openEpoch", e1.epochId, e1.epochId, e1.expectedOpen));
  await step(`market.openEpoch:${e2.epochId}`, call(Market, marketAddr, "openEpoch", e2.epochId, e2.epochId, e2.expectedOpen));
  console.log("epochs opened", e1.epochId, e2.epochId);

  console.log(`gas spent this run: ${ethers.formatEther(balance - (await ethers.provider.getBalance(deployer.address)))}`);

  const out = {
    network: network.name,
    chainId,
    deployer: deployer.address,
    quoter,
    deployedAt: new Date().toISOString(),
    deployBlock,
    contracts: {
      USDT: usdtAddr,
      ReferenceOracle: oracleAddr,
      KeeperVault: vaultAddr,
      CoverMarket: marketAddr,
    },
    stocks,
    epochs: [e1, e2],
    binders,
    config: {
      gasPriceWei: ov.gasPrice.toString(),
      txType: ov.type,
      initialSupply: INITIAL_SUPPLY.toString(),
      initialSupplyHolder: deployer.address,
      faucet: { USDT: "10000", stocks: "100" },
      decimals: { USDT: 6, stocks: 18 },
      vaultSeedUsdt: "50000",
      oraclePrices: Object.fromEntries(STOCKS.map((s) => [s.symbol, s.price])),
      owner: deployer.address,
    },
    txs: Object.fromEntries(Object.entries(progress.steps).map(([k, v]) => [k, v.hash])),
    // x402 v2 "exact" scheme, Permit2 transfer method: canonical, chain-independent addresses
    x402: {
      permit2: "0x000000000022D473030F116dDEE9F6B43aC78BA3",
      exactPermit2Proxy: "0x402085c248EeA27D92E8b30b2C58ed07f9E20001",
    },
  };
  fs.writeFileSync(fp, JSON.stringify(out, null, 2));
  console.log("wrote", fp);
  if (mainnet) return;
  for (const rel of ["../client/src/deployments", "../server/deployments"]) {
    const d2 = path.join(__dirname, "..", rel);
    if (fs.existsSync(path.dirname(d2))) {
      fs.mkdirSync(d2, { recursive: true });
      fs.writeFileSync(path.join(d2, `${network.name}.json`), JSON.stringify(out, null, 2));
      console.log("copied to", d2);
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
