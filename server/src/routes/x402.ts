import { Router } from "express";
import { z } from "zod";
import { store } from "../store";
import { settle, supported, verify } from "../x402/facilitator";
import type { PaymentPayload, PaymentRequirements } from "../x402/x402";
import { asyncHandler, parseQuery, zChainId } from "./util";

/** x402 facilitator request body: { x402Version, paymentPayload, paymentRequirements } */
const FacilitatorBody = z.object({
  x402Version: z.literal(2).optional(),
  paymentPayload: z.object({ x402Version: z.literal(2), accepted: z.any(), payload: z.any(), resource: z.any().optional() }).passthrough(),
  paymentRequirements: z
    .object({
      scheme: z.literal("exact"),
      network: z.string().regex(/^eip155:\d+$/),
      amount: z.string().regex(/^\d+$/),
      asset: z.string(),
      payTo: z.string(),
      maxTimeoutSeconds: z.number().int().positive(),
      extra: z.object({ assetTransferMethod: z.literal("permit2") }).passthrough(),
    })
    .passthrough(),
});

function parseBody(body: unknown): { p: PaymentPayload; r: PaymentRequirements } | { error: string } {
  const parsed = FacilitatorBody.safeParse(body);
  if (!parsed.success) return { error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
  return { p: parsed.data.paymentPayload as unknown as PaymentPayload, r: parsed.data.paymentRequirements as unknown as PaymentRequirements };
}

export const x402Router = Router();

x402Router.get("/x402/facilitator/supported", (_req, res) => {
  res.json(supported());
});

x402Router.post(
  "/x402/facilitator/verify",
  asyncHandler(async (req, res) => {
    const b = parseBody(req.body);
    if ("error" in b) return res.status(400).json({ isValid: false, invalidReason: `invalid_request: ${b.error}` });
    res.json(await verify(b.p, b.r));
  }),
);

x402Router.post(
  "/x402/facilitator/settle",
  asyncHandler(async (req, res) => {
    const b = parseBody(req.body);
    if ("error" in b) return res.status(400).json({ success: false, errorReason: `invalid_request: ${b.error}` });
    res.json(await settle(b.p, b.r));
  }),
);

/** agent-to-agent activity feed for the UI: x402 settlements, cover bound for buyers, settlements, feedback */
x402Router.get(
  "/agents/activity",
  asyncHandler(async (req, res) => {
    const q = parseQuery(z.object({ chainId: zChainId, limit: z.coerce.number().int().min(1).max(200).default(50) }), req.query);
    res.json({ chainId: q.chainId, events: await store.agentEvents.recent(q.chainId, q.limit) });
  }),
);
