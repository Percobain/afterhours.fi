"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApp = createApp;
const cors_1 = __importDefault(require("cors"));
const express_1 = __importDefault(require("express"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const helmet_1 = __importDefault(require("helmet"));
const config_1 = require("./config");
const db_1 = require("./db");
const logger_1 = require("./logger");
const routes_1 = require("./routes");
const errors_1 = require("./util/errors");
const json_1 = require("./util/json");
function createApp() {
    const app = (0, express_1.default)();
    app.disable("x-powered-by");
    app.set("json replacer", json_1.jsonReplacer);
    if (config_1.config.trustProxy)
        app.set("trust proxy", 1);
    // Keep-alive probe for uptime pingers (cron-job.org) so the Render free instance never idles out.
    // Registered before helmet/cors/rate limiting and touches no DB or RPC, so frequent pings cost nothing.
    app.all("/health", (_req, res) => {
        res.set("cache-control", "no-store").json({ ok: true, service: "afterhours-server", store: (0, db_1.storeMode)(), uptimeSeconds: Math.round(process.uptime()), now: new Date().toISOString() });
    });
    app.use((0, helmet_1.default)({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
    const origins = config_1.config.clientOrigin
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    let originPattern = null;
    try {
        originPattern = config_1.config.clientOriginPattern ? new RegExp(config_1.config.clientOriginPattern) : null;
    }
    catch {
        logger_1.logger.warn({ pattern: config_1.config.clientOriginPattern }, "CLIENT_ORIGIN_PATTERN is not a valid regex; ignoring it");
    }
    app.use((0, cors_1.default)({
        origin: (origin, cb) => {
            if (!origin || origins.includes("*") || origins.includes(origin) || /^https?:\/\/localhost(:\d+)?$/.test(origin) || originPattern?.test(origin))
                cb(null, true);
            else
                cb(null, false);
        },
        credentials: false,
        allowedHeaders: ["Content-Type", "x-admin-secret"],
    }));
    app.use(express_1.default.json({ limit: "256kb" }));
    app.use((0, express_rate_limit_1.default)({ windowMs: 60_000, limit: 300, standardHeaders: "draft-7", legacyHeaders: false, message: { error: "too many requests", code: "rate_limited" } }));
    app.use((req, res, next) => {
        const t0 = process.hrtime.bigint();
        res.on("finish", () => {
            const ms = Number(process.hrtime.bigint() - t0) / 1e6;
            const line = { method: req.method, path: req.originalUrl.split("?")[0], status: res.statusCode, ms: Math.round(ms) };
            if (res.statusCode >= 500)
                logger_1.logger.error(line, "request");
            else if (req.originalUrl !== "/api/health" && req.originalUrl !== "/health")
                logger_1.logger.debug(line, "request");
        });
        next();
    });
    app.get("/", (_req, res) => res.json({ service: "afterhours-server", docs: "/health, /api/health, /api/config, /api/quote, /api/market-status, /api/tokens, /api/policies/:address, /api/vault, /api/stats, /api/famous, /api/learn" }));
    app.use("/api", (0, routes_1.apiRouter)());
    app.use((req, res) => {
        res.status(404).json({ error: `no route for ${req.method} ${req.path}`, code: "not_found" });
    });
    app.use((err, _req, res, _next) => {
        if (err instanceof errors_1.ApiError) {
            res.status(err.status).json({ error: err.message, code: err.code, ...(err.extra ?? {}) });
            return;
        }
        const e = err;
        if (e?.type === "entity.parse.failed") {
            res.status(400).json({ error: "invalid JSON body", code: "bad_request" });
            return;
        }
        logger_1.logger.error({ err: e?.message ?? String(err) }, "unhandled error");
        res.status(500).json({ error: "internal error", code: "internal" });
    });
    return app;
}
//# sourceMappingURL=app.js.map