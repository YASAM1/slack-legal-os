import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });

const { db, schema } = await import('@/db/client');

const rows = await db
  .select({ encryptedRefreshToken: schema.clioOauth.encryptedRefreshToken })
  .from(schema.clioOauth)
  .limit(1);
console.log('selected (column-projected) rows:', rows);
console.log('first row token length:', rows[0]?.encryptedRefreshToken?.length);

const rowsAll = await db.select().from(schema.clioOauth).limit(1);
console.log('all-columns row keys:', Object.keys(rowsAll[0] ?? {}));

process.exit(0);
