import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });
import { Pool } from 'pg';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const pool = new Pool({ connectionString: process.env.DATABASE_URL_UNPOOLED! });

// Step 1: Apply the 0001 diff manually (idempotent)
const sql0001 = await readFile('db/migrations/0001_lush_mastermind.sql', 'utf-8');
const stmts = sql0001
  .split('--> statement-breakpoint')
  .map((s) => s.trim())
  .filter(Boolean);
for (const stmt of stmts) {
  try {
    await pool.query(stmt);
    console.log('Applied:', stmt.slice(0, 80));
  } catch (e: unknown) {
    const msg = (e as { message?: string }).message ?? String(e);
    console.log('Skipped (likely already applied):', stmt.slice(0, 60), '|', msg);
  }
}

// Step 2: Repair drizzle bookkeeping — clear, then mark both migrations as applied.
const dir = 'db/migrations';
const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort();
await pool.query('TRUNCATE drizzle.__drizzle_migrations RESTART IDENTITY');
for (const f of files) {
  const content = await readFile(join(dir, f), 'utf-8');
  const hash = createHash('sha256').update(content).digest('hex');
  await pool.query(
    'INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ($1, $2)',
    [hash, Date.now()],
  );
  console.log('Recorded migration:', f, hash.slice(0, 12));
}

const check = await pool.query(
  'SELECT id, hash, created_at FROM drizzle.__drizzle_migrations ORDER BY id',
);
console.log('Final state:', check.rows);
await pool.end();
