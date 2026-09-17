import { env } from "../config/env";
import { logger } from "../utils/logger";

/**
 * Shared Redis facade.
 *
 * Two drivers, one API:
 *   * @upstash/redis (HTTPS REST) — used in production. Every command is an
 *     independent HTTPS request, so there's no persistent TCP that can be
 *     silently dropped by NAT/edge idle timers. This is the fix for the
 *     "Command timed out" 500s that hit EB → Upstash after idle periods.
 *   * ioredis (TCP) — used locally against Docker Redis where LAN TCP is
 *     stable and low-latency.
 *
 * Selection: if UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN are set,
 * use the HTTP driver; otherwise fall back to ioredis on REDIS_URL.
 *
 * The exported `redis` object exposes exactly the 10 operations the rest of
 * the codebase uses. `session.ts`, `gallery-session.ts`, `rateLimit.ts`, and
 * `index.ts` remain untouched.
 */

export interface RedisPipeline {
  set(key: string, value: string, mode?: "EX", seconds?: number): RedisPipeline;
  get(key: string): RedisPipeline;
  del(key: string): RedisPipeline;
  expire(key: string, seconds: number): RedisPipeline;
  sadd(key: string, member: string): RedisPipeline;
  exec(): Promise<unknown>;
}

export interface RedisClient {
  set(key: string, value: string, mode: "EX", seconds: number): Promise<unknown>;
  set(key: string, value: string): Promise<unknown>;
  get(key: string): Promise<string | null>;
  del(key: string): Promise<unknown>;
  expire(key: string, seconds: number): Promise<unknown>;
  incr(key: string): Promise<number>;
  ttl(key: string): Promise<number>;
  sadd(key: string, member: string): Promise<unknown>;
  smembers(key: string): Promise<string[]>;
  pipeline(): RedisPipeline;
  quit(): Promise<unknown>;
}

function makeUpstashClient(url: string, token: string): RedisClient {
  // Lazy-require so ioredis-only local dev doesn't need @upstash/redis installed
  // (though for consistency we still list it as a dep).
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require("@upstash/redis") as typeof import("@upstash/redis");
  const upstash = new mod.Redis({
    url,
    token,
    // Return raw strings from GET; we JSON.parse ourselves in session.ts.
    automaticDeserialization: false,
    // Retry transient HTTPS/DNS blips a few times before surfacing to caller.
    retry: {
      retries: 3,
      backoff: (retryCount) => Math.min(50 * 2 ** retryCount, 1000),
    },
  });

  const makePipeline = (): RedisPipeline => {
    const p = upstash.pipeline();
    const wrapper: RedisPipeline = {
      set(key, value, mode, seconds) {
        if (mode === "EX" && typeof seconds === "number") {
          p.set(key, value, { ex: seconds });
        } else {
          p.set(key, value);
        }
        return wrapper;
      },
      get(key) {
        p.get(key);
        return wrapper;
      },
      del(key) {
        p.del(key);
        return wrapper;
      },
      expire(key, seconds) {
        p.expire(key, seconds);
        return wrapper;
      },
      sadd(key, member) {
        p.sadd(key, member);
        return wrapper;
      },
      async exec() {
        return p.exec();
      },
    };
    return wrapper;
  };

  const client: RedisClient = {
    async set(
      key: string,
      value: string,
      mode?: "EX",
      seconds?: number
    ): Promise<unknown> {
      if (mode === "EX" && typeof seconds === "number") {
        return upstash.set(key, value, { ex: seconds });
      }
      return upstash.set(key, value);
    },
    async get(key) {
      const v = await upstash.get<string>(key);
      return v === null || v === undefined ? null : String(v);
    },
    async del(key) {
      return upstash.del(key);
    },
    async expire(key, seconds) {
      return upstash.expire(key, seconds);
    },
    async incr(key) {
      return upstash.incr(key);
    },
    async ttl(key) {
      return upstash.ttl(key);
    },
    async sadd(key, member) {
      return upstash.sadd(key, member);
    },
    async smembers(key) {
      const rows = await upstash.smembers(key);
      return rows.map((v) => (typeof v === "string" ? v : String(v)));
    },
    pipeline: makePipeline,
    async quit() {
      // No-op — HTTP client has no persistent connection to close.
    },
  };

  logger.info("Redis: using @upstash/redis HTTP client");
  return client;
}

function makeIoredisClient(redisUrl: string): RedisClient {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const IORedis = require("ioredis").default as typeof import("ioredis").default;
  const conn = new IORedis(redisUrl, {
    connectTimeout: 10_000,
    commandTimeout: 5_000,
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    // OS-level TCP keepalive helps detect dead sockets on local networks too.
    keepAlive: 30_000,
  });

  conn.on("error", (err) => logger.error({ err }, "Redis error"));
  conn.on("connect", () => logger.info("Redis: connected (ioredis)"));
  conn.on("close", () => logger.warn("Redis: connection closed"));

  // ioredis already implements every method on our RedisClient interface with
  // the same signatures (session.ts and friends were written against it).
  return conn as unknown as RedisClient;
}

export const redis: RedisClient =
  env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN
    ? makeUpstashClient(env.UPSTASH_REDIS_REST_URL, env.UPSTASH_REDIS_REST_TOKEN)
    : makeIoredisClient(env.REDIS_URL as string);
