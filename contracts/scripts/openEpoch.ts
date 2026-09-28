/** Opens the next two weekend epochs on an existing deployment (run weekly, or let the server do it). */
import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const dep = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "deployments", `${network.name}.json`), "utf8"));
  const market = await ethers.getContractAt("CoverMarket", dep.contracts.CoverMarket);
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 20, 0, 0));
  let add = (5 - d.getUTCDay() + 7) % 7;
  if (add === 0 && now.getTime() > d.getTime()) add = 7;
  d.setUTCDate(d.getUTCDate() + add);
  for (let k = 0; k < 2; k++) {
    const epochId = Math.floor(d.getTime() / 1000) + k * 7 * 86400;
    const e = await market.epochs(epochId);
    if (!e.exists) {
      await (await market.openEpoch(epochId, epochId, epochId + 65.5 * 3600)).wait();
      console.log("opened", epochId, new Date(epochId * 1000).toISOString());
    } else console.log("exists", epochId);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
