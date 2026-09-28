import { Router } from "express";
import { z } from "zod";
import { buildQuote } from "../pricing/quote";
import { asyncHandler, parseQuery, zAddress, zChainId, zUint } from "./util";

export const quoteRouter = Router();

const QuoteQuery = z.object({
  chainId: zChainId,
  buyer: zAddress,
  token: zAddress,
  notionalUsd: zUint,
  barrierBps: z.coerce.number().int().min(100).max(2000).optional(),
  budgetBps: z.coerce.number().int().min(1).max(2000).optional(),
});

quoteRouter.get(
  "/quote",
  asyncHandler(async (req, res) => {
    const q = parseQuery(QuoteQuery, req.query);
    const out = await buildQuote({ chainId: q.chainId, buyer: q.buyer, token: q.token, notionalUsd: q.notionalUsd, barrierBps: q.barrierBps, budgetBps: q.budgetBps });
    res.setHeader("Cache-Control", "no-store");
    res.json(out);
  }),
);
