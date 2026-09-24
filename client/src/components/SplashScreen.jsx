import { Activity } from 'lucide-react';

/**
 * Animated splash — pulsing logo rings + sweeping progress bar.
 * Shown while the first data fetch lands (min ~900ms so it reads as intentional).
 */
export default function SplashScreen() {
  return (
    <div className="anim-fade-in fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-50 dark:bg-[#0b1120]">
      <div className="relative flex h-20 w-20 items-center justify-center">
        <span className="absolute inset-0 rounded-2xl bg-brand-500/30" style={{ animation: 'splash-ring 1.6s ease-out infinite' }} />
        <span className="absolute inset-0 rounded-2xl bg-brand-500/30" style={{ animation: 'splash-ring 1.6s ease-out 0.5s infinite' }} />
        <span className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-lg">
          <Activity className="h-7 w-7" strokeWidth={2.5} />
        </span>
      </div>

      <h1 className="anim-fade-up mt-6 text-center text-lg font-bold tracking-tight" style={{ '--d': '150ms' }}>
        MoSPI &amp; RBI — Real-Time Airfare Price Index
      </h1>
      <p className="anim-fade-up mt-1 text-xs text-slate-500 dark:text-slate-400" style={{ '--d': '260ms' }}>
        Loading live index · 12 sectors · 5 booking windows
      </p>

      <div className="mt-6 h-1 w-48 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
        <div
          className="h-full w-1/3 rounded-full bg-gradient-to-r from-brand-400 to-brand-600"
          style={{ animation: 'splash-bar 1.1s ease-in-out infinite' }}
        />
      </div>
    </div>
  );
}
