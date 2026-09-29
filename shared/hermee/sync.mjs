// Copies Hermee's shared agent code into a consumer: <dest>/hermee/core.ts (+ localPayer.ts unless --browser)
// and <dest>/x402/x402.ts, keeping the "../x402/x402" import valid in every copy.
//   node shared/hermee/sync.mjs <dest-src-dir> [--browser]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const dest = process.argv[2];
const browser = process.argv.includes("--browser");
if (!dest) {
  console.error("usage: node shared/hermee/sync.mjs <dest-src-dir> [--browser]");
  process.exit(1);
}
const banner = (src) => `// GENERATED from shared/${src} by shared/hermee/sync.mjs; do not edit this copy.\n`;
const copy = (from, to, label) => {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.writeFileSync(to, banner(label) + fs.readFileSync(from, "utf8"));
};
copy(path.join(here, "core.ts"), path.join(dest, "hermee", "core.ts"), "hermee/core.ts");
if (!browser) copy(path.join(here, "localPayer.ts"), path.join(dest, "hermee", "localPayer.ts"), "hermee/localPayer.ts");
copy(path.join(here, "..", "x402", "x402.ts"), path.join(dest, "x402", "x402.ts"), "x402/x402.ts");
console.log(`hermee: synced to ${dest}${browser ? " (browser)" : ""}`);
