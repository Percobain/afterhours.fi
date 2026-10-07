"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getQuoterAccount = getQuoterAccount;
exports.quoterAddress = quoterAddress;
exports.getPublicClient = getPublicClient;
exports.getWalletClient = getWalletClient;
exports.requireWallet = requireWallet;
const viem_1 = require("viem");
const accounts_1 = require("viem/accounts");
const config_1 = require("./config");
const logger_1 = require("./logger");
const errors_1 = require("./util/errors");
const publicClients = new Map();
const walletClients = new Map();
// keyed by chainId; 0 = the default QUOTER_PRIVATE_KEY
const quoterAccounts = new Map();
/**
 * The server's signer (quotes + oracle keeper writes + x402 settlement). With a chainId, QUOTER_PRIVATE_KEY_<chainId>
 * wins over QUOTER_PRIVATE_KEY, so mainnet can sign as its own owner/quoter while testnets keep theirs.
 * null when the key is empty or invalid.
 */
function getQuoterAccount(chainId) {
    const slot = chainId ?? 0;
    if (quoterAccounts.has(slot))
        return quoterAccounts.get(slot);
    const k = (chainId ? config_1.config.quoterPrivateKeyFor(chainId) : config_1.config.quoterPrivateKey).trim();
    const name = chainId && process.env[`QUOTER_PRIVATE_KEY_${chainId}`]?.trim() ? `QUOTER_PRIVATE_KEY_${chainId}` : "QUOTER_PRIVATE_KEY";
    let account = null;
    if (!k) {
        logger_1.logger.warn({ chainId }, `${name} is empty: quotes are returned unsigned and keeper jobs are disabled`);
    }
    else {
        try {
            account = (0, accounts_1.privateKeyToAccount)((k.startsWith("0x") ? k : `0x${k}`));
            logger_1.logger.info({ chainId, quoter: account.address, from: name }, "quoter signer loaded");
        }
        catch (e) {
            logger_1.logger.error({ chainId, err: e.message }, `${name} is not a valid private key; running unsigned`);
        }
    }
    quoterAccounts.set(slot, account);
    return account;
}
function quoterAddress(chainId) {
    return getQuoterAccount(chainId)?.address ?? null;
}
function getPublicClient(chainId) {
    const existing = publicClients.get(chainId);
    if (existing)
        return existing;
    const c = (0, config_1.getChain)(chainId);
    if (!c)
        throw new errors_1.ApiError(400, "unsupported_chain", `chainId ${chainId} is not supported`);
    const client = (0, viem_1.createPublicClient)({
        chain: c.viemChain,
        transport: (0, viem_1.http)(c.rpcUrl, { timeout: 12_000, retryCount: 2, retryDelay: 400 }),
        batch: { multicall: { wait: 16 } },
    });
    publicClients.set(chainId, client);
    return client;
}
function getWalletClient(chainId) {
    const existing = walletClients.get(chainId);
    if (existing)
        return existing;
    const account = getQuoterAccount(chainId);
    const c = (0, config_1.getChain)(chainId);
    if (!account || !c)
        return null;
    const client = (0, viem_1.createWalletClient)({ account, chain: c.viemChain, transport: (0, viem_1.http)(c.rpcUrl, { timeout: 20_000, retryCount: 1 }) });
    walletClients.set(chainId, client);
    return client;
}
function requireWallet(chainId) {
    const w = getWalletClient(chainId);
    if (!w)
        throw new errors_1.ApiError(503, "signer_not_configured", "QUOTER_PRIVATE_KEY is not configured; on-chain writes are disabled");
    return w;
}
//# sourceMappingURL=chains.js.map