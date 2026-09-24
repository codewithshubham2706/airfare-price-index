/**
 * Live Playwright adapter — template for real portal extraction.
 *
 * COMPLIANCE (§8) — this adapter is intentionally conservative:
 *  - robots.txt gate runs before every URL (see orchestrator)
 *  - randomized 5–15 s pacing between page loads (see orchestrator)
 *  - honest research headers, no CAPTCHA/auth/paywall circumvention of any kind
 *  - read-only navigation to public, unauthenticated search results
 *
 * Selectors below are illustrative structure, not operational — portal DOMs change
 * frequently and each target's ToS must be reviewed before enabling live mode.
 */
import { researchHeaders } from '../userAgents.js';

let browserPromise = null;

async function getBrowser() {
  if (!browserPromise) {
    const { chromium } = await import('playwright');
    browserPromise = chromium.launch({ headless: true, args: ['--no-sandbox'] });
  }
  return browserPromise;
}

export async function closeBrowser() {
  if (browserPromise) {
    const b = await browserPromise;
    await b.close().catch(() => {});
    browserPromise = null;
  }
}

/**
 * Fetch public search page and extract fare candidates.
 * @returns {Array} raw quotes in the standard raw shape (may be empty)
 */
export async function fetchQuotesForRoute({ route, windowDays, origin, destination }, { timeoutMs = 20000 } = {}) {
  const browser = await getBrowser();
  const ctx = await browser.newContext({ userAgent: researchHeaders()['User-Agent'], locale: 'en-IN', timezoneId: 'Asia/Kolkata' });
  const page = await ctx.newPage();
  const url = `https://www.google.com/travel/flights?q=Flights%20from%20${origin}%20to%20${destination}%20on%20${departureDate(windowDays)}`;
  const quotes = [];
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
    await page.waitForTimeout(3000); // let results hydrate
    const cells = page.locator('div[role="listitem"] span');
    const n = Math.min(await cells.count(), 40);
    for (let i = 0; i < n; i++) {
      const txt = (await cells.nth(i).textContent().catch(() => '')) || '';
      const fare = parseINR(txt);
      if (fare == null) continue;
      quotes.push({
        source: 'live:google-travel',
        airlineName: guessAirline(txt),
        routeId: route.id,
        originCode: origin,
        destinationCode: destination,
        windowDays,
        fareRaw: fare,
        currency: 'INR',
        refundable: false,
        scrapedAt: new Date(),
        meta: { url, position: i },
      });
    }
  } finally {
    await ctx.close().catch(() => {});
  }
  return quotes;
}

function departureDate(windowDays) {
  const d = new Date(Date.now() + windowDays * 86_400_000);
  return d.toISOString().slice(0, 10);
}

export function parseINR(text) {
  const m = String(text).match(/₹\s?([\d,]{3,})/);
  if (!m) return null;
  const n = Number.parseInt(m[1].replace(/,/g, ''), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function guessAirline(text) {
  const t = text.toLowerCase();
  if (t.includes('indigo')) return 'IndiGo';
  if (t.includes('air india express')) return 'Air India Express';
  if (t.includes('air india')) return 'Air India';
  if (t.includes('akasa')) return 'Akasa Air';
  if (t.includes('spicejet')) return 'SpiceJet';
  return 'Unknown carrier';
}
