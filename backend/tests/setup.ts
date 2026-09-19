import { config } from "dotenv";
import { beforeAll, afterAll, beforeEach } from "vitest";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import Redis from "ioredis";

// Load .env.test FIRST — before any modules that import env
config({ path: ".env.test", override: true });
process.env.LOG_LEVEL = "error";
let pool: Pool;
let redis: Redis;

beforeAll(async () => {
  // Migrate test DB
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool);
  await migrate(db, { migrationsFolder: "./src/db/migrations" });

  // Connect Redis
  redis = new Redis(process.env.REDIS_URL!);
});

beforeEach(async () => {
  // Reset DB — truncate all tables, respecting FK order
  await pool.query(`
    TRUNCATE TABLE 
      gallery_photos, galleries, photos, event_members, events, users
    RESTART IDENTITY CASCADE;
  `);

  // Clear Redis keys used by app
  const keys = await redis.keys("*");
  if (keys.length > 0) {
    await redis.del(...keys);
  }
});

afterAll(async () => {
  await pool.end();
  await redis.quit();
});