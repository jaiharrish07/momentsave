import { Request, Response, NextFunction } from 'express';
import { redis } from '../redis/client';
import { tooManyRequests } from '../utils/errors';

/**
 * Redis-backed rate limiter.
 *
 * Uses INCR + EXPIRE atomically. First hit sets counter=1 with expiry;
 * subsequent hits within the window increment. Beyond `limit`, return 429
 * with a Retry-After header.
 *
 * keyFn: build the Redis key from the request. Different limits use different
 *   scopes — per-IP-per-gallery, per-email-per-IP, etc.
 */
export function createRateLimiter(opts: {
  keyFn: (req: Request) => string;
  limit: number;
  windowSeconds: number;
}) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const key = opts.keyFn(req);

      // INCR returns the new value. If it's the first hit, set expiry.
      const count = await redis.incr(key);
      if (count === 1) {
        await redis.expire(key, opts.windowSeconds);
      }

      if (count > opts.limit) {
        const ttl = await redis.ttl(key);
        const retryAfter = ttl > 0 ? ttl : opts.windowSeconds;
        res.setHeader('Retry-After', String(retryAfter));
        return next(tooManyRequests('Too many attempts. Try again later.'));
      }

      next();
    } catch (err) {
      // If Redis is unreachable, fail open (allow the request) — matches
      // our Redis-down policy for auth: don't block users, log loudly.
      // A stricter policy would fail closed here.
      next();
    }
  };
}

/**
 * PIN verify rate limiter: per IP per gallery.
 * 5 attempts per 15 min.
 */
export const pinVerifyRateLimiter = createRateLimiter({
  keyFn: (req) => {
    const ip = getClientIp(req);
    const publicToken = req.params.publicToken ?? 'unknown';
    return `rate:pin:${publicToken}:${ip}`;
  },
  limit: 5,
  windowSeconds: 15 * 60,
});

function getClientIp(req: Request): string {
  // Behind CloudFront + EB, the real IP is in X-Forwarded-For (first value).
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.length > 0) {
    return xff.split(',')[0].trim();
  }
  return req.ip ?? 'unknown';
}
