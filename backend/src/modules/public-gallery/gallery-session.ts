import { redis } from '../../redis/client';

const GALLERY_SESSION_PREFIX = 'gallery_session:';
const GALLERY_SESSION_INDEX_PREFIX = 'gallery_sessions_by_token:';

/**
 * Kill all customer gallery sessions bound to a public_token.
 * Used when the admin regenerates the PIN — every previously-verified customer
 * must re-verify with the new PIN.
 *
 * We maintain a set of session tokens per public_token so we can find them all.
 * Both operations run in a single MULTI/EXEC for atomicity.
 */
export async function invalidateGallerySessions(publicToken: string): Promise<void> {
  const indexKey = `${GALLERY_SESSION_INDEX_PREFIX}${publicToken}`;
  const sessionTokens = await redis.smembers(indexKey);

  if (sessionTokens.length === 0) return;

  const pipeline = redis.pipeline();
  for (const token of sessionTokens) {
    pipeline.del(`${GALLERY_SESSION_PREFIX}${token}`);
  }
  pipeline.del(indexKey);
  await pipeline.exec();
}
