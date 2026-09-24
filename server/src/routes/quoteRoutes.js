/**
 * Quotes endpoints — Raw Data Explorer (table + CSV/JSON export for NSO).
 */
import { Router } from 'express';
import { getStore } from '../store/index.js';

const router = Router();

const CSV_COLUMNS = [
  'scrapedAt', 'source', 'routeId', 'originCode', 'destinationCode', 'windowDays',
  'airlineCode', 'airlineName', 'fareINR', 'currency', 'refundable', 'isImputed',
];

function toCsv(rows) {
  const esc = (v) => {
    if (v == null) return '';
    const s = v instanceof Date ? v.toISOString() : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [CSV_COLUMNS.join(','), ...rows.map((r) => CSV_COLUMNS.map((c) => esc(r[c])).join(','))].join('\n');
}

/** GET /api/v1/quotes?route=&window=&airline=&q=&from=&to=&limit=&skip=&format=csv|json */
router.get('/', async (req, res, next) => {
  try {
    const filter = {
      routeId: req.query.route,
      windowDays: req.query.window ? Number(req.query.window) : undefined,
      airlineCode: req.query.airline,
      q: req.query.q,
      from: req.query.from,
      to: req.query.to,
      limit: Math.min(Number(req.query.limit || 500), 5000),
      skip: Number(req.query.skip || 0),
    };
    const { rows, total } = await getStore().findQuotesClean(filter);
    if (req.query.format === 'csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="apix_quotes_${new Date().toISOString().slice(0, 10)}.csv"`);
      return res.send(toCsv(rows));
    }
    res.json({ total, count: rows.length, limit: filter.limit, skip: filter.skip, quotes: rows });
  } catch (err) { next(err); }
});

export default router;
