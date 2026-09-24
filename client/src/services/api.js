const BASE = import.meta.env.VITE_API_BASE || '/api/v1';

/** Full URL for direct-download endpoints (CSV export). */
export function rawQuotesCsvUrl(params = {}) {
  const qs = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== '' && v != null)
  ).toString();
  return `${BASE}/quotes?${qs}&format=csv`;
}

async function get(path) {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return res.json();
}

export const api = {
  currentIndex: () => get('/index/current'),
  historical: ({ timeframe = '30d', route = '', window: win = '' } = {}) =>
    get(`/index/historical?timeframe=${timeframe}${route ? `&route=${route}` : ''}${win ? `&window=${win}` : ''}`),
  heatmap: () => get('/routes/heatmap'),
  elasticity: () => get('/routes/elasticity'),
  quotes: (params = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== '' && v != null)
    ).toString();
    return get(`/quotes${qs ? `?${qs}` : ''}`);
  },
  scraperStatus: () => get('/scraper/status'),
  routes: () => get('/routes'),
  trigger: (body, apiKey) =>
    fetch(`${BASE}/scraper/trigger`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
      body: JSON.stringify(body),
    }).then(async (r) => ({ ok: r.ok, status: r.status, body: await r.json().catch(() => ({})) })),
};

export const inr = (n, opts = {}) =>
  n == null
    ? '—'
    : new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0, ...opts }).format(n);

export const pct = (n, digits = 2) => {
  if (n == null) return '—';
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(digits)}%`;
};

// en-US compact so counts read 27.6K / 1.2M (en-IN would render thousands as "T")
export const compact = (n) =>
  n == null ? '—' : new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
