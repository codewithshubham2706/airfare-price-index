import { useState } from 'react';
import { Activity, Loader2, LogIn, UserPlus, ShieldCheck, BarChart3 } from 'lucide-react';
import { useAuth } from '../services/auth.jsx';

const DEMOS = [
  { label: 'Admin (full control)', email: 'admin@apix.gov.in', password: 'Admin@12345' },
  { label: 'Viewer (read-only)', email: 'viewer@apix.gov.in', password: 'Viewer@12345' },
];

export default function LoginGate() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ email: '', password: '', name: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (mode === 'login') await login(form.email, form.password);
      else await register(form.email, form.password, form.name);
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  const demoLogin = async (email, password) => {
    setBusy(true);
    setError('');
    try {
      await login(email, password);
    } catch (err) {
      setError(err.message || 'Demo login failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-brand-800 via-brand-900 to-slate-950 p-10 text-white lg:flex">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 backdrop-blur">
            <Activity className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-bold leading-tight">MoSPI &amp; RBI</p>
            <p className="text-xs text-brand-200">Government of India · Prototype</p>
          </div>
        </div>

        <div className="max-w-md">
          <h1 className="text-3xl font-extrabold leading-tight tracking-tight">
            Real-Time Airfare Price Index
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-brand-100/90">
            Automated collection, cleaning and normalization of domestic airfares across
            T+1…T+45 advance-booking windows, weighted into a national inflation index
            (base = 100) for policy research.
          </p>
          <div className="mt-8 space-y-3 text-sm">
            <p className="flex items-center gap-2 text-brand-100/80"><BarChart3 className="h-4 w-4" /> 12 DGCA-weighted city-pairs · 5 booking windows · 5 carriers</p>
            <p className="flex items-center gap-2 text-brand-100/80"><ShieldCheck className="h-4 w-4" /> robots.txt honored · 5–15s pacing · off-peak 02:00–04:00 IST</p>
          </div>
        </div>

        <p className="text-[11px] text-brand-200/60">
          Figures are simulation-engine outputs for evaluation · not for citation
        </p>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center bg-slate-50 p-6 dark:bg-[#0b1120]">
        <div className="w-full max-w-sm">
          <div className="mb-6 flex items-center gap-3 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-white">
              <Activity className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-bold">MoSPI &amp; RBI — APIx</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Airfare Price Index</p>
            </div>
          </div>

          <h2 className="text-xl font-bold tracking-tight">
            {mode === 'login' ? 'Sign in to APIx' : 'Create your account'}
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {mode === 'login' ? 'Government-grade access to the price-index console' : 'Viewer accounts can browse all dashboards and export data'}
          </p>

          {/* noValidate: prototype mode accepts any credentials — the server is the
            single validator (it 400s with a visible message in production). */}
        <form onSubmit={submit} noValidate className="mt-5 space-y-3">
            {mode === 'register' && (
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Full name</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                  placeholder="Your name"
                />
              </div>
            )}
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Email</label>
              <input
                type="text"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                placeholder="any email (e.g. you@example.com)"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Password</label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                placeholder={mode === 'register' ? 'Any password (prototype)' : '••••••••'}
              />
            </div>

            {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600 dark:bg-red-950/60 dark:text-red-400">{error}</p>}

            <button type="submit" disabled={busy} className="btn w-full justify-center bg-brand-600 py-2.5 text-white hover:bg-brand-700">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : mode === 'login' ? <LogIn className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
              {mode === 'login' ? 'Sign in' : 'Create account'}
            </button>
          </form>

          <p className="mt-4 text-center text-xs text-slate-500 dark:text-slate-400">
            {mode === 'login' ? "Don't have an account? " : 'Already registered? '}
            <button onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }} className="font-semibold text-brand-600 hover:underline dark:text-brand-400">
              {mode === 'login' ? 'Register' : 'Sign in'}
            </button>
          </p>

          <div className="my-5 flex items-center gap-3 text-[11px] uppercase tracking-wider text-slate-400">
            <span className="h-px flex-1 bg-slate-200 dark:bg-slate-800" /> demo accounts <span className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
          </div>
          <div className="space-y-2">
            {DEMOS.map((d) => (
              <button
                key={d.email}
                onClick={() => demoLogin(d.email, d.password)}
                disabled={busy}
                className="btn w-full justify-between border border-slate-200 px-3 py-2 text-xs hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
              >
                <span>{d.label}</span>
                <span className="num text-slate-400">{d.email}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
