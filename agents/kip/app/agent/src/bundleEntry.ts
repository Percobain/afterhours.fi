/**
 * Entry for the prebuilt single-file bundle (bundle/kip.mjs) that Render runs with no install or build step.
 * Same server as `bag dev` / dualMain.ts: A2A + MCP + the afterhours.fi x402 cover route and keeper.
 *   npm run bundle   (then commit bundle/kip.mjs)
 */
import "./bundleArgvShim.js";
import { buildDualApp } from "./dualMain.js";

const host = process.env.AGENT_BIND_HOST || "0.0.0.0";
const port = Number(process.env.AGENT_PORT || process.env.PORT || "9000");

buildDualApp()
  .then(({ app }) => {
    app.listen(port, host, () => console.log(`[kip] afterhours.fi underwriting agent serving A2A + MCP + x402 on ${host}:${port}`));
  })
  .catch((e) => {
    console.error("[kip] fatal:", e);
    process.exit(1);
  });
