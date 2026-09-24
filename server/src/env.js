import 'dotenv/config';

const bool = (v, dflt) => (v === undefined || v === '' ? dflt : String(v).toLowerCase() === 'true');

const portNum = Number(process.env.PORT);
export const env = {
  port: Number.isInteger(portNum) && portNum > 0 ? portNum : 8787,
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',

  mongoUri: process.env.MONGODB_URI || '',
  mongoDb: process.env.MONGODB_DB || 'apix',

  scrapeMode: (process.env.SCRAPE_MODE || 'simulate').toLowerCase(), // simulate | live
  scrapeApiKey: process.env.SCRAPE_API_KEY || 'apix-demo-key',
  minDelayMs: Number(process.env.SCRAPE_MIN_DELAY_MS || 5000),
  maxDelayMs: Number(process.env.SCRAPE_MAX_DELAY_MS || 15000),
  offPeakOnly: bool(process.env.SCRAPE_OFF_PEAK_ONLY, false),
  scrapeCron: process.env.SCRAPE_CRON || '0 45 20 * * *', // 02:45 IST daily (UTC cron)

  baselineDays: Number(process.env.BASELINE_DAYS || 7),
};

// Startup guard: the demo default is fine locally, never in production.
if (env.nodeEnv === 'production' && env.scrapeApiKey.length < 32) {
  console.warn('[security] SCRAPE_API_KEY is weak (<32 chars) — set a strong generated key in the hosting environment');
}
