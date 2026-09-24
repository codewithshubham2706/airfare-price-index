/**
 * Auth endpoints — register, login, me. Login/registration are rate-limited.
 */
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { getStore } from '../store/index.js';
import { createUser, authenticate, publicUser, signToken, validateRegistration } from '../services/auth.js';

const router = Router();
const authLimiter = rateLimit({
  windowMs: 10 * 60_000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many attempts — try again in 10 minutes' },
});

/** POST /api/v1/auth/register */
router.post('/register', authLimiter, async (req, res, next) => {
  try {
    const { email, password, name, role } = req.body || {};
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
    const user = await authenticate(email, password);
    if (!user) return res.status(401).json({ error: 'Invalid email or password' });
    res.json({ token: signToken({ sub: user.email, name: user.name, role: user.role }), user: publicUser(user) });
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
