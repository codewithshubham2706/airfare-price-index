# APIx — Real-Time Airfare Price Index (MoSPI & RBI)

[![CI](https://github.com/codewithshubham2706/airfare-price-index/actions/workflows/ci.yml/badge.svg)](https://github.com/codewithshubham2706/airfare-price-index/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![API Docs](https://img.shields.io/badge/Swagger-%2Fapi%2Fdocs-85ea2d?logo=swagger&logoColor=white)](/api/docs)

**Repo:** [github.com/codewithshubham2706/airfare-price-index](https://github.com/codewithshubham2706/airfare-price-index)

## 🚀 One-click deploy

| Piece | Button | Result |
|---|---|---|
| **API** (Express + scraper engine) | [![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/codewithshubham2706/airfare-price-index) | Reads `render.yaml` → `https://apix-api-xxxx.onrender.com` |
| **Dashboard** (this website) | [![Deploy to Cloudflare](https://img.shields.io/badge/Deploy-Cloudflare%20Pages-F6821F?logo=cloudflare&logoColor=white)](https://dash.cloudflare.com/?to=/:account/workers-and-pages/create/pages) | Connect repo → root `client` → `https://apix.pages.dev` |

After deploying, set the Pages env var `VITE_API_BASE=https://apix-api-xxxx.onrender.com/api/v1`
and the API's `CORS_ORIGIN=https://apix.pages.dev`.

Enterprise-grade production prototype of an automated **domestic airfare price index** for the
National Statistical Office (MoSPI) and the Reserve Bank of India (RBI).

The system ingests, cleans, and normalizes domestic airline fares in India
(IndiGo, Air India, Air India Express, Akasa Air, SpiceJet) across advance-booking
windows **T+1, T+7, T+15, T+30, T+45** for key city-pairs, and computes a weighted
economic inflation index (**APIx**, base = 100) exposed through a government-grade dashboard.

## Architecture

```
┌──────────────────────────┐        ┌──────────────────────────────────┐
│  React Dashboard (Vite)  │  REST  │  Express API  (server/)          │
│  Tailwind + Recharts     │◄──────►│  ├─ /api/v1/index/*  index maths │
│  Cloudflare Pages        │        │  ├─ /api/v1/routes/* aggregates  │
└──────────────────────────┘        │  ├─ /api/v1/scraper/*  jobs      │
                                    │  └─ Swagger UI  /api/docs        │
┌──────────────────────────┐        └───────────────▲──────────────────┘
│  Scraper Engine (Node)   │  quotes (raw → clean)  │
│  Playwright adapters +   ├────────────────────────┘
│  simulation fallback     │   MongoDB Atlas (raw quotes, normalized
└──────────────────────────┘   records, index timeline) | in-memory fallback
```

## Key components

| Layer | Location | Notes |
|---|---|---|
| API + index math | `server/` | Express 4, OpenAPI 3 docs, rate-limited, CORS-guarded |
| Scraper engine | `server/src/scraper/` | UA rotation, 5–15 s random pacing, robots.txt gate, off-peak (02:00–04:00 IST) cron, `simulate` / `live` modes |
| Index engine | `server/src/services/` | Laspeyres-style weighted index, DGCA traffic weights, chained MoM / YoY |
| Dashboard | `client/` | 4 tabs — trend, sector heatmap, lead-time elasticity, raw explorer + CSV/JSON export |
| Tests | `server/tests/` | Supertest contract suite over all v1 endpoints |

## Endpoints (OpenAPI 3)

- `GET /api/v1/index/current` — latest APIx score, MoM/YoY, sub-indices per route & window
- `GET /api/v1/index/historical?timeframe=30d&route=DEL-BOM` — chart series (daily/weekly/monthly)
- `GET /api/v1/routes/heatmap` — route × booking-window surge matrix with spark data
- `POST /api/v1/scraper/trigger` — protected (`x-api-key`) manual run trigger
- `GET /api/v1/routes` — tracked city-pairs; `GET /api/v1/scraper/status` — engine health
- `GET /api/docs` — interactive Swagger UI · `GET /api/openapi.json` — raw spec

## Quick start

```bash
npm run setup          # installs server + client deps
cp .env.example .env   # defaults run fully offline (simulation engine)
npm run dev            # API :8787 · dashboard :5173
```

For live scraping set `SCRAPE_MODE=live` and run `npx playwright install chromium`
(see **Compliance** below). For persistence set `MONGODB_URI` to a MongoDB Atlas
free-tier cluster (leave empty to use the built-in in-memory store).

Backfill 90 days of index history for demo charts:

```bash
npm run backfill
```

## Compliance & risk mitigation (§8)

- **robots.txt & ToS** — every source adapter resolves `robots.txt` before any fetch; authenticated/private paths are out of scope by policy. `simulate` mode generates data with zero network egress.
- **Throttling** — strict 5–15 s randomized delays between requests (`SCRAPE_MIN_DELAY_MS` / `SCRAPE_MAX_DELAY_MS`), never more than one page in flight per source.
- **Off-peak execution** — scheduled cron fires only inside the 02:00–04:00 IST window; manual triggers outside the window are rejected unless `SCRAPE_OFF_PEAK_ONLY=false` is explicitly set for demos.
- **UA rotation** — pool of modern desktop user-agents rotated per request; requests identify as data-research tooling per policy. No CAPTCHA-evasion, credential, or paywall circumvention logic is included by design.

## Deployment (zero-cost tiers)

- **API + scraper** — Render / Google Cloud Run (container in `server/Dockerfile`), scraper cron via Render Cron Job or Cloud Scheduler hitting `POST /api/v1/scraper/trigger`.
- **Dashboard** — Cloudflare Pages, build `npm run build` in `client/`, API base URL via `VITE_API_BASE`.
- **Database** — MongoDB Atlas M0 free cluster.

See `DEPLOYMENT.md` for the full walkthrough.
