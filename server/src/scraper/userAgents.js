/**
 * User-Agent rotation pool (§8 — Proxy & User-Agent Rotation).
 * Modern desktop UAs only; rotated per request. Requests identify honestly as
 * automated research tooling via headers — no CAPTCHA evasion, no credential use.
 */
const UA_POOL = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
];

let idx = Math.floor(Math.random() * UA_POOL.length);

export function nextUserAgent() {
  idx = (idx + 1) % UA_POOL.length;
  return UA_POOL[idx];
}

/** Honest research-tooling headers sent with every request. */
export function researchHeaders() {
  return {
    'User-Agent': nextUserAgent(),
    'Accept-Language': 'en-IN,en;q=0.9',
    Accept: 'text/html,application/xhtml+xml',
    'X-Research-Purpose': 'NSO/MoSPI statistical price collection — apix prototype',
  };
}
