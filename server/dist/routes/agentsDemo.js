"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.agentsDemoRouter = void 0;
/**
 * Live demo for the site: runs Hermee's agent (shared/hermee) on the server with a testnet-only demo key and streams
 * each step as server-sent events, so a visitor can watch one agent pay another over x402 and get a real policy.
 *
 * Guardrails: BSC Testnet only, one run at a time, a cooldown between runs, amounts capped, menu floors only.
 */
const express_1 = require("express");
const chains_1 = require("viem/chains");
const accounts_1 = require("viem/accounts");
const zod_1 = require("zod");
const config_1 = require("../config");
const logger_1 = require("../logger");
const core_1 = require("../hermee/core");
const localPayer_1 = require("../hermee/localPayer");
const util_1 = require("./util");
const CHAIN_ID = 97;
let running = false;
let lastRunAt = 0;
const Body = zod_1.z.object({
    token: zod_1.z.string().default("NVDAB"),
    amountUsd: zod_1.z.coerce.number().min(10).max(5_000).default(1_000),
    floorPct: zod_1.z.coerce.number().refine((v) => [1, 2, 3, 5, 7, 10].includes(v), "floor must be one of 1, 2, 3, 5, 7, 10").default(5),
});
let hermeeAddr;
function hermeeAddress() {
    if (hermeeAddr !== undefined)
        return hermeeAddr;
    try {
        hermeeAddr = config_1.config.agents.hermeeDemoKey ? (0, accounts_1.privateKeyToAccount)(config_1.config.agents.hermeeDemoKey).address : null;
    }
    catch {
        hermeeAddr = null;
    }
    return hermeeAddr;
}
exports.agentsDemoRouter = (0, express_1.Router)();
exports.agentsDemoRouter.get("/agents/demo", (_req, res) => {
    res.json({
        enabled: !!config_1.config.agents.hermeeDemoKey && !!config_1.config.agents.kipUrl,
        kipUrl: config_1.config.agents.kipUrl || null,
        hermee: hermeeAddress(),
        chainId: CHAIN_ID,
        busy: running,
        cooldownSeconds: Math.max(0, Math.ceil((lastRunAt + config_1.config.agents.demoCooldownMs - Date.now()) / 1000)),
    });
});
exports.agentsDemoRouter.post("/agents/demo/protect", (0, util_1.asyncHandler)(async (req, res) => {
    if (!config_1.config.agents.hermeeDemoKey || !config_1.config.agents.kipUrl)
        return res.status(503).json({ error: "the agent demo is not configured on this server" });
    const b = Body.safeParse(req.body ?? {});
    if (!b.success)
        return res.status(400).json({ error: b.error.issues.map((i) => i.message).join("; ") });
    if (running)
        return res.status(429).json({ error: "another visitor's agents are trading right now; try again in a minute" });
    const wait = lastRunAt + config_1.config.agents.demoCooldownMs - Date.now();
    if (wait > 0)
        return res.status(429).json({ error: `cooling down; try again in ${Math.ceil(wait / 1000)}s` });
    const c = (0, config_1.getChain)(CHAIN_ID);
    const tok = c?.tokens.find((t) => t.symbol.toLowerCase() === b.data.token.toLowerCase() || t.ticker.toLowerCase() === b.data.token.toLowerCase());
    if (!c?.contracts.USDT || !tok)
        return res.status(400).json({ error: `unknown token ${b.data.token}` });
    running = true;
    lastRunAt = Date.now();
    res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache, no-transform", connection: "keep-alive", "x-accel-buffering": "no" });
    const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    const heartbeat = setInterval(() => res.write(": keep-alive\n\n"), 15_000);
    try {
        const payer = (0, localPayer_1.localPayer)({ privateKey: config_1.config.agents.hermeeDemoKey, chain: chains_1.bscTestnet, rpcUrl: c.rpcUrl });
        send("step", { step: "ask", status: "info", message: `Hermee's agent (${payer.address.slice(0, 8)}…) checks its wallet on BSC Testnet`, at: new Date().toISOString() });
        const txs = await payer.ensureTestFunds({ token: tok.address, minToken: 10n ** 18n, usdt: c.contracts.USDT, minUsdt: 10n * 10n ** 6n });
        if (txs.length)
            send("step", { step: "ask", status: "info", message: "Claimed test tokens from the faucet", data: { txs }, at: new Date().toISOString() });
        const result = await (0, core_1.protectWeekend)({ kipUrl: config_1.config.agents.kipUrl, token: tok.address, notionalUsd: BigInt(Math.round(b.data.amountUsd * 1e6)), barrierBps: Math.round(b.data.floorPct * 100), maxPremiumBps: 100 }, payer, (e) => send("step", e));
        send("result", { ...result, hermee: payer.address, explorer: c.explorer });
    }
    catch (e) {
        logger_1.logger.warn({ err: e.message }, "agent demo failed");
        send("result", { ok: false, error: e.message });
    }
    finally {
        clearInterval(heartbeat);
        running = false;
        res.end();
    }
}));
//# sourceMappingURL=agentsDemo.js.map