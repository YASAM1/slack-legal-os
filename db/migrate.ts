import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });
loadEnv();

import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { sql } from 'drizzle-orm';

async function main() {
  const connectionString = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set');
  }

  const pool = new Pool({ connectionString });
  const db = drizzle(pool);

  console.log('Enabling pgvector extension...');
  await db.execute(sql`CREATE EXTENSION IF NOT EXISTS vector`);

  console.log('Running migrations...');
  await migrate(db, { migrationsFolder: './db/migrations' });

  console.log('Migrations complete.');
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
