import { Router, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import { config } from "../config";
import { indexerStatus, resetCursor, runIndexerOnce } from "../indexer";
import { openNextEpochs, postClose, postOpen, setLastPrices, settleEpoch, voidEpoch, jobsSummary } from "../jobs/epoch";
import { refreshAllPrices } from "../jobs/scheduler";
import { getPriceOverrides, lastKnownPrices, setPriceOverride } from "../market/prices";
import { getTokens, invalidateTokens } from "../market/tokens";
import { store } from "../store";
import { ApiError } from "../util/errors";
import { asyncHandler, parseQuery, zAddress, zChainId } from "../routes/util";

export const adminRouter = Router();

function adminGuard(req: Request, _res: Response, next: NextFunction): void {
  if (!config.adminSecret) {
    next(new ApiError(403, "admin_disabled", "ADMIN_SECRET is not configured; admin routes are disabled"));
    return;
  }
  const given = req.header("x-admin-secret") ?? "";
  if (given.length !== config.adminSecret.length || given !== config.adminSecret) {
    next(new ApiError(401, "unauthorized", "bad or missing x-admin-secret"));
    return;
  }
  next();
}
adminRouter.use(adminGuard);

const zPrices = z.record(z.string(), z.coerce.number().positive()).optional();
const zChainBody = z.object({ chainId: zChainId });
const zEpochParam = z.object({ epochId: z.coerce.number().int().positive() });

adminRouter.get(
  "/status",
  asyncHandler(async (_req, res) => {
    res.json({ store: store.mode(), indexer: indexerStatus(), jobs: jobsSummary(), overrides: getPriceOverrides(), lastKnownPrices: lastKnownPrices(), recentQuotes: store.quoteLogs.recentInMemory(20) });
  }),
);

/** POST /admin/prices { chainId, prices?: { NVDAB: 224.5 }, overrides?: { NVDA: 224.5 } } -> setLastPrices on the oracle */
adminRouter.post(
  "/prices",
  asyncHandler(async (req, res) => {
    const body = parseQuery(z.object({ chainId: zChainId, prices: zPrices, overrides: zPrices, persistOverrides: z.boolean().optional() }), req.body ?? {});
    if (body.overrides) for (const [t, p] of Object.entries(body.overrides)) setPriceOverride(t, p);
    const r = await setLastPrices(body.chainId, body.prices ?? {});
    res.json({ ok: true, ...r });
  }),
);

/** Manual override map for demos: POST { ticker, price } (price null clears) */
adminRouter.get("/overrides", (_req, res) => res.json({ overrides: getPriceOverrides() }));
adminRouter.post(
  "/overrides",
  asyncHandler(async (req, res) => {
    const body = parseQuery(z.object({ ticker: z.string().min(1), price: z.number().positive().nullable() }), req.body ?? {});
    setPriceOverride(body.ticker, body.price);
    res.json({ ok: true, overrides: getPriceOverrides() });
  }),
);

adminRouter.post(
  "/close/:epochId",
  asyncHandler(async (req, res) => {
    const { epochId } = parseQuery(zEpochParam, req.params);
    const body = parseQuery(z.object({ chainId: zChainId, prices: zPrices }), req.body ?? {});
    res.json(await postClose(body.chainId, epochId, body.prices ?? {}));
  }),
);

adminRouter.post(
  "/open/:epochId",
  asyncHandler(async (req, res) => {
    const { epochId } = parseQuery(zEpochParam, req.params);
    const body = parseQuery(z.object({ chainId: zChainId, prices: zPrices, allowFallback: z.boolean().optional() }), req.body ?? {});
    res.json(await postOpen(body.chainId, epochId, { overrides: body.prices ?? {}, allowFallback: body.allowFallback ?? false }));
  }),
);

adminRouter.post(
  "/void",
  asyncHandler(async (req, res) => {
    const body = parseQuery(z.object({ chainId: zChainId, token: zAddress, epochId: z.coerce.number().int().positive(), reason: z.string().min(1).max(64) }), req.body ?? {});
    const tx = await voidEpoch(body.chainId, body.token, body.epochId, body.reason);
    res.json({ ok: true, tx });
  }),
);

adminRouter.post(
  "/settle",
  asyncHandler(async (req, res) => {
    const body = parseQuery(z.object({ chainId: zChainId, epochId: z.coerce.number().int().positive().optional() }), req.body ?? {});
    res.json(await settleEpoch(body.chainId, body.epochId));
  }),
);

adminRouter.post(
  "/epochs",
  asyncHandler(async (req, res) => {
    const body = parseQuery(zChainBody, req.body ?? {});
    res.json(await openNextEpochs(body.chainId));
  }),
);

adminRouter.post(
  "/reindex",
  asyncHandler(async (req, res) => {
    const body = parseQuery(z.object({ chainId: zChainId, fromBlock: z.coerce.number().int().nonnegative().optional() }), req.body ?? {});
    await resetCursor(body.chainId, body.fromBlock);
    invalidateTokens(body.chainId);
    const r = await runIndexerOnce(body.chainId);
    res.json({ ok: true, ...r });
  }),
);

adminRouter.post(
  "/index",
  asyncHandler(async (req, res) => {
    const body = parseQuery(zChainBody, req.body ?? {});
    res.json(await runIndexerOnce(body.chainId));
  }),
);

adminRouter.post(
  "/refresh-prices",
  asyncHandler(async (_req, res) => {
    await refreshAllPrices();
    res.json({ ok: true, lastKnownPrices: lastKnownPrices() });
  }),
);

adminRouter.get(
  "/tokens",
  asyncHandler(async (req, res) => {
    const { chainId } = parseQuery(zChainBody, req.query);
    invalidateTokens(chainId);
    res.json({ tokens: await getTokens(chainId) });
  }),
);
