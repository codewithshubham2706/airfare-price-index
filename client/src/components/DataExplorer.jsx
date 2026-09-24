import { useEffect, useMemo, useState } from 'react';
import { Search, Download, FileJson, RefreshCw, Database } from 'lucide-react';
import { api, inr, rawQuotesCsvUrl } from '../services/api.js';
import { WINDOWS } from '../services/format.js';

const PAGE_SIZE = 50;

export default function DataExplorer({ routes, token }) {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({ q: '', route: '', window: '', airline: '' });

  const query = useMemo(
    () => ({ ...filters, limit: PAGE_SIZE, skip: page * PAGE_SIZE }),
    [filters, page]
  );

  useEffect(() => {
    let live = true;
    setLoading(true);
    api.quotes(query, token)
      .then((d) => {
        if (!live) return;
        setRows(d.quotes || []);
        setTotal(d.total || 0);
      })
      .catch(() => live && setRows([]))
      .finally(() => live && setLoading(false));
    return () => { live = false; };
  }, [query]);

  const setF = (k) => (e) => {
    setPage(0);
    setFilters((f) => ({ ...f, [k]: e.target.value }));
  };

  // CSV export via authorized fetch → blob (a plain link can't send the Bearer header)
  const exportCsv = async () => {
    try {
      const qs = new URLSearchParams(
        Object.entries({ ...filters, limit: 5000 }).filter(([, v]) => v !== '' && v != null)
      ).toString();
      const res = await fetch(rawQuotesCsvUrl({}).split('?')[0] + `?${qs}&format=csv`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `apix_quotes_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) {
      setNotice?.(`Export failed: ${e.message}`);
    }
  };

  const downloadJson = () => {
    const blob = new Blob([JSON.stringify(rows, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `apix_quotes_page${page + 1}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-end gap-3 p-4">
        <div className="min-w-[180px] flex-1">
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Search</label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
            <input
              value={filters.q}
              onChange={setF('q')}
              placeholder="Route or carrier…"
              className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-8 pr-3 text-sm dark:border-slate-700 dark:bg-slate-900"
            />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Sector</label>
          <select value={filters.route} onChange={setF('route')} className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm dark:border-slate-700 dark:bg-slate-900">
            <option value="">All sectors</option>
            {(routes || []).map((r) => <option key={r.id} value={r.id}>{r.id}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Window</label>
          <select value={filters.window} onChange={setF('window')} className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm dark:border-slate-700 dark:bg-slate-900">
            <option value="">All windows</option>
            {WINDOWS.map((w) => <option key={w.days} value={w.days}>{w.label}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Carrier</label>
          <select value={filters.airline} onChange={setF('airline')} className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm dark:border-slate-700 dark:bg-slate-900">
            <option value="">All carriers</option>
            <option value="6E">IndiGo (6E)</option>
            <option value="AI">Air India (AI)</option>
            <option value="IX">Air India Express (IX)</option>
            <option value="QP">Akasa Air (QP)</option>
            <option value="SG">SpiceJet (SG)</option>
          </select>
        </div>
        <div className="flex gap-2 pb-0.5">
          <button onClick={exportCsv} className="btn bg-brand-600 text-white hover:bg-brand-700">
            <Download className="h-4 w-4" /> CSV
          </button>
          <button onClick={downloadJson} className="btn border border-slate-200 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800">
            <FileJson className="h-4 w-4" /> JSON
          </button>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5 dark:border-slate-800">
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <Database className="h-3.5 w-3.5" />
            <span><span className="num font-semibold text-slate-700 dark:text-slate-200">{total.toLocaleString('en-IN')}</span> cleaned quotes</span>
            {loading && <RefreshCw className="h-3.5 w-3.5 animate-spin text-brand-500" />}
          </div>
          <div className="flex items-center gap-2 text-xs">
            <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} className="btn border border-slate-200 dark:border-slate-700">Prev</button>
            <span className="num text-slate-500 dark:text-slate-400">{page + 1} / {pages}</span>
            <button onClick={() => setPage((p) => Math.min(pages - 1, p + 1))} disabled={page >= pages - 1} className="btn border border-slate-200 dark:border-slate-700">Next</button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-[11px] uppercase tracking-wide text-slate-400 dark:border-slate-800">
                <th className="px-4 py-2 font-semibold">Scraped</th>
                <th className="px-3 py-2 font-semibold">Sector</th>
                <th className="px-3 py-2 font-semibold">Window</th>
                <th className="px-3 py-2 font-semibold">Carrier</th>
                <th className="px-3 py-2 text-right font-semibold">Fare (INR)</th>
                <th className="px-3 py-2 font-semibold">Source</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800/60">
              {rows.map((r, i) => (
                <tr key={`${r.scrapedAt}-${r.routeId}-${r.windowDays}-${r.airlineCode}-${i}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="num whitespace-nowrap px-4 py-2 text-xs text-slate-500 dark:text-slate-400">
                    {new Date(r.scrapedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                  </td>
                  <td className="num px-3 py-2 font-medium">{r.routeId}</td>
                  <td className="px-3 py-2"><span className="badge bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">T+{r.windowDays}</span></td>
                  <td className="px-3 py-2">
                    <span className="flex items-center gap-1.5">
                      <span className="num text-xs font-bold text-brand-600 dark:text-brand-400">{r.airlineCode}</span>
                      <span className="text-xs text-slate-500 dark:text-slate-400">{r.airlineName}</span>
                    </span>
                  </td>
                  <td className="num px-3 py-2 text-right font-semibold">{inr(r.fareINR)}</td>
                  <td className="px-3 py-2">
                    {r.isImputed ? (
                      <span className="badge bg-amber-50 text-[10px] text-amber-700 dark:bg-amber-950/60 dark:text-amber-400" title="Filled by cell-median imputation">imputed</span>
                    ) : (
                      <span className="text-xs text-slate-400">{r.source}</span>
                    )}
                  </td>
                </tr>
              ))}
              {!rows.length && !loading && (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-400">No quotes match the current filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
