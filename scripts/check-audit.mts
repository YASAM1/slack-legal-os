import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL_UNPOOLED! });
const r = await pool.query(
  "SELECT action, actor_name, payload, timestamp FROM legal_os.audit_log ORDER BY timestamp DESC LIMIT 25",
);
for (const row of r.rows) {
  console.log('---');
  console.log('time:', row.timestamp);
  console.log('action:', row.action, '|', row.payload?.outcome);
  if (row.payload?.outcome === 'error') {
    console.log('error:', row.payload?.output?.error);
  }
}
await pool.end();
