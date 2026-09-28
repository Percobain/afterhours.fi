"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.quoteRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const quote_1 = require("../pricing/quote");
const util_1 = require("./util");
exports.quoteRouter = (0, express_1.Router)();
const QuoteQuery = zod_1.z.object({
    chainId: util_1.zChainId,
    buyer: util_1.zAddress,
    token: util_1.zAddress,
    notionalUsd: util_1.zUint,
    barrierBps: zod_1.z.coerce.number().int().min(100).max(2000).optional(),
    budgetBps: zod_1.z.coerce.number().int().min(1).max(2000).optional(),
});
exports.quoteRouter.get("/quote", (0, util_1.asyncHandler)(async (req, res) => {
    const q = (0, util_1.parseQuery)(QuoteQuery, req.query);
    const out = await (0, quote_1.buildQuote)({ chainId: q.chainId, buyer: q.buyer, token: q.token, notionalUsd: q.notionalUsd, barrierBps: q.barrierBps, budgetBps: q.budgetBps });
    res.setHeader("Cache-Control", "no-store");
    res.json(out);
}));
//# sourceMappingURL=quote.js.map