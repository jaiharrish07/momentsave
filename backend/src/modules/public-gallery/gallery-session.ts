import { redis } from '../../redis/client';
import { generateSessionToken } from '../../utils/crypto';

/**
 * Gallery session store — for customers who have verified a PIN.
 *
 * Structure:
 *   session:{token} → { publicToken, verifiedAt }  (2 hour sliding TTL)
 *   sessions_by_token:{publicToken} → SET of session tokens
 *
 * The index enables invalidateGallerySessions to kill every session bound to
 * a specific gallery when the admin rotates the PIN.
 */

const SESSION_PREFIX = 'gallery_session:';
const SESSION_INDEX_PREFIX = 'gallery_sessions_by_token:';
const SESSION_TTL_SECONDS = 60 * 60 * 2; // 2 hours sliding

export type GallerySessionData = {
  publicToken: string;
  verifiedAt: string;
};

function sessionKey(token: string): string {
  return `${SESSION_PREFIX}${token}`;
}

function indexKey(publicToken: string): string {
  return `${SESSION_INDEX_PREFIX}${publicToken}`;
}

/**
 * Create a gallery session for a verified customer.
 * Adds the session token to the per-gallery index so mass-invalidation works.
 */
export async function createGallerySession(publicToken: string): Promise<string> {
  const token = generateSessionToken();
  const data: GallerySessionData = {
    publicToken,
    verifiedAt: new Date().toISOString(),
  };

  const pipeline = redis.pipeline();
  pipeline.set(sessionKey(token), JSON.stringify(data), 'EX', SESSION_TTL_SECONDS);
  pipeline.sadd(indexKey(publicToken), token);
  // Give the index the same TTL — if all sessions expire naturally, index cleans up too.
  pipeline.expire(indexKey(publicToken), SESSION_TTL_SECONDS);
  await pipeline.exec();

  return token;
}

/**
 * Look up a gallery session by token. Refreshes sliding TTL on success.
 */
export async function readGallerySession(token: string): Promise<GallerySessionData | null> {
  const key = sessionKey(token);
  const raw = await redis.get(key);
  if (raw === null) return null;

  await redis.expire(key, SESSION_TTL_SECONDS);

  try {
    return JSON.parse(raw) as GallerySessionData;
  } catch {
    await redis.del(key);
    return null;
  }
}

/**
 * Kill every customer session bound to a specific public_token.
 * Used after PIN regeneration.
 */
export async function invalidateGallerySessions(publicToken: string): Promise<void> {
  const idxKey = indexKey(publicToken);
  const sessionTokens = await redis.smembers(idxKey);

  if (sessionTokens.length === 0) return;

  const pipeline = redis.pipeline();
  for (const token of sessionTokens) {
    pipeline.del(sessionKey(token));
  }
  pipeline.del(idxKey);
  await pipeline.exec();
}
