/**
 * Aggregation service — turns clean quotes into the aggregates the API exposes.
 * All grouping is (routeId × windowDays), with airline-weighted means inside cells.
 */
import { getStore } from '../store/index.js';
import { AIRLINES, BOOKING_WINDOWS, ROUTES, INDEX_METHOD } from '../config.js';

const round1 = (n) => Math.round(n * 10) / 10;
const round2 = (n) => Math.round(n * 100) / 100;

const airlineWeight = (code) => AIRLINES.find((a) => a.code === code)?.weight ?? 0;
const routeWeight = (id) => ROUTES.find((r) => r.id === id)?.weight ?? 0;

/** Airline-weighted mean fare of a quote set. */
export function weightedMeanFare(quotes) {
  if (!quotes.length) return null;
  let num = 0;
  let den = 0;
  for (const q of quotes) {
    const w = airlineWeight(q.airlineCode);
    num += q.fareINR * w;
    den += w;
  }
  return den > 0 ? num / den : quotes.reduce((s, q) => s + q.fareINR, 0) / quotes.length;
}

/** Composite APIx for one day: Σ routeWeight × windowWeight × (100 × fare / baseline). */
export function compositeIndex(dayPoints, baselineMap) {
  // dayPoints: [{ routeId, windowDays, fareINR }]
  let num = 0;
  let den = 0;
  for (const p of dayPoints) {
    const rw = routeWeight(p.routeId);
    if (!rw) continue;
    const base = baselineMap.get(`${p.routeId}|${p.windowDays}`);
    if (!base) continue;
    num += rw * (100 * p.fareINR) / base;
    den += rw;
  }
  return den > 0 ? round2(num / den) : null;
}

/** Latest APIx snapshot with sub-indices per route and per booking window. */
export async function getCurrentIndex() {
  const store = getStore();
  const quotes = await store.latestQuotesPerCell();

  // Baseline = trailing 7-day median fare per (route, window)
  const since = new Date(Date.now() - 7 * 86_400_000);
  const { rows: recent } = await store.findQuotesClean({ from: since.toISOString(), limit: 100000 });
  const baselineMap = new Map();
  for (const r of ROUTES) {
    for (const w of BOOKING_WINDOWS) {
      const fares = recent.filter((q) => q.routeId === r.id && q.windowDays === w).map((q) => q.fareINR);
      if (fares.length) baselineMap.set(`${r.id}|${w}`, medianOf(fares));
    }
  }

  const dayPoints = quotes.map((q) => ({ routeId: q.routeId, windowDays: q.windowDays, fareINR: q.fareINR }));
  const value = compositeIndex(dayPoints, baselineMap);

  const subByRoute = ROUTES.map((r) => {
    const pts = dayPoints.filter((p) => p.routeId === r.id);
    const routeBaseline = new Map(
      [...baselineMap.entries()].filter(([k]) => k.startsWith(`${r.id}|`)).map(([k, v]) => [k, v])
    );
    return {
      routeId: r.id,
      label: `${r.originCode}–${r.destinationCode}`,
      weight: r.weight,
      value: pts.length ? compositeIndex(pts, routeBaseline) : null,
      avgFare: round1(weightedMeanFare(quotes.filter((q) => q.routeId === r.id)) ?? 0),
    };
  });

  const subByWindow = BOOKING_WINDOWS.map((w) => {
    const pts = dayPoints.filter((p) => p.windowDays === w);
    const winBaseline = new Map(
      [...baselineMap.entries()].filter(([k]) => k.endsWith(`|${w}`)).map(([k, v]) => [k, v])
    );
    return {
      windowDays: w,
      label: `T+${w}`,
      value: pts.length ? compositeIndex(pts, winBaseline) : null,
      avgFare: round1(weightedMeanFare(quotes.filter((q) => q.windowDays === w)) ?? 0),
    };
  });

  const delBom = quotes.filter((q) => q.routeId === 'DEL-BOM');
  const delBomFare = weightedMeanFare(delBom);

  return {
    index: value,
    name: INDEX_METHOD.name,
    methodology: INDEX_METHOD,
    computedAt: new Date().toISOString(),
    momPct: null, // filled by the route layer from the timeline
    yoyPct: null,
    subIndices: { byRoute: subByRoute, byWindow: subByWindow },
    metrics: {
      avgFareDelBom: delBomFare ? round1(delBomFare) : null,
      routesTracked: ROUTES.length,
      quotesIngested: await store.countQuotesClean(),
    },
  };
}

function medianOf(nums) {
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Historical composite index points for charts. */
export async function getHistoricalIndex({ timeframe = '30d', routeId = null, windowDays = null } = {}) {
  const store = getStore();
  const days = { '7d': 7, '30d': 30, '90d': 90, '180d': 180, '1y': 365 }[timeframe] || 30;
  const from = new Date(Date.now() - days * 86_400_000);
  const points = await store.findIndexPoints({ routeId, windowDays, from });

  // Downsample: weekly buckets beyond 90d
  const series = points.map((p) => ({
    date: p.date.toISOString().slice(0, 10),
    value: p.value,
    avgFare: p.avgFare ?? null,
  }));

  return { timeframe, routeId, windowDays, count: series.length, series };
}

/** Sector × booking-window heatmap with % change vs baseline and sparklines. */
export async function getHeatmap() {
  const store = getStore();
  const quotes = await store.latestQuotesPerCell();
  const since = new Date(Date.now() - 7 * 86_400_000);
  const { rows: recent } = await store.findQuotesClean({ from: since.toISOString(), limit: 100000 });

  const cells = [];
  for (const r of ROUTES) {
    const sparkSeries = await store.findIndexPoints({ routeId: r.id, windowDays: null, from: new Date(Date.now() - 30 * 86_400_000) });
    const spark = sparkSeries.map((p) => ({ date: p.date.toISOString().slice(0, 10), value: p.value }));
    const row = {
      routeId: r.id,
      label: `${r.originCode}–${r.destinationCode}`,
      origin: r.origin,
      destination: r.destination,
      weight: r.weight,
      spark,
      windows: [],
    };
    for (const w of BOOKING_WINDOWS) {
      const now = quotes.filter((q) => q.routeId === r.id && q.windowDays === w);
      const base = recent.filter((q) => q.routeId === r.id && q.windowDays === w).map((q) => q.fareINR);
      const fare = weightedMeanFare(now);
      const baseFare = base.length ? medianOf(base) : null;
      row.windows.push({
        windowDays: w,
        label: `T+${w}`,
        fare: fare ? round1(fare) : null,
        baseFare: baseFare ? round1(baseFare) : null,
        pctChange: fare && baseFare ? round2(((fare - baseFare) / baseFare) * 100) : null,
        airlines: now.length,
      });
    }
    cells.push(row);
  }
  return { generatedAt: new Date().toISOString(), windows: BOOKING_WINDOWS, routes: cells };
}
