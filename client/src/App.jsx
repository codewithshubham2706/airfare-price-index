import { useCallback, useEffect, useState } from 'react';
import { LineChart, LayoutGrid, Timer, Table2, RefreshCw, Play, AlertTriangle, Zap } from 'lucide-react';
import { api } from './services/api.js';
import { ThemeProvider } from './services/theme.jsx';
import Header from './components/Header.jsx';
import MetricCards from './components/MetricCards.jsx';
import IndexTrend from './components/IndexTrend.jsx';
import HeatmapTab from './components/HeatmapTab.jsx';
import ElasticityTab from './components/ElasticityTab.jsx';
import DataExplorer from './components/DataExplorer.jsx';
import ScraperKeyModal from './components/ScraperKeyModal.jsx';
import { KeyRound } from 'lucide-react';
import Footer from './components/Footer.jsx';

const TABS = [
  { id: 'trend', label: 'Index Trend Analysis', icon: LineChart },
  { id: 'heatmap', label: 'Sector-Wise Surge Heatmap', icon: LayoutGrid },
  { id: 'elasticity', label: 'Lead-Time Elasticity Curves', icon: Timer },
  { id: 'explorer', label: 'Raw Data Explorer / NSO Export', icon: Table2 },
];

function ScraperControls({ status, onRun, running, notice, onManageKey }) {
  const sync = status?.lastSync ? new Date(status.lastSync) : null;
  return (
    <div className="card flex flex-wrap items-center justify-between gap-3 p-3">
      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
        <Zap className="h-4 w-4 text-brand-500" />
        <span>
          Engine: <span className="font-semibold uppercase text-slate-700 dark:text-slate-200">{status?.mode || '—'}</span>
          {' · '}Pacing 5–15s · Off-peak gate {status?.offPeakOnly ? 'enforced' : 'demo-bypass'}
          {sync && <> · Last run {sync.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</>}
        </span>
        {notice && <span className={`font-medium ${notice.ok ? 'text-emerald-500' : 'text-red-500'}`}>{notice.msg}</span>}
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onManageKey}
          className="btn border border-slate-200 text-slate-500 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
          title="Set the x-api-key used to trigger collection"
        >
          <KeyRound className="h-3.5 w-3.5" /> API key
        </button>
        <button onClick={onRun} disabled={running} className="btn bg-slate-900 text-white hover:bg-slate-700 dark:bg-brand-600 dark:hover:bg-brand-700">
          {running ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          {running ? 'Collecting…' : 'Run collection cycle'}
        </button>
      </div>
    </div>
  );
}

function Dashboard() {
  const [tab, setTab] = useState('trend');
  const [timeframe, setTimeframe] = useState('30d');
  const [current, setCurrent] = useState(null);
  const [historical, setHistorical] = useState(null);
  const [heatmap, setHeatmap] = useState(null);
  const [elasticity, setElasticity] = useState(null);
  const [routes, setRoutes] = useState([]);
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);
  const [running, setRunning] = useState(false);
  const [notice, setNotice] = useState(null);
  const [keyModalOpen, setKeyModalOpen] = useState(false);
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('apix-api-key') || '');

  const loadCore = useCallback(async () => {
    const [cur, hist, hm, ela, rts] = await Promise.allSettled([
      api.currentIndex(),
      api.historical({ timeframe }),
      api.heatmap(),
      api.elasticity(),
      api.routes(),
    ]);
    if (cur.status === 'fulfilled') setCurrent(cur.value);
    else setError('API unreachable — is the server running on :8787?');
    if (hist.status === 'fulfilled') setHistorical(hist.value);
    if (hm.status === 'fulfilled') setHeatmap(hm.value);
    if (ela.status === 'fulfilled') setElasticity(ela.value);
    if (rts.status === 'fulfilled') setRoutes(rts.value.routes);
  }, [timeframe]);

  const loadStatus = useCallback(() => api.scraperStatus().then(setStatus).catch(() => {}), []);

  useEffect(() => { loadCore(); }, [loadCore]);
  useEffect(() => { loadStatus(); }, [loadStatus]);
  useEffect(() => {
    const t = setInterval(loadStatus, 60_000);
    return () => clearInterval(t);
  }, [loadStatus]);

  const runCycle = async () => {
    setRunning(true);
    setNotice(null);
    try {
      const res = await api.trigger({ force: true, mode: 'simulate' }, apiKey);
      if (res.ok) {
        setNotice({ ok: true, msg: `+${res.body.run?.cleanCount ?? 0} quotes ingested` });
        await Promise.all([loadCore(), loadStatus()]);
      } else if (res.status === 401) {
        setNotice({ ok: false, msg: 'Unauthorized — set your API key' });
        setKeyModalOpen(true);
      } else {
        setNotice({ ok: false, msg: res.body?.reason || res.body?.error || `HTTP ${res.status}` });
      }
    } catch {
      setNotice({ ok: false, msg: 'Trigger failed — API unreachable' });
    } finally {
      setRunning(false);
      setTimeout(() => setNotice(null), 6000);
    }
  };

  const saveKey = (k) => {
    setApiKey(k);
    localStorage.setItem('apix-api-key', k);
    setKeyModalOpen(false);
    setNotice({ ok: true, msg: 'API key saved in this browser' });
    setTimeout(() => setNotice(null), 4000);
  };

  return (
    <div className="min-h-screen">
      <Header status={status} />
      <main className="mx-auto max-w-7xl space-y-4 px-4 py-6 sm:px-6">
        {error && (
          <div className="card flex items-center gap-3 border-red-200 p-4 text-sm text-red-600 dark:border-red-900/60 dark:text-red-400">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <div>
              <p className="font-semibold">Backend connection failed</p>
              <p className="text-xs opacity-80">{error} Start it with <code className="rounded bg-red-50 px-1 dark:bg-red-950/60">npm run dev:server</code>.</p>
            </div>
          </div>
        )}

        <MetricCards data={current} />
        <ScraperControls status={status} onRun={runCycle} running={running} notice={notice} onManageKey={() => setKeyModalOpen(true)} />
        <ScraperKeyModal open={keyModalOpen} onClose={() => setKeyModalOpen(false)} onSave={saveKey} currentKey={apiKey} />

        <div className="border-b border-slate-200 dark:border-slate-800">
          <nav className="-mb-px flex gap-1 overflow-x-auto">
            {TABS.map((t) => {
              const Icon = t.icon;
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`tab-btn flex items-center gap-2 ${active
                    ? 'border-brand-600 text-brand-600 dark:border-brand-400 dark:text-brand-400'
                    : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
                >
                  <Icon className="h-4 w-4" />
                  {t.label}
                </button>
              );
            })}
          </nav>
        </div>

        <div>
          {tab === 'trend' && (
            <IndexTrend historical={historical} timeframe={timeframe} setTimeframe={setTimeframe} routes={routes} />
          )}
          {tab === 'heatmap' && <HeatmapTab heatmap={heatmap} />}
          {tab === 'elasticity' && <ElasticityTab elasticity={elasticity} />}
          {tab === 'explorer' && <DataExplorer routes={routes} />}
        </div>
      </main>
      <Footer />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <Dashboard />
    </ThemeProvider>
  );
}
