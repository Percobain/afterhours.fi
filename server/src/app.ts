import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { config } from "./config";
import { storeMode } from "./db";
import { logger } from "./logger";
import { apiRouter } from "./routes";
import { ApiError } from "./util/errors";
import { jsonReplacer } from "./util/json";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.set("json replacer", jsonReplacer);
  if (config.trustProxy) app.set("trust proxy", 1);

  // Keep-alive probe for uptime pingers (cron-job.org) so the Render free instance never idles out.
  // Registered before helmet/cors/rate limiting and touches no DB or RPC, so frequent pings cost nothing.
  app.all("/health", (_req, res) => {
    res.set("cache-control", "no-store").json({ ok: true, service: "afterhours-server", store: storeMode(), uptimeSeconds: Math.round(process.uptime()), now: new Date().toISOString() });
  });

  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  const origins = config.clientOrigin
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  let originPattern: RegExp | null = null;
  try {
    originPattern = config.clientOriginPattern ? new RegExp(config.clientOriginPattern) : null;
  } catch {
    logger.warn({ pattern: config.clientOriginPattern }, "CLIENT_ORIGIN_PATTERN is not a valid regex; ignoring it");
  }
  app.use(
    cors({
      origin: (origin, cb) => {
        if (!origin || origins.includes("*") || origins.includes(origin) || /^https?:\/\/localhost(:\d+)?$/.test(origin) || originPattern?.test(origin)) cb(null, true);
        else cb(null, false);
      },
      credentials: false,
      allowedHeaders: ["Content-Type", "x-admin-secret"],
    }),
  );
  app.use(express.json({ limit: "256kb" }));
  app.use(rateLimit({ windowMs: 60_000, limit: 300, standardHeaders: "draft-7", legacyHeaders: false, message: { error: "too many requests", code: "rate_limited" } }));

  app.use((req, res, next) => {
    const t0 = process.hrtime.bigint();
    res.on("finish", () => {
      const ms = Number(process.hrtime.bigint() - t0) / 1e6;
      const line = { method: req.method, path: req.originalUrl.split("?")[0], status: res.statusCode, ms: Math.round(ms) };
      if (res.statusCode >= 500) logger.error(line, "request");
      else if (req.originalUrl !== "/api/health" && req.originalUrl !== "/health") logger.debug(line, "request");
    });
    next();
  });

  app.get("/", (_req, res) => res.json({ service: "afterhours-server", docs: "/health, /api/health, /api/config, /api/quote, /api/market-status, /api/tokens, /api/policies/:address, /api/vault, /api/stats, /api/famous, /api/learn" }));
  app.use("/api", apiRouter());

  app.use((req, res) => {
    res.status(404).json({ error: `no route for ${req.method} ${req.path}`, code: "not_found" });
  });

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof ApiError) {
      res.status(err.status).json({ error: err.message, code: err.code, ...(err.extra ?? {}) });
      return;
    }
    const e = err as { type?: string; status?: number; message?: string };
    if (e?.type === "entity.parse.failed") {
      res.status(400).json({ error: "invalid JSON body", code: "bad_request" });
      return;
    }
    logger.error({ err: e?.message ?? String(err) }, "unhandled error");
    res.status(500).json({ error: "internal error", code: "internal" });
  });

  return app;
}
