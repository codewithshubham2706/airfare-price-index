# APIx Roadmap — What to Build Next

The prototype is complete and working (auth, index engine, dashboard, scraper, CI).
Below is the full expansion plan, grouped by theme, ordered roughly by value-per-effort.

## Phase 1 — Production hardening (do first)

| Item | What it takes |
|---|---|
| **Atlas persistence** | Paste `MONGODB_URI` into Render env — users & index history survive restarts (code ready, `npm run verify:atlas` to check) |
| **Live scraping mode** | Review each portal's ToS → set `SCRAPE_MODE=live`, `npx playwright install chromium` in the Render build; adapters already scaffolded in `server/src/scraper/sources/live.js` |
| **HTTPS + custom domain** | Cloudflare Pages gives HTTPS free; map `apix.mospi.gov.in`-style domain via CNAME |
| **JWT secret rotation** | Set a dedicated 64-char `JWT_SECRET` env var in Render (currently derived from `SCRAPE_API_KEY`) |
| **Atlas backups** | M0 has none — move to M2 (~$9/mo) once the index timeline becomes authoritative |

## Phase 2 — Statistical & analytical depth

- **Chain-linked index methodology**: proper chained Laspeyres with annual weight rebasing (currently fixed DGCA weights) + published methodology note
- **YoY curves**: 365-day historical window already stored — add a year-over-year overlay to the trend tab
- **Seasonality decomposition**: STL/HP-filter on the index series to separate trend vs seasonal vs shock components
- **Fare-box plots per sector**: distribution view (p25/p50/p75) per route per day, not just means
- **Ancillary fee tracking**: scrape baggage/seat fees separately — true cost-of-travel index
- **Route elasticity econometrics**: regress log-fare on lead-time per sector; publish elasticities as an API endpoint

## Phase 3 — Platform features

- **Alerts & subscriptions**: email/WhatsApp digests when a sector×window surges >15% vs baseline (cells already computed in the heatmap service)
- **Public transparency portal**: read-only public site showing headline index + sparklines (no login) — separate from the analyst console
- **User management UI**: admin panel to list/invite/disable users (auth + roles already in place)
- **Audit trail page**: surface the scraper `runs` collection in the dashboard with per-run diff stats
- **Scheduled reports**: weekly PDF/CSV index briefing auto-emailed to subscribers
- **Multi-language UI**: Hindi/English toggle (i18n layer on the dashboard copy)

## Phase 4 — Engineering scale-ups

- **Message-queue scraping**: move orchestration to BullMQ/Redis so runs are resumable and parallelizable per source
- **Source adapters as plugins**: per-portal parser modules with health checks and per-source accuracy scores vs a truth sample
- **Data quality dashboard**: coverage %, imputation rate, outlier rejection rate, source freshness per cell (the data already carries these flags)
- **TimescaleDB/ClickHouse option**: columnar store for the quote time-series once volume passes ~10M rows
- **OpenAPI client SDKs**: generate TS/Python clients from `/api/openapi.json` for researchers
- **Rate-limit per API key**: issue researcher API keys with quotas; meter usage

## Phase 5 — Institutional integration

- **DGCA data cross-validation**: reconcile APIx fares against DGCA's published sector-wise averages; publish a variance report
- **CPI integration hooks**: export the index in the format RBI/MoSPI internal systems ingest
- **Real-time pipeline**: websocket/SSE push of index updates instead of polling
- **Mobile PWA**: installable dashboard with offline cache of the latest index snapshot
- **Data Lake export**: nightly Parquet dumps of `quotes_clean` to object storage for research datasets

## Suggested immediate next step

Atlas persistence (one env var, zero code) → then alerts (highest user-visible value) → then live mode behind a ToS review.
