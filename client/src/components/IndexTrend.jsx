import { useMemo, useState } from 'react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine,
} from 'recharts';
import { TIMEFRAMES } from '../services/format.js';

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-card dark:border-slate-700 dark:bg-slate-900">
      <p className="mb-1 font-semibold text-slate-700 dark:text-slate-200">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="num flex items-center gap-2 text-slate-600 dark:text-slate-300">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: p.color }} />
          {p.name}: <span className="font-semibold">{p.value?.toFixed(1)}</span>
        </p>
      ))}
    </div>
  );
}

export default function IndexTrend({ historical, timeframe, setTimeframe, routes }) {
  const [showBaseline, setShowBaseline] = useState(true);
  const [routeFilter, setRouteFilter] = useState('');

  const data = useMemo(() => {
    if (!historical?.series) return [];
    // 7-day moving average as the "baseline benchmark" line
    const series = historical.series;
    return series.map((p, i) => {
      const windowSlice = series.slice(Math.max(0, i - 6), i + 1);
      const avg = windowSlice.reduce((s, x) => s + x.value, 0) / windowSlice.length;
      return { ...p, baseline: Number(avg.toFixed(2)) };
    });
  }, [historical]);

  const last = data[data.length - 1]?.value;
  const first = data[0]?.value;
  const periodDelta = last != null && first != null ? (((last - first) / first) * 100).toFixed(2) : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf.value}
              onClick={() => setTimeframe(tf.value)}
              className={`btn text-xs ${timeframe === tf.value
                ? 'bg-brand-600 text-white shadow-card'
                : 'border border-slate-200 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'}`}
            >
              {tf.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <label className="flex cursor-pointer items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <input type="checkbox" checked={showBaseline} onChange={(e) => setShowBaseline(e.target.checked)} className="accent-brand-600" />
            7-day baseline trend
          </label>
          <select
            value={routeFilter}
            onChange={(e) => setRouteFilter(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
          >
            <option value="">Overlay route sub-index…</option>
            {(routes || []).map((r) => (
              <option key={r.id} value={r.id}>{r.label || r.id}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="card p-4">
        <div className="mb-3 flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <h3 className="text-sm font-semibold">APIx composite movement</h3>
          {periodDelta != null && (
            <span className={`num text-xs font-semibold ${Number(periodDelta) >= 0 ? 'text-red-500' : 'text-emerald-500'}`}>
              {Number(periodDelta) >= 0 ? '▲' : '▼'} {Math.abs(periodDelta)}% over period
            </span>
          )}
          <span className="text-xs text-slate-400">Reference base = 100</span>
        </div>
        <div className="h-[380px] w-full text-slate-500 dark:text-slate-400">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: -8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.15} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'currentColor' }} tickLine={false} axisLine={false} minTickGap={40} />
              <YAxis domain={['dataMin - 4', 'dataMax + 4']} tick={{ fontSize: 11, fill: 'currentColor' }} tickLine={false} axisLine={false} />
              <Tooltip content={<ChartTooltip />} />
              <ReferenceLine y={100} stroke="#94a3b8" strokeDasharray="6 4" label={{ value: 'Base 100', fontSize: 10, fill: 'currentColor', position: 'insideBottomRight' }} />
              {showBaseline && (
                <Line type="monotone" dataKey="baseline" name="7-day baseline" stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="5 3" dot={false} animationDuration={2200} animationBegin={350} animationEasing="ease-out" />
              )}
              <Line type="monotone" dataKey="value" name="APIx" stroke="#1d6fec" strokeWidth={2.4} dot={false} activeDot={{ r: 4 }} animationDuration={1600} animationEasing="ease-out" />
            </LineChart>
          </ResponsiveContainer>
        </div>
        {routeFilter && (
          <RouteOverlay routeId={routeFilter} timeframe={timeframe} />
        )}
      </div>
    </div>
  );
}

/** Secondary small chart for the selected route sub-index. */
import { useEffect } from 'react';
import { api } from '../services/api.js';

function RouteOverlay({ routeId, timeframe }) {
  const [series, setSeries] = useState(null);
  useEffect(() => {
    let live = true;
    api.historical({ timeframe, route: routeId }).then((d) => live && setSeries(d.series)).catch(() => live && setSeries([]));
    return () => { live = false; };
  }, [routeId, timeframe]);

  if (!series?.length) return null;
  return (
    <div className="mt-4 border-t border-slate-100 pt-3 dark:border-slate-800">
      <p className="mb-2 text-xs font-semibold text-slate-500 dark:text-slate-400">Route sub-index: {routeId}</p>
      <div className="h-[160px] w-full text-slate-500 dark:text-slate-400">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={series} margin={{ top: 4, right: 16, bottom: 0, left: -8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.15} />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'currentColor' }} tickLine={false} axisLine={false} minTickGap={50} />
            <YAxis domain={['dataMin - 3', 'dataMax + 3']} tick={{ fontSize: 10, fill: 'currentColor' }} tickLine={false} axisLine={false} width={40} />
            <Tooltip content={<ChartTooltip />} />
            <Line type="monotone" dataKey="value" name={routeId} stroke="#7c3aed" strokeWidth={2} dot={false} animationDuration={1200} animationEasing="ease-out" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
