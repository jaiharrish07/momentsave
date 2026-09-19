import { defineConfig } from "vitest/config";
import { config } from "dotenv";

// Load .env.test IMMEDIATELY, before Vitest even starts spinning up tests
config({ path: ".env.test", override: true });

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    testTimeout: 20_000,
    hookTimeout: 30_000,
    // All test files share one Postgres + Redis, and setup truncates tables
    // before each test, so files must run one at a time.
    fileParallelism: false,
    setupFiles: ["tests/setup.ts"],
    env: {
      ...process.env,
    },
  },
});
