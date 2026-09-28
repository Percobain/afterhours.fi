import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";
dotenv.config();

const PK = process.env.DEPLOYER_PRIVATE_KEY && process.env.DEPLOYER_PRIVATE_KEY.length > 0 ? [process.env.DEPLOYER_PRIVATE_KEY] : [];
const ALCHEMY = process.env.ALCHEMY_API_KEY || "";
const SEPOLIA_URL = process.env.SEPOLIA_RPC_URL || (ALCHEMY ? `https://eth-sepolia.g.alchemy.com/v2/${ALCHEMY}` : "https://ethereum-sepolia-rpc.publicnode.com");
const BSC_TESTNET_URL = process.env.BSC_TESTNET_RPC_URL || (ALCHEMY ? `https://bnb-testnet.g.alchemy.com/v2/${ALCHEMY}` : "https://data-seed-prebsc-1-s1.bnbchain.org:8545");

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: { optimizer: { enabled: true, runs: 200 }, viaIR: true, evmVersion: "cancun" },
  },
  networks: {
    hardhat: { chainId: 31337 },
    localhost: { url: "http://127.0.0.1:8545" },
    sepolia: {
      url: SEPOLIA_URL,
      chainId: 11155111,
      accounts: PK,
    },
    bscTestnet: {
      url: BSC_TESTNET_URL,
      chainId: 97,
      accounts: PK,
    },
  },
  etherscan: {
    // Etherscan API v2: one key for every chain (Etherscan covers BscScan under v2 as well)
    apiKey: process.env.ETHERSCAN_API_KEY || "",
  },
  sourcify: { enabled: false },
  mocha: { timeout: 120000 },
};

export default config;
