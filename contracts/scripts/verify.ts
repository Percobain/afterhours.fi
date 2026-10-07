/**
 * Verifies every contract from a deployment file on the explorer (Etherscan API v2, one key for every chain).
 *   npx hardhat run scripts/verify.ts --network bsc          (reads deployment-mainnet.json)
 *   npx hardhat run scripts/verify.ts --network bscTestnet   (reads deployments/bscTestnet.json)
 * Constructor arguments mirror scripts/deploy.ts. Already-verified contracts are skipped by the plugin.
 */
import hre, { ethers, network } from "hardhat";
import * as path from "path";

async function main() {
  const chainId = Number((await ethers.provider.getNetwork()).chainId);
  const file = chainId === 56 ? path.join(__dirname, "..", "deployment-mainnet.json") : path.join(__dirname, "..", "deployments", `${network.name}.json`);
  const d = require(file);
  const { USDT, ReferenceOracle, KeeperVault, CoverMarket } = d.contracts;

  const jobs: { label: string; address: string; contract: string; args: unknown[] }[] = [
    { label: "USDT", address: USDT, contract: "contracts/MockERC20.sol:MockERC20", args: ["Test USDT", "USDT", 6, 10_000n * 10n ** 6n, d.deployer] },
    ...Object.entries<any>(d.stocks).map(([symbol, s]) => ({
      label: symbol,
      address: s.address,
      contract: "contracts/MockERC20.sol:MockERC20",
      args: [s.name, symbol, 18, ethers.parseEther("100"), d.deployer],
    })),
    { label: "ReferenceOracle", address: ReferenceOracle, contract: "contracts/ReferenceOracle.sol:ReferenceOracle", args: [d.deployer] },
    { label: "KeeperVault", address: KeeperVault, contract: "contracts/KeeperVault.sol:KeeperVault", args: [USDT, d.deployer] },
    { label: "CoverMarket", address: CoverMarket, contract: "contracts/CoverMarket.sol:CoverMarket", args: [USDT, KeeperVault, ReferenceOracle, d.quoter, d.deployer] },
  ];

  const failed: string[] = [];
  for (const j of jobs) {
    try {
      await hre.run("verify:verify", { address: j.address, contract: j.contract, constructorArguments: j.args });
      console.log(`verified ${j.label} ${j.address}`);
    } catch (e) {
      const msg = (e as Error).message;
      if (/already verified/i.test(msg)) console.log(`already verified ${j.label} ${j.address}`);
      else {
        console.log(`FAILED ${j.label} ${j.address}: ${msg.split("\n")[0]}`);
        failed.push(j.label);
      }
    }
  }
  if (failed.length) throw new Error(`not verified: ${failed.join(", ")}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
