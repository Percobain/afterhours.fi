"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.zUint = exports.zChainId = exports.zAddress = void 0;
exports.asyncHandler = asyncHandler;
exports.parseQuery = parseQuery;
exports.requireChain = requireChain;
const zod_1 = require("zod");
const viem_1 = require("viem");
const config_1 = require("../config");
const errors_1 = require("../util/errors");
function asyncHandler(fn) {
    return (req, res, next) => {
        fn(req, res, next).catch(next);
    };
}
exports.zAddress = zod_1.z
    .string()
    .refine((v) => (0, viem_1.isAddress)(v), { message: "invalid address" })
    .transform((v) => (0, viem_1.getAddress)(v));
exports.zChainId = zod_1.z.coerce
    .number()
    .int()
    .refine((v) => (0, config_1.chainIds)().includes(v), { message: `chainId must be one of ${(0, config_1.chainIds)().join(", ")}` });
exports.zUint = zod_1.z
    .string()
    .regex(/^\d+$/, "must be a positive integer string")
    .transform((v) => BigInt(v));
function parseQuery(schema, input) {
    const r = schema.safeParse(input);
    if (!r.success) {
        const issues = r.error.issues.map((i) => `${i.path.join(".") || "query"}: ${i.message}`);
        throw new errors_1.ApiError(400, "bad_request", issues.join("; "), { issues });
    }
    return r.data;
}
function requireChain(chainId) {
    const c = (0, config_1.getChain)(chainId);
    if (!c)
        throw new errors_1.ApiError(400, "unsupported_chain", `chainId ${chainId} is not supported`);
    return c;
}
//# sourceMappingURL=util.js.map