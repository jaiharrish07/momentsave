import { Redis } from 'ioredis';
import { env } from '../config/env';
import { logger } from '../utils/logger';

/**
 * Single shared Redis client for the app.
 *
 * Used for:
 *   - Session storage (login sessions + customer gallery sessions)
 *   - Rate limiting (login attempts + PIN verify attempts)
 *
 * lazyConnect: false means the client connects immediately on import,
 * so we discover connection problems at startup, not on the first request.
 */
export const redis = new Redis(env.REDIS_URL, {
  lazyConnect: false,
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
});

redis.on('connect', () => {
  logger.info('Redis connected');
});

redis.on('error', (err) => {
  logger.error({ err: err.message }, 'Redis error');
});

redis.on('close', () => {
  logger.warn('Redis connection closed');
});
