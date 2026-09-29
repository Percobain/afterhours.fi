"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = exports.BARRIER_MENU = void 0;
exports.wrapperFor = wrapperFor;
exports.tickerFromSymbol = tickerFromSymbol;
exports.getChain = getChain;
exports.chainIds = chainIds;
exports.isDeployed = isDeployed;
exports.deployedChains = deployedChains;
exports.publicRpcUrl = publicRpcUrl;
const dotenv_1 = __importDefault(require("dotenv"));
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const viem_1 = require("viem");
const chains_1 = require("viem/chains");
const paths_1 = require("./paths");
const logger_1 = require("./logger");
dotenv_1.default.config({ path: node_path_1.default.join(paths_1.SERVER_ROOT, ".env") });
function env(name, def = "") {
    const v = process.env[name];
    return v === undefined || v === "" ? def : v;
}
function envNum(name, def) {
    const raw = env(name);
    if (raw === "")
        return def;
    const v = Number(raw);
    return Number.isFinite(v) ? v : def;
}
function envBool(name, def) {
    const v = env(name).toLowerCase();
    if (v === "")
        return def;
    return v === "1" || v === "true" || v === "yes";
}
function envAddress(name) {
    const v = env(name);
    if (!v)
        return undefined;
    if (!(0, viem_1.isAddress)(v)) {
        logger_1.logger.warn({ name, value: v }, "ignoring invalid address in env");
        return undefined;
    }
    return (0, viem_1.getAddress)(v);
}
exports.BARRIER_MENU = [100, 200, 300, 500, 700, 1000];
const PUBLIC_RPC = {
    sepolia: "https://ethereum-sepolia-rpc.publicnode.com",
    bscTestnet: "https://data-seed-prebsc-1-s1.bnbchain.org:8545",
};
/** RPC policy: explicit override > Alchemy (ALCHEMY_API_KEY) > public RPC (warned). */
function resolveRpc(key, overrideVar, alchemyHost, alchemyKey) {
    const override = env(overrideVar);
    if (override)
        return { url: override, source: "override" };
    if (alchemyKey)
        return { url: `https://${alchemyHost}/v2/${alchemyKey}`, source: "alchemy" };
    logger_1.logger.warn({ chain: key }, `ALCHEMY_API_KEY and ${overrideVar} are both empty; falling back to a public RPC (rate-limited, best effort)`);
    return { url: PUBLIC_RPC[key], source: "public" };
}
function wrapperFor(symbol, given) {
    if (given === "bstock" || given === "ondo" || given === "xstock")
        return given;
    if (symbol.endsWith("on"))
        return "ondo";
    if (symbol.endsWith("B"))
        return "bstock";
    if (symbol.endsWith("x"))
        return "xstock";
    return "unknown";
}
function tickerFromSymbol(symbol) {
    return symbol.replace(/(on|B|x)$/, "").toUpperCase();
}
function loadDeployment(key) {
    const fp = node_path_1.default.join(paths_1.DEPLOYMENTS_DIR, `${key}.json`);
    if (!node_fs_1.default.existsSync(fp))
        return null;
    try {
        const data = JSON.parse(node_fs_1.default.readFileSync(fp, "utf8"));
        return { file: fp, data };
    }
    catch (e) {
        logger_1.logger.warn({ fp, err: e.message }, "could not parse deployment file");
        return null;
    }
}
function parseEnvTokens(chainId) {
    const raw = env(`TOKENS_${chainId}`);
    if (!raw)
        return [];
    try {
        const arr = JSON.parse(raw);
        return arr
            .filter((t) => t && typeof t.symbol === "string" && (0, viem_1.isAddress)(t.address))
            .map((t) => ({
            symbol: t.symbol,
            address: (0, viem_1.getAddress)(t.address),
            ticker: (t.ticker ?? tickerFromSymbol(t.symbol)).toUpperCase(),
            name: t.name ?? t.symbol,
            decimals: t.decimals ?? 18,
            wrapper: wrapperFor(t.symbol, t.wrapper),
        }));
    }
    catch (e) {
        logger_1.logger.warn({ err: e.message }, `TOKENS_${chainId} is not valid JSON`);
        return [];
    }
}
function buildChain(spec, alchemyKey) {
    const { key, chainId } = spec;
    const dep = loadDeployment(key);
    const d = dep?.data;
    const addr = (envName, fromFile) => {
        const e = envAddress(`${envName}_${chainId}`);
        if (e)
            return e;
        if (fromFile && (0, viem_1.isAddress)(fromFile))
            return (0, viem_1.getAddress)(fromFile);
        return undefined;
    };
    const tokens = [];
    if (d?.stocks) {
        for (const [symbol, s] of Object.entries(d.stocks)) {
            if (!s || !(0, viem_1.isAddress)(s.address))
                continue;
            tokens.push({
                symbol,
                address: (0, viem_1.getAddress)(s.address),
                ticker: (s.ticker ?? tickerFromSymbol(symbol)).toUpperCase(),
                name: s.name ?? symbol,
                decimals: s.decimals ?? 18,
                wrapper: wrapperFor(symbol, s.wrapper),
            });
        }
    }
    for (const t of parseEnvTokens(chainId)) {
        if (!tokens.find((x) => x.address.toLowerCase() === t.address.toLowerCase()))
            tokens.push(t);
    }
    const epochs = (d?.epochs ?? []).map((e) => ({
        epochId: Number(e.epochId),
        bindDeadline: Number(e.bindDeadline ?? e.epochId),
        expectedOpen: Number(e.expectedOpen),
    }));
    const rpc = resolveRpc(key, spec.overrideVar, spec.alchemyHost, alchemyKey);
    const deployBlockEnv = envNum(`DEPLOY_BLOCK_${chainId}`, NaN);
    return {
        chainId,
        key,
        name: spec.name,
        rpcUrl: rpc.url,
        rpcSource: rpc.source,
        explorer: spec.explorer,
        viemChain: spec.viemChain,
        contracts: {
            CoverMarket: addr("CONTRACT_COVER_MARKET", d?.contracts?.CoverMarket),
            KeeperVault: addr("CONTRACT_KEEPER_VAULT", d?.contracts?.KeeperVault),
            ReferenceOracle: addr("CONTRACT_REFERENCE_ORACLE", d?.contracts?.ReferenceOracle),
            USDT: addr("CONTRACT_USDT", d?.contracts?.USDT),
        },
        deployer: d?.deployer && (0, viem_1.isAddress)(d.deployer) ? (0, viem_1.getAddress)(d.deployer) : undefined,
        quoter: d?.quoter && (0, viem_1.isAddress)(d.quoter) ? (0, viem_1.getAddress)(d.quoter) : undefined,
        deployBlock: Number.isFinite(deployBlockEnv) ? deployBlockEnv : d?.deployBlock,
        tokens,
        epochs,
        binders: (d?.binders ?? []).filter((b) => (0, viem_1.isAddress)(b)).map((b) => (0, viem_1.getAddress)(b)),
        deploymentFile: dep?.file ?? null,
    };
}
const alchemyKey = env("ALCHEMY_API_KEY");
exports.config = {
    port: envNum("PORT", 4000),
    // Bind on all IPv4 interfaces; hosts like Render only route to 0.0.0.0.
    host: env("HOST", "0.0.0.0"),
    nodeEnv: env("NODE_ENV", "development"),
    mongoUri: env("MONGODB_URI"),
    mongoDbName: env("MONGODB_DB", "afterhours"),
    // Comma-separated resolvers used when the OS resolver refuses the SRV lookup behind mongodb+srv:// URIs.
    dnsFallbackServers: env("DNS_FALLBACK_SERVERS", "8.8.8.8,1.1.1.1").split(",").map((x) => x.trim()).filter(Boolean),
    quoterPrivateKey: env("QUOTER_PRIVATE_KEY"),
    agents: {
        // public URL of Kip's Agent Studio agent (the underwriter that sells cover over x402)
        kipUrl: env("KIP_AGENT_URL", "https://afterhours-kip.onrender.com").replace(/\/+$/, ""),
        // TESTNET-ONLY key for the site's live demo buyer (Hermee's agent); empty disables the demo
        hermeeDemoKey: env("HERMEE_DEMO_PRIVATE_KEY"),
        demoCooldownMs: envNum("AGENT_DEMO_COOLDOWN_MS", 45_000),
    },
    x402: {
        // testnet stand-in for Binance's b402 facilitator; on mainnet agents point at b402 instead
        facilitatorEnabled: envBool("X402_FACILITATOR_ENABLED", true),
        // chains the facilitator settles on; the canonical x402 Permit2 proxy must exist there (BSC testnet does)
        networks: env("X402_NETWORKS", "97").split(",").map((x) => Number(x.trim())).filter((n) => Number.isFinite(n) && n > 0),
        // gas payer for settlements; falls back to the quoter key
        facilitatorPrivateKey: env("FACILITATOR_PRIVATE_KEY"),
    },
    adminSecret: env("ADMIN_SECRET"),
    clientOrigin: env("CLIENT_ORIGIN", "http://localhost:3000"),
    alchemyApiKey: alchemyKey,
    binanceWeb3ApiKey: env("BINANCE_WEB3_API_KEY"),
    binanceWeb3ApiSecret: env("BINANCE_WEB3_API_SECRET"),
    trustProxy: envBool("TRUST_PROXY", false),
    jobsEnabled: envBool("JOBS_ENABLED", true),
    indexerEnabled: envBool("INDEXER_ENABLED", true),
    indexerIntervalMs: envNum("INDEXER_INTERVAL_MS", 30_000),
    indexerChunkBlocks: envNum("INDEXER_CHUNK_BLOCKS", 5_000),
    indexerLookbackBlocks: envNum("INDEXER_LOOKBACK_BLOCKS", 100_000),
    indexerSmallChunkDelayMs: envNum("INDEXER_SMALL_CHUNK_DELAY_MS", 250),
    indexerConfirmations: envNum("INDEXER_CONFIRMATIONS", 2),
    priceRefreshCron: env("PRICE_REFRESH_CRON", "*/5 * * * *"),
    quoteTtlSeconds: envNum("QUOTE_TTL_SECONDS", 15 * 60),
    epochCloseHourUtc: envNum("EPOCH_CLOSE_HOUR_UTC", 20),
    openRetryMinutes: envNum("OPEN_RETRY_MINUTES", 2),
    openRetryWindowMinutes: envNum("OPEN_RETRY_WINDOW_MINUTES", 120),
    openFallbackAfterMinutes: envNum("OPEN_FALLBACK_AFTER_MINUTES", 120),
    closeWindowMinutes: envNum("CLOSE_WINDOW_MINUTES", 360),
    settleChunk: 50,
    pricing: {
        load: envNum("PRICING_LOAD", 1.5),
        floorFraction: envNum("PRICING_FLOOR_FRACTION", 0.0001),
        maxChargedFraction: envNum("PRICING_MAX_CHARGED_FRACTION", 0.02),
        defaultVol: envNum("DEFAULT_VOL", 0.4),
        payoutCapBps: 2000,
        minNotionalUsd: 10000000n,
        maxNotionalUsd: 1000000000000n,
    },
    binance: {
        spotBase: env("BINANCE_SPOT_BASE", "https://api.binance.com"),
        klinesEnabled: envBool("BINANCE_KLINES_ENABLED", true),
        maxRequestsPerMinute: envNum("BINANCE_MAX_RPM", 20),
        web3Base: env("BINANCE_WEB3_BASE", "https://www.binance.com"),
    },
    chains: {
        11155111: buildChain({ key: "sepolia", chainId: 11155111, name: "Ethereum Sepolia", viemChain: chains_1.sepolia, explorer: "https://sepolia.etherscan.io", overrideVar: "SEPOLIA_RPC_URL", alchemyHost: "eth-sepolia.g.alchemy.com" }, alchemyKey),
        97: buildChain({ key: "bscTestnet", chainId: 97, name: "BSC Testnet", viemChain: chains_1.bscTestnet, explorer: "https://testnet.bscscan.com", overrideVar: "BSC_TESTNET_RPC_URL", alchemyHost: "bnb-testnet.g.alchemy.com" }, alchemyKey),
    },
};
function getChain(chainId) {
    return exports.config.chains[chainId];
}
function chainIds() {
    return Object.keys(exports.config.chains).map(Number);
}
function isDeployed(c) {
    return !!(c.contracts.CoverMarket && c.contracts.ReferenceOracle && c.contracts.KeeperVault);
}
function deployedChains() {
    return chainIds()
        .map((id) => exports.config.chains[id])
        .filter((c) => !!c && isDeployed(c));
}
/** Redacts the RPC URL for public responses (never leak the Alchemy key). */
function publicRpcUrl(c) {
    if (exports.config.alchemyApiKey && c.rpcUrl.includes(exports.config.alchemyApiKey))
        return c.rpcUrl.replace(exports.config.alchemyApiKey, "<ALCHEMY_API_KEY>");
    return c.rpcUrl;
}
//# sourceMappingURL=config.js.map