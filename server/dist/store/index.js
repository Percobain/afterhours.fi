"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.store = void 0;
/**
 * Storage facade. Every method uses MongoDB when it is connected and an in-memory store otherwise, so the
 * server keeps serving quotes, config and (session-scoped) policies/stats when MONGODB_URI is empty or down.
 */
const db_1 = require("../db");
const logger_1 = require("../logger");
const models_1 = require("../models");
const mem = {
    policies: new Map(),
    stats: new Map(),
    cursors: new Map(),
    epochPrices: new Map(),
    quoteLogs: [],
};
const pk = (chainId, policyId) => `${chainId}:${policyId}`;
const sk = (chainId, address) => `${chainId}:${address.toLowerCase()}`;
const ck = (chainId, key) => `${chainId}:${key}`;
const ek = (chainId, epochId, token) => `${chainId}:${epochId}:${token.toLowerCase()}`;
async function withMongo(name, mongo, memory) {
    if ((0, db_1.mongoReady)()) {
        try {
            return await mongo();
        }
        catch (e) {
            logger_1.logger.warn({ op: name, err: e.message }, "mongo op failed, using memory store");
        }
    }
    return memory();
}
exports.store = {
    mode() {
        return (0, db_1.mongoReady)() ? "mongo" : "memory";
    },
    policies: {
        async upsert(doc) {
            doc.buyer = doc.buyer.toLowerCase();
            doc.token = doc.token.toLowerCase();
            doc.updatedAt = new Date();
            mem.policies.set(pk(doc.chainId, doc.policyId), { ...doc });
            await withMongo("policies.upsert", async () => {
                await models_1.PolicyModel.updateOne({ chainId: doc.chainId, policyId: doc.policyId }, { $set: doc }, { upsert: true });
            }, () => undefined);
        },
        async get(chainId, policyId) {
            return withMongo("policies.get", async () => (await models_1.PolicyModel.findOne({ chainId, policyId }).lean()) ?? null, () => mem.policies.get(pk(chainId, policyId)) ?? null);
        },
        async byBuyer(chainId, buyer) {
            const b = buyer.toLowerCase();
            return withMongo("policies.byBuyer", async () => models_1.PolicyModel.find({ chainId, buyer: b }).sort({ epochId: -1, policyId: -1 }).lean(), () => [...mem.policies.values()]
                .filter((p) => p.chainId === chainId && p.buyer === b)
                .sort((a, b2) => b2.epochId - a.epochId || b2.policyId - a.policyId));
        },
        async open(chainId, epochId) {
            return withMongo("policies.open", async () => models_1.PolicyModel.find({ chainId, status: "Open", ...(epochId !== undefined ? { epochId } : {}) }).sort({ policyId: 1 }).lean(), () => [...mem.policies.values()]
                .filter((p) => p.chainId === chainId && p.status === "Open" && (epochId === undefined || p.epochId === epochId))
                .sort((a, b) => a.policyId - b.policyId));
        },
        async count(chainId) {
            return withMongo("policies.count", async () => models_1.PolicyModel.countDocuments({ chainId }), () => [...mem.policies.values()].filter((p) => p.chainId === chainId).length);
        },
        async clear(chainId) {
            for (const [k, v] of mem.policies)
                if (v.chainId === chainId)
                    mem.policies.delete(k);
            await withMongo("policies.clear", async () => {
                await models_1.PolicyModel.deleteMany({ chainId });
            }, () => undefined);
        },
    },
    stats: {
        async upsert(doc) {
            doc.address = doc.address.toLowerCase();
            doc.updatedAt = new Date();
            mem.stats.set(sk(doc.chainId, doc.address), { ...doc });
            await withMongo("stats.upsert", async () => {
                await models_1.UserStatsModel.updateOne({ chainId: doc.chainId, address: doc.address }, { $set: doc }, { upsert: true });
            }, () => undefined);
        },
        async get(chainId, address) {
            const a = address.toLowerCase();
            return withMongo("stats.get", async () => (await models_1.UserStatsModel.findOne({ chainId, address: a }).lean()) ?? null, () => mem.stats.get(sk(chainId, a)) ?? null);
        },
    },
    cursors: {
        async get(chainId, key = "indexer") {
            return withMongo("cursors.get", async () => (await models_1.CursorModel.findOne({ chainId, key }).lean())?.block ?? null, () => mem.cursors.get(ck(chainId, key))?.block ?? null);
        },
        async set(chainId, block, key = "indexer") {
            const doc = { chainId, key, block, updatedAt: new Date() };
            mem.cursors.set(ck(chainId, key), doc);
            await withMongo("cursors.set", async () => {
                await models_1.CursorModel.updateOne({ chainId, key }, { $set: doc }, { upsert: true });
            }, () => undefined);
        },
        async clear(chainId, key = "indexer") {
            mem.cursors.delete(ck(chainId, key));
            await withMongo("cursors.clear", async () => {
                await models_1.CursorModel.deleteOne({ chainId, key });
            }, () => undefined);
        },
    },
    epochPrices: {
        async upsert(partial) {
            const key = ek(partial.chainId, partial.epochId, partial.token);
            const existing = (await this.get(partial.chainId, partial.epochId, partial.token)) ?? {
                chainId: partial.chainId,
                epochId: partial.epochId,
                token: partial.token.toLowerCase(),
                symbol: null,
                closePrice: null,
                openPrice: null,
                closeSource: null,
                openSource: null,
                closeTx: null,
                openTx: null,
                closePostedAt: null,
                openPostedAt: null,
                voided: false,
                voidReason: null,
                updatedAt: new Date(),
            };
            const doc = { ...existing, ...partial, token: partial.token.toLowerCase(), updatedAt: new Date() };
            mem.epochPrices.set(key, doc);
            await withMongo("epochPrices.upsert", async () => {
                await models_1.EpochPriceModel.updateOne({ chainId: doc.chainId, epochId: doc.epochId, token: doc.token }, { $set: doc }, { upsert: true });
            }, () => undefined);
            return doc;
        },
        async get(chainId, epochId, token) {
            return withMongo("epochPrices.get", async () => (await models_1.EpochPriceModel.findOne({ chainId, epochId, token: token.toLowerCase() }).lean()) ?? null, () => mem.epochPrices.get(ek(chainId, epochId, token)) ?? null);
        },
        async list(chainId, epochId) {
            return withMongo("epochPrices.list", async () => models_1.EpochPriceModel.find({ chainId, epochId }).lean(), () => [...mem.epochPrices.values()].filter((e) => e.chainId === chainId && e.epochId === epochId));
        },
    },
    quoteLogs: {
        async insert(doc) {
            mem.quoteLogs.push(doc);
            if (mem.quoteLogs.length > 5_000)
                mem.quoteLogs.splice(0, mem.quoteLogs.length - 5_000);
            await withMongo("quoteLogs.insert", async () => {
                await models_1.QuoteLogModel.create(doc);
            }, () => undefined);
        },
        recentInMemory(limit = 50) {
            return mem.quoteLogs.slice(-limit).reverse();
        },
    },
};
//# sourceMappingURL=index.js.map