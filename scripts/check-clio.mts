import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL_UNPOOLED! });
const r = await pool.query('SELECT id, encrypted_refresh_token, last_refreshed_at, updated_at FROM legal_os.clio_oauth');
for (const row of r.rows) {
  console.log({
    id: row.id,
    tokenLength: row.encrypted_refresh_token?.length,
    tokenStart: row.encrypted_refresh_token?.slice(0, 20),
    lastRefreshedAt: row.last_refreshed_at,
    updatedAt: row.updated_at,
  });
}
await pool.end();
