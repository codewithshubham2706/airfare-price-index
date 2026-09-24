/**
 * Off-peak daily cron — fires inside 02:00–04:00 IST window (default 02:45 IST).
 * Cron format is UTC seconds-based: "0 45 20 * * *" == 02:45 IST.
 * If the process wakes inside the window but off-schedule (e.g. restart),
 * the off-peak gate still permits the run only within the window.
 */
import { env } from './env.js';
import { runScrapeCycle } from './scraper/orchestrator.js';
import { isOffPeakNow, OFF_PEAK_WINDOW } from './utils/time.js';

const CRON_RE = /^(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)$/; // sec min hour dom mon dow

/** Tiny seconds-precision cron scheduler (no external dep). */
export function startCron(handler = runScrapeCycle) {
  const m = env.scrapeCron.match(CRON_RE);
  if (!m) {
    console.warn(`[cron] unparsable SCRAPE_CRON "${env.scrapeCron}" — scheduler disabled`);
    return;
  }
  const [, sec, min, hour] = m;
  const matches = (field, val) => field === '*' || Number(field) === val;

  const tick = async () => {
    const now = new Date();
    if (matches(sec, now.getUTCSeconds()) && matches(min, now.getUTCMinutes()) && matches(hour, now.getUTCHours())) {
      // Double-check the IST off-peak window before doing any work.
      if (isOffPeakNow(OFF_PEAK_WINDOW)) {
        console.log('[cron] off-peak window active → running scheduled scrape');
        try { await handler({ trigger: 'cron' }); } catch (err) { console.error('[cron] run failed:', err.message); }
      } else {
        console.log('[cron] scheduled tick outside off-peak window — skipping (compliance gate)');
      }
    }
  };
  const timer = setInterval(tick, 1000);
  console.log(`[cron] scheduler armed: "${env.scrapeCron}" (off-peak 02:00–04:00 IST)`);
  return timer;
}
