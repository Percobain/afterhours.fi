/**
 * Gas price for scripts that send transactions. Nothing is hardcoded:
 *   GAS_PRICE_GWEI       explicit price (e.g. 0.05); when unset, the network's own eth_gasPrice is used
 *   MAX_GAS_PRICE_GWEI   safety cap: refuse to send above it (only checked when set)
 * Transactions go out as legacy (type 0) at exactly that price. On BSC the base fee is 0, so a type-2 transaction
 * would only add a priority fee on top for nothing.
 */
import { ethers } from "hardhat";

export async function resolveGasPrice(): Promise<bigint> {
  const fromEnv = process.env.GAS_PRICE_GWEI?.trim();
  const price = fromEnv ? ethers.parseUnits(fromEnv, "gwei") : BigInt(await ethers.provider.send("eth_gasPrice", []));
  const cap = process.env.MAX_GAS_PRICE_GWEI?.trim();
  if (cap && price > ethers.parseUnits(cap, "gwei")) {
    throw new Error(`gas price ${ethers.formatUnits(price, "gwei")} gwei is above MAX_GAS_PRICE_GWEI=${cap}; refusing to send`);
  }
  return price;
}

export async function txOverrides(): Promise<{ gasPrice: bigint; type: 0 }> {
  return { gasPrice: await resolveGasPrice(), type: 0 };
}
