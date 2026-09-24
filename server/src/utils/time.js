/** IST is UTC+5:30. All compliance windows are anchored to IST. */
export const IST_OFFSET_MINUTES = 330;

/**
 * Current time in IST returned as a Date whose *UTC* fields read as the IST wall clock.
 * (Convention used everywhere in the scraper for window math.)
 */
export function nowIST() {
  return new Date(Date.now() + IST_OFFSET_MINUTES * 60_000);
}

/** { hours, minutes } of the current IST wall clock. */
export function istClock(date = nowIST()) {
  return { hours: date.getUTCHours(), minutes: date.getUTCMinutes() };
}

/** Minutes since IST midnight. */
export function istMinutesOfDay(date = nowIST()) {
  const { hours, minutes } = istClock(date);
  return hours * 60 + minutes;
}

/**
 * Is the current IST time inside the off-peak scraping window [startMin, endMin)?
 * The window may wrap midnight (e.g. 02:00–04:00 does not, but support it anyway).
 */
export function isOffPeakNow({ startMin = 120, endMin = 240 } = {}) {
  const m = istMinutesOfDay();
  if (startMin <= endMin) return m >= startMin && m < endMin;
  return m >= startMin || m < endMin; // wraps midnight
}

/** Default off-peak window: 02:00–04:00 IST → [120, 240). */
export const OFF_PEAK_WINDOW = { startMin: 120, endMin: 240 };

/** UTC cron (sec min hour * * *) that fires at 02:15 IST daily (20:45 UTC). */
export const OFF_PEAK_CRON_UTC = '0 45 20 * * *';
