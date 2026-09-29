/**
 * Deploys the full afterhours.fi stack to the selected network and writes deployments/<network>.json
 * (also copied to ../client/src/deployments and ../server/deployments when those folders exist).
 *
 *   npx hardhat run scripts/deploy.ts --network sepolia
 *   npx hardhat run scripts/deploy.ts --network bscTestnet
 *
 * Testnet stock tokens are MockERC20 stand-ins for bStocks/Ondo tokens (faucet: 100 tokens per call).
 * USDT is a MockERC20 with 6 decimals (faucet: 10,000 per call).
 */
import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

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

async function main() {
  const [deployer] = await ethers.getSigners();
  const quoter = process.env.QUOTER_ADDRESS && process.env.QUOTER_ADDRESS.length > 0 ? process.env.QUOTER_ADDRESS : deployer.address;
  console.log(`network ${network.name} deployer ${deployer.address} quoter ${quoter}`);

  const Mock = await ethers.getContractFactory("MockERC20");
  const usdt = await Mock.deploy("Test USDT", "USDT", 6, 10_000n * 10n ** 6n, deployer.address);
  await usdt.waitForDeployment();
  console.log("USDT", await usdt.getAddress());

  const stocks: Record<string, any> = {};
  for (const s of STOCKS) {
    const t = await Mock.deploy(s.name, s.symbol, 18, ethers.parseEther("100"), deployer.address);
    await t.waitForDeployment();
    stocks[s.symbol] = { address: await t.getAddress(), ticker: s.ticker, name: s.name, decimals: 18, wrapper: s.symbol.endsWith("on") ? "ondo" : "bstock" };
    console.log(s.symbol, stocks[s.symbol].address);
  }

  const Oracle = await ethers.getContractFactory("ReferenceOracle");
  const oracle = await Oracle.deploy(deployer.address);
  await oracle.waitForDeployment();
  console.log("ReferenceOracle", await oracle.getAddress());

  const Vault = await ethers.getContractFactory("KeeperVault");
  const vault = await Vault.deploy(await usdt.getAddress(), deployer.address);
  await vault.waitForDeployment();
  console.log("KeeperVault", await vault.getAddress());

  const Market = await ethers.getContractFactory("CoverMarket");
  const market = await Market.deploy(await usdt.getAddress(), await vault.getAddress(), await oracle.getAddress(), quoter, deployer.address);
  await market.waitForDeployment();
  const deployBlock = (await market.deploymentTransaction()!.wait())!.blockNumber;
  console.log("CoverMarket", await market.getAddress(), "block", deployBlock);

  // wiring
  await (await vault.setMarket(await market.getAddress())).wait();
  if (quoter.toLowerCase() !== deployer.address.toLowerCase()) await (await oracle.setKeeper(quoter, true)).wait();
  const addrs = Object.values(stocks).map((s: any) => s.address);
  for (const a of addrs) await (await market.setTokenAllowed(a, true)).wait();
  const prices = STOCKS.map((s) => BigInt(Math.round(s.price * 1e8)));
  await (await oracle.setLastPrices(addrs, prices)).wait();

  // agent-to-agent flow: authorise the underwriting agent (Kip's Agent Studio wallet) to bind cover for buyers
  const binders = (process.env.BINDER_ADDRESSES ?? "").split(",").map((x) => x.trim()).filter(Boolean);
  for (const b of binders) await (await market.setBinder(b, true)).wait();
  if (binders.length) console.log("binders", binders.join(", "));

  // seed the vault with 50k test USDT from the deployer so the demo has capacity
  await (await usdt.mint(deployer.address, 50_000n * 10n ** 6n)).wait();
  await (await usdt.approve(await vault.getAddress(), 50_000n * 10n ** 6n)).wait();
  await (await vault.deposit(50_000n * 10n ** 6n, deployer.address)).wait();

  // open the current epoch (next Friday 20:00 UTC) and the one after
  const e1 = nextFridayClose();
  const e2 = { epochId: e1.epochId + 7 * 86400, expectedOpen: e1.expectedOpen + 7 * 86400 };
  await (await market.openEpoch(e1.epochId, e1.epochId, e1.expectedOpen)).wait();
  await (await market.openEpoch(e2.epochId, e2.epochId, e2.expectedOpen)).wait();
  console.log("epochs opened", e1.epochId, e2.epochId);

  const out = {
    network: network.name,
    chainId: Number((await ethers.provider.getNetwork()).chainId),
    deployer: deployer.address,
    quoter,
    deployedAt: new Date().toISOString(),
    deployBlock,
    contracts: {
      USDT: await usdt.getAddress(),
      ReferenceOracle: await oracle.getAddress(),
      KeeperVault: await vault.getAddress(),
      CoverMarket: await market.getAddress(),
    },
    stocks,
    epochs: [e1, e2],
    binders,
    // x402 v2 "exact" scheme, Permit2 transfer method: canonical, chain-independent addresses
    x402: {
      permit2: "0x000000000022D473030F116dDEE9F6B43aC78BA3",
      exactPermit2Proxy: "0x402085c248EeA27D92E8b30b2C58ed07f9E20001",
    },
  };
  const dir = path.join(__dirname, "..", "deployments");
  fs.mkdirSync(dir, { recursive: true });
  const fp = path.join(dir, `${network.name}.json`);
  fs.writeFileSync(fp, JSON.stringify(out, null, 2));
  console.log("wrote", fp);
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
