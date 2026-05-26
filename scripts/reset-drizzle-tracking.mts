import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL_UNPOOLED! });
await pool.query('TRUNCATE drizzle.__drizzle_migrations RESTART IDENTITY');
console.log('Cleared drizzle.__drizzle_migrations');
await pool.end();
