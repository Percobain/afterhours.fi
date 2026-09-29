// Copies shared/x402/x402.ts into a consumer's source tree (server, agents, client) so each package builds on its own.
//   node ../shared/x402/sync.mjs <destination-dir>
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const dest = process.argv[2];
if (!dest) {
  console.error("usage: node shared/x402/sync.mjs <destination-dir>");
  process.exit(1);
}
const src = fs.readFileSync(path.join(here, "x402.ts"), "utf8");
fs.mkdirSync(dest, { recursive: true });
fs.writeFileSync(path.join(dest, "x402.ts"), `// GENERATED from shared/x402/x402.ts by shared/x402/sync.mjs; do not edit this copy.\n${src}`);
console.log(`x402: synced to ${dest}`);
