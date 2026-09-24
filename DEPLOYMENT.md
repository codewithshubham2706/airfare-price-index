# Deployment — Zero-Cost Free Tiers

## 1. Database — MongoDB Atlas M0 (free forever)

1. Create a cluster (M0, region: Mumbai `ap-south-1`).
2. Database user + password; network access: allow Render/Cloud Run egress or `0.0.0.0/32` pair ranges as required.
3. Copy the SRV string into `MONGODB_URI` (e.g. `mongodb+srv://user:pass@cluster.apix.mongodb.net/apix`).

## 2. API + Scraper Worker — Render

1. New → **Web Service**, repo root `server/`, build `npm ci`, start `npm start`.
2. Environment: `MONGODB_URI`, `SCRAPE_MODE`, `SCRAPE_API_KEY`, `CORS_ORIGIN=https://<pages-domain>`, `SCRAPE_OFF_PEAK_ONLY=true` in production.
3. Health check path: `/api/v1/health`.
4. **Scraper schedule** — New → **Cron Job** running `curl -X POST -H "x-api-key: $SCRAPE_API_KEY" https://<service>/api/v1/scraper/trigger` at 02:15 IST daily (the in-process cron also runs if you keep one service).

Alternative: **Google Cloud Run** — deploy `server/Dockerfile`, then a Cloud Scheduler job (Asia/Kolkata) → HTTP POST to `/api/v1/scraper/trigger` with the header.

### Live scraping mode
`SCRAPE_MODE=live` uses Playwright Chromium. On Render set the build command to
`npm ci && npx playwright install --with-deps chromium`. Cloud Run: use the included
Dockerfile which installs Chromium. Robots.txt is fetched and honored per source before any run.

## 3. Dashboard — Cloudflare Pages

1. Pages → Connect to Git, **Framework preset: Vite**, root directory `client`.
2. Build `npm run build`, output `dist`.
3. Env: `VITE_API_BASE=https://<render-service>.onrender.com/api/v1`.
4. SPA redirect: included as `client/public/_redirects` (`/* → /index.html`).

## 4. CI

`.github/workflows/ci.yml` runs the contract test suite and the client production build on every push/PR.
