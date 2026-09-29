/**
 * Testnet setup for the agent-to-agent demo: top up gas for Kip's underwriting agent and Hermee's buyer agent.
 * Sends native gas only; each agent claims its own test tokens from the MockERC20 faucets.
 *   AGENTS=0xKip,0xHermee GAS_EACH=0.05 npx hardhat run scripts/fundAgents.ts --network bscTestnet
 */
import { ethers, network } from "hardhat";

async function main() {
  if (!/testnet|sepolia|localhost|hardhat/i.test(network.name)) throw new Error(`refusing to fund agents on ${network.name}`);
  const agents = (process.env.AGENTS ?? "").split(",").map((x) => x.trim()).filter(Boolean);
  if (!agents.length) throw new Error("set AGENTS=0x...,0x...");
  const each = ethers.parseEther(process.env.GAS_EACH ?? "0.05");
  const [funder] = await ethers.getSigners();
  for (const a of agents) {
    const bal = await ethers.provider.getBalance(a);
    if (bal >= each) {
      console.log(`${a} already has ${ethers.formatEther(bal)} (skip)`);
      continue;
    }
    const tx = await funder.sendTransaction({ to: a, value: each - bal });
    await tx.wait();
    console.log(`${a} topped up to ${ethers.formatEther(each)}  tx ${tx.hash}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
