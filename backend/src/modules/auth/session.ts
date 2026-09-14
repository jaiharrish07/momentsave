import { redis } from '../../redis/client';
import { generateSessionToken } from '../../utils/crypto';

/**
 * Session store backed by Redis.
 *
 * A session is a short opaque token stored in a cookie. Redis holds
 * the user info keyed by that token. On each request the auth middleware
 * looks up the token and hydrates req.user.
 *
 * TTL: 7 days sliding — refreshed on access, so active users stay logged in
 * and idle sessions expire on their own.
 */

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days
const SESSION_KEY_PREFIX = 'session:';

export type SessionData = {
  userId: string;   // BIGINT serialized as string; JSON cant hold bigints
  role: 'admin' | 'team_member';
};

function sessionKey(token: string): string {
  return `${SESSION_KEY_PREFIX}${token}`;
}

/**
 * Create a new session for a logged-in user. Returns the session token
 * to be set as a cookie on the response.
 */
export async function createSession(data: SessionData): Promise<string> {
  const token = generateSessionToken();
  await redis.set(sessionKey(token), JSON.stringify(data), 'EX', SESSION_TTL_SECONDS);
  return token;
}

/**
 * Look up a session by token. Returns null if the token is invalid
 * or expired. On successful lookup, refresh the TTL (sliding expiry).
 */
export async function readSession(token: string): Promise<SessionData | null> {
  const key = sessionKey(token);
  const raw = await redis.get(key);
  if (raw === null) return null;

  // Refresh TTL so active users stay logged in.
  await redis.expire(key, SESSION_TTL_SECONDS);

  try {
    return JSON.parse(raw) as SessionData;
  } catch {
    // Corrupted session data — treat as invalid.
    await redis.del(key);
    return null;
  }
}

/**
 * Destroy a session (logout).
 */
export async function deleteSession(token: string): Promise<void> {
  await redis.del(sessionKey(token));
}
