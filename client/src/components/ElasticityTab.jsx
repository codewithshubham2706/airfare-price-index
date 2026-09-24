import { useState, useMemo } from 'react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import { inr } from '../services/api.js';
import { ROUTE_COLORS } from '../services/format.js';

export default function ElasticityTab({ elasticity }) {
  const [selected, setSelected] = useState(() => new Set(['DEL-BOM', 'DEL-BLR', 'BOM-BLR']));

  const toggle = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const data = useMemo(() => {
    if (!elasticity?.routes) return [];
    const shown = elasticity.routes.filter((r) => selected.has(r.routeId));
    if (!shown.length) return [];
    // Long-form: [{ windowLabel, [routeId]: fare }]
    return shown[0].points.map((_, i) => {
      const row = { windowLabel: shown[0].points[i].label };
      for (const r of shown) row[r.routeId] = r.points[i]?.avgFare ?? null;
      return row;
    });
  }, [elasticity, selected]);

  if (!elasticity) return <div className="card h-96 animate-pulse" />;

  // Premium summary: T+1 vs T+45 multiplier per route
  const premiums = elasticity.routes
    .map((r) => {
      const t1 = r.points.find((p) => p.windowDays === 1)?.avgFare;
      const t45 = r.points.find((p) => p.windowDays === 45)?.avgFare;
      return t1 && t45 ? { ...r, premium: t1 / t45 } : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.premium - a.premium);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {elasticity.routes.map((r, i) => (
          <button
            key={r.routeId}
            onClick={() => toggle(r.routeId)}
            className={`badge border px-2 py-1 text-xs transition-colors ${
              selected.has(r.routeId)
                ? 'border-transparent text-white'
                : 'border-slate-200 text-slate-500 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800'
            }`}
            style={selected.has(r.routeId) ? { background: ROUTE_COLORS[i % ROUTE_COLORS.length] } : undefined}
          >
            {r.label}
          </button>
        ))}
      </div>

      <div className="card p-4">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-sm font-semibold">Fare vs advance-booking window (lead-time elasticity)</h3>
          <span className="text-xs text-slate-400">Log-spike near departure · select sectors to compare</span>
        </div>
        <div className="h-[400px] w-full text-slate-500 dark:text-slate-400">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.15} />
              <XAxis dataKey="windowLabel" tick={{ fontSize: 11, fill: 'currentColor' }} tickLine={false} axisLine={false} />
              <YAxis
                tick={{ fontSize: 11, fill: 'currentColor' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `₹${(v / 1000).toFixed(1)}k`}
              />
              <Tooltip
                formatter={(v) => (v != null ? inr(v) : '—')}
                contentStyle={{ borderRadius: 8, border: '1px solid rgb(51 65 85)', background: 'rgb(15 23 42)', color: '#e2e8f0', fontSize: 12 }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {elasticity.routes.map((r, i) =>
                selected.has(r.routeId) ? (
                  <Line
                    key={r.routeId}
                    type="monotone"
                    dataKey={r.routeId}
                    name={r.label}
                    stroke={ROUTE_COLORS[i % ROUTE_COLORS.length]}
                    strokeWidth={2.2}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                ) : null
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {premiums.slice(0, 6).map((r) => (
          <div key={r.routeId} className="card flex items-center justify-between p-3">
            <div>
              <p className="num text-sm font-bold">{r.label}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">T+1 premium over T+45</p>
            </div>
            <span className="num rounded-lg bg-red-50 px-2.5 py-1.5 text-lg font-bold text-red-600 dark:bg-red-950/60 dark:text-red-400">
              ×{r.premium.toFixed(2)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
