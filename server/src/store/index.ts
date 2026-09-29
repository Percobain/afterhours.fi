/**
 * Storage facade. Every method uses MongoDB when it is connected and an in-memory store otherwise, so the
 * server keeps serving quotes, config and (session-scoped) policies/stats when MONGODB_URI is empty or down.
 */
import { mongoReady } from "../db";
import { logger } from "../logger";
import { AgentEventModel, CursorModel, EpochPriceModel, PolicyModel, QuoteLogModel, UserStatsModel } from "../models";
import type { AgentEventDoc, CursorDoc, EpochPriceDoc, PolicyDoc, QuoteLogDoc, UserStatsDoc } from "../models/types";

const mem = {
  policies: new Map<string, PolicyDoc>(),
  stats: new Map<string, UserStatsDoc>(),
  cursors: new Map<string, CursorDoc>(),
  epochPrices: new Map<string, EpochPriceDoc>(),
  quoteLogs: [] as QuoteLogDoc[],
  agentEvents: [] as AgentEventDoc[],
};

const pk = (chainId: number, policyId: number) => `${chainId}:${policyId}`;
const sk = (chainId: number, address: string) => `${chainId}:${address.toLowerCase()}`;
const ck = (chainId: number, key: string) => `${chainId}:${key}`;
const ek = (chainId: number, epochId: number, token: string) => `${chainId}:${epochId}:${token.toLowerCase()}`;

async function withMongo<T>(name: string, mongo: () => Promise<T>, memory: () => T): Promise<T> {
  if (mongoReady()) {
    try {
      return await mongo();
    } catch (e) {
      logger.warn({ op: name, err: (e as Error).message }, "mongo op failed, using memory store");
    }
  }
  return memory();
}

export const store = {
  mode(): "mongo" | "memory" {
    return mongoReady() ? "mongo" : "memory";
  },

  policies: {
    async upsert(doc: PolicyDoc): Promise<void> {
      doc.buyer = doc.buyer.toLowerCase();
      doc.token = doc.token.toLowerCase();
      doc.updatedAt = new Date();
      mem.policies.set(pk(doc.chainId, doc.policyId), { ...doc });
      await withMongo(
        "policies.upsert",
        async () => {
          await PolicyModel.updateOne({ chainId: doc.chainId, policyId: doc.policyId }, { $set: doc }, { upsert: true });
        },
        () => undefined,
      );
    },
    async get(chainId: number, policyId: number): Promise<PolicyDoc | null> {
      return withMongo(
        "policies.get",
        async () => (await PolicyModel.findOne({ chainId, policyId }).lean<PolicyDoc>()) ?? null,
        () => mem.policies.get(pk(chainId, policyId)) ?? null,
      );
    },
    async byBuyer(chainId: number, buyer: string): Promise<PolicyDoc[]> {
      const b = buyer.toLowerCase();
      return withMongo(
        "policies.byBuyer",
        async () => PolicyModel.find({ chainId, buyer: b }).sort({ epochId: -1, policyId: -1 }).lean<PolicyDoc[]>(),
        () =>
          [...mem.policies.values()]
            .filter((p) => p.chainId === chainId && p.buyer === b)
            .sort((a, b2) => b2.epochId - a.epochId || b2.policyId - a.policyId),
      );
    },
    async open(chainId: number, epochId?: number): Promise<PolicyDoc[]> {
      return withMongo(
        "policies.open",
        async () => PolicyModel.find({ chainId, status: "Open", ...(epochId !== undefined ? { epochId } : {}) }).sort({ policyId: 1 }).lean<PolicyDoc[]>(),
        () =>
          [...mem.policies.values()]
            .filter((p) => p.chainId === chainId && p.status === "Open" && (epochId === undefined || p.epochId === epochId))
            .sort((a, b) => a.policyId - b.policyId),
      );
    },
    async count(chainId: number): Promise<number> {
      return withMongo(
        "policies.count",
        async () => PolicyModel.countDocuments({ chainId }),
        () => [...mem.policies.values()].filter((p) => p.chainId === chainId).length,
      );
    },
    async clear(chainId: number): Promise<void> {
      for (const [k, v] of mem.policies) if (v.chainId === chainId) mem.policies.delete(k);
      await withMongo(
        "policies.clear",
        async () => {
          await PolicyModel.deleteMany({ chainId });
        },
        () => undefined,
      );
    },
  },

  stats: {
    async upsert(doc: UserStatsDoc): Promise<void> {
      doc.address = doc.address.toLowerCase();
      doc.updatedAt = new Date();
      mem.stats.set(sk(doc.chainId, doc.address), { ...doc });
      await withMongo(
        "stats.upsert",
        async () => {
          await UserStatsModel.updateOne({ chainId: doc.chainId, address: doc.address }, { $set: doc }, { upsert: true });
        },
        () => undefined,
      );
    },
    async get(chainId: number, address: string): Promise<UserStatsDoc | null> {
      const a = address.toLowerCase();
      return withMongo(
        "stats.get",
        async () => (await UserStatsModel.findOne({ chainId, address: a }).lean<UserStatsDoc>()) ?? null,
        () => mem.stats.get(sk(chainId, a)) ?? null,
      );
    },
  },

  cursors: {
    async get(chainId: number, key = "indexer"): Promise<number | null> {
      return withMongo(
        "cursors.get",
        async () => (await CursorModel.findOne({ chainId, key }).lean<CursorDoc>())?.block ?? null,
        () => mem.cursors.get(ck(chainId, key))?.block ?? null,
      );
    },
    async set(chainId: number, block: number, key = "indexer"): Promise<void> {
      const doc: CursorDoc = { chainId, key, block, updatedAt: new Date() };
      mem.cursors.set(ck(chainId, key), doc);
      await withMongo(
        "cursors.set",
        async () => {
          await CursorModel.updateOne({ chainId, key }, { $set: doc }, { upsert: true });
        },
        () => undefined,
      );
    },
    async clear(chainId: number, key = "indexer"): Promise<void> {
      mem.cursors.delete(ck(chainId, key));
      await withMongo(
        "cursors.clear",
        async () => {
          await CursorModel.deleteOne({ chainId, key });
        },
        () => undefined,
      );
    },
  },

  epochPrices: {
    async upsert(partial: Partial<EpochPriceDoc> & Pick<EpochPriceDoc, "chainId" | "epochId" | "token">): Promise<EpochPriceDoc> {
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
      const doc: EpochPriceDoc = { ...existing, ...partial, token: partial.token.toLowerCase(), updatedAt: new Date() };
      mem.epochPrices.set(key, doc);
      await withMongo(
        "epochPrices.upsert",
        async () => {
          await EpochPriceModel.updateOne({ chainId: doc.chainId, epochId: doc.epochId, token: doc.token }, { $set: doc }, { upsert: true });
        },
        () => undefined,
      );
      return doc;
    },
    async get(chainId: number, epochId: number, token: string): Promise<EpochPriceDoc | null> {
      return withMongo(
        "epochPrices.get",
        async () => (await EpochPriceModel.findOne({ chainId, epochId, token: token.toLowerCase() }).lean<EpochPriceDoc>()) ?? null,
        () => mem.epochPrices.get(ek(chainId, epochId, token)) ?? null,
      );
    },
    async list(chainId: number, epochId: number): Promise<EpochPriceDoc[]> {
      return withMongo(
        "epochPrices.list",
        async () => EpochPriceModel.find({ chainId, epochId }).lean<EpochPriceDoc[]>(),
        () => [...mem.epochPrices.values()].filter((e) => e.chainId === chainId && e.epochId === epochId),
      );
    },
  },

  agentEvents: {
    /** idempotent on (tx, kind): replays from the indexer or a retried settlement add nothing */
    async add(doc: AgentEventDoc): Promise<void> {
      doc.payer = doc.payer?.toLowerCase() ?? null;
      doc.payee = doc.payee?.toLowerCase() ?? null;
      const dup = doc.tx ? mem.agentEvents.find((e) => e.tx === doc.tx && e.kind === doc.kind) : undefined;
      if (!dup) {
        mem.agentEvents.push(doc);
        if (mem.agentEvents.length > 2_000) mem.agentEvents.splice(0, mem.agentEvents.length - 2_000);
      }
      await withMongo(
        "agentEvents.add",
        async () => {
          if (doc.tx) await AgentEventModel.updateOne({ tx: doc.tx, kind: doc.kind }, { $setOnInsert: doc }, { upsert: true });
          else await AgentEventModel.create(doc);
        },
        () => undefined,
      );
    },
    async recent(chainId: number, limit = 50): Promise<AgentEventDoc[]> {
      return withMongo(
        "agentEvents.recent",
        async () => AgentEventModel.find({ chainId }).sort({ at: -1 }).limit(limit).lean<AgentEventDoc[]>(),
        () => mem.agentEvents.filter((e) => e.chainId === chainId).sort((a, b) => +b.at - +a.at).slice(0, limit),
      );
    },
  },

  quoteLogs: {
    async insert(doc: QuoteLogDoc): Promise<void> {
      mem.quoteLogs.push(doc);
      if (mem.quoteLogs.length > 5_000) mem.quoteLogs.splice(0, mem.quoteLogs.length - 5_000);
      await withMongo(
        "quoteLogs.insert",
        async () => {
          await QuoteLogModel.create(doc);
        },
        () => undefined,
      );
    },
    recentInMemory(limit = 50): QuoteLogDoc[] {
      return mem.quoteLogs.slice(-limit).reverse();
    },
  },
};
