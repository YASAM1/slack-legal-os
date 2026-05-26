import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

declare global {
  // eslint-disable-next-line no-var
  var __pgPool: Pool | undefined;
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not set');
}

const pool =
  global.__pgPool ??
  new Pool({
    connectionString,
    max: 10,
  });

if (process.env.NODE_ENV !== 'production') {
  global.__pgPool = pool;
}

export const db = drizzle(pool, { schema });
export type DB = typeof db;
export { schema };
