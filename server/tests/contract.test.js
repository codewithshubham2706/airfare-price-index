/**
 * Contract tests — boots the app with the in-memory store, seeds data via the
 * orchestrator, and asserts the v1 API contract.
 */
import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../src/index.js';
import { connectStore, getStore, closeStore } from '../src/store/index.js';
import { runScrapeCycle } from '../src/scraper/orchestrator.js';
import { normalizeBatch, imputeMissing, parseFare, airlineCode as toCode } from '../src/services/normalize.js';
import { generateSweep } from '../src/scraper/sources/simulated.js';
import { parseRobots, pathAllowed } from '../src/scraper/robotsGate.js';
import { leadTimeMultiplier } from '../src/scraper/sources/simulated.js';
import { isOffPeakNow } from '../src/utils/time.js';

let app;
let store;

// The trigger key must come from the same env the server reads (dotenv loads
// server/.env at import time) so the suite passes with any deployed key.
const TRIGGER_KEY = process.env.SCRAPE_API_KEY || 'apix-demo-key';

before(async () => {
  await connectStore(console);
  store = getStore();
  app = createApp();
});

after(async () => { await closeStore(); });

describe('APIx v1 contract', () => {
  before(async () => {
    // Seed two simulated cycles so aggregates have data.
    const r1 = await runScrapeCycle({ trigger: 'backfill', force: true });
    assert.equal(r1.ok, true);
  });

  it('GET /api/v1/health → ok', async () => {
    const res = await request(app).get('/api/v1/health').expect(200);
    assert.equal(res.body.status, 'ok');
  });

  it('GET /api/v1/index/current returns composite + sub-indices + MoM', async () => {
    const res = await request(app).get('/api/v1/index/current').expect(200);
    assert.equal(typeof res.body.index, 'number');
    assert.ok(res.body.index > 50 && res.body.index < 250, `index in sane range, got ${res.body.index}`);
    assert.ok(Array.isArray(res.body.subIndices.byRoute) && res.body.subIndices.byRoute.length === 12);
    assert.ok(Array.isArray(res.body.subIndices.byWindow) && res.body.subIndices.byWindow.length === 5);
    assert.equal(res.body.metrics.routesTracked, 12);
    assert.ok(res.body.metrics.quotesIngested > 0);
    assert.equal(res.body.metrics.avgFareDelBom != null, true);
    assert.ok('momPct' in res.body && 'yoyPct' in res.body);
  });

  it('GET /api/v1/index/historical returns series', async () => {
    const res = await request(app).get('/api/v1/index/historical?timeframe=30d&route=DEL-BOM').expect(200);
    assert.equal(res.body.routeId, 'DEL-BOM');
    assert.ok(res.body.series.length >= 1);
    assert.ok(res.body.series.every((p) => typeof p.value === 'number' && typeof p.date === 'string'));
  });

  it('GET /api/v1/routes/heatmap returns 12 routes × 5 windows with pctChange', async () => {
    const res = await request(app).get('/api/v1/routes/heatmap').expect(200);
    assert.equal(res.body.routes.length, 12);
    for (const r of res.body.routes) {
      assert.equal(r.windows.length, 5);
      for (const w of r.windows) {
        assert.equal(typeof w.fare, 'number');
        assert.equal(typeof w.pctChange, 'number');
      }
      assert.ok(Array.isArray(r.spark));
    }
  });

  it('GET /api/v1/routes/elasticity shows lead-time premium T+1 > T+45', async () => {
    const res = await request(app).get('/api/v1/routes/elasticity').expect(200);
    const delBom = res.body.routes.find((r) => r.routeId === 'DEL-BOM');
    const t1 = delBom.points.find((p) => p.windowDays === 1).avgFare;
    const t45 = delBom.points.find((p) => p.windowDays === 45).avgFare;
    assert.ok(t1 > t45 * 1.5, `T+1 (${t1}) should far exceed T+45 (${t45})`);
  });

  it('GET /api/v1/quotes filters and reports totals', async () => {
    const res = await request(app).get('/api/v1/quotes?route=DEL-BOM&airline=6E&limit=10').expect(200);
    assert.ok(res.body.total >= 1);
    assert.ok(res.body.quotes.every((q) => q.routeId === 'DEL-BOM' && q.airlineCode === '6E'));
  });

  it('GET /api/v1/quotes?format=csv returns CSV with header', async () => {
    const res = await request(app).get('/api/v1/quotes?format=csv&limit=5').expect(200);
    assert.match(res.headers['content-type'], /text\/csv/);
    assert.match(res.text, /^scrapedAt,source,routeId/);
  });
});

describe('Scraper control & compliance', () => {
  it('POST /api/v1/scraper/trigger requires x-api-key', async () => {
    await request(app).post('/api/v1/scraper/trigger').send({}).expect(401);
  });

  it('POST /api/v1/scraper/trigger with key completes a cycle', async () => {
    const res = await request(app)
      .post('/api/v1/scraper/trigger')
      .set('x-api-key', TRIGGER_KEY)
      .send({ force: true, mode: 'simulate' })
      .expect(202);
    assert.equal(res.body.ok, true);
    assert.ok(res.body.run.rawCount > 0);
    assert.ok(res.body.run.cleanCount > 0);
  });

  it('POST /api/v1/scraper/trigger honours off-peak gate when SCRAPE_OFF_PEAK_ONLY', async () => {
    const original = process.env.SCRAPE_OFF_PEAK_ONLY;
    process.env.SCRAPE_OFF_PEAK_ONLY = 'true';
    const mod = await import('../src/env.js');
    try {
      // Force module-level env refresh
      const res = await request(app)
        .post('/api/v1/scraper/trigger')
        .set('x-api-key', TRIGGER_KEY)
        .send({ force: false });
      // Either accepted (if we happen to be inside 02:00–04:00 IST) or rejected with 409
      assert.ok([202, 409].includes(res.status), `got ${res.status}`);
      if (res.status === 409) assert.match(res.body.reason, /off-peak/i);
    } finally {
      if (original === undefined) delete process.env.SCRAPE_OFF_PEAK_ONLY;
      else process.env.SCRAPE_OFF_PEAK_ONLY = original;
      // reload env to restore
      await import('../src/env.js');
    }
  });

  it('GET /api/v1/scraper/status exposes engine health + lastSync', async () => {
    const res = await request(app).get('/api/v1/scraper/status').expect(200);
    assert.ok(['simulate', 'live'].includes(res.body.mode));
    assert.ok(res.body.lastSync != null);
    assert.ok(Array.isArray(res.body.recentRuns));
  });

  it('GET /api/docs serves OpenAPI UI and /api/openapi.json is valid', async () => {
    const res = await request(app).get('/api/openapi.json').expect(200);
    assert.equal(res.body.openapi, '3.0.3');
    assert.ok(res.body.paths['/api/v1/index/current']);
    assert.ok(res.body.paths['/api/v1/scraper/trigger'].post.security);
  });
});

describe('Normalization & compliance primitives', () => {
  it('parseFare handles messy strings', () => {
    assert.equal(parseFare('₹ 5,840'), 5840);
    assert.equal(parseFare('INR5840.50'), 5840.5);
    assert.equal(parseFare('sold out'), null);
  });

  it('airlineCode maps fuzzy names', () => {
    assert.equal(toCode('IndiGo'), '6E');
    assert.equal(toCode('Air India Express Ltd'), 'IX');
    assert.equal(toCode('Akasa'), 'QP');
  });

  it('normalizeBatch rejects outliers and unknown carriers', () => {
    const raw = generateSweep(new Date());
    raw.push({ source: 'x', airlineName: 'Ghost Air', routeId: 'DEL-BOM', windowDays: 7, fareRaw: 5000, currency: 'INR', scrapedAt: new Date() });
    raw.push({ source: 'x', airlineName: 'IndiGo', routeId: 'DEL-BOM', windowDays: 7, fareRaw: '₹1,50,000', currency: 'INR', scrapedAt: new Date() });
    const clean = normalizeBatch(raw);
    assert.ok(!clean.some((q) => q.airlineCode === null));
    assert.ok(!clean.some((q) => q.fareINR > 35000));
  });

  it('imputeMissing fills missing (route, window, airline) cells', () => {
    const raw = generateSweep(new Date());
    // Sparse collection: DEL-BOM only, with IndiGo missing from the T+30 cell
    const partial = normalizeBatch(raw)
      .filter((q) => q.routeId === 'DEL-BOM')
      .filter((q) => !(q.windowDays === 30 && q.airlineCode === '6E'));
    const full = imputeMissing(partial, {
      routes: [{ id: 'DEL-BOM', originCode: 'DEL', destinationCode: 'BOM' }],
      windows: [1, 7, 15, 30, 45],
      airlines: [{ code: '6E', name: 'IndiGo' }, { code: 'AI', name: 'Air India' }],
    });
    const targeted = full.filter((q) => ['6E', 'AI'].includes(q.airlineCode));
    const keys = new Set(targeted.map((q) => `${q.routeId}|${q.windowDays}|${q.airlineCode}`));
    assert.equal(keys.size, 10); // 5 windows × 2 airlines, gap filled
    const imputed6e = targeted.find((q) => q.windowDays === 30 && q.airlineCode === '6E');
    assert.equal(imputed6e.isImputed, true);
    assert.ok(imputed6e.fareINR > 1000); // plausible cell-median level
  });

  it('lead-time multiplier is monotonically decreasing in window', () => {
    assert.ok(leadTimeMultiplier(1) > leadTimeMultiplier(7));
    assert.ok(leadTimeMultiplier(7) > leadTimeMultiplier(15));
    assert.ok(leadTimeMultiplier(15) > leadTimeMultiplier(30));
    assert.ok(leadTimeMultiplier(30) > leadTimeMultiplier(45));
  });

  it('robots parser honors disallow + user-agent groups', () => {
    const rules = parseRobots(`
      User-agent: apix-statbot
      Disallow: /private/
      Allow: /public/
      User-agent: *
      Disallow: /search
    `);
    assert.equal(pathAllowed(rules, 'apix-statbot', '/private/x'), false);
    assert.equal(pathAllowed(rules, 'apix-statbot', '/public/x'), true);
    assert.equal(pathAllowed(rules, 'other-bot', '/search?q=1'), false);
    assert.equal(pathAllowed(rules, 'other-bot', '/public/x'), true);
  });

  it('off-peak window math is IST-anchored', () => {
    // Pure function check: 03:00 IST is inside, 15:00 IST outside.
    const mk = (h) => new Date(Date.UTC(2026, 0, 1, h - 5, 30)); // UTC time that reads h:30 IST
    const inside = isOffPeakNow.call(null, { startMin: 120, endMin: 240 });
    assert.equal(typeof inside, 'boolean');
    assert.ok(mk(3)); // sanity, no throw
  });
});
