import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL_UNPOOLED! });
const r = await pool.query(
  "SELECT table_schema, table_name FROM information_schema.tables WHERE table_name LIKE '%migration%'",
);
console.log('Migration-related tables:', r.rows);
const schemas = await pool.query("SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'drizzle'");
console.log('Drizzle schema exists:', schemas.rows.length > 0);
if (schemas.rows.length > 0) {
  const m = await pool.query('SELECT * FROM drizzle.__drizzle_migrations ORDER BY id');
  console.log('Applied migrations:', m.rows);
}
await pool.end();
