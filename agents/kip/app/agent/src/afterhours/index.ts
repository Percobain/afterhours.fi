/** afterhours.fi additions to the Studio seller: the paid x402 cover route, a status endpoint and the keeper loop. */
import express, { type Express } from "express";
import { AH } from "./config.js";
import { ERC20_ABI, MARKET_ABI, agentAddress, publicClient } from "./chain.js";
import { bindCoverRouter } from "./bindCover.js";
import { bookSize, keeperState, startKeeper } from "./keeper.js";
import { deployment } from "./market.js";

export { registerAfterhoursTools } from "./tools.js";

export function mountAfterhours(app: Express): void {
  // the afterhours.fi site reads this agent's status and can buy cover from the browser
  app.use(["/cover", "/afterhours"], (req, res, next) => {
    const origin = req.header("origin");
    if (origin && AH.corsOrigins.includes(origin)) {
      res.set("access-control-allow-origin", origin);
      res.set("vary", "origin");
      res.set("access-control-allow-headers", "content-type, payment-signature");
      res.set("access-control-expose-headers", "payment-required, payment-response");
      res.set("access-control-allow-methods", "GET, POST, OPTIONS");
    }
    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }
    next();
  });
  app.use(bindCoverRouter);

  app.get("/afterhours/status", express.json(), async (_req, res) => {
    try {
      const dep = await deployment();
      const me = agentAddress();
      const [bnb, usdt, binder] = await Promise.all([
        publicClient.getBalance({ address: me }),
        publicClient.readContract({ address: dep.contracts.USDT, abi: ERC20_ABI, functionName: "balanceOf", args: [me] }),
        publicClient.readContract({ address: dep.contracts.CoverMarket, abi: MARKET_ABI, functionName: "isBinder", args: [me] }),
      ]);
      res.json({
        agent: "Kip, the afterhours.fi underwriting agent",
        address: me,
        chainId: AH.chainId,
        authorisedBinder: binder,
        balances: { nativeWei: bnb.toString(), usdt: usdt.toString() },
        sells: { method: "POST", path: "/cover/bind", payment: "x402 v2 exact/permit2", facilitator: AH.facilitator },
        mcp: { path: "/mcp", tools: ["quote_cover", "market_status", "gap_history", "pool_health", "my_book"] },
        keeper: { ...keeperState, openPolicies: bookSize(), intervalMs: AH.keeperIntervalMs },
        market: dep.contracts.CoverMarket,
      });
    } catch (e) {
      res.status(502).json({ error: (e as Error).message });
    }
  });

  startKeeper();
}
