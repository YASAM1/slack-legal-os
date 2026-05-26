import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL_UNPOOLED! });

// Tables I want to create
const myTables = [
  'agent_config',
  'audit_log',
  'capabilities',
  'capability_runs',
  'clio_oauth',
  'conversations',
  'kb_documents',
];

const r = await pool.query(
  `SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name = ANY($1) ORDER BY table_name`,
  [myTables],
);
console.log('My tables already present:', r.rows.map((x) => x.table_name));

const missing = myTables.filter((t) => !r.rows.find((x) => x.table_name === t));
console.log('Tables missing (need to create):', missing);

// Inspect the existing audit_log if present
if (r.rows.find((x) => x.table_name === 'audit_log')) {
  const cols = await pool.query(
    "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'audit_log' AND table_schema = 'public' ORDER BY ordinal_position",
  );
  console.log("Existing audit_log columns:", cols.rows);
}

await pool.end();
