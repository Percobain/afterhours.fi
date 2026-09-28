"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.mongoReady = mongoReady;
exports.storeMode = storeMode;
exports.connectMongo = connectMongo;
exports.disconnectMongo = disconnectMongo;
const node_dns_1 = __importDefault(require("node:dns"));
const mongoose_1 = __importDefault(require("mongoose"));
const config_1 = require("./config");
const logger_1 = require("./logger");
mongoose_1.default.set("bufferCommands", false);
mongoose_1.default.set("strictQuery", true);
let attempted = false;
let dnsSwitched = false;
const opts = () => ({ dbName: config_1.config.mongoDbName, serverSelectionTimeoutMS: 5_000, connectTimeoutMS: 5_000 });
/** Some Windows/ISP resolvers refuse SRV queries (querySrv ECONNREFUSED); retry through public resolvers once. */
async function connectOnce() {
    try {
        await mongoose_1.default.connect(config_1.config.mongoUri, opts());
    }
    catch (e) {
        const msg = e.message;
        if (dnsSwitched || !/querySrv|ENOTFOUND|ECONNREFUSED/.test(msg) || !config_1.config.dnsFallbackServers.length)
            throw e;
        dnsSwitched = true;
        logger_1.logger.warn({ err: msg, servers: config_1.config.dnsFallbackServers }, "mongo SRV lookup failed; retrying with fallback DNS servers");
        node_dns_1.default.setServers(config_1.config.dnsFallbackServers);
        await mongoose_1.default.connect(config_1.config.mongoUri, opts());
    }
}
function mongoReady() {
    return mongoose_1.default.connection.readyState === 1;
}
function storeMode() {
    return mongoReady() ? "mongo" : "memory";
}
/**
 * Connects to MongoDB when MONGODB_URI is set. Never throws: on failure the server keeps running with the
 * in-memory store and mongoose keeps retrying in the background.
 */
async function connectMongo() {
    if (attempted)
        return;
    attempted = true;
    if (!config_1.config.mongoUri) {
        logger_1.logger.warn("MONGODB_URI is empty: running with the in-memory store (policies and stats are not persisted)");
        return;
    }
    mongoose_1.default.connection.on("connected", () => logger_1.logger.info("mongo connected"));
    mongoose_1.default.connection.on("disconnected", () => logger_1.logger.warn("mongo disconnected; falling back to the in-memory store until it returns"));
    mongoose_1.default.connection.on("error", (e) => logger_1.logger.warn({ err: e.message }, "mongo error"));
    try {
        await connectOnce();
    }
    catch (e) {
        logger_1.logger.warn({ err: e.message }, "mongo unreachable: running with the in-memory store; will retry in the background");
        retryLater();
    }
}
function retryLater() {
    setTimeout(async () => {
        if (mongoReady())
            return;
        try {
            await connectOnce();
        }
        catch {
            retryLater();
        }
    }, 60_000).unref();
}
async function disconnectMongo() {
    if (mongoose_1.default.connection.readyState !== 0)
        await mongoose_1.default.disconnect().catch(() => undefined);
}
//# sourceMappingURL=db.js.map