/**
 * Role management CLI — promote/demote a user.
 * Usage: node scripts/promote.js <email> [admin|viewer]
 */
import 'dotenv/config';
import { connectStore, closeStore } from '../src/store/index.js';

const [email, role = 'admin'] = process.argv.slice(2);
if (!email) {
  console.error('Usage: node scripts/promote.js <email> [admin|viewer]');
  process.exit(1);
}
if (!['admin', 'viewer'].includes(role)) {
  console.error('Role must be "admin" or "viewer"');
  process.exit(1);
}

await connectStore(console);
const { getStore } = await import('../src/store/index.js');
const result = await getStore().updateUserRole(email, role);
await closeStore();

if (!result) {
  console.error(`✗ No user found with email ${email}`);
  process.exit(1);
}
console.log(`✓ ${result.email} is now role "${result.role}". They must log out and back in for the new token to take effect.`);
