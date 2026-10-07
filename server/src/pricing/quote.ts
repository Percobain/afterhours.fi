/**
 * Builds and signs the EIP-712 Quote the client submits to CoverMarket.buyCover.
 *   domain: { name: "afterhours.fi CoverMarket", version: "1", chainId, verifyingContract: CoverMarket }
 *   Quote(address buyer,address token,uint64 epochId,uint256 notionalUsd,uint16 barrierBps,uint256 premiumUsd,uint64 expiry,uint256 nonce)
 * nonce = random uint256, expiry = now + QUOTE_TTL_SECONDS (15 min). When QUOTER_PRIVATE_KEY is empty the quote is
 * returned unsigned with `signature: null, signerConfigured: false`.
 */
import { randomBytes } from "node:crypto";
import { getAddress, type Address, type Hex } from "viem";
import { CoverMarketAbi, ReferenceOracleAbi } from "../abi";
import { getPublicClient, getQuoterAccount } from "../chains";
import { BARRIER_MENU, config, getChain, type TokenInfo } from "../config";
import { logger } from "../logger";
import { getUnderlyingPrice } from "../market/prices";
import { currentEpoch, findToken } from "../market/tokens";
import { store } from "../store";
import { ApiError } from "../util/errors";
import { nowSec } from "../util/time";
import { estimatedValue, pickForBudget, priceMenu, quoteBarrier, type BarrierPrice, type EstimatedValue } from "./engine";
import { getVol, type VolResult } from "./vol";

export const QUOTE_TYPES = {
  Quote: [
    { name: "buyer", type: "address" },
    { name: "token", type: "address" },
    { name: "epochId", type: "uint64" },
    { name: "notionalUsd", type: "uint256" },
    { name: "barrierBps", type: "uint16" },
    { name: "premiumUsd", type: "uint256" },
    { name: "expiry", type: "uint64" },
    { name: "nonce", type: "uint256" },
  ],
} as const;

export interface QuoteParams {
  chainId: number;
  buyer: Address;
  token: Address;
  notionalUsd: bigint;
  barrierBps?: number;
  budgetBps?: number;
}

export interface QuoteWire {
  buyer: Address;
  token: Address;
  epochId: number;
  notionalUsd: string;
  barrierBps: number;
  premiumUsd: string;
  expiry: number;
  nonce: string;
}

export interface QuoteResponse {
  quote: QuoteWire;
  signature: Hex | null;
  signerConfigured: boolean;
  quoter: Address | null;
  chainId: number;
  verifyingContract: Address | null;
  domain: { name: string; version: string; chainId: number; verifyingContract: Address | null };
  estimatedValue: EstimatedValue;
  floorPricePerShare: string | null;
  floorPricePerShareUsd: number | null;
  lastPricePerShare: string | null;
  lastPriceSource: string | null;
  requiredTokenBalance: string | null;
  capacityNotional: string | null;
  capacityOk: boolean | null;
  pricing: {
    mode: "barrier" | "budget";
    budgetBps: number | null;
    budgetShort: boolean;
    pricedOut: false;
    ticker: string | null;
    symbol: string | null;
    wrapper: string;
    tokenUnknown: boolean;
    rv20: number;
    volSource: string;
    volAsof: string;
    volSymbol: string | null;
    menu: BarrierPrice[];
  };
  epoch: { epochId: number; bindDeadline: number; expectedOpen: number; openOnChain: boolean | null; secondsToBell: number };
  expiresAt: string;
  notes: string[];
}

function randomNonce(): bigint {
  return BigInt(`0x${randomBytes(32).toString("hex")}`);
}

async function chainReads(chainId: number, token: Address, notionalUsd: bigint) {
  const c = getChain(chainId);
  if (!c?.contracts.CoverMarket || !c.contracts.ReferenceOracle) return null;
  try {
    const client = getPublicClient(chainId);
    const [required, capacity, lastPrice, minNotional, maxNotional] = await client.multicall({
      contracts: [
        { address: c.contracts.CoverMarket, abi: CoverMarketAbi, functionName: "requiredTokenBalance", args: [token, notionalUsd] },
        { address: c.contracts.CoverMarket, abi: CoverMarketAbi, functionName: "capacityNotional" },
        { address: c.contracts.ReferenceOracle, abi: ReferenceOracleAbi, functionName: "lastPrice", args: [token] },
        { address: c.contracts.CoverMarket, abi: CoverMarketAbi, functionName: "minNotionalUsd" },
        { address: c.contracts.CoverMarket, abi: CoverMarketAbi, functionName: "maxNotionalUsd" },
      ],
      allowFailure: true,
    });
    return {
      requiredTokenBalance: required.status === "success" ? required.result : null,
      capacityNotional: capacity.status === "success" ? capacity.result : null,
      lastPrice: lastPrice.status === "success" ? lastPrice.result : null,
      minNotional: minNotional.status === "success" ? minNotional.result : null,
      maxNotional: maxNotional.status === "success" ? maxNotional.result : null,
    };
  } catch (e) {
    logger.warn({ chainId, err: (e as Error).message }, "chain reads for quote failed");
    return null;
  }
}

export async function buildQuote(p: QuoteParams): Promise<QuoteResponse> {
  const c = getChain(p.chainId);
  if (!c) throw new ApiError(400, "unsupported_chain", `chainId ${p.chainId} is not supported`);
  if ((p.barrierBps === undefined) === (p.budgetBps === undefined)) {
    throw new ApiError(400, "bad_request", "provide exactly one of barrierBps or budgetBps");
  }
  const notes: string[] = [];
  const buyer = getAddress(p.buyer);
  const token = getAddress(p.token);

  const known: TokenInfo | null = await findToken(p.chainId, token);
  const tokenUnknown = !known;
  const ticker = known?.ticker ?? null;
  const symbol = known?.symbol ?? null;
  const wrapper = known?.wrapper ?? "unknown";
  if (tokenUnknown) notes.push("token is not in the allow-list for this chain; priced with the default 40% vol, the market will reject the purchase");

  const [vol, reads, epoch] = await Promise.all([getVol(ticker, symbol), chainReads(p.chainId, token, p.notionalUsd), currentEpoch(p.chainId)]);
  const rv20 = (vol as VolResult).rv20;

  const minN = reads?.minNotional ?? config.pricing.minNotionalUsd;
  const maxN = reads?.maxNotional ?? config.pricing.maxNotionalUsd;
  if (p.notionalUsd < minN || p.notionalUsd > maxN) {
    throw new ApiError(400, "notional_out_of_range", `notionalUsd must be between ${minN} and ${maxN} (USDT units, 6 decimals)`, { minNotionalUsd: minN.toString(), maxNotionalUsd: maxN.toString() });
  }

  let picked: BarrierPrice;
  let menu: BarrierPrice[];
  let budgetShort = false;
  let mode: "barrier" | "budget";
  if (p.budgetBps !== undefined) {
    mode = "budget";
    const r = pickForBudget(p.budgetBps, rv20);
    picked = r.pick;
    menu = r.menu;
    budgetShort = r.budgetShort;
    if (budgetShort) notes.push(`no barrier in the menu fits ${p.budgetBps}bp this week; showing the widest (10%) floor`);
  } else {
    mode = "barrier";
    menu = priceMenu(rv20);
    picked = quoteBarrier(p.barrierBps as number, rv20, p.notionalUsd);
  }
  const quoted = quoteBarrier(picked.barrierBps, rv20, p.notionalUsd);
  const ev = estimatedValue(quoted);

  if (quoted.pricedOut && !budgetShort) {
    throw new ApiError(422, "priced_out", `Priced out: a ${quoted.barrierBps / 100}% floor on this name would cost ${quoted.chargedBp.toFixed(1)}bp this week, above the 2% cap.`, {
      estimatedValue: ev,
      pricing: { ticker, symbol, rv20, volSource: vol.source, menu, tokenUnknown },
      suggestion: menu.find((m) => !m.pricedOut) ? `try a ${(menu.find((m) => !m.pricedOut) as BarrierPrice).barrierBps / 100}% floor or budget mode` : "no barrier in the menu is priceable this week",
    });
  }

  const now = nowSec();
  const expiry = Math.min(now + config.quoteTtlSeconds, epoch.bindDeadline > now ? epoch.bindDeadline : now + config.quoteTtlSeconds);
  if (epoch.bindDeadline <= now) notes.push("the sale window for this epoch has closed; the quote is informational");
  if (epoch.openOnChain === false) notes.push("this epoch is not open on-chain yet (run openEpoch or POST /api/admin/epochs)");

  const nonce = randomNonce();
  const message = {
    buyer,
    token,
    epochId: BigInt(epoch.epochId),
    notionalUsd: p.notionalUsd,
    barrierBps: quoted.barrierBps,
    premiumUsd: quoted.premiumUsd,
    expiry: BigInt(expiry),
    nonce,
  };

  const account = getQuoterAccount(p.chainId);
  const verifyingContract = c.contracts.CoverMarket ?? null;
  let signature: Hex | null = null;
  if (account && verifyingContract) {
    signature = await account.signTypedData({
      domain: { name: "afterhours.fi CoverMarket", version: "1", chainId: p.chainId, verifyingContract },
      types: QUOTE_TYPES,
      primaryType: "Quote",
      message,
    });
  } else if (account && !verifyingContract) {
    notes.push("CoverMarket is not deployed on this chain; quote returned unsigned");
  }

  // floor price per share from the oracle's last price, else the live underlying price
  let lastPrice8: bigint | null = reads?.lastPrice && reads.lastPrice > 0n ? reads.lastPrice : null;
  let lastPriceSource: string | null = lastPrice8 ? "oracle" : null;
  if (!lastPrice8 && ticker) {
    const live = await getUnderlyingPrice({ ticker, symbol, wrapper }).catch(() => null);
    if (live) {
      lastPrice8 = BigInt(live.price8);
      lastPriceSource = live.source;
    }
  }
  const floor8 = lastPrice8 ? (lastPrice8 * BigInt(10_000 - quoted.barrierBps)) / 10_000n : null;
  const capacityOk = reads?.capacityNotional !== null && reads?.capacityNotional !== undefined ? reads.capacityNotional >= p.notionalUsd : null;
  if (capacityOk === false) notes.push("the Keeper pool cannot back this notional right now; try a smaller amount");

  const wire: QuoteWire = {
    buyer,
    token,
    epochId: epoch.epochId,
    notionalUsd: p.notionalUsd.toString(),
    barrierBps: quoted.barrierBps,
    premiumUsd: quoted.premiumUsd.toString(),
    expiry,
    nonce: nonce.toString(),
  };

  void store.quoteLogs
    .insert({
      chainId: p.chainId,
      buyer: buyer.toLowerCase(),
      token: token.toLowerCase(),
      ticker,
      epochId: epoch.epochId,
      notionalUsd: wire.notionalUsd,
      barrierBps: wire.barrierBps,
      premiumUsd: wire.premiumUsd,
      nonce: wire.nonce,
      expiry,
      signed: !!signature,
      rv20,
      volSource: vol.source,
      fairBp: quoted.fairBp,
      chargedBp: quoted.chargedBp,
      mode,
      createdAt: new Date(),
    })
    .catch(() => undefined);

  return {
    quote: wire,
    signature,
    signerConfigured: !!account,
    quoter: account?.address ?? null,
    chainId: p.chainId,
    verifyingContract,
    domain: { name: "afterhours.fi CoverMarket", version: "1", chainId: p.chainId, verifyingContract },
    estimatedValue: ev,
    floorPricePerShare: floor8?.toString() ?? null,
    floorPricePerShareUsd: floor8 ? Number(floor8) / 1e8 : null,
    lastPricePerShare: lastPrice8?.toString() ?? null,
    lastPriceSource,
    requiredTokenBalance: reads?.requiredTokenBalance?.toString() ?? null,
    capacityNotional: reads?.capacityNotional?.toString() ?? null,
    capacityOk,
    pricing: {
      mode,
      budgetBps: p.budgetBps ?? null,
      budgetShort,
      pricedOut: false,
      ticker,
      symbol,
      wrapper,
      tokenUnknown,
      rv20,
      volSource: vol.source,
      volAsof: vol.asof,
      volSymbol: vol.symbol,
      menu,
    },
    epoch: { epochId: epoch.epochId, bindDeadline: epoch.bindDeadline, expectedOpen: epoch.expectedOpen, openOnChain: epoch.openOnChain, secondsToBell: Math.max(0, epoch.bindDeadline - now) },
    expiresAt: new Date(expiry * 1000).toISOString(),
    notes,
  };
}

export const barrierMenu = BARRIER_MENU;
