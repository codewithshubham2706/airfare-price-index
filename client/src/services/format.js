export const WINDOWS = [
  { days: 1, label: 'T+1' },
  { days: 7, label: 'T+7' },
  { days: 15, label: 'T+15' },
  { days: 30, label: 'T+30' },
  { days: 45, label: 'T+45' },
];

export const TIMEFRAMES = [
  { value: '7d', label: 'Daily · 7D' },
  { value: '30d', label: 'Daily · 30D' },
  { value: '90d', label: 'Daily · 90D' },
  { value: '1y', label: 'Weekly · 1Y' },
];

/** Heatmap cell color by % change — blue (cheaper) → slate → red (surge). */
export function heatColor(pct) {
  if (pct == null) return 'bg-slate-100 dark:bg-slate-800/40 text-slate-400';
  if (pct <= -15) return 'bg-blue-600 text-white';
  if (pct <= -7) return 'bg-blue-400/90 text-white';
  if (pct <= -3) return 'bg-blue-200 text-blue-900 dark:text-blue-950';
  if (pct < 3) return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200';
  if (pct < 7) return 'bg-amber-200 text-amber-950';
  if (pct < 15) return 'bg-orange-400 text-white';
  if (pct < 30) return 'bg-red-500 text-white';
  return 'bg-red-700 text-white';
}

/** Sub-index line colors (routes). */
export const ROUTE_COLORS = [
  '#1d6fec', '#dc2626', '#059669', '#d97706', '#7c3aed', '#0891b2',
  '#db2777', '#65a30d', '#ea580c', '#4f46e5', '#0d9488', '#b45309',
];

export const WINDOW_COLORS = {
  1: '#dc2626',
  7: '#ea580c',
  15: '#d97706',
  30: '#1d6fec',
  45: '#059669',
};
