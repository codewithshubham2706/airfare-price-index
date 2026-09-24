/**
 * Backfill CLI — seeds simulated index history.
 * Usage: npm run backfill [days]
 */
import { connectStore, closeStore } from '../src/store/index.js';
import { seedHistory } from '../src/services/demoSeed.js';

const days = Number(process.argv[2] || 90);

await connectStore(console);
await seedHistory(days, console);
await closeStore();
