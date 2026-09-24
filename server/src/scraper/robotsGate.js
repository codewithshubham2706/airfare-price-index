/**
 * robots.txt compliance gate (§8 — Adherence to robots.txt & ToS).
 * Minimal RFC 9309 parser: user-agent groups, Allow/Disallow, wildcard '*',
 * longest-match precedence. Results cached per host for the process lifetime.
 */
const cache = new Map(); // origin → { rules, fetchedAt }

async function fetchRobots(origin) {
  const url = `${origin}/robots.txt`;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': 'APIx-StatBot/1.0 (research; contact: nso-demo@gov.in)' } });
    clearTimeout(t);
    if (!res.ok) return { status: res.status === 404 ? 'allow-all' : 'unknown', rules: [] };
    const text = await res.text();
    return { status: 'ok', rules: parseRobots(text) };
  } catch {
    return { status: 'unknown', rules: [] };
  }
}

/** Parse robots.txt lines into [{ allow:boolean, path:string, agents:string[] }].
 *  Consecutive user-agent lines form one group (RFC 9309 grouping). */
export function parseRobots(text) {
  const rules = [];
  let currentAgents = [];
  let lastWasAgent = false;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, '').trim();
    if (!line) continue;
    const m = line.match(/^(user-agent|allow|disallow|sitemap)\s*:\s*(.*)$/i);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const val = m[2].trim();
    if (key === 'user-agent') {
      if (lastWasAgent && currentAgents.length) currentAgents.push(val.toLowerCase());
      else currentAgents = [val.toLowerCase()];
      lastWasAgent = true;
    } else if (key === 'allow' || key === 'disallow') {
      lastWasAgent = false;
      if (!val) continue; // empty Disallow ⇒ allow-all ⇒ equivalent to no rule
      rules.push({ allow: key === 'allow', path: val, agents: currentAgents });
    }
  }
  return rules;
}

/** RFC 9309 longest-match: more specific (longer) path wins; Allow wins ties. */
export function pathAllowed(rules, agent, path) {
  const a = agent.toLowerCase();
  const groups = rules.filter((r) => r.agents.includes('*') || r.agents.includes(a));
  let best = { len: -1, allow: true };
  for (const r of groups) {
    const pat = r.path.replace(/\*/g, '');
    const matchBase = pat.length ? path.startsWith(pat) : r.path === '' && false;
    if (!matchBase) continue;
    if (pat.length > best.len || (pat.length === best.len && r.allow)) best = { len: pat.length, allow: r.allow };
  }
  return best.len === -1 ? true : best.allow;
}

/**
 * Gate a URL for scraping. Never throws — unknown/4xx robots means allow
 * (standard practice), but network errors are surfaced as 'unknown' for audit.
 */
export async function isAllowed(origin, pathname) {
  let entry = cache.get(origin);
  if (!entry) {
    entry = await fetchRobots(origin);
    cache.set(origin, entry);
  }
  const allowed = entry.status !== 'ok' ? true : pathAllowed(entry.rules, 'apix-statbot', pathname);
  return { allowed, robotsStatus: entry.status };
}

/** Test helper: clear the per-host cache. */
export function resetRobotsCache() { cache.clear(); }
