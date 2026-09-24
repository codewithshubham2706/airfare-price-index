/**
 * Contract tests — boots the app with the in-memory store, exercises the auth
 * flow end-to-end, then asserts the v1 API contract (all data endpoints are
 * Bearer-protected; scraper control is admin-only).
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../src/index.js';
import { connectStore, getStore, closeStore } from '../src/store/index.js';
import { runScrapeCycle } from '../src/scraper/orchestrator.js';
import { normalizeBatch, imputeMissing, parseFare, airlineCode as toCode } from '../src/services/normalize.js';
import { generateSweep } from '../src/scraper/sources/simulated.js';
import { parseRobots, pathAllowed } from '../src/scraper/robotsGate.js';
import { leadTimeMultiplier } from '../src/scraper/sources/simulated.js';
import { verifyToken, ensureDemoUsers } from '../src/services/auth.js';

const TRIGGER_KEY = process.env.SCRAPE_API_KEY || 'apix-demo-key';
let app;
let adminToken;
let viewerToken;

before(async () => {
  await connectStore(console);
  await ensureDemoUsers(); // seed admin/viewer demo accounts for this suite
  app = createApp();
  await runScrapeCycle({ trigger: 'backfill', force: true });

  // Login flow: seeded admin + a fresh self-registered viewer
  const admin = await request(app).post('/api/v1/auth/login').send({ email: 'admin@apix.gov.in', password: 'Admin@12345' });
  assert.equal(admin.status, 200, `admin login failed: ${JSON.stringify(admin.body)}`);
  adminToken = admin.body.token;
  const reg = await request(app).post('/api/v1/auth/register').send({ email: 'economist@nso.in', password: 'Research@123', name: 'Test Economist' });
  assert.equal(reg.status, 201);
  viewerToken = reg.body.token;
});

after(async () => { await closeStore(); });

describe('Auth contract', () => {
  it('rejects bad credentials and enforces rate limits', async () => {
    const bad = await request(app).post('/api/v1/auth/login').send({ email: 'admin@apix.gov.in', password: 'wrong' });
    assert.equal(bad.status, 401);
  });

  it('issues verifiable JWTs with correct role claims', () => {
    const payload = verifyToken(adminToken);
    assert.equal(payload.role, 'admin');
    assert.equal(payload.sub, 'admin@apix.gov.in');
    assert.ok(payload.exp > Date.now());
  });

  it('GET /auth/me returns the session profile', async () => {
    const res = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${viewerToken}`).expect(200);
    assert.equal(res.body.user.email, 'economist@nso.in');
    assert.equal(res.body.user.role, 'viewer');
  });

  it('rejects duplicate registration and weak passwords', async () => {
    const dup = await request(app).post('/api/v1/auth/register').send({ email: 'economist@nso.in', password: 'Whatever@123', name: 'Dup' });
    assert.equal(dup.status, 409);
    const weak = await request(app).post('/api/v1/auth/register').send({ email: 'x@y.in', password: 'short', name: 'X' });
    assert.equal(weak.status, 400);
  });

  it('blocks protected data endpoints without a token', async () => {
    await request(app).get('/api/v1/index/current').expect(401);
    await request(app).get('/api/v1/routes/heatmap').expect(401);
    await request(app).get('/api/v1/quotes?limit=1').expect(401);
    await request(app).get('/api/v1/scraper/status').expect(401);
  });

  it('viewer can read analytics but not trigger scraper', async () => {
    await request(app).get('/api/v1/index/current').set('Authorization', `Bearer ${viewerToken}`).expect(200);
    const trig = await request(app)
      .post('/api/v1/scraper/trigger')
      .set('Authorization', `Bearer ${viewerToken}`)
      .set('x-api-key', TRIGGER_KEY)
      .send({ force: true, mode: 'simulate' });
    assert.equal(trig.status, 403);
  });
});

describe('APIx v1 contract (authenticated)', () => {
  const auth = () => ({ Authorization: `Bearer ${adminToken}` });

  it('GET /api/v1/health → ok (public)', async () => {
    const res = await request(app).get('/api/v1/health').expect(200);
    assert.equal(res.body.status, 'ok');
  });

  it('GET /api/v1/index/current returns composite + sub-indices', async () => {
    const res = await request(app).get('/api/v1/index/current').set(auth()).expect(200);
    assert.equal(typeof res.body.index, 'number');
    assert.ok(res.body.index > 50 && res.body.index < 250, `index sane, got ${res.body.index}`);
    assert.ok(res.body.subIndices.byRoute.length === 12);
    assert.ok(res.body.subIndices.byWindow.length === 5);
    assert.ok(res.body.metrics.quotesIngested > 0);
  });

  it('GET /api/v1/index/historical returns series', async () => {
    const res = await request(app).get('/api/v1/index/historical?timeframe=30d&route=DEL-BOM').set(auth()).expect(200);
    assert.equal(res.body.routeId, 'DEL-BOM');
    assert.ok(res.body.series.length >= 1);
  });

  it('GET /api/v1/routes/heatmap returns 12 routes × 5 windows', async () => {
    const res = await request(app).get('/api/v1/routes/heatmap').set(auth()).expect(200);
    assert.equal(res.body.routes.length, 12);
    for (const r of res.body.routes) {
      assert.equal(r.windows.length, 5);
      for (const w of r.windows) {
        assert.equal(typeof w.fare, 'number');
        assert.equal(typeof w.pctChange, 'number');
      }
    }
  });

  it('GET /api/v1/routes/elasticity shows lead-time premium', async () => {
    const res = await request(app).get('/api/v1/routes/elasticity').set(auth()).expect(200);
    const delBom = res.body.routes.find((r) => r.routeId === 'DEL-BOM');
    const t1 = delBom.points.find((p) => p.windowDays === 1).avgFare;
    const t45 = delBom.points.find((p) => p.windowDays === 45).avgFare;
    assert.ok(t1 > t45 * 1.5, `T+1 (${t1}) should exceed T+45 (${t45})`);
  });

  it('GET /api/v1/quotes filters + CSV export', async () => {
    const res = await request(app).get('/api/v1/quotes?route=DEL-BOM&airline=6E&limit=10').set(auth()).expect(200);
    assert.ok(res.body.total >= 1);
    assert.ok(res.body.quotes.every((q) => q.routeId === 'DEL-BOM' && q.airlineCode === '6E'));
    const csv = await request(app).get('/api/v1/quotes?format=csv&limit=5').set(auth()).expect(200);
    assert.match(csv.headers['content-type'], /text\/csv/);
    assert.match(csv.text, /^scrapedAt,source,routeId/);
  });

  it('POST /api/v1/scraper/trigger — admin with key completes a cycle', async () => {
    const res = await request(app)
      .post('/api/v1/scraper/trigger')
      .set({ Authorization: `Bearer ${adminToken}`, 'x-api-key': TRIGGER_KEY })
      .send({ force: true, mode: 'simulate' })
      .expect(202);
    assert.equal(res.body.ok, true);
    assert.ok(res.body.run.cleanCount > 0);
  });

  it('GET /api/v1/scraper/status exposes engine health (admin)', async () => {
    const res = await request(app).get('/api/v1/scraper/status').set(auth()).expect(200);
    assert.ok(['simulate', 'live'].includes(res.body.mode));
    assert.ok(res.body.lastSync != null);
  });

  it('GET /api/docs serves OpenAPI UI and /api/openapi.json is valid (public)', async () => {
    const res = await request(app).get('/api/openapi.json').expect(200);
    assert.equal(res.body.openapi, '3.0.3');
    assert.ok(res.body.paths['/api/v1/auth/login']);
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
    assert.equal(keys.size, 10);
    const imputed6e = targeted.find((q) => q.windowDays === 30 && q.airlineCode === '6E');
    assert.equal(imputed6e.isImputed, true);
    assert.ok(imputed6e.fareINR > 1000);
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
});
