/**
 * Auth endpoints — register, login, me. Login/registration are rate-limited.
 */
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { env } from '../env.js';
import { getStore } from '../store/index.js';
import { createUser, authenticate, publicUser, signToken, validateRegistration } from '../services/auth.js';

const router = Router();
const authLimiter = rateLimit({
  windowMs: 10 * 60_000,
  limit: 50,
  // Key per account, not per IP: shared-NAT offices and localhost dev servers
  // must not let one user's typos lock everyone out.
  keyGenerator: (req) => `${req.ip}:${String(req.body?.email || 'anon').toLowerCase()}`,
  // Local/development is friction-free; production keeps brute-force protection.
  skip: () => env.nodeEnv !== 'production',
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many attempts for this account — try again in 10 minutes' },
});

/** POST /api/v1/auth/register */
router.post('/register', authLimiter, async (req, res, next) => {
  try {
    const { email, password, name, role } = req.body || {};

    // Prototype mode (development only): registration never rejects anything —
    // find-or-create an admin and return a token immediately.
    if (env.openAuth) {
      if (!String(email || '').trim() || !String(password || '').trim()) {
        return res.status(400).json({ error: 'Email and password required' });
      }
      const store = getStore();
      const normalized = String(email).toLowerCase().trim();
      let user = await store.findUserByEmail(normalized);
      if (!user) {
        await store.insertUser({
          email: normalized,
          name: String(name || normalized.split('@')[0]).trim(),
          role: 'admin',
          passwordHash: 'open-auth',
          createdAt: new Date(),
        });
        user = await store.findUserByEmail(normalized);
        console.log(`[auth:open] auto-created admin for ${user.email}`);
      }
      return res.status(201).json({ token: signToken({ sub: user.email, name: user.name, role: user.role }), user: publicUser(user) });
    }

    const check = validateRegistration({ email, password, name, role });
    if (!check.ok) return res.status(400).json({ error: check.error });
    // Self-serve registrations are always viewers; admins are seeded/first-user only.
    const result = await createUser({ email, password, name, role: 'viewer' });
    if (result.error) return res.status(409).json({ error: result.error });
    const user = result;
    res.status(201).json({ token: signToken({ sub: user.email, name: user.name, role: user.role }), user });
  } catch (err) { next(err); }
});

/** POST /api/v1/auth/login */
router.post('/login', authLimiter, async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    // Prototype mode (development only): ANY email + ANY password logs in as admin.
    if (env.openAuth) {
      const store = getStore();
      let user = await store.findUserByEmail(email);
      if (!user) {
        await store.insertUser({
          email: String(email).toLowerCase().trim(),
          name: String(email).split('@')[0],
          role: 'admin',
          passwordHash: 'open-auth',
          createdAt: new Date(),
        });
        user = await store.findUserByEmail(email);
        console.log(`[auth:open] auto-created admin for ${user.email}`);
      }
      return res.json({ token: signToken({ sub: user.email, name: user.name, role: user.role }), user: publicUser(user) });
    }

    const user = await authenticate(email, password);
    if (!user) return res.status(401).json({ error: 'Invalid email or password' });
    res.json({ token: signToken({ sub: user.email, name: user.name, role: user.role }), user: publicUser(user) });
  } catch (err) { next(err); }
});

/**
 * PATCH /api/v1/auth/users/role — admin-only role management.
 * Body: { email, role: 'admin'|'viewer' }
 */
router.patch('/users/role', async (req, res, next) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Admin role required' });
    }
    const { email, role } = req.body || {};
    if (!email || !['admin', 'viewer'].includes(role)) {
      return res.status(400).json({ error: 'email and role (admin|viewer) required' });
    }
    const updated = await getStore().updateUserRole(email, role);
    if (!updated) return res.status(404).json({ error: 'No such user' });
    res.json({ ok: true, ...updated, note: 'User must re-login to receive a token with the new role' });
  } catch (err) { next(err); }
});

/** GET /api/v1/auth/me */
router.get('/me', async (req, res, next) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    const fresh = await getStore().findUserByEmail(req.user.sub);
    if (!fresh) return res.status(401).json({ error: 'Account no longer exists' });
    res.json({ user: publicUser(fresh) });
  } catch (err) { next(err); }
});

export default router;
