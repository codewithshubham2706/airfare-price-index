/**
 * Scraper control endpoints — trigger, status.
 * POST /trigger is key-protected (x-api-key).
 */
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { env } from '../env.js';
import { getStore } from '../store/index.js';
import { runScrapeCycle } from '../scraper/orchestrator.js';

const router = Router();
const triggerLimiter = rateLimit({ windowMs: 60_000, limit: 6, standardHeaders: 'draft-7', legacyHeaders: false });

/** GET /api/v1/scraper/status */
router.get('/status', async (_req, res, next) => {
  try {
    const store = getStore();
    const runs = await store.findRuns(10);
    const last = runs.find((r) => r.status === 'completed');
    res.json({
      mode: env.scrapeMode,
      offPeakOnly: env.offPeakOnly,
      offPeakWindowIST: '02:00–04:00',
      pacing: { minDelayMs: env.minDelayMs, maxDelayMs: env.maxDelayMs },
      lastSync: last ? last.finishedAt || last.startedAt : null,
      lastRun: last || null,
      recentRuns: runs,
    });
  } catch (err) { next(err); }
});

/** POST /api/v1/scraper/trigger */
router.post('/trigger', triggerLimiter, async (req, res, next) => {
  try {
    const key = req.get('x-api-key');
    if (!key || key !== env.scrapeApiKey) {
      return res.status(401).json({ error: 'Unauthorized — provide x-api-key header' });
    }
    const { force = false, mode, routes, windows } = req.body || {};
    if (mode && !['simulate', 'live'].includes(mode)) {
      return res.status(400).json({ error: 'mode must be "simulate" or "live"' });
    }
    if (routes && (!Array.isArray(routes) || routes.some((r) => typeof r !== 'string'))) {
      return res.status(400).json({ error: 'routes must be an array of route ids' });
    }
    if (windows && (!Array.isArray(windows) || windows.some((w) => !Number.isInteger(w) || w < 1 || w > 365))) {
      return res.status(400).json({ error: 'windows must be an array of integers (days ahead)' });
    }
    const result = await runScrapeCycle({ trigger: 'manual', force: Boolean(force), mode, routes, windows });
    if (!result.ok) return res.status(409).json(result);
    res.status(202).json(result);
  } catch (err) { next(err); }
});

export default router;
