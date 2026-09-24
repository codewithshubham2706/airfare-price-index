/**
 * Auth service — scrypt password hashing + compact HS256 JWTs (no external deps).
 * Roles: 'admin' (scraper control + exports) | 'viewer' (read-only dashboards).
 * Tokens: 12h expiry, HMAC-SHA256 signed, base64url segments.
 */
import { scryptSync, randomBytes, timingSafeEqual, createHmac } from 'node:crypto';
import { getStore } from '../store/index.js';

const JWT_SECRET = process.env.JWT_SECRET || process.env.SCRAPE_API_KEY || 'apix-dev-secret-change-me';
const TOKEN_TTL_HOURS = 12;

export function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(String(password), salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  const [salt, hash] = String(stored).split(':');
  if (!salt || !hash) return false;
  const candidate = scryptSync(String(password), salt, 64);
  const expected = Buffer.from(hash, 'hex');
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

const b64url = (buf) => Buffer.from(buf).toString('base64url');

export function signToken(payload) {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify({ ...payload, exp: Date.now() + TOKEN_TTL_HOURS * 3600_000 }));
  const sig = createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${sig}`;
}

export function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, body, sig] = parts;
  const expected = createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest();
  const got = Buffer.from(sig, 'base64url');
  if (expected.length !== got.length || !timingSafeEqual(expected, got)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (!payload.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateRegistration({ email, password, name, role }) {
  if (!EMAIL_RE.test(String(email || ''))) return { error: 'Valid email required' };
  if (String(password || '').length < 8) return { error: 'Password must be at least 8 characters' };
  if (!String(name || '').trim()) return { error: 'Name required' };
  if (role && !['viewer', 'admin'].includes(role)) return { error: 'Invalid role' };
  return { ok: true };
}

/** Create a user. First registered user becomes admin automatically. */
export async function createUser({ email, password, name, role }) {
  const store = getStore();
  email = String(email).toLowerCase().trim();
  if (await store.findUserByEmail(email)) return { error: 'An account with this email already exists' };
  const count = await store.countUsers();
  const user = {
    email,
    name: String(name).trim(),
    role: role || (count === 0 ? 'admin' : 'viewer'),
    passwordHash: hashPassword(password),
    createdAt: new Date(),
  };
  return store.insertUser(user);
}

export async function authenticate(email, password) {
  const store = getStore();
  const user = await store.findUserByEmail(String(email).toLowerCase().trim());
  if (!user) return null;
  if (!verifyPassword(password, user.passwordHash)) return null;
  return user;
}

export function publicUser(user) {
  return { email: user.email, name: user.name, role: user.role, createdAt: user.createdAt };
}

/** Seed the demo accounts so the app is usable immediately. */
export async function ensureDemoUsers() {
  const store = getStore();
  if ((await store.countUsers()) === 0) {
    await store.insertUser({
      email: 'admin@apix.gov.in',
      name: 'NSO Administrator',
      role: 'admin',
      passwordHash: hashPassword('Admin@12345'),
      createdAt: new Date(),
    });
    await store.insertUser({
      email: 'viewer@apix.gov.in',
      name: 'Policy Viewer',
      role: 'viewer',
      passwordHash: hashPassword('Viewer@12345'),
      createdAt: new Date(),
    });
    console.log('[auth] demo accounts seeded: admin@apix.gov.in / Admin@12345 · viewer@apix.gov.in / Viewer@12345');
  }
}
