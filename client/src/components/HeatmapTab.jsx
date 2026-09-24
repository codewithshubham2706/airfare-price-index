import { useState } from 'react';
import { inr, pct } from '../services/api.js';
import { WINDOWS, heatColor } from '../services/format.js';
import { Flame } from 'lucide-react';

function Cell({ cell }) {
  return (
    <td className="p-0.5">
      <div
        className={`group relative flex h-12 min-w-[64px] cursor-default flex-col items-center justify-center rounded-md text-center transition-transform hover:scale-[1.04] ${heatColor(cell.pctChange)}`}
        title={`${cell.label}: ${inr(cell.fare)} (baseline ${inr(cell.baseFare)}, ${pct(cell.pctChange)})`}
      >
        <span className="num text-[13px] font-bold leading-none">{cell.pctChange == null ? '—' : `${cell.pctChange > 0 ? '+' : ''}${cell.pctChange.toFixed(1)}%`}</span>
        <span className="mt-0.5 text-[10px] leading-none opacity-75">{cell.fare != null ? inr(cell.fare) : '—'}</span>
      </div>
    </td>
  );
}

export default function HeatmapTab({ heatmap }) {
  const [sortMode, setSortMode] = useState('weight'); // weight | surge
  if (!heatmap) return <div className="card h-64 animate-pulse" />;

  const routes = [...heatmap.routes].sort((a, b) => {
    if (sortMode === 'weight') return b.weight - a.weight;
    const maxA = Math.max(...a.windows.map((w) => w.pctChange ?? 0));
    const maxB = Math.max(...b.windows.map((w) => w.pctChange ?? 0));
    return maxB - maxA;
  });

  const hottest = routes
    .flatMap((r) => r.windows.map((w) => ({ ...w, routeId: r.routeId, label2: r.label })))
    .sort((a, b) => (b.pctChange ?? 0) - (a.pctChange ?? 0))[0];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span className="font-medium">Cell = % change vs 7-day baseline fare</span>
          <span className="hidden sm:inline">· hover for absolute fares</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1" aria-hidden>
            <span className="text-[10px] text-slate-400">-15%</span>
            {[-15, -7, -3, 0, 3, 7, 15, 30].map((v) => (
              <span key={v} className={`h-4 w-5 rounded-sm ${heatColor(v)}`} />
            ))}
            <span className="text-[10px] text-slate-400">+30%</span>
          </div>
          <select
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-900"
          >
            <option value="weight">Sort: traffic weight</option>
            <option value="surge">Sort: max surge</option>
          </select>
        </div>
      </div>

      {hottest && (
        <div className="card flex items-center gap-3 border-orange-200 p-3 dark:border-orange-900/50">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-100 text-orange-600 dark:bg-orange-950/60 dark:text-orange-400">
            <Flame className="h-4 w-4" />
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-300">
            Hottest sector: <span className="font-bold">{hottest.label2} @ {hottest.label}</span> —{' '}
            <span className="num font-bold text-orange-600 dark:text-orange-400">{pct(hottest.pctChange)}</span> vs baseline
            ({inr(hottest.fare)} now, {inr(hottest.baseFare)} baseline)
          </p>
        </div>
      )}

      <div className="card overflow-x-auto p-4">
        <table className="w-full border-separate border-spacing-0">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-inherit pb-2 pr-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Sector
              </th>
              {WINDOWS.map((w) => (
                <th key={w.days} className="pb-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  {w.label}
                </th>
              ))}
              <th className="pb-2 pl-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">30d Δ</th>
            </tr>
          </thead>
          <tbody>
            {routes.map((r) => {
              const spark = r.spark || [];
              const first = spark[0]?.value;
              const last = spark[spark.length - 1]?.value;
              const d30 = first != null && last != null ? ((last - first) / first) * 100 : null;
              const byWindow = Object.fromEntries(r.windows.map((w) => [w.windowDays, w]));
              return (
                <tr key={r.routeId}>
                  <td className="sticky left-0 z-10 bg-white py-1 pr-3 dark:bg-slate-950">
                    <div className="flex items-center gap-2">
                      <span className="num text-sm font-semibold">{r.label}</span>
                      <span className="badge bg-slate-100 text-[10px] text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                        {(r.weight * 100).toFixed(0)}% w
                      </span>
                    </div>
                  </td>
                  {WINDOWS.map((w) => (
                    <Cell key={w.days} cell={byWindow[w.days] || { label: w.label, pctChange: null, fare: null }} />
                  ))}
                  <td className={`num pl-3 text-right text-sm font-semibold ${d30 == null ? 'text-slate-400' : d30 >= 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                    {d30 == null ? '—' : pct(d30, 1)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
