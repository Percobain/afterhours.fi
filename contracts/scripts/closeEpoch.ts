/**
 * Admin: stop new purchases for an epoch by moving its bindDeadline to now (existing policies still settle normally).
 * Used to retire the demo epoch that scripts/e2e.ts opens, so nobody can buy cover on an outcome already posted.
 *   CLOSE_EPOCH_ID=1790692578 npx hardhat run scripts/closeEpoch.ts --network bscTestnet
 */
import { ethers, network } from "hardhat";
import fs from "node:fs";
import path from "node:path";

async function main() {
  const epochId = BigInt(process.env.CLOSE_EPOCH_ID ?? "0");
  if (epochId === 0n) throw new Error("set CLOSE_EPOCH_ID");
  const dep = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "deployments", `${network.name}.json`), "utf8"));
  const market = await ethers.getContractAt("CoverMarket", dep.contracts.CoverMarket);

  const before = await market.epochs(epochId);
  if (!before.exists) throw new Error(`epoch ${epochId} is not open on ${network.name}`);
  const now = BigInt((await ethers.provider.getBlock("latest"))!.timestamp);
  if (before.bindDeadline <= now) {
    console.log(`epoch ${epochId} already closed (bindDeadline ${before.bindDeadline} <= now ${now})`);
    return;
  }
  const tx = await market.openEpoch(epochId, now, before.expectedOpen);
  await tx.wait();
  const after = await market.epochs(epochId);
  console.log(`closed epoch ${epochId} on ${network.name}: bindDeadline ${before.bindDeadline} -> ${after.bindDeadline}  tx ${tx.hash}`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
