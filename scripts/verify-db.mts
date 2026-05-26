import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL_UNPOOLED! });
const tables = await pool.query(
  "SELECT table_name FROM information_schema.tables WHERE table_schema='legal_os' ORDER BY table_name",
);
console.log('legal_os tables:', tables.rows.map((r) => r.table_name).join(', '));
const indexes = await pool.query(
  "SELECT indexname FROM pg_indexes WHERE schemaname='legal_os' AND tablename='kb_documents'",
);
console.log('kb_documents indexes:', indexes.rows.map((r) => r.indexname).join(', '));
await pool.end();
