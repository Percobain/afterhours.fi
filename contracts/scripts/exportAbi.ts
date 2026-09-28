/** Exports ABIs to ../shared/abi/*.json for the server and client. */
import * as fs from "fs";
import * as path from "path";

const names = ["CoverMarket", "KeeperVault", "ReferenceOracle", "MockERC20"];
const out = path.join(__dirname, "..", "..", "shared", "abi");
fs.mkdirSync(out, { recursive: true });
for (const n of names) {
  const art = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "artifacts", "contracts", `${n}.sol`, `${n}.json`), "utf8"));
  fs.writeFileSync(path.join(out, `${n}.json`), JSON.stringify(art.abi, null, 2));
  console.log("exported", n);
}
