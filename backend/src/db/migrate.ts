import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL not set');
  }

  // If connecting to RDS (or any managed Postgres with a non-public CA),
  // we need SSL. rejectUnauthorized: false trusts the RDS CA implicitly.
  // For strict production use, pass a downloaded RDS CA bundle instead.
  const isRemote = /amazonaws\.com|rds\.amazonaws/.test(connectionString);

  const pool = new Pool({
    connectionString,
    ssl: isRemote ? { rejectUnauthorized: false } : undefined,
  });

  const db = drizzle(pool);

  console.log('Running migrations...');
  await migrate(db, { migrationsFolder: './src/db/migrations' });
  console.log('Migrations complete.');

  await pool.end();
  process.exit(0);
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
