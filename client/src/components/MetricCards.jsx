import { Gauge, Route as RouteIcon, IndianRupee, Database, TrendingUp, TrendingDown } from 'lucide-react';
import { inr, pct, compact } from '../services/api.js';
import { useCountUp } from '../services/useCountUp.js';

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

/** One animated metric card: fades up on mount, count-up number, hover lift. */
function Card({ icon: Icon, label, value, sub, badge, accent, raw }) {
  const numeric = typeof raw === 'number' ? raw : null;
  const shown = useCountUp(numeric, { decimals: numeric != null && Math.abs(numeric) < 1000 ? 1 : 0 });

  let display = value;
  if (numeric != null) {
    if (label.startsWith('Current APIx')) display = shown.toFixed(1);
    else if (label.startsWith('Average')) display = inr(Math.round(shown));
    else display = compact(Math.round(shown));
  }

  return (
    <div className="card lift anim-fade-up p-4" style={{ '--d': '80ms' }}>
      <div className="flex items-start justify-between">
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${accent}`}>
          <Icon className="h-[18px] w-[18px]" />
        </div>
        {badge}
      </div>
      <p className="mt-3 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
      <p className="num mt-1 text-2xl font-bold tracking-tight">{display}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{sub}</p>}
    </div>
  );
}

export default function MetricCards({ data }) {
  if (!data) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="card h-[120px] animate-pulse bg-slate-100/50 dark:bg-slate-900/40" style={{ '--d': `${i * 70}ms` }} />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Card
        icon={Gauge}
        accent="bg-brand-50 text-brand-600 dark:bg-brand-950/60 dark:text-brand-400"
        label="Current APIx Value"
        value={data.index?.toFixed(1)}
        raw={data.index}
        sub="Base period = 100"
        badge={<DeltaBadge value={data.momPct} />}
      />
      <Card
        icon={RouteIcon}
        accent="bg-violet-50 text-violet-600 dark:bg-violet-950/60 dark:text-violet-400"
        label="Active Routes Tracked"
        value={data.metrics?.routesTracked}
        raw={data.metrics?.routesTracked}
        sub="Key DGCA-weighted city-pairs"
        badge={<span className="badge bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">T+1…T+45</span>}
      />
      <Card
        icon={IndianRupee}
        accent="bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400"
        label="Average Base Fare (DEL–BOM)"
        value={inr(data.metrics?.avgFareDelBom)}
        raw={data.metrics?.avgFareDelBom}
        sub="All booking windows · all carriers"
      />
      <Card
        icon={Database}
        accent="bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400"
        label="Data Points Ingested"
        value={compact(data.metrics?.quotesIngested)}
        raw={data.metrics?.quotesIngested}
        sub="Cleaned, normalized quotes"
      />
    </div>
  );
}
