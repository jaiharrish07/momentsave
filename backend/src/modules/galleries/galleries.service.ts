import { eq, and, desc, inArray, sql } from 'drizzle-orm';
import { db } from '../../db/client';
import { events, galleries, galleryPhotos, photos } from '../../db/schema';
import { badRequest, conflict, notFound } from '../../utils/errors';
import { generatePin, generatePublicToken, hashSecret } from '../../utils/crypto';
import { invalidateGallerySessions } from '../public-gallery/gallery-session';

export type GalleryStatus = 'draft' | 'published';

export type PublicGallery = {
  gallery_id: string;
  event_id: string;
  title: string;
  public_token: string;
  status: GalleryStatus;
  created_by: string;
  created_at: Date;
  published_at: Date | null;
  expiry_date: Date | null;
  photo_count: number;
};

/**
 * Admin creates a gallery for one of their events.
 * PIN auto-generated, returned once (never stored plaintext).
 *
 * Enforces the "one gallery per event" invariant via UNIQUE(event_id).
 */
export async function createGallery(
  adminId: bigint,
  eventId: bigint,
  title: string
): Promise<{ gallery: PublicGallery; pin: string }> {
  const [event] = await db
    .select({ eventId: events.eventId })
    .from(events)
    .where(and(eq(events.eventId, eventId), eq(events.createdBy, adminId)))
    .limit(1);

  if (!event) throw notFound('Event not found');

  const pin = generatePin();
  const pinHash = await hashSecret(pin);
  const publicToken = generatePublicToken();

  try {
    const [inserted] = await db
      .insert(galleries)
      .values({
        eventId,
        title,
        pinHash,
        publicToken,
        createdBy: adminId,
      })
      .returning({
        galleryId: galleries.galleryId,
        eventId: galleries.eventId,
        title: galleries.title,
        publicToken: galleries.publicToken,
        status: galleries.status,
        createdBy: galleries.createdBy,
        createdAt: galleries.createdAt,
        publishedAt: galleries.publishedAt,
        expiryDate: galleries.expiryDate,
      });

    if (!inserted) throw new Error('Insert returned no row');

    return {
      gallery: toPublicGallery(inserted, 0),
      pin,
    };
  } catch (err: unknown) {
    if (isPgUniqueViolation(err)) {
      throw conflict('GALLERY_ALREADY_EXISTS', 'A gallery already exists for this event');
    }
    throw err;
  }
}

/**
 * Admin views their gallery.
 */
export async function getGallery(
  adminId: bigint,
  galleryId: bigint
): Promise<PublicGallery> {
  const [row] = await db
    .select()
    .from(galleries)
    .where(and(eq(galleries.galleryId, galleryId), eq(galleries.createdBy, adminId)))
    .limit(1);

  if (!row) throw notFound('Gallery not found');

  const photoCount = await countGalleryPhotos(galleryId);
  return toPublicGallery(row, photoCount);
}

/**
 * Admin bulk-adds photos to gallery.
 *
 * All-or-nothing:
 *   - Every photo_id must belong to the same event as the gallery.
 *   - Every photo must be status='uploaded'.
 *   - Photos not already in the gallery are added.
 *   - If ANY id is invalid, throw 400 with bad_photo_ids list — nothing is added.
 *
 * Photos already in the gallery are silently ignored (idempotent add).
 */

/**
 * Get the gallery for a specific event (owner check).
 * Returns null if the admin doesn't own the event OR no gallery exists.
 */
export async function getGalleryByEventId(
  adminId: bigint,
  eventId: bigint
): Promise<PublicGallery | null> {
  const [event] = await db
    .select({ eventId: events.eventId })
    .from(events)
    .where(and(eq(events.eventId, eventId), eq(events.createdBy, adminId)))
    .limit(1);

  if (!event) return null;

  const [row] = await db
    .select()
    .from(galleries)
    .where(eq(galleries.eventId, eventId))
    .limit(1);

  if (!row) return null;

  const photoCount = await countGalleryPhotos(row.galleryId);
  return toPublicGallery(row, photoCount);
}

export async function addPhotosToGallery(
  adminId: bigint,
  galleryId: bigint,
  photoIds: bigint[]
): Promise<{ added: number; already_in_gallery: number }> {
  const [gallery] = await db
    .select({ galleryId: galleries.galleryId, eventId: galleries.eventId })
    .from(galleries)
    .where(and(eq(galleries.galleryId, galleryId), eq(galleries.createdBy, adminId)))
    .limit(1);

  if (!gallery) throw notFound('Gallery not found');

  // Fetch all provided photo_ids that exist AND match this event AND are uploaded.
  const validPhotos = await db
    .select({ photoId: photos.photoId })
    .from(photos)
    .where(
      and(
        inArray(photos.photoId, photoIds),
        eq(photos.eventId, gallery.eventId),
        eq(photos.photoStatus, 'uploaded')
      )
    );

  const validIds = new Set(validPhotos.map((p) => p.photoId.toString()));
  const requestedIds = photoIds.map((id) => id.toString());
  const badIds = requestedIds.filter((id) => !validIds.has(id));

  if (badIds.length > 0) {
    throw badRequest('INVALID_PHOTO_IDS', 'One or more photo IDs are invalid or not in this event', {
      bad_photo_ids: badIds,
    });
  }

  // Fetch existing gallery memberships to skip duplicates.
  const existing = await db
    .select({ photoId: galleryPhotos.photoId })
    .from(galleryPhotos)
    .where(and(eq(galleryPhotos.galleryId, galleryId), inArray(galleryPhotos.photoId, photoIds)));

  const existingIds = new Set(existing.map((p) => p.photoId.toString()));
  const newPhotoIds = photoIds.filter((id) => !existingIds.has(id.toString()));

  if (newPhotoIds.length === 0) {
    return { added: 0, already_in_gallery: existingIds.size };
  }

  await db
    .insert(galleryPhotos)
    .values(newPhotoIds.map((photoId) => ({ galleryId, photoId })));

  return {
    added: newPhotoIds.length,
    already_in_gallery: existingIds.size,
  };
}

/**
 * Admin removes a photo from gallery.
 * 404 if either the gallery isnt theirs or the photo isnt in it.
 */
export async function removePhotoFromGallery(
  adminId: bigint,
  galleryId: bigint,
  photoId: bigint
): Promise<void> {
  const [gallery] = await db
    .select({ galleryId: galleries.galleryId })
    .from(galleries)
    .where(and(eq(galleries.galleryId, galleryId), eq(galleries.createdBy, adminId)))
    .limit(1);

  if (!gallery) throw notFound('Gallery not found');

  const result = await db
    .delete(galleryPhotos)
    .where(and(eq(galleryPhotos.galleryId, galleryId), eq(galleryPhotos.photoId, photoId)))
    .returning({ photoId: galleryPhotos.photoId });

  if (result.length === 0) {
    throw notFound('Photo not in gallery');
  }
}

/**
 * Admin regenerates the PIN. New PIN returned once (never stored plaintext).
 * Existing gallery sessions bound to the old PIN are invalidated.
 */
export async function regeneratePin(
  adminId: bigint,
  galleryId: bigint
): Promise<{ pin: string }> {
  const [gallery] = await db
    .select({
      galleryId: galleries.galleryId,
      publicToken: galleries.publicToken,
    })
    .from(galleries)
    .where(and(eq(galleries.galleryId, galleryId), eq(galleries.createdBy, adminId)))
    .limit(1);

  if (!gallery) throw notFound('Gallery not found');

  const pin = generatePin();
  const pinHash = await hashSecret(pin);

  await db
    .update(galleries)
    .set({ pinHash })
    .where(eq(galleries.galleryId, galleryId));

  // Kill all customer sessions bound to the old PIN.
  await invalidateGallerySessions(gallery.publicToken);

  return { pin };
}

/**
 * Admin publishes a draft gallery.
 * Preconditions:
 *   - Gallery must be status='draft'
 *   - Gallery must have at least one photo
 */
export async function publishGallery(
  adminId: bigint,
  galleryId: bigint
): Promise<PublicGallery> {
  const [gallery] = await db
    .select()
    .from(galleries)
    .where(and(eq(galleries.galleryId, galleryId), eq(galleries.createdBy, adminId)))
    .limit(1);

  if (!gallery) throw notFound('Gallery not found');

  if (gallery.status === 'published') {
    throw conflict('ALREADY_PUBLISHED', 'Gallery is already published');
  }

  const photoCount = await countGalleryPhotos(galleryId);
  if (photoCount === 0) {
    throw badRequest('EMPTY_GALLERY', 'Cannot publish a gallery with no photos');
  }

  const now = new Date();
  const [updated] = await db
    .update(galleries)
    .set({ status: 'published', publishedAt: now })
    .where(and(eq(galleries.galleryId, galleryId), eq(galleries.status, 'draft')))
    .returning();

  if (!updated) throw notFound('Gallery not found');

  return toPublicGallery(updated, photoCount);
}

async function countGalleryPhotos(galleryId: bigint): Promise<number> {
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(galleryPhotos)
    .where(eq(galleryPhotos.galleryId, galleryId));
  return count;
}

/**
 * List all photos currently in a gallery.
 * Admin owns the gallery. Returns full photo metadata.
 */
export async function listPhotosInGalleryForAdmin(
  adminId: bigint,
  galleryId: bigint
): Promise<{ photo_id: string; filename: string; file_size: string; content_type: string }[]> {
  const [gallery] = await db
    .select({ galleryId: galleries.galleryId })
    .from(galleries)
    .where(and(eq(galleries.galleryId, galleryId), eq(galleries.createdBy, adminId)))
    .limit(1);

  if (!gallery) throw notFound('Gallery not found');

  const rows = await db
    .select({
      photoId: photos.photoId,
      filename: photos.filename,
      fileSize: photos.fileSize,
      contentType: photos.contentType,
    })
    .from(galleryPhotos)
    .innerJoin(photos, eq(photos.photoId, galleryPhotos.photoId))
    .where(eq(galleryPhotos.galleryId, galleryId))
    .orderBy(desc(galleryPhotos.addedAt));

  return rows.map((r) => ({
    photo_id: r.photoId.toString(),
    filename: r.filename,
    file_size: r.fileSize.toString(),
    content_type: r.contentType,
  }));
}

function toPublicGallery(
  row: {
    galleryId: bigint;
    eventId: bigint;
    title: string;
    publicToken: string;
    status: string;
    createdBy: bigint;
    createdAt: Date;
    publishedAt: Date | null;
    expiryDate: Date | null;
  },
  photoCount: number
): PublicGallery {
  return {
    gallery_id: row.galleryId.toString(),
    event_id: row.eventId.toString(),
    title: row.title,
    public_token: row.publicToken,
    status: row.status as GalleryStatus,
    created_by: row.createdBy.toString(),
    created_at: row.createdAt,
    published_at: row.publishedAt,
    expiry_date: row.expiryDate,
    photo_count: photoCount,
  };
}

function isPgUniqueViolation(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;
  const asObj = err as { code?: unknown; cause?: unknown };
  if (asObj.code === '23505') return true;
  if (typeof asObj.cause === 'object' && asObj.cause !== null) {
    const cause = asObj.cause as { code?: unknown };
    if (cause.code === '23505') return true;
  }
  return false;
}
