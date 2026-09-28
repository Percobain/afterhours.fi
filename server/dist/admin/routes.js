"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const config_1 = require("../config");
const indexer_1 = require("../indexer");
const epoch_1 = require("../jobs/epoch");
const scheduler_1 = require("../jobs/scheduler");
const prices_1 = require("../market/prices");
const tokens_1 = require("../market/tokens");
const store_1 = require("../store");
const errors_1 = require("../util/errors");
const util_1 = require("../routes/util");
exports.adminRouter = (0, express_1.Router)();
function adminGuard(req, _res, next) {
    if (!config_1.config.adminSecret) {
        next(new errors_1.ApiError(403, "admin_disabled", "ADMIN_SECRET is not configured; admin routes are disabled"));
        return;
    }
    const given = req.header("x-admin-secret") ?? "";
    if (given.length !== config_1.config.adminSecret.length || given !== config_1.config.adminSecret) {
        next(new errors_1.ApiError(401, "unauthorized", "bad or missing x-admin-secret"));
        return;
    }
    next();
}
exports.adminRouter.use(adminGuard);
const zPrices = zod_1.z.record(zod_1.z.string(), zod_1.z.coerce.number().positive()).optional();
const zChainBody = zod_1.z.object({ chainId: util_1.zChainId });
const zEpochParam = zod_1.z.object({ epochId: zod_1.z.coerce.number().int().positive() });
exports.adminRouter.get("/status", (0, util_1.asyncHandler)(async (_req, res) => {
    res.json({ store: store_1.store.mode(), indexer: (0, indexer_1.indexerStatus)(), jobs: (0, epoch_1.jobsSummary)(), overrides: (0, prices_1.getPriceOverrides)(), lastKnownPrices: (0, prices_1.lastKnownPrices)(), recentQuotes: store_1.store.quoteLogs.recentInMemory(20) });
}));
/** POST /admin/prices { chainId, prices?: { NVDAB: 224.5 }, overrides?: { NVDA: 224.5 } } -> setLastPrices on the oracle */
exports.adminRouter.post("/prices", (0, util_1.asyncHandler)(async (req, res) => {
    const body = (0, util_1.parseQuery)(zod_1.z.object({ chainId: util_1.zChainId, prices: zPrices, overrides: zPrices, persistOverrides: zod_1.z.boolean().optional() }), req.body ?? {});
    if (body.overrides)
        for (const [t, p] of Object.entries(body.overrides))
            (0, prices_1.setPriceOverride)(t, p);
    const r = await (0, epoch_1.setLastPrices)(body.chainId, body.prices ?? {});
    res.json({ ok: true, ...r });
}));
/** Manual override map for demos: POST { ticker, price } (price null clears) */
exports.adminRouter.get("/overrides", (_req, res) => res.json({ overrides: (0, prices_1.getPriceOverrides)() }));
exports.adminRouter.post("/overrides", (0, util_1.asyncHandler)(async (req, res) => {
    const body = (0, util_1.parseQuery)(zod_1.z.object({ ticker: zod_1.z.string().min(1), price: zod_1.z.number().positive().nullable() }), req.body ?? {});
    (0, prices_1.setPriceOverride)(body.ticker, body.price);
    res.json({ ok: true, overrides: (0, prices_1.getPriceOverrides)() });
}));
exports.adminRouter.post("/close/:epochId", (0, util_1.asyncHandler)(async (req, res) => {
    const { epochId } = (0, util_1.parseQuery)(zEpochParam, req.params);
    const body = (0, util_1.parseQuery)(zod_1.z.object({ chainId: util_1.zChainId, prices: zPrices }), req.body ?? {});
    res.json(await (0, epoch_1.postClose)(body.chainId, epochId, body.prices ?? {}));
}));
exports.adminRouter.post("/open/:epochId", (0, util_1.asyncHandler)(async (req, res) => {
    const { epochId } = (0, util_1.parseQuery)(zEpochParam, req.params);
    const body = (0, util_1.parseQuery)(zod_1.z.object({ chainId: util_1.zChainId, prices: zPrices, allowFallback: zod_1.z.boolean().optional() }), req.body ?? {});
    res.json(await (0, epoch_1.postOpen)(body.chainId, epochId, { overrides: body.prices ?? {}, allowFallback: body.allowFallback ?? false }));
}));
exports.adminRouter.post("/void", (0, util_1.asyncHandler)(async (req, res) => {
    const body = (0, util_1.parseQuery)(zod_1.z.object({ chainId: util_1.zChainId, token: util_1.zAddress, epochId: zod_1.z.coerce.number().int().positive(), reason: zod_1.z.string().min(1).max(64) }), req.body ?? {});
    const tx = await (0, epoch_1.voidEpoch)(body.chainId, body.token, body.epochId, body.reason);
    res.json({ ok: true, tx });
}));
exports.adminRouter.post("/settle", (0, util_1.asyncHandler)(async (req, res) => {
    const body = (0, util_1.parseQuery)(zod_1.z.object({ chainId: util_1.zChainId, epochId: zod_1.z.coerce.number().int().positive().optional() }), req.body ?? {});
    res.json(await (0, epoch_1.settleEpoch)(body.chainId, body.epochId));
}));
exports.adminRouter.post("/epochs", (0, util_1.asyncHandler)(async (req, res) => {
    const body = (0, util_1.parseQuery)(zChainBody, req.body ?? {});
    res.json(await (0, epoch_1.openNextEpochs)(body.chainId));
}));
exports.adminRouter.post("/reindex", (0, util_1.asyncHandler)(async (req, res) => {
    const body = (0, util_1.parseQuery)(zod_1.z.object({ chainId: util_1.zChainId, fromBlock: zod_1.z.coerce.number().int().nonnegative().optional() }), req.body ?? {});
    await (0, indexer_1.resetCursor)(body.chainId, body.fromBlock);
    (0, tokens_1.invalidateTokens)(body.chainId);
    const r = await (0, indexer_1.runIndexerOnce)(body.chainId);
    res.json({ ok: true, ...r });
}));
exports.adminRouter.post("/index", (0, util_1.asyncHandler)(async (req, res) => {
    const body = (0, util_1.parseQuery)(zChainBody, req.body ?? {});
    res.json(await (0, indexer_1.runIndexerOnce)(body.chainId));
}));
exports.adminRouter.post("/refresh-prices", (0, util_1.asyncHandler)(async (_req, res) => {
    await (0, scheduler_1.refreshAllPrices)();
    res.json({ ok: true, lastKnownPrices: (0, prices_1.lastKnownPrices)() });
}));
exports.adminRouter.get("/tokens", (0, util_1.asyncHandler)(async (req, res) => {
    const { chainId } = (0, util_1.parseQuery)(zChainBody, req.query);
    (0, tokens_1.invalidateTokens)(chainId);
    res.json({ tokens: await (0, tokens_1.getTokens)(chainId) });
}));
//# sourceMappingURL=routes.js.map