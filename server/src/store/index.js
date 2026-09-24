/**
 * Storage layer — MongoDB Atlas when MONGODB_URI is set, otherwise an
 * in-memory store so the prototype runs anywhere (sandbox/CI/offline demo).
 *
 * Collections:
 *   quotes_raw        — unmodified scrape payloads
 *   quotes_clean      — normalized records (the analytical table)
 *   index_timeline    — computed APIx data points (per route/window buckets)
 *   runs              — scraper job audit log
 */
import { MongoClient } from 'mongodb';
import { env } from '../env.js';

class MemoryStore {
  constructor() {
    this.kind = 'memory';
    this.quotesRaw = [];
    this.quotesClean = [];
    this.indexTimeline = [];
    this.runs = [];
  }

  async connect() { return this; }
  async close() { /* noop */ }

  async insertQuotesRaw(docs) { this.quotesRaw.push(...docs); return docs.length; }
  async insertQuotesClean(docs) { this.quotesClean.push(...docs); return docs.length; }

  async findQuotesClean(filter = {}) {
    const { routeId, windowDays, airlineCode, from, to, q, limit = 500, skip = 0 } = filter;
    let rows = this.quotesClean.slice();
    if (routeId) rows = rows.filter((r) => r.routeId === routeId);
    if (windowDays) rows = rows.filter((r) => r.windowDays === Number(windowDays));
    if (airlineCode) rows = rows.filter((r) => r.airlineCode === airlineCode);
    if (from) rows = rows.filter((r) => r.scrapedAt >= new Date(from));
    if (to) rows = rows.filter((r) => r.scrapedAt <= new Date(to));
    if (q) {
      const needle = String(q).toLowerCase();
      rows = rows.filter((r) =>
        [r.routeId, r.airlineName, r.originCode, r.destinationCode].some(
          (f) => String(f).toLowerCase().includes(needle)
        )
      );
    }
    rows.sort((a, b) => b.scrapedAt - a.scrapedAt);
    return { rows: rows.slice(skip, skip + limit), total: rows.length };
  }

  async insertIndexPoints(docs) { this.indexTimeline.push(...docs); return docs.length; }

  async findIndexPoints({ routeId = null, windowDays = null, from, to } = {}) {
    // routeId/windowDays null ⇒ composite aggregates (routeId: null / windowDays: null)
    let rows = this.indexTimeline.filter(
      (p) => p.routeId === routeId && p.windowDays === windowDays
    );
    if (from) rows = rows.filter((p) => p.date >= new Date(from));
    if (to) rows = rows.filter((p) => p.date <= new Date(to));
    rows.sort((a, b) => a.date - b.date);
    return rows;
  }

  async upsertIndexPoint(doc) {
    const i = this.indexTimeline.findIndex(
      (p) => p.date.getTime() === doc.date.getTime() && p.routeId === doc.routeId && p.windowDays === doc.windowDays
    );
    if (i >= 0) this.indexTimeline[i] = doc; else this.indexTimeline.push(doc);
  }

  async distinctIndexRoutes() {
    return [...new Set(this.indexTimeline.filter((p) => p.routeId).map((p) => p.routeId))];
  }

  async latestQuotesPerCell() {
    // latest clean quote per (routeId, windowDays, airlineCode)
    const best = new Map();
    for (const r of this.quotesClean) {
      const k = `${r.routeId}|${r.windowDays}|${r.airlineCode}`;
      const prev = best.get(k);
      if (!prev || r.scrapedAt > prev.scrapedAt) best.set(k, r);
    }
    return [...best.values()];
  }

  async insertRun(doc) { this.runs.push(doc); return doc; }
  async findRuns(limit = 20) {
    return this.runs.slice().sort((a, b) => b.startedAt - a.startedAt).slice(0, limit);
  }
  async countQuotesRaw() { return this.quotesRaw.length; }
  async countQuotesClean() { return this.quotesClean.length; }

  async trimIndexTimeline(keepDates) {
    const set = new Set(keepDates.map((d) => d.getTime()));
    this.indexTimeline = this.indexTimeline.filter((p) => set.has(p.date.getTime()) || p.routeId || p.windowDays);
  }
}

class MongoStore {
  constructor(uri) {
    this.kind = 'mongo';
    this.client = new MongoClient(uri, { serverSelectionTimeoutMS: 8000 });
    this.dbName = env.mongoDb;
  }

  async connect() {
    await this.client.connect();
    this.db = this.client.db(this.dbName);
    await this.db.collection('quotes_clean').createIndex({ routeId: 1, windowDays: 1, airlineCode: 1, scrapedAt: -1 });
    await this.db.collection('index_timeline').createIndex({ routeId: 1, windowDays: 1, date: 1 }, { unique: true });
    await this.db.collection('runs').createIndex({ startedAt: -1 });
    return this;
  }
  async close() { await this.client.close(); }

  async insertQuotesRaw(docs) {
    if (!docs.length) return 0;
    const r = await this.db.collection('quotes_raw').insertMany(docs.map((d) => ({ ...d })));
    return r.insertedCount;
  }
  async insertQuotesClean(docs) {
    if (!docs.length) return 0;
    const r = await this.db.collection('quotes_clean').insertMany(docs.map((d) => ({ ...d })));
    return r.insertedCount;
  }

  async findQuotesClean(filter = {}) {
    const { routeId, windowDays, airlineCode, from, to, q, limit = 500, skip = 0 } = filter;
    const query = {};
    if (routeId) query.routeId = routeId;
    if (windowDays) query.windowDays = Number(windowDays);
    if (airlineCode) query.airlineCode = airlineCode;
    if (from || to) query.scrapedAt = { ...(from ? { $gte: new Date(from) } : {}), ...(to ? { $lte: new Date(to) } : {}) };
    if (q) query.$or = ['routeId', 'airlineName', 'originCode', 'destinationCode'].map((f) => ({ [f]: { $regex: q, $options: 'i' } }));
    const col = this.db.collection('quotes_clean');
    const total = await col.countDocuments(query);
    const rows = await col.find(query).sort({ scrapedAt: -1 }).skip(Number(skip)).limit(Number(limit)).toArray();
    return { rows, total };
  }

  async insertIndexPoints(docs) {
    if (!docs.length) return 0;
    const r = await this.db.collection('index_timeline').insertMany(docs.map((d) => ({ ...d })));
    return r.insertedCount;
  }

  async upsertIndexPoint(doc) {
    await this.db.collection('index_timeline').updateOne(
      { date: doc.date, routeId: doc.routeId, windowDays: doc.windowDays },
      { $set: doc },
      { upsert: true }
    );
  }

  async findIndexPoints({ routeId = null, windowDays = null, from, to } = {}) {
    const query = { routeId, windowDays };
    if (from || to) query.date = { ...(from ? { $gte: new Date(from) } : {}), ...(to ? { $lte: new Date(to) } : {}) };
    return this.db.collection('index_timeline').find(query).sort({ date: 1 }).toArray();
  }

  async distinctIndexRoutes() {
    return this.db.collection('index_timeline').distinct('routeId', { routeId: { $ne: null } });
  }

  async latestQuotesPerCell() {
    return this.db.collection('quotes_clean').find({}).sort({ scrapedAt: -1 }).toArray();
  }

  async insertRun(doc) {
    await this.db.collection('runs').insertOne({ ...doc });
    return doc;
  }
  async findRuns(limit = 20) {
    return this.db.collection('runs').find({}).sort({ startedAt: -1 }).limit(limit).toArray();
  }
  async countQuotesRaw() { return this.db.collection('quotes_raw').countDocuments({}); }
  async countQuotesClean() { return this.db.collection('quotes_clean').countDocuments({}); }
}

let storeInstance = null;

/** Close the active store (no-op for memory). */
export async function closeStore() {
  if (storeInstance) await storeInstance.close();
  storeInstance = null;
}

/** Connect the configured store (Mongo if URI present, else memory). */
export async function connectStore(log = console) {
  if (env.mongoUri) {
    try {
      storeInstance = await new MongoStore(env.mongoUri).connect();
      log.log(`[store] MongoDB connected → db "${env.mongoDb}"`);
      return storeInstance;
    } catch (err) {
      log.warn(`[store] MongoDB unavailable (${err.message}) → falling back to in-memory store`);
    }
  }
  storeInstance = new MemoryStore();
  await storeInstance.connect();
  log.log('[store] In-memory store active (demo mode)');
  return storeInstance;
}

export function getStore() {
  if (!storeInstance) throw new Error('Store not connected');
  return storeInstance;
}
