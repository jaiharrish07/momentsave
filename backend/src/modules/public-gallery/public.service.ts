import { eq, and, desc, sql } from 'drizzle-orm';
import { db } from '../../db/client';
import { galleries, galleryPhotos, photos } from '../../db/schema';
import { notFound, unauthorized } from '../../utils/errors';
import { verifySecret } from '../../utils/crypto';
import { generatePresignedDownloadUrl } from '../../s3/client';
import { createGallerySession } from './gallery-session';
import type { Pagination } from '../../utils/pagination';

export type PublicGalleryPreview = {
  title: string;
};

export type PublicPhotoInGallery = {
  photo_id: string;
  filename: string;
  content_type: string;
  file_size: string;
  added_at: Date;
};

/**
 * Get minimal gallery info for the PIN entry screen.
 * Returns title only. 404 for unpublished or missing.
 * Never leaks internal gallery_id.
 */
export async function getPublicGalleryPreview(publicToken: string): Promise<PublicGalleryPreview> {
  const [row] = await db
    .select({ title: galleries.title })
    .from(galleries)
    .where(and(eq(galleries.publicToken, publicToken), eq(galleries.status, 'published')))
    .limit(1);

  if (!row) throw notFound('Gallery not found');
  return { title: row.title };
}

/**
 * Verify PIN. On success, create a gallery session and return the token
 * for the controller to set as a cookie.
 *
 * 404 for unpublished/missing galleries — customer cant enumerate which
 * public_tokens exist as drafts.
 * 401 for wrong PIN — uniform response regardless of whether the gallery
 * exists (published or not, doesnt matter after 404 above).
 */
export async function verifyPinAndCreateSession(
  publicToken: string,
  pin: string
): Promise<{ sessionToken: string; title: string }> {
  const [row] = await db
    .select({
      title: galleries.title,
      pinHash: galleries.pinHash,
    })
    .from(galleries)
    .where(and(eq(galleries.publicToken, publicToken), eq(galleries.status, 'published')))
    .limit(1);

  if (!row) throw notFound('Gallery not found');

  const ok = await verifySecret(pin, row.pinHash);
  if (!ok) throw unauthorized('Invalid PIN');

  const sessionToken = await createGallerySession(publicToken);
  return { sessionToken, title: row.title };
}

/**
 * List photos in a gallery. Requires the caller to have already passed
 * the gallery-session middleware (session bound to this publicToken).
 */
export async function listPhotosInGallery(
  publicToken: string,
  pagination: Pagination
): Promise<{ photos: PublicPhotoInGallery[]; total: number }> {
  const [gallery] = await db
    .select({ galleryId: galleries.galleryId })
    .from(galleries)
    .where(and(eq(galleries.publicToken, publicToken), eq(galleries.status, 'published')))
    .limit(1);

  if (!gallery) throw notFound('Gallery not found');

  const rows = await db
    .select({
      photoId: photos.photoId,
      filename: photos.filename,
      contentType: photos.contentType,
      fileSize: photos.fileSize,
      addedAt: galleryPhotos.addedAt,
    })
    .from(galleryPhotos)
    .innerJoin(photos, eq(photos.photoId, galleryPhotos.photoId))
    .where(and(eq(galleryPhotos.galleryId, gallery.galleryId), eq(photos.photoStatus, 'uploaded')))
    .orderBy(desc(galleryPhotos.addedAt))
    .limit(pagination.limit)
    .offset(pagination.offset);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(galleryPhotos)
    .innerJoin(photos, eq(photos.photoId, galleryPhotos.photoId))
    .where(and(eq(galleryPhotos.galleryId, gallery.galleryId), eq(photos.photoStatus, 'uploaded')));

  return {
    photos: rows.map((r) => ({
      photo_id: r.photoId.toString(),
      filename: r.filename,
      content_type: r.contentType,
      file_size: r.fileSize.toString(),
      added_at: r.addedAt,
    })),
    total: count,
  };
}

/**
 * Generate a time-limited presigned S3 URL for downloading one photo.
 * Requires the photo to be in this gallery AND uploaded.
 * URL has Content-Disposition: attachment so the browser saves the file.
 */
export async function getPhotoDownloadUrl(
  publicToken: string,
  photoId: bigint
): Promise<{ download_url: string; expires_at: Date; filename: string }> {
  const row = await getGalleryPhotoAsset(publicToken, photoId);

  const expiresInSeconds = 3600; // 1 hour
  const downloadUrl = await generatePresignedDownloadUrl(
    row.s3Key,
    expiresInSeconds,
    row.filename
  );
  const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);

  return {
    download_url: downloadUrl,
    expires_at: expiresAt,
    filename: row.filename,
  };
}

/**
 * Generate a presigned URL for INLINE viewing of a public gallery photo
 * (thumbnails / lightbox). No Content-Disposition, so the browser renders
 * the image instead of downloading it.
 * Same authorization as getPhotoDownloadUrl (gallery must be published and
 * the photo must belong to it).
 */
export async function getPhotoPreviewUrl(
  publicToken: string,
  photoId: bigint
): Promise<{ download_url: string; expires_at: Date; filename: string }> {
  const row = await getGalleryPhotoAsset(publicToken, photoId);

  const expiresInSeconds = 3600;
  const downloadUrl = await generatePresignedDownloadUrl(row.s3Key, expiresInSeconds);
  const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);

  return {
    download_url: downloadUrl,
    expires_at: expiresAt,
    filename: row.filename,
  };
}

async function getGalleryPhotoAsset(
  publicToken: string,
  photoId: bigint
): Promise<{ s3Key: string; filename: string }> {
  const [row] = await db
    .select({
      s3Key: photos.s3Key,
      filename: photos.filename,
    })
    .from(galleryPhotos)
    .innerJoin(galleries, eq(galleries.galleryId, galleryPhotos.galleryId))
    .innerJoin(photos, eq(photos.photoId, galleryPhotos.photoId))
    .where(
      and(
        eq(galleries.publicToken, publicToken),
        eq(galleries.status, 'published'),
        eq(photos.photoId, photoId),
        eq(photos.photoStatus, 'uploaded')
      )
    )
    .limit(1);

  if (!row) throw notFound('Photo not found');
  return row;
}
