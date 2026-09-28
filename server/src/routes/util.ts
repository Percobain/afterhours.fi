import type { NextFunction, Request, RequestHandler, Response } from "express";
import { z } from "zod";
import { isAddress, getAddress, type Address } from "viem";
import { chainIds, getChain, type ChainConfig } from "../config";
import { ApiError } from "../util/errors";

export function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}

export const zAddress = z
  .string()
  .refine((v) => isAddress(v), { message: "invalid address" })
  .transform((v) => getAddress(v) as Address);

export const zChainId = z.coerce
  .number()
  .int()
  .refine((v) => chainIds().includes(v), { message: `chainId must be one of ${chainIds().join(", ")}` });

export const zUint = z
  .string()
  .regex(/^\d+$/, "must be a positive integer string")
  .transform((v) => BigInt(v));

export function parseQuery<T extends z.ZodTypeAny>(schema: T, input: unknown): z.infer<T> {
  const r = schema.safeParse(input);
  if (!r.success) {
    const issues = r.error.issues.map((i) => `${i.path.join(".") || "query"}: ${i.message}`);
    throw new ApiError(400, "bad_request", issues.join("; "), { issues });
  }
  return r.data;
}

export function requireChain(chainId: number): ChainConfig {
  const c = getChain(chainId);
  if (!c) throw new ApiError(400, "unsupported_chain", `chainId ${chainId} is not supported`);
  return c;
}
