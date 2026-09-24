import { Gauge, Route as RouteIcon, IndianRupee, Database, TrendingUp, TrendingDown } from 'lucide-react';
import { inr, pct, compact } from '../services/api.js';

function DeltaBadge({ value }) {
  if (value == null) return <span className="badge bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">—</span>;
  const up = value >= 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span className={`badge ${up ? 'bg-red-50 text-red-600 dark:bg-red-950/60 dark:text-red-400' : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400'}`}>
      <Icon className="h-3 w-3" /> {pct(value)}
    </span>
  );
}

function Card({ icon: Icon, label, value, sub, badge, accent }) {
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between">
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${accent}`}>
          <Icon className="h-4.5 w-4.5 h-[18px] w-[18px]" />
        </div>
        {badge}
      </div>
      <p className="mt-3 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
      <p className="num mt-1 text-2xl font-bold tracking-tight">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{sub}</p>}
    </div>
  );
}

export default function MetricCards({ data }) {
  if (!data) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="card h-[120px] animate-pulse bg-slate-100/50 dark:bg-slate-900/40" />
        ))}
      </div>
    );
  }

  const mom = data.momPct;
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Card
        icon={Gauge}
        accent="bg-brand-50 text-brand-600 dark:bg-brand-950/60 dark:text-brand-400"
        label="Current APIx Value"
        value={data.index?.toFixed(1)}
        sub="Base period = 100"
        badge={<DeltaBadge value={mom} />}
      />
      <Card
        icon={RouteIcon}
        accent="bg-violet-50 text-violet-600 dark:bg-violet-950/60 dark:text-violet-400"
        label="Active Routes Tracked"
        value={data.metrics?.routesTracked ?? '—'}
        sub="Key DGCA-weighted city-pairs"
        badge={<span className="badge bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">T+1…T+45</span>}
      />
      <Card
        icon={IndianRupee}
        accent="bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400"
        label="Average Base Fare (DEL–BOM)"
        value={inr(data.metrics?.avgFareDelBom)}
        sub="All booking windows · all carriers"
      />
      <Card
        icon={Database}
        accent="bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400"
        label="Data Points Ingested"
        value={compact(data.metrics?.quotesIngested)}
        sub="Cleaned, normalized quotes"
      />
    </div>
  );
}
