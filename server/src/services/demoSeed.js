/**
 * Demo history seeding — generates `days` of simulated sweeps and index points.
 * Used by the backfill CLI and by server bootstrap when running with the
 * in-memory store (so the dashboard is never empty in demo mode).
 */
import { getStore } from '../store/index.js';
import { normalizeBatch, imputeMissing } from './normalize.js';
import { computeAndStoreDay, baselineMapAsOf } from './timeline.js';
import { AIRLINES, BOOKING_WINDOWS, ROUTES } from '../config.js';
import { generateSweep } from '../scraper/sources/simulated.js';

export async function seedHistory(days = 90, log = console) {
  const store = getStore();
  log.log(`[seed] generating ${days} days of simulated history…`);
  let totalClean = 0;
  for (let i = days; i >= 0; i--) {
    const day = new Date(Date.now() - i * 86_400_000);
    const raw = generateSweep(day);
    const clean = normalizeBatch(raw);
    const full = imputeMissing(clean, { routes: ROUTES, windows: BOOKING_WINDOWS, airlines: AIRLINES });
    await store.insertQuotesRaw(raw);
    await store.insertQuotesClean(full);

    let baseline = await baselineMapAsOf(day);
    if (baseline.size < 20) {
      // Bootstrap window: seed baseline from the day itself (index ≈ 100 at start)
      baseline = new Map();
      for (const r of ROUTES) {
        for (const w of BOOKING_WINDOWS) {
          const fares = full.filter((q) => q.routeId === r.id && q.windowDays === w).map((q) => q.fareINR);
          if (fares.length) {
            const s = [...fares].sort((a, b) => a - b);
            baseline.set(`${r.id}|${w}`, s[Math.floor(s.length / 2)]);
          }
        }
      }
    }
    await computeAndStoreDay(day, full, baseline);
    totalClean += full.length;
  }
  log.log(`[seed] done — ${totalClean} clean quotes, ${days} index days.`);
  return totalClean;
}
