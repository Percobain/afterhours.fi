"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.x402Router = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const store_1 = require("../store");
const facilitator_1 = require("../x402/facilitator");
const util_1 = require("./util");
/** x402 facilitator request body: { x402Version, paymentPayload, paymentRequirements } */
const FacilitatorBody = zod_1.z.object({
    x402Version: zod_1.z.literal(2).optional(),
    paymentPayload: zod_1.z.object({ x402Version: zod_1.z.literal(2), accepted: zod_1.z.any(), payload: zod_1.z.any(), resource: zod_1.z.any().optional() }).passthrough(),
    paymentRequirements: zod_1.z
        .object({
        scheme: zod_1.z.literal("exact"),
        network: zod_1.z.string().regex(/^eip155:\d+$/),
        amount: zod_1.z.string().regex(/^\d+$/),
        asset: zod_1.z.string(),
        payTo: zod_1.z.string(),
        maxTimeoutSeconds: zod_1.z.number().int().positive(),
        extra: zod_1.z.object({ assetTransferMethod: zod_1.z.literal("permit2") }).passthrough(),
    })
        .passthrough(),
});
function parseBody(body) {
    const parsed = FacilitatorBody.safeParse(body);
    if (!parsed.success)
        return { error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
    return { p: parsed.data.paymentPayload, r: parsed.data.paymentRequirements };
}
exports.x402Router = (0, express_1.Router)();
exports.x402Router.get("/x402/facilitator/supported", (_req, res) => {
    res.json((0, facilitator_1.supported)());
});
exports.x402Router.post("/x402/facilitator/verify", (0, util_1.asyncHandler)(async (req, res) => {
    const b = parseBody(req.body);
    if ("error" in b)
        return res.status(400).json({ isValid: false, invalidReason: `invalid_request: ${b.error}` });
    res.json(await (0, facilitator_1.verify)(b.p, b.r));
}));
exports.x402Router.post("/x402/facilitator/settle", (0, util_1.asyncHandler)(async (req, res) => {
    const b = parseBody(req.body);
    if ("error" in b)
        return res.status(400).json({ success: false, errorReason: `invalid_request: ${b.error}` });
    res.json(await (0, facilitator_1.settle)(b.p, b.r));
}));
/** agent-to-agent activity feed for the UI: x402 settlements, cover bound for buyers, settlements, feedback */
exports.x402Router.get("/agents/activity", (0, util_1.asyncHandler)(async (req, res) => {
    const q = (0, util_1.parseQuery)(zod_1.z.object({ chainId: util_1.zChainId, limit: zod_1.z.coerce.number().int().min(1).max(200).default(50) }), req.query);
    res.json({ chainId: q.chainId, events: await store_1.store.agentEvents.recent(q.chainId, q.limit) });
}));
//# sourceMappingURL=x402.js.map