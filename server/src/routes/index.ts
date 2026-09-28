import { Router } from "express";
import rateLimit from "express-rate-limit";
import { adminRouter } from "../admin/routes";
import { configRouter } from "./config";
import { healthRouter } from "./health";
import { learnRouter } from "./learn";
import { marketRouter } from "./market";
import { policiesRouter } from "./policies";
import { quoteRouter } from "./quote";
import { statsRouter } from "./stats";
import { vaultRouter } from "./vault";

export function apiRouter(): Router {
  const r = Router();
  const quoteLimiter = rateLimit({ windowMs: 60_000, limit: 60, standardHeaders: "draft-7", legacyHeaders: false, message: { error: "too many quote requests, slow down", code: "rate_limited" } });
  r.use(healthRouter);
  r.use(configRouter);
  r.use(marketRouter);
  r.use("/quote", quoteLimiter);
  r.use(quoteRouter);
  r.use(policiesRouter);
  r.use(vaultRouter);
  r.use(statsRouter);
  r.use(learnRouter);
  r.use("/admin", adminRouter);
  return r;
}
