/**
 * Route/aggregation endpoints — heatmap, routes catalog, elasticities.
 */
import { Router } from 'express';
import { ROUTES, BOOKING_WINDOWS } from '../config.js';
import { getHeatmap } from '../services/aggregator.js';

const router = Router();

/** GET /api/v1/routes/heatmap */
router.get('/heatmap', async (_req, res, next) => {
  try { res.json(await getHeatmap()); } catch (err) { next(err); }
});

/** GET /api/v1/routes — tracked city-pairs catalog */
router.get('/', (_req, res) => {
  res.json({
    count: ROUTES.length,
    routes: ROUTES.map((r) => ({
      id: r.id, origin: r.origin, originCode: r.originCode,
      destination: r.destination, destinationCode: r.destinationCode,
      weight: r.weight, distanceKm: r.distanceKm,
    })),
  });
});

/** GET /api/v1/routes/elasticity — lead-time elasticity curve (avg fare per window) */
router.get('/elasticity', async (_req, res, next) => {
  try {
    const { rows } = await import('../store/index.js').then((m) => m.getStore().findQuotesClean({ limit: 100000 }));
    const byRoute = ROUTES.map((r) => {
      const q = rows.filter((x) => x.routeId === r.id);
      const points = BOOKING_WINDOWS.map((w) => {
        const fares = q.filter((x) => x.windowDays === w).map((x) => x.fareINR);
        const avg = fares.length ? fares.reduce((s, f) => s + f, 0) / fares.length : null;
        return { windowDays: w, label: `T+${w}`, avgFare: avg == null ? null : Math.round(avg) };
      });
      return { routeId: r.id, label: `${r.originCode}–${r.destinationCode}`, points };
    });
    res.json({ generatedAt: new Date().toISOString(), routes: byRoute });
  } catch (err) { next(err); }
});

export default router;
