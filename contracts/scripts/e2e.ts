/**
 * Live end-to-end demo on a deployed network, using the deployer as Hermee:
 *  faucet NVDAB + USDT -> approve -> sign a quote (deployer is the quoter) -> buyCover
 *  -> post Friday close and a Monday open (default -7%) for a DEMO epoch -> settle -> payout.
 * Uses a dedicated demo epoch (epochId = now + 1 day) so it never touches the real weekend epochs.
 *   npx hardhat run scripts/e2e.ts --network sepolia
 * Env: E2E_GAP_PCT (default -7), E2E_BARRIER_BPS (default 300), E2E_NOTIONAL_USD (default 1000)
 */
import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const dep = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "deployments", `${network.name}.json`), "utf8"));
  const [signer] = await ethers.getSigners();
  const usdt = await ethers.getContractAt("MockERC20", dep.contracts.USDT);
  const stock = await ethers.getContractAt("MockERC20", dep.stocks.NVDAB.address);
  const oracle = await ethers.getContractAt("ReferenceOracle", dep.contracts.ReferenceOracle);
  const market = await ethers.getContractAt("CoverMarket", dep.contracts.CoverMarket);
  const vault = await ethers.getContractAt("KeeperVault", dep.contracts.KeeperVault);
  const gapPct = Number(process.env.E2E_GAP_PCT || -7);
  const barrierBps = Number(process.env.E2E_BARRIER_BPS || 300);
  const notionalUsd = BigInt(Math.round(Number(process.env.E2E_NOTIONAL_USD || 1000) * 1e6));
  const log = (m: string, tx?: any) => console.log(m, tx?.hash ? `tx ${tx.hash}` : "");

  const now = Math.floor(Date.now() / 1000);
  const epochId = BigInt(now + 86400);
  let tx = await market.openEpoch(epochId, epochId, epochId + 65n * 3600n); await tx.wait(); log(`opened demo epoch ${epochId}`, tx);

  tx = await stock.faucet(); await tx.wait(); log("faucet 100 NVDAB", tx);
  tx = await usdt.faucet(); await tx.wait(); log("faucet 10,000 USDT", tx);

  const px = await oracle.lastPrice(dep.stocks.NVDAB.address); // 8 decimals
  const closePx = px; const openPx = BigInt(Math.round(Number(px) * (1 + gapPct / 100)));
  const premiumUsd = notionalUsd * 6n / 10_000n; // 6bp demo premium
  const chainId = (await ethers.provider.getNetwork()).chainId;
  const domain = { name: "afterhours.fi CoverMarket", version: "1", chainId, verifyingContract: dep.contracts.CoverMarket };
  const types = { Quote: [
    { name: "buyer", type: "address" }, { name: "token", type: "address" }, { name: "epochId", type: "uint64" },
    { name: "notionalUsd", type: "uint256" }, { name: "barrierBps", type: "uint16" }, { name: "premiumUsd", type: "uint256" },
    { name: "expiry", type: "uint64" }, { name: "nonce", type: "uint256" } ] };
  const q = { buyer: signer.address, token: dep.stocks.NVDAB.address, epochId, notionalUsd, barrierBps, premiumUsd, expiry: BigInt(now + 900), nonce: BigInt(Date.now()) };
  const sig = await signer.signTypedData(domain, types, q);

  tx = await usdt.approve(dep.contracts.CoverMarket, premiumUsd); await tx.wait(); log("approve premium", tx);
  const capBefore = await market.capacityNotional();
  tx = await market.buyCover(q, sig); const rc = await tx.wait(); log(`bought floor: $${Number(notionalUsd) / 1e6} NVDAB at -${barrierBps / 100}% for $${Number(premiumUsd) / 1e6}`, tx);
  const policyId = (await market.policyCount()) - 1n;
  console.log(`policy #${policyId}, capacity ${Number(capBefore) / 1e6} -> ${Number(await market.capacityNotional()) / 1e6}, locked ${Number(await vault.lockedAssets()) / 1e6}`);

  tx = await oracle.postClose(dep.stocks.NVDAB.address, epochId, closePx); await tx.wait(); log(`posted Friday close $${Number(closePx) / 1e8}`, tx);
  tx = await oracle.postOpen(dep.stocks.NVDAB.address, epochId, openPx); await tx.wait(); log(`posted Monday open $${Number(openPx) / 1e8} (${gapPct}%)`, tx);
  const before = await usdt.balanceOf(signer.address);
  tx = await market.settle(policyId); await tx.wait(); log("settled", tx);
  const p = await market.getPolicy(policyId);
  console.log(`gap ${Number(p.gapBps) / 100}% -> payout $${Number(p.payoutUsd) / 1e6} (received ${Number((await usdt.balanceOf(signer.address)) - before) / 1e6}); vault locked now ${Number(await vault.lockedAssets()) / 1e6}`);
  fs.writeFileSync(path.join(__dirname, "..", "deployments", `${network.name}.e2e.json`), JSON.stringify({ policyId: policyId.toString(), epochId: epochId.toString(), gapPct, barrierBps, payoutUsd: p.payoutUsd.toString(), at: new Date().toISOString() }, null, 2));
}
main().catch((e) => { console.error(e); process.exit(1); });
