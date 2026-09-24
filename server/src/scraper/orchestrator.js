/**
 * Scraper orchestrator — one compliant collection cycle.
 * Sequence: compliance gates → collect (simulate|live) → normalize → impute →
 * persist raw+clean → recompute today's index points → audit log.
 */
import { getStore } from '../store/index.js';
import { normalizeBatch, imputeMissing } from '../services/normalize.js';
import { computeAndStoreDay, baselineMapAsOf } from '../services/timeline.js';
import { AIRLINES, BOOKING_WINDOWS, ROUTES, ROUTE_IDS, env } from './shared.js';
import { offPeakGate, runWithPacing } from './pacers.js';
import { isAllowed } from './robotsGate.js';
import { generateSweep } from './sources/simulated.js';
import { fetchQuotesForRoute } from './sources/live.js';

/**
 * Run one collection cycle.
 * @param {object} opts
 * @param {'manual'|'cron'|'backfill'} opts.trigger who asked for it
 * @param {boolean} opts.force bypass the off-peak gate (demo/test only)
 * @param {'simulate'|'live'} [opts.mode] override env mode for this run
 * @param {string[]} [opts.routes] subset of route ids
 * @param {number[]} [opts.windows] subset of booking windows
 */
export async function runScrapeCycle(opts = {}) {
  const store = getStore();
  const startedAt = new Date();
  const mode = opts.mode || env.scrapeMode;
  const routes = ROUTES.filter((r) => !opts.routes || opts.routes.includes(r.id));
  const windows = BOOKING_WINDOWS.filter((w) => !opts.windows || opts.windows.includes(w));

  // ── Compliance gate: off-peak window ─────────────────────────
  const gate = offPeakGate(Boolean(opts.force));
  if (!gate.ok) {
    const run = {
      trigger: opts.trigger || 'manual', mode, startedAt, finishedAt: new Date(),
      status: 'rejected', reason: gate.reason, rawCount: 0, cleanCount: 0, imputedCount: 0,
    };
    await store.insertRun(run);
    return { ok: false, status: 'rejected', reason: gate.reason, run };
  }

  // ── Collect ──────────────────────────────────────────────────
  let raw = [];
  const skipped = [];
  if (mode === 'live') {
    const tasks = [];
    for (const route of routes) {
      for (const w of windows) {
        tasks.push(async () => {
          const pathname = `/travel/flights?q=${route.originCode}-${route.destinationCode}`;
          const gate2 = await isAllowed('https://www.google.com', pathname);
          if (!gate2.allowed) {
            skipped.push({ source: 'google-travel', reason: `robots.txt disallows ${pathname}` });
            return [];
          }
          return fetchQuotesForRoute({ route, windowDays: w, origin: route.originCode, destination: route.destinationCode });
        });
      }
    }
    const batches = await runWithPacing(tasks);
    raw = batches.flat();
  } else {
    raw = generateSweep(new Date()).filter(
      (q) => routes.some((r) => r.id === q.routeId) && windows.includes(q.windowDays)
    );
  }

  // ── Normalize + impute ───────────────────────────────────────
  const clean = normalizeBatch(raw);
  const withImputed = imputeMissing(clean, { routes, windows, airlines: AIRLINES });
  const imputedCount = withImputed.length - clean.length;

  // ── Persist ──────────────────────────────────────────────────
  await store.insertQuotesRaw(raw);
  await store.insertQuotesClean(withImputed);

  // ── Recompute today's index points ───────────────────────────
  const baseline = await baselineMapAsOf(new Date());
  const { composite } = await computeAndStoreDay(new Date(), withImputed, baseline);

  // ── Audit log ────────────────────────────────────────────────
  const run = {
    trigger: opts.trigger || 'manual', mode, startedAt, finishedAt: new Date(),
    status: 'completed', rawCount: raw.length, cleanCount: clean.length,
    imputedCount, skipped, indexValue: composite,
  };
  await store.insertRun(run);

  return { ok: true, status: 'completed', run };
}
