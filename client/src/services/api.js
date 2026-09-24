const BASE = import.meta.env.VITE_API_BASE || '/api/v1';

/** Full URL for direct-download endpoints (CSV export). */
export function rawQuotesCsvUrl(params = {}) {
  const qs = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== '' && v != null)
  ).toString();
  return `${BASE}/quotes?${qs}&format=csv`;
}

async function get(path, token) {
  const res = await fetch(`${BASE}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return res.json();
}

function authHeaders(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export const api = {
  // auth
  login: (email, password) =>
    fetch(`${BASE}/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    }).then(async (r) => ({ ok: r.ok, status: r.status, body: await r.json().catch(() => ({})) })),
  register: (email, password, name) =>
    fetch(`${BASE}/auth/register`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name }),
    }).then(async (r) => ({ ok: r.ok, status: r.status, body: await r.json().catch(() => ({})) })),
  me: (token) => get('/auth/me', token),
  // analytics (Bearer-protected)
  currentIndex: (token) => get('/index/current', token),
  historical: ({ timeframe = '30d', route = '', window: win = '' } = {}, token) =>
    get(`/index/historical?timeframe=${timeframe}${route ? `&route=${route}` : ''}${win ? `&window=${win}` : ''}`, token),
  heatmap: (token) => get('/routes/heatmap', token),
  elasticity: (token) => get('/routes/elasticity', token),
  quotes: (params = {}, token) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== '' && v != null)
    ).toString();
    return get(`/quotes${qs ? `?${qs}` : ''}`, token);
  },
  scraperStatus: (token) => get('/scraper/status', token),
  routes: (token) => get('/routes', token),
  trigger: (body, apiKey, token) =>
    fetch(`${BASE}/scraper/trigger`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, ...authHeaders(token) },
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
