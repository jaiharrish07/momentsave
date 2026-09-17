import { lt, and, eq } from 'drizzle-orm';
import { db } from '../db/client';
import { photos } from '../db/schema';
import { deleteObject } from '../s3/client';
import { logger } from '../utils/logger';

/**
 * Delete orphaned pending photos older than 1 hour.
 *
 * Orphans happen when a team member requests an upload URL but never
 * PUTs the file (browser crash, network drop, cancelled upload).
 * Without cleanup, pending rows and their S3 keys pile up.
 *
 * S3 delete is idempotent so we safely call it even if the client
 * never uploaded the object.
 *
 * Uses a simple 1-hour cutoff. The upload URL itself expires after
 * 5 minutes so anything older than that is definitely abandoned.
 */
export async function cleanupPendingPhotos(): Promise<{ deleted: number }> {
  const cutoff = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago

  const orphans = await db
    .select({
      photoId: photos.photoId,
      s3Key: photos.s3Key,
    })
    .from(photos)
    .where(and(eq(photos.photoStatus, 'pending'), lt(photos.createdAt, cutoff)));

  if (orphans.length === 0) return { deleted: 0 };

  logger.info({ count: orphans.length }, 'Cleaning up orphaned pending photos');

  let deletedCount = 0;
  for (const orphan of orphans) {
    try {
      await deleteObject(orphan.s3Key);
      await db.delete(photos).where(eq(photos.photoId, orphan.photoId));
      deletedCount += 1;
    } catch (err) {
      logger.error({ err, photoId: orphan.photoId.toString() }, 'Failed to cleanup orphan photo');
      // Continue with the rest — dont let one failure kill the batch.
    }
  }

  logger.info({ deleted: deletedCount, requested: orphans.length }, 'Cleanup complete');
  return { deleted: deletedCount };
}

/**
 * Start the periodic cleanup interval.
 * Returns the interval handle so the caller can stop it on shutdown.
 */
export function startCleanupJob(): NodeJS.Timeout {
  const INTERVAL_MS = 15 * 60 * 1000; // 15 min

  // Run once shortly after startup to catch anything left from a previous restart.
  const initialRun = setTimeout(() => {
    cleanupPendingPhotos().catch((err) => {
      logger.error({ err }, 'Initial cleanup run failed');
    });
  }, 60 * 1000); // 1 min after boot and Date.now() returns the current time in milliseconds so 1000 multplied by 60 gives us 1 minute in milliseconds.

  const interval = setInterval(() => {
    cleanupPendingPhotos().catch((err) => {
      logger.error({ err }, 'Scheduled cleanup run failed');
    });
  }, INTERVAL_MS);

  logger.info({ intervalMs: INTERVAL_MS }, 'Started orphaned photo cleanup job');

  // Attach the initial timeout to the interval so we can clear both on shutdown.
  interval.unref();
  initialRun.unref();

  return interval;
}
