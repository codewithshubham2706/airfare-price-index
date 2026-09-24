/**
 * Cleaning & normalization pipeline.
 * Raw scrape payload → canonical analytical record.
 *
 * Raw shape (per source adapter):
 * { source, airlineName, routeId, windowDays, fareRaw, currency, scrapedAt, meta }
 */

const INR = 'INR';

/** Extract the numeric fare from messy strings: "₹ 5,840", "INR5840", "5,840.00" etc. */
export function parseFare(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return null;
  const cleaned = value.replace(/[₹,\s]/g, '').replace(/INR/gi, '');
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Canonical airline code from fuzzy carrier names. */
export function airlineCode(name = '') {
  const n = name.toLowerCase();
  if (n.includes('indigo') || n === '6e') return '6E';
  if (n === 'ai' || (n.includes('air india') && !n.includes('express'))) return 'AI';
  if (n.includes('express') || n === 'ix') return 'IX';
  if (n.includes('akasa') || n === 'qp') return 'QP';
  if (n.includes('spicejet') || n === 'sg') return 'SG';
  return null;
}

/** Convert USD/EUR quotes to INR when a source leaks foreign currency (demo fx). */
const FX_TO_INR = { INR: 1, USD: 83.5, EUR: 90.2, GBP: 106.0 };

/**
 * Normalize one raw quote into the clean analytical schema.
 * Returns null when the quote must be discarded (outlier or unparseable).
 */
export function normalizeQuote(raw, { medianFare = null } = {}) {
  const fare = parseFare(raw.fareRaw ?? raw.fare ?? raw.price);
  if (fare == null) return null;

  const code = raw.airlineCode || airlineCode(raw.airlineName);
  if (!code) return null; // unknown carrier → drop (policy: no silent imputation)

  // Currency normalization → INR
  const currency = (raw.currency || INR).toUpperCase();
  const fx = FX_TO_INR[currency];
  if (!fx) return null;
  let fareINR = Math.round(fare * fx);

  // Outlier guard: |log(fare/median)| > 0.6 ⇒ discard (≈ ±82%)
  if (medianFare && medianFare > 0) {
    const dev = Math.abs(Math.log(fareINR / medianFare));
    if (dev > 0.6) return null;
  }
  // Absolute sanity bands for domestic economy (₹1,200 – ₹35,000)
  if (fareINR < 1200 || fareINR > 35000) return null;

  return {
    source: raw.source || 'unknown',
    routeId: raw.routeId,
    originCode: raw.originCode,
    destinationCode: raw.destinationCode,
    windowDays: Number(raw.windowDays),
    airlineCode: code,
    airlineName: raw.airlineName || code,
    fareINR,
    currency: INR,
    refundable: Boolean(raw.refundable),
    scrapedAt: raw.scrapedAt instanceof Date ? raw.scrapedAt : new Date(raw.scrapedAt || Date.now()),
    isImputed: false,
    meta: raw.meta || {},
  };
}

/** Median helper used for the outlier baseline. */
export function median(nums) {
  if (!nums.length) return null;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

/**
 * Normalize a batch. The outlier baseline is the **per-cell** (route × window)
 * median, not a global one — otherwise legitimately expensive long-haul T+1
 * quotes would be discarded against cheap short-haul medians.
 */
export function normalizeBatch(rawQuotes) {
  const cellFares = new Map();
  for (const r of rawQuotes) {
    const fare = parseFare(r.fareRaw ?? r.fare ?? r.price);
    if (fare == null) continue;
    const key = `${r.routeId}|${r.windowDays}`;
    if (!cellFares.has(key)) cellFares.set(key, []);
    cellFares.get(key).push(fare);
  }
  return rawQuotes
    .map((r) => normalizeQuote(r, { medianFare: median(cellFares.get(`${r.routeId}|${r.windowDays}`) || []) }))
    .filter(Boolean);
}

/**
 * Fill missing (route × window × airline) cells with the cell-median of the
 * same route+window across carriers — flagged isImputed=true. Price statisticians
 * call this deterministic imputation; it keeps the index chain unbroken.
 */
export function imputeMissing(cleanQuotes, { routes, windows, airlines }) {
  const cellMedians = new Map();
  for (const r of routes) {
    for (const w of windows) {
      const fares = cleanQuotes.filter((q) => q.routeId === r.id && q.windowDays === w).map((q) => q.fareINR);
      const m = median(fares);
      if (m) cellMedians.set(`${r.id}|${w}`, m);
    }
  }
  const present = new Set(cleanQuotes.map((q) => `${q.routeId}|${q.windowDays}|${q.airlineCode}`));
  const out = [...cleanQuotes];
  for (const r of routes) {
    for (const w of windows) {
      const base = cellMedians.get(`${r.id}|${w}`);
      if (!base) continue;
      for (const a of airlines) {
        const key = `${r.id}|${w}|${a.code}`;
        if (!present.has(key)) {
          out.push({
            source: 'imputation',
            routeId: r.id,
            originCode: r.originCode,
            destinationCode: r.destinationCode,
            windowDays: w,
            airlineCode: a.code,
            airlineName: a.name,
            fareINR: Math.round(base * (0.97 + ((a.code.charCodeAt(0) % 7) / 100))), // ±3% carrier offset
            currency: INR,
            refundable: false,
            scrapedAt: new Date(),
            isImputed: true,
            meta: { method: 'cell-median' },
          });
        }
      }
    }
  }
  return out;
}
