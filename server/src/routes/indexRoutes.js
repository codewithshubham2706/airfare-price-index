/**
 * Index endpoints — current snapshot & historical series.
 */
import { Router } from 'express';
import { TIMEFRAMES, ROUTE_IDS, BOOKING_WINDOWS } from '../config.js';
import { getCurrentIndex, getHistoricalIndex } from '../services/aggregator.js';
import { indexDeltas } from '../services/timeline.js';

const router = Router();

/** GET /api/v1/index/current */
router.get('/current', async (_req, res, next) => {
  try {
    const current = await getCurrentIndex();
    const { momPct, yoyPct } = await indexDeltas();
    res.json({ ...current, momPct, yoyPct });
  } catch (err) { next(err); }
});

/** GET /api/v1/index/historical?timeframe=30d&route=DEL-BOM&window=30 */
router.get('/historical', async (req, res, next) => {
  try {
    const timeframe = TIMEFRAMES.includes(req.query.timeframe) ? req.query.timeframe : '30d';
    const routeId = ROUTE_IDS.includes(req.query.route) ? req.query.route : null;
    const windowDays = BOOKING_WINDOWS.includes(Number(req.query.window)) ? Number(req.query.window) : null;
    const data = await getHistoricalIndex({ timeframe, routeId, windowDays });
    res.json(data);
  } catch (err) { next(err); }
});

export default router;
