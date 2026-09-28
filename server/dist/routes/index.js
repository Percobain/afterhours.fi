"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.apiRouter = apiRouter;
const express_1 = require("express");
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const routes_1 = require("../admin/routes");
const config_1 = require("./config");
const health_1 = require("./health");
const learn_1 = require("./learn");
const market_1 = require("./market");
const policies_1 = require("./policies");
const quote_1 = require("./quote");
const stats_1 = require("./stats");
const vault_1 = require("./vault");
function apiRouter() {
    const r = (0, express_1.Router)();
    const quoteLimiter = (0, express_rate_limit_1.default)({ windowMs: 60_000, limit: 60, standardHeaders: "draft-7", legacyHeaders: false, message: { error: "too many quote requests, slow down", code: "rate_limited" } });
    r.use(health_1.healthRouter);
    r.use(config_1.configRouter);
    r.use(market_1.marketRouter);
    r.use("/quote", quoteLimiter);
    r.use(quote_1.quoteRouter);
    r.use(policies_1.policiesRouter);
    r.use(vault_1.vaultRouter);
    r.use(stats_1.statsRouter);
    r.use(learn_1.learnRouter);
    r.use("/admin", routes_1.adminRouter);
    return r;
}
//# sourceMappingURL=index.js.map