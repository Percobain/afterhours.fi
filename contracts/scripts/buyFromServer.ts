/** Buys a floor on the deployed network using a quote signed by the running server (default http://localhost:4000).
 *  npx hardhat run scripts/buyFromServer.ts --network sepolia   (env: SERVER_URL, BUY_SYMBOL=NVDAB, BUY_NOTIONAL_USD=1000, BUY_BUDGET_BPS=5) */
import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const dep = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "deployments", `${network.name}.json`), "utf8"));
  const [buyer] = await ethers.getSigners();
  const server = process.env.SERVER_URL || "http://localhost:4000";
  const sym = process.env.BUY_SYMBOL || "NVDAB";
  const notionalUsd = BigInt(Math.round(Number(process.env.BUY_NOTIONAL_USD || 1000) * 1e6));
  const budget = process.env.BUY_BUDGET_BPS || "5";
  const token = dep.stocks[sym].address;
  const url = `${server}/api/quote?chainId=${dep.chainId}&buyer=${buyer.address}&token=${token}&notionalUsd=${notionalUsd}&budgetBps=${budget}`;
  const res = await fetch(url); const j: any = await res.json();
  if (!res.ok || !j.signature) throw new Error(`quote failed: ${JSON.stringify(j).slice(0, 300)}`);
  console.log(`quote: ${sym} $${Number(notionalUsd) / 1e6} floor -${j.quote.barrierBps / 100}% premium $${Number(j.quote.premiumUsd) / 1e6} | ${j.estimatedValue.sentence}`);

  const usdt = await ethers.getContractAt("MockERC20", dep.contracts.USDT);
  const stock = await ethers.getContractAt("MockERC20", token);
  const market = await ethers.getContractAt("CoverMarket", dep.contracts.CoverMarket);
  const need = BigInt(j.requiredTokenBalance || "0");
  if ((await stock.balanceOf(buyer.address)) < need) { const t = await stock.faucet(); await t.wait(); console.log("faucet", sym, t.hash); }
  if ((await usdt.balanceOf(buyer.address)) < BigInt(j.quote.premiumUsd)) { const t = await usdt.faucet(); await t.wait(); console.log("faucet USDT", t.hash); }
  let tx = await usdt.approve(dep.contracts.CoverMarket, BigInt(j.quote.premiumUsd)); await tx.wait(); console.log("approve", tx.hash);
  const q = { buyer: j.quote.buyer, token: j.quote.token, epochId: BigInt(j.quote.epochId), notionalUsd: BigInt(j.quote.notionalUsd), barrierBps: Number(j.quote.barrierBps), premiumUsd: BigInt(j.quote.premiumUsd), expiry: BigInt(j.quote.expiry), nonce: BigInt(j.quote.nonce) };
  tx = await market.buyCover(q, j.signature); await tx.wait();
  const id = (await market.policyCount()) - 1n;
  console.log(`bought policy #${id} for weekend epoch ${j.quote.epochId} (${new Date(j.quote.epochId * 1000).toISOString()})  tx ${tx.hash}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
