"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.statsRouter = void 0;
const express_1 = require("express");
const data_1 = require("../data");
const util_1 = require("./util");
exports.statsRouter = (0, express_1.Router)();
exports.statsRouter.get("/stats", (0, util_1.asyncHandler)(async (_req, res) => {
    res.setHeader("Cache-Control", "public, max-age=300");
    res.json((0, data_1.getSummary)());
}));
exports.statsRouter.get("/famous", (0, util_1.asyncHandler)(async (req, res) => {
    const s = (0, data_1.getSummary)();
    const kind = typeof req.query.kind === "string" ? req.query.kind : null;
    const ticker = typeof req.query.ticker === "string" ? req.query.ticker.toUpperCase() : null;
    let list = s.famous;
    if (kind)
        list = list.filter((f) => f.kind === kind);
    if (ticker)
        list = list.filter((f) => f.ticker.toUpperCase() === ticker);
    res.setHeader("Cache-Control", "public, max-age=300");
    res.json({
        count: list.length,
        kinds: [...new Set(s.famous.map((f) => f.kind))],
        famous: list.map((f) => ({
            ...f,
            gapPct: Math.round(f.gap * 1e4) / 100,
            covered: f.hermee_covered !== null && f.hermee_bare !== null ? f.hermee_covered - f.hermee_bare : null,
            headline: f.gap < 0
                ? `${f.event}: ${f.ticker} opened ${(f.gap * 100).toFixed(1)}% on Monday${f.premium_bp !== null ? `; a 3% floor cost ${f.premium_bp}bp that Friday` : ""}.`
                : `${f.event}: ${f.ticker} opened +${(f.gap * 100).toFixed(1)}% on Monday; the floor was not needed.`,
        })),
    });
}));
//# sourceMappingURL=stats.js.map