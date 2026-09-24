import { useState } from 'react';
import { KeyRound, X, Check } from 'lucide-react';

/**
 * Dialog for entering the scraper API key (POST /scraper/trigger credential).
 * Stored in localStorage only — never committed, never sent anywhere except
 * your own backend as the x-api-key header.
 */
export default function ScraperKeyModal({ open, onClose, onSave, currentKey }) {
  const [value, setValue] = useState('');
  if (!open) return null;

  const masked = currentKey
    ? `${currentKey.slice(0, 4)}…${currentKey.slice(-2)}`
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="card w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <KeyRound className="h-4 w-4 text-brand-500" /> Scraper API key
          </h3>
          <button onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mb-3 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
          The trigger endpoint <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">POST /api/v1/scraper/trigger</code> requires
          the <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">x-api-key</code> header set in your backend's
          environment (<code className="rounded bg-slate-100 px-1 dark:bg-slate-800">SCRAPE_API_KEY</code>). The key is kept in this
          browser's localStorage only.
        </p>
        {masked && (
          <p className="mb-2 text-xs text-slate-400">
            Current key: <span className="num font-semibold">{masked}</span>
          </p>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (value.trim()) onSave(value.trim());
          }}
        >
          <input
            type="password"
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Paste strong key (e.g. 64-char hex)"
            className="num w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
          />
          <div className="mt-3 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="btn border border-slate-200 dark:border-slate-700">
              Cancel
            </button>
            <button type="submit" disabled={!value.trim()} className="btn bg-brand-600 text-white hover:bg-brand-700">
              <Check className="h-4 w-4" /> Save key
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
