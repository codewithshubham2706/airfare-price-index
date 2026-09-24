/**
 * Atlas connection verifier — run before deploying or after network changes.
 * Checks: DNS/TLS, auth, ping, index presence, write/read/delete round-trip.
 * Usage: MONGODB_URI="mongodb+srv://…" npm run verify:atlas
 *   (or just `npm run verify:atlas` if server/.env already has MONGODB_URI)
 */
import 'dotenv/config';
import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error('✗ MONGODB_URI not set. Add it to server/.env or pass it inline.');
  process.exit(1);
}

const db = process.env.MONGODB_DB || 'apix';

console.log(`[verify] connecting to ${uri.replace(/\/\/([^:]+):[^@]+@/, '//$1:****@')} → db "${db}"`);
const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000 });

const t0 = Date.now();
try {
  await client.connect();
  const pingMs = Date.now() - t0;
  await client.db('admin').command({ ping: 1 });
  console.log(`✓ connected & pinged (${pingMs}ms)`);

  const database = client.db(db);
  const cols = await database.listCollections().toArray();
  console.log(`✓ auth OK — collections: ${cols.map((c) => c.name).join(', ') || '(empty — first boot will seed)'}`);

  // Index presence on the analytical tables
  const idx = await database.collection('index_timeline').listIndexes().toArray().catch(() => []);
  const hasUnique = idx.some((i) => i.name === 'routeId_1_windowDays_1_date_1');
  console.log(hasUnique ? '✓ index_timeline unique key present' : '• index_timeline indexes will be created on first server boot');

  // Write/read/delete round-trip in a scratch collection
  const scratch = database.collection('_verify_scratch');
  const stamp = new Date();
  await scratch.insertOne({ stamp });
  const back = await scratch.findOne({ stamp });
  if (!back) throw new Error('write/read round-trip failed');
  await scratch.deleteMany({});
  console.log('✓ write/read/delete round-trip OK');

  const counts = {
    quotes_clean: await database.collection('quotes_clean').countDocuments(),
    index_timeline: await database.collection('index_timeline').countDocuments(),
    runs: await database.collection('runs').countDocuments(),
  };
  console.log('✓ document counts:', JSON.stringify(counts));
  console.log('\nAll checks passed — MONGODB_URI is good for server/.env and Render.');
  process.exitCode = 0;
} catch (err) {
  console.error('✗ verification failed:', err.message);
  if (/ENOTFOUND|ETIMEDOUT|querySrv/.test(err.message)) {
    console.error('  → DNS/network: check Network Access in Atlas (your current IP must be allowlisted).');
  } else if (/bad auth|AuthenticationFailed|UI18/.test(err.message)) {
    console.error('  → credentials: check the database user/password inside the SRV string (URL-encode special chars).');
  }
  process.exitCode = 1;
} finally {
  await client.close().catch(() => {});
}
