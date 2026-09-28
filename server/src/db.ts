import dns from "node:dns";
import mongoose from "mongoose";
import { config } from "./config";
import { logger } from "./logger";

mongoose.set("bufferCommands", false);
mongoose.set("strictQuery", true);

let attempted = false;
let dnsSwitched = false;

const opts = () => ({ dbName: config.mongoDbName, serverSelectionTimeoutMS: 5_000, connectTimeoutMS: 5_000 });

/** Some Windows/ISP resolvers refuse SRV queries (querySrv ECONNREFUSED); retry through public resolvers once. */
async function connectOnce(): Promise<void> {
  try {
    await mongoose.connect(config.mongoUri, opts());
  } catch (e) {
    const msg = (e as Error).message;
    if (dnsSwitched || !/querySrv|ENOTFOUND|ECONNREFUSED/.test(msg) || !config.dnsFallbackServers.length) throw e;
    dnsSwitched = true;
    logger.warn({ err: msg, servers: config.dnsFallbackServers }, "mongo SRV lookup failed; retrying with fallback DNS servers");
    dns.setServers(config.dnsFallbackServers);
    await mongoose.connect(config.mongoUri, opts());
  }
}

export function mongoReady(): boolean {
  return mongoose.connection.readyState === 1;
}

export function storeMode(): "mongo" | "memory" {
  return mongoReady() ? "mongo" : "memory";
}

/**
 * Connects to MongoDB when MONGODB_URI is set. Never throws: on failure the server keeps running with the
 * in-memory store and mongoose keeps retrying in the background.
 */
export async function connectMongo(): Promise<void> {
  if (attempted) return;
  attempted = true;
  if (!config.mongoUri) {
    logger.warn("MONGODB_URI is empty: running with the in-memory store (policies and stats are not persisted)");
    return;
  }
  mongoose.connection.on("connected", () => logger.info("mongo connected"));
  mongoose.connection.on("disconnected", () => logger.warn("mongo disconnected; falling back to the in-memory store until it returns"));
  mongoose.connection.on("error", (e) => logger.warn({ err: e.message }, "mongo error"));
  try {
    await connectOnce();
  } catch (e) {
    logger.warn({ err: (e as Error).message }, "mongo unreachable: running with the in-memory store; will retry in the background");
    retryLater();
  }
}

function retryLater(): void {
  setTimeout(async () => {
    if (mongoReady()) return;
    try {
      await connectOnce();
    } catch {
      retryLater();
    }
  }, 60_000).unref();
}

export async function disconnectMongo(): Promise<void> {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect().catch(() => undefined);
}
