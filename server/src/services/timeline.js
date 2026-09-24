/**
 * Timeline service — recomputes & persists APIx points for given dates and
 * attaches MoM / YoY deltas to the current snapshot.
 *
 * Point granularity stored in `index_timeline`:
 *   composite  → { routeId: null, windowDays: null }
 *   per-route  → { routeId, windowDays: null }
 *   per-window → { routeId: null, windowDays }
 */
import { getStore } from '../store/index.js';
import { ROUTES, BOOKING_WINDOWS } from '../config.js';
import { compositeIndex, weightedMeanFare } from './aggregator.js';

const round2 = (n) => Math.round(n * 100) / 100;

/** Baseline map: trailing-7-day median fare per (route, window) as of `asOf`. */
export async function baselineMapAsOf(asOf = new Date()) {
  const store = getStore();
  const since = new Date(asOf.getTime() - 7 * 86_400_000);
  const { rows } = await store.findQuotesClean({ from: since.toISOString(), limit: 100000 });
  const older = rows.filter((q) => q.scrapedAt <= asOf);
  const map = new Map();
  for (const r of ROUTES) {
    for (const w of BOOKING_WINDOWS) {
      const fares = older.filter((q) => q.routeId === r.id && q.windowDays === w).map((q) => q.fareINR);
      if (fares.length) map.set(`${r.id}|${w}`, medianOf(fares));
    }
  }
  return map;
}

function medianOf(nums) {
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/**
 * Compute & persist all index points for one calendar day.
 * @param {Date} day IST-anchored calendar day (any time-of-day)
 * @param {Array} cleanQuotes normalized quotes attributed to that day
 * @param {Map} baselineMap baseline fares per route|window key
 * @returns {{ composite: number|null, points: number }}
 */
export async function computeAndStoreDay(day, cleanQuotes, baselineMap) {
  const store = getStore();
  const dateKey = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate()));

  // Cell medians (route × window) for the day
  const cellMedian = (routeId, w) => {
    const fares = cleanQuotes.filter((q) => q.routeId === routeId && q.windowDays === w).map((q) => q.fareINR);
    return fares.length ? medianOf(fares) : null;
  };

  const points = [];
  // Composite
  const dayPoints = [];
  for (const r of ROUTES) {
    for (const w of BOOKING_WINDOWS) {
      const fare = cellMedian(r.id, w);
      if (fare != null) dayPoints.push({ routeId: r.id, windowDays: w, fareINR: fare });
    }
  }
  const composite = compositeIndex(dayPoints, baselineMap);
  if (composite != null) {
    points.push({ date: dateKey, routeId: null, windowDays: null, value: composite, avgFare: round2(weightedMeanFare(cleanQuotes) ?? 0) });
  }
  // Per-route
  for (const r of ROUTES) {
    const pts = dayPoints.filter((p) => p.routeId === r.id);
    if (!pts.length) continue;
    const sub = new Map([...baselineMap.entries()].filter(([k]) => k.startsWith(`${r.id}|`)));
    const v = compositeIndex(pts, sub);
    if (v != null) {
      points.push({
        date: dateKey, routeId: r.id, windowDays: null, value: v,
        avgFare: round2(weightedMeanFare(cleanQuotes.filter((q) => q.routeId === r.id)) ?? 0),
      });
    }
  }
  // Per-window
  for (const w of BOOKING_WINDOWS) {
    const pts = dayPoints.filter((p) => p.windowDays === w);
    if (!pts.length) continue;
    const sub = new Map([...baselineMap.entries()].filter(([k]) => k.endsWith(`|${w}`)));
    const v = compositeIndex(pts, sub);
    if (v != null) {
      points.push({
        date: dateKey, routeId: null, windowDays: w, value: v,
        avgFare: round2(weightedMeanFare(cleanQuotes.filter((q) => q.windowDays === w)) ?? 0),
      });
    }
  }

  for (const p of points) await store.upsertIndexPoint(p);
  return { composite, points: points.length };
}

/** MoM / YoY deltas for the current composite, from the persisted timeline. */
export async function indexDeltas() {
  const store = getStore();
  const now = new Date();
  const series = await store.findIndexPoints({ routeId: null, windowDays: null, from: new Date(now.getTime() - 400 * 86_400_000) });
  if (!series.length) return { momPct: null, yoyPct: null };
  const latest = series[series.length - 1];
  const monthAgo = pickNearest(series, latest.date.getTime() - 30 * 86_400_000);
  const yearAgo = pickNearest(series, latest.date.getTime() - 365 * 86_400_000);
  return {
    momPct: monthAgo ? round2(((latest.value - monthAgo.value) / monthAgo.value) * 100) : null,
    yoyPct: yearAgo ? round2(((latest.value - yearAgo.value) / yearAgo.value) * 100) : null,
  };
}

function pickNearest(series, targetTs) {
  let best = null;
  let bestDiff = Infinity;
  for (const p of series) {
    const diff = Math.abs(p.date.getTime() - targetTs);
    if (diff < bestDiff) { bestDiff = diff; best = p; }
  }
  return bestDiff <= 5 * 86_400_000 ? best : null; // within ±5 days
}
