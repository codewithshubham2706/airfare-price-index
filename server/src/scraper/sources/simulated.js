/**
 * Simulated source adapter — deterministic stochastic fare generator.
 * Zero network egress; models Indian domestic fares with:
 * - route base levels (trunk routes cheaper per km, leisure routes premium)
 * - exponential lead-time curve: fares spike as T+n → 0
 * - airline positioning (LCC vs full-service)
 * - weekly seasonality + seeded random noise + slow inflation drift
 */
import { AIRLINES, BOOKING_WINDOWS, ROUTES } from '../shared.js';

/** Mulberry32 PRNG — reproducible series per (seed, route, window, airline). */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const hashStr = (s) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
};

const AIRLINE_MULT = { '6E': 1.0, AI: 1.14, IX: 0.88, QP: 0.92, SG: 0.84 };
const LEISURE_ROUTES = new Set(['DEL-GOI', 'BOM-GOI']);

/** Route base fare (T+45 economy) from distance with per-km taper. */
function routeBase(route) {
  const { distanceKm } = route;
  const base = 1400 + 3.1 * Math.pow(distanceKm, 0.82);
  return LEISURE_ROUTES.has(route.id) ? base * 1.18 : base;
}

/** Lead-time multiplier: cheap far out, explosive inside T+7. */
export function leadTimeMultiplier(windowDays) {
  // calibrated anchors: T+45 ≈ 1.00, T+30 ≈ 1.06, T+15 ≈ 1.22, T+7 ≈ 1.55, T+1 ≈ 2.35
  const anchors = [[45, 1.0], [30, 1.06], [15, 1.22], [7, 1.55], [1, 2.35]];
  const w = anchors.find(([d]) => d === windowDays) || [windowDays, Math.max(1, Math.pow(45 / windowDays, 0.35))];
  return w[1];
}

/**
 * Generate one quote.
 * @param {object} route element of ROUTES
 * @param {number} windowDays T+n
 * @param {object} airline element of AIRLINES
 * @param {Date} when observation date
 */
export function generateQuote(route, windowDays, airline, when = new Date()) {
  const rnd = mulberry32(hashStr(`${route.id}|${windowDays}|${airline.code}|${when.toISOString().slice(0, 10)}`));
  const base = routeBase(route);
  const lead = leadTimeMultiplier(windowDays);
  const dow = when.getUTCDay();
  const weekend = dow === 5 || dow === 6 || dow === 0 ? 1.09 : 1.0; // Fri/Sat/Sun premium
  const drift = 1 + 0.00025 * Math.floor((when.getTime() - Date.UTC(2026, 0, 1)) / 86_400_000); // slow upward drift
  const noise = 0.9 + rnd() * 0.24; // ±12% market dispersion
  const fare = base * lead * AIRLINE_MULT[airline.code] * weekend * drift * noise;
  return {
    source: 'simulated',
    airlineCode: airline.code,
    airlineName: airline.name,
    routeId: route.id,
    originCode: route.originCode,
    destinationCode: route.destinationCode,
    windowDays,
    fareRaw: Math.round(fare),
    currency: 'INR',
    refundable: airline.code === 'AI',
    scrapedAt: when,
    meta: { engine: 'simulation', seed: hashStr(`${route.id}${windowDays}${airline.code}`) },
  };
}

/** Generate a full sweep (all routes × windows × airlines) for a timestamp. */
export function generateSweep(when = new Date()) {
  const out = [];
  for (const r of ROUTES) {
    for (const w of BOOKING_WINDOWS) {
      for (const a of AIRLINES) out.push(generateQuote(r, w, a, when));
    }
  }
  return out;
}
