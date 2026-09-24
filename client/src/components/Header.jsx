import { Activity, Moon, Sun, BookOpen } from 'lucide-react';
import { useTheme } from '../services/theme.jsx';

export default function Header({ status }) {
  const { dark, toggle } = useTheme();
  const sync = status?.lastSync ? new Date(status.lastSync) : null;
  const minsAgo = sync ? Math.max(0, Math.round((Date.now() - sync.getTime()) / 60000)) : null;

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/85 backdrop-blur dark:border-slate-800 dark:bg-[#0b1120]/85">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-white shadow-card">
            <Activity className="h-5 w-5" strokeWidth={2.4} />
          </div>
          <div>
            <h1 className="text-[15px] font-bold leading-tight tracking-tight sm:text-base">
              MoSPI &amp; RBI — Real-Time Airfare Price Index (APIx)
              <span className="ml-2 hidden rounded bg-brand-50 px-1.5 py-0.5 align-middle text-[10px] font-bold uppercase tracking-wider text-brand-700 dark:bg-brand-950 dark:text-brand-300 sm:inline">
                Prototype
              </span>
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Automated domestic airfare inflation monitoring · DGCA-weighted city-pairs
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Live system health */}
          <div className="hidden items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs dark:border-slate-800 dark:bg-slate-900 md:flex">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            <span className="font-medium text-slate-600 dark:text-slate-300">
              Scraper: <span className="text-emerald-600 dark:text-emerald-400">Active</span>
            </span>
            <span className="text-slate-300 dark:text-slate-600">|</span>
            <span className="text-slate-500 dark:text-slate-400">
              Last Sync: <span className="font-medium text-slate-700 dark:text-slate-200">{sync ? `${minsAgo} min ago` : '—'}</span>
            </span>
          </div>

          <a
            href="/api/docs"
            target="_blank"
            rel="noreferrer"
            className="btn border border-slate-200 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <BookOpen className="h-4 w-4" /> API Docs
          </a>

          <button
            onClick={toggle}
            className="btn border border-slate-200 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            aria-label="Toggle dark mode"
          >
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>
      </div>
      <div className="border-t border-slate-100 px-4 py-1.5 text-center text-[11px] text-slate-500 dark:border-slate-800/60 dark:text-slate-500 md:hidden">
        Scraper: Active · Last Sync: {sync ? `${minsAgo} min ago` : '—'}
      </div>
    </header>
  );
}
