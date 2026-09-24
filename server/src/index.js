/**
 * APIx — Express application factory (exported for tests) + server bootstrap.
 */
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import rateLimit from 'express-rate-limit';
import { env } from './env.js';
import { connectStore, getStore } from './store/index.js';
import { openapiSpec } from './openapi.js';
import indexRoutes from './routes/indexRoutes.js';
import routeRoutes from './routes/routeRoutes.js';
import scraperRoutes from './routes/scraperRoutes.js';
import quoteRoutes from './routes/quoteRoutes.js';
import authRoutes from './routes/authRoutes.js';
import { attachUser, requireAuth, requireRole } from './authMiddleware.js';
import { ensureDemoUsers } from './services/auth.js';
import { startCron } from './cron.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  // Behind Render/Cloudflare proxies: honor X-Forwarded-For so express-rate-limit
  // sees real client IPs instead of the proxy's (prevents rate-limit false merges).
  app.set('trust proxy', 1);
  // Security headers; CSP allows the Swagger UI's inline scripts/styles.
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          ...helmet.contentSecurityPolicy.defaultsDirectives,
          'script-src': ["'self'", "'unsafe-inline'"],
          'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          'font-src': ["'self'", 'https://fonts.gstatic.com', 'data:'],
        },
      },
    })
  );
  app.use(express.json({ limit: '256kb' }));
  app.use(morgan(env.nodeEnv === 'production' ? 'combined' : 'dev'));

  const allowedOrigins = String(env.corsOrigin).split(',').map((s) => s.trim()).filter(Boolean);
  app.use(
    cors({
      origin(origin, cb) {
        // Allow same-origin/no-origin (curl, health checks) and listed origins.
        if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) return cb(null, true);
        return cb(new Error(`CORS: origin ${origin} not allowed`));
      },
    })
  );

  // Global API rate limit — civic infrastructure stays gentle.
  app.use('/api/', rateLimit({ windowMs: 60_000, limit: 300, standardHeaders: 'draft-7', legacyHeaders: false }));

  // Docs
  app.get('/api/openapi.json', (_req, res) => res.json(openapiSpec));
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openapiSpec, { customSiteTitle: 'APIx — API Documentation' }));

  // v1 — auth endpoints remain (admin tooling); analytics are public read-only
  app.use(attachUser);
  app.use('/api/v1/auth', authRoutes);

  app.use('/api/v1/index', indexRoutes);
  app.use('/api/v1/routes', routeRoutes);
  app.use('/api/v1/quotes', quoteRoutes);
  // Scraper control stays gated: admin JWT **or** valid x-api-key (spec model)
  app.use('/api/v1/scraper', scraperRoutes);

  app.get('/api/v1/health', (_req, res) => {
    res.json({ status: 'ok', service: 'apix-api', version: '1.0.0', time: new Date().toISOString() });
  });

  // Deployment introspection — shows what CORS would allow; set CORS_ORIGIN
  // to your https://<project>.pages.dev URL (comma-separate for previews).
  app.get('/api/v1/meta', (_req, res) => {
    res.json({
      service: 'apix-api',
      env: env.nodeEnv,
      allowedOrigins,
      store: getStore().kind,
      scraper: { mode: env.scrapeMode, offPeakOnly: env.offPeakOnly, cron: env.scrapeCron },
      time: new Date().toISOString(),
    });
  });

  // JSON 404 for unknown API paths (HTML 404 elsewhere)
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Not found', hint: 'See /api/docs for the endpoint catalog' });
  });

  // Errors
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    console.error('[api] error:', err.message);
    res.status(err.status || 500).json({ error: err.message || 'Internal error' });
  });

  return app;
}

/** Bootstrap when run directly. */
const isMain = process.argv[1] && process.argv[1].endsWith('index.js');
if (isMain) {
  const app = createApp();
  await connectStore(console);

  // Auto-seed 90 days of simulated history on FIRST boot only (empty timeline),
  // for any store kind — the dashboard is never empty, and with MongoDB the
  // history then survives restarts instead of being regenerated per boot.
  await ensureDemoUsers();

  const timeline = await getStore().findIndexPoints({ routeId: null, windowDays: null });
  if (timeline.length === 0) {
    const { seedHistory } = await import('./services/demoSeed.js');
    await seedHistory(90, console);
  } else {
    console.log(`[apix] index timeline present (${timeline.length} days) — persistence OK, no seed needed`);
  }

  const server = app.listen(env.port, () => {
    console.log(`[apix] API listening on http://localhost:${env.port} (docs: /api/docs)`);
    startCron();
  });
  const shutdown = () => server.close(() => process.exit(0));
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
