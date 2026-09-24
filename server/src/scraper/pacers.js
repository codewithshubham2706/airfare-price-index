/**
 * Request pacing & compliance gates (§8 — Throttling & Off-Peak Execution).
 * - Randomized 5–15 s delays between fetches (configurable).
 * - Off-peak IST window enforcement (02:00–04:00 by default).
 */
import { env } from './shared.js';
import { isOffPeakNow, OFF_PEAK_WINDOW, istClock } from '../utils/time.js';

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function randomDelayMs() {
  const min = Math.min(env.minDelayMs, env.maxDelayMs);
  const max = Math.max(env.minDelayMs, env.maxDelayMs);
  return Math.floor(min + Math.random() * (max - min));
}

/** Sequential task runner honoring the pacing delay between each task. */
export async function runWithPacing(tasks, { onProgress } = {}) {
  const results = [];
  for (let i = 0; i < tasks.length; i++) {
    if (onProgress) onProgress(i, tasks.length);
    results.push(await tasks[i]());
    if (i < tasks.length - 1) {
      const d = randomDelayMs();
      if (onProgress) onProgress(i + 1, tasks.length, `pacing ${Math.round(d / 100) / 10}s`);
      await sleep(d);
    }
  }
  return results;
}

/**
 * Off-peak gate for the IST window. Returns { ok, reason }.
 * Manual/demo triggers may bypass via force (the API layer decides).
 */
export function offPeakGate(force = false) {
  if (force || !env.offPeakOnly) return { ok: true };
  const inWindow = isOffPeakNow(OFF_PEAK_WINDOW);
  const { hours, minutes } = istClock();
  return inWindow
    ? { ok: true }
    : { ok: false, reason: `Outside off-peak window (02:00–04:00 IST). Current IST ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}. Set SCRAPE_OFF_PEAK_ONLY=false or pass force=true to override for demos.` };
}
