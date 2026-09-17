import { eq, and, desc, sql } from 'drizzle-orm';
import { db } from '../../db/client';
import { events, eventMembers, photos, users } from '../../db/schema';
import { badRequest, conflict, forbidden, notFound } from '../../utils/errors';
import { generateS3Key } from '../../utils/crypto';
import { generatePresignedDownloadUrl, generatePresignedUploadUrl, headObject } from '../../s3/client';
import { env } from '../../config/env';
import type { Pagination } from '../../utils/pagination';
import type { RequestUploadUrlInput } from './photos.schemas';


export type PhotoStatus = 'pending' | 'uploaded' | 'failed';

export type PublicPhoto = {
  photo_id: string;
  event_id: string;
  uploaded_by: string;
  filename: string;
  file_size: string; // BIGINT as string
  content_type: string;
  photo_status: PhotoStatus;
  created_at: Date;
  updated_at: Date;
};

/**
 * Team member requests a presigned URL to upload one photo.
 *
 * Authorization:
 *   - User must be a team_member assigned to the event.
 *   - Else 404 (hides existence).
 *
 * Side effects:
 *   - Inserts photo row with status='pending', chosen s3_key.
 *   - Generates presigned PUT URL, valid for 5 minutes.
 *
 * Returns:
 *   - photo_id (for the confirm step)
 *   - upload_url (client PUTs bytes here)
 *   - expires_at (ISO timestamp)
 */
export async function requestUploadUrl(
  userId: bigint,
  eventId: bigint,
  input: RequestUploadUrlInput
): Promise<{
  photo_id: string;
  upload_url: string;
  expires_at: Date;
}> {
  // Validate size against configured max.
  if (input.file_size > env.MAX_FILE_SIZE_BYTES) {
    throw badRequest(
      'FILE_TOO_LARGE',
      `File size exceeds maximum of ${env.MAX_FILE_SIZE_BYTES} bytes`
    );
  }

  // Verify the user is assigned to this event.
  const [membership] = await db
    .select({ eventId: eventMembers.eventId })
    .from(eventMembers)
    .where(and(eq(eventMembers.eventId, eventId), eq(eventMembers.userId, userId)))
    .limit(1);

  if (!membership) {
    throw notFound('Event not found');
  }

  // Derive extension from filename for a clean s3 key.
  const extension = extractExtension(input.filename) ?? contentTypeToExtension(input.content_type);
  const s3Key = generateS3Key(eventId, extension);

  // Insert pending row.
  const [inserted] = await db
    .insert(photos)
    .values({
      eventId,
      uploadedBy: userId,
      filename: input.filename,
      s3Key,
      fileSize: BigInt(input.file_size),
      contentType: input.content_type,
      photoStatus: 'pending',
    })
    .returning({
      photoId: photos.photoId,
    });

  if (!inserted) {
    throw new Error('Insert returned no row');
  }

  // Generate the presigned URL.
  const expiresInSeconds = 300;
  const uploadUrl = await generatePresignedUploadUrl(s3Key, input.content_type, expiresInSeconds);
  const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);

  return {
    photo_id: inserted.photoId.toString(),
    upload_url: uploadUrl,
    expires_at: expiresAt,
  };
}

/**
 * Team member confirms an upload completed. Backend HEADs S3 to verify
 * the object actually exists, then flips status pending → uploaded.
 *
 * Authorization:
 *   - Photo must belong to the requesting user (uploaded_by = userId).
 *   - Photo status must currently be 'pending'.
 *   - Else 404 (hides existence AND double-confirm attempts).
 */
export async function confirmUpload(
  userId: bigint,
  photoId: bigint
): Promise<PublicPhoto> {
  // Fetch photo, verify ownership + pending status.
  const [row] = await db
    .select()
    .from(photos)
    .where(
      and(
        eq(photos.photoId, photoId),
        eq(photos.uploadedBy, userId),
        eq(photos.photoStatus, 'pending')
      )
    )
    .limit(1);

  if (!row) {
    throw notFound('Photo not found');
  }

  // Verify object exists in S3.
  const head = await headObject(row.s3Key);
  if (!head) {
    // Client claimed upload done but S3 has no such object.
    // Mark as failed for observability.
    await db
      .update(photos)
      .set({ photoStatus: 'failed', updatedAt: new Date() })
      .where(eq(photos.photoId, photoId));
    throw badRequest('UPLOAD_NOT_FOUND', 'S3 object was not uploaded');
  }

  // Optional: verify size matches what client declared.
  // Small tolerance not needed — S3 will report exact byte count.
  if (BigInt(head.size) !== row.fileSize) {
    // Size mismatch — client lied about size or upload was truncated.
    await db
      .update(photos)
      .set({ photoStatus: 'failed', updatedAt: new Date() })
      .where(eq(photos.photoId, photoId));
    throw badRequest('SIZE_MISMATCH', 'Uploaded file size does not match declared size');
  }

  // All good — mark as uploaded.
  const [updated] = await db
    .update(photos)
    .set({ photoStatus: 'uploaded', updatedAt: new Date() })
    .where(eq(photos.photoId, photoId))
    .returning();

  if (!updated) {
    throw new Error('Update returned no row');
  }

  return toPublicPhoto(updated);
}

/**
 * Team member lists photos they uploaded to an event.
 *
 * Authorization:
 *   - User must be assigned to the event.
 *   - Only returns photos where uploaded_by = user.
 */
export async function listMyPhotos(
  userId: bigint,
  eventId: bigint,
  pagination: Pagination,
  statusFilter?: PhotoStatus
): Promise<{ photos: PublicPhoto[]; total: number }> {
  // Verify membership.
  const [membership] = await db
    .select({ eventId: eventMembers.eventId })
    .from(eventMembers)
    .where(and(eq(eventMembers.eventId, eventId), eq(eventMembers.userId, userId)))
    .limit(1);

  if (!membership) {
    throw notFound('Event not found');
  }

  const status = statusFilter ?? 'uploaded';

  const rows = await db
    .select()
    .from(photos)
    .where(
      and(
        eq(photos.eventId, eventId),
        eq(photos.uploadedBy, userId),
        eq(photos.photoStatus, status)
      )
    )
    .orderBy(desc(photos.createdAt))
    .limit(pagination.limit)
    .offset(pagination.offset);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(photos)
    .where(
      and(
        eq(photos.eventId, eventId),
        eq(photos.uploadedBy, userId),
        eq(photos.photoStatus, status)
      )
    );

  return {
    photos: rows.map(toPublicPhoto),
    total: count,
  };
}

/**
 * Admin lists all photos in an event they own.
 *
 * Authorization:
 *   - User must be the admin who created the event.
 *   - Else 404.
 */
export async function listAllEventPhotos(
  adminId: bigint,
  eventId: bigint,
  pagination: Pagination,
  statusFilter?: PhotoStatus
): Promise<{ photos: PublicPhoto[]; total: number }> {
  // Verify admin owns the event.
  const [event] = await db
    .select({ eventId: events.eventId })
    .from(events)
    .where(and(eq(events.eventId, eventId), eq(events.createdBy, adminId)))
    .limit(1);

  if (!event) {
    throw notFound('Event not found');
  }

  const status = statusFilter ?? 'uploaded';

  const rows = await db
    .select()
    .from(photos)
    .where(and(eq(photos.eventId, eventId), eq(photos.photoStatus, status)))
    .orderBy(desc(photos.createdAt))
    .limit(pagination.limit)
    .offset(pagination.offset);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(photos)
    .where(and(eq(photos.eventId, eventId), eq(photos.photoStatus, status)));

  return {
    photos: rows.map(toPublicPhoto),
    total: count,
  };
}

/**
 * Get a presigned S3 download URL for a specific photo.
 *
 * Authorization:
 *   - Admin: must own the event that contains the photo
 *   - Team member: must be assigned to the event that contains the photo
 *
 * Photo must be uploaded (not pending/failed).
 * URL expires in 1 hour.
 */
export async function getPhotoPreviewUrl(
  userId: bigint,
  role: 'admin' | 'team_member',
  photoId: bigint
): Promise<{ download_url: string; expires_at: Date; filename: string; content_type: string }> {
  const row = await authorizePhotoAccess(userId, role, photoId);

  const expiresInSeconds = 3600;
  const downloadUrl = await generatePresignedDownloadUrl(row.s3Key, expiresInSeconds);
  const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);
  return {
    download_url: downloadUrl,
    expires_at: expiresAt,
    filename: row.filename,
    content_type: row.contentType,
  };
}

/**
 * Get a presigned S3 URL that forces the browser to download the photo
 * (Content-Disposition: attachment) instead of viewing it inline.
 * Same authorization rules as getPhotoPreviewUrl.
 */
export async function getPhotoDownloadUrl(
  userId: bigint,
  role: 'admin' | 'team_member',
  photoId: bigint
): Promise<{ download_url: string; expires_at: Date; filename: string; content_type: string }> {
  const row = await authorizePhotoAccess(userId, role, photoId);

  const expiresInSeconds = 3600;
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
    content_type: row.contentType,
  };
}

async function authorizePhotoAccess(
  userId: bigint,
  role: 'admin' | 'team_member',
  photoId: bigint
): Promise<{ s3Key: string; filename: string; contentType: string; eventId: bigint }> {
  const [row] = await db
    .select({
      s3Key: photos.s3Key,
      filename: photos.filename,
      contentType: photos.contentType,
      eventId: photos.eventId,
    })
    .from(photos)
    .where(and(eq(photos.photoId, photoId), eq(photos.photoStatus, 'uploaded')))
    .limit(1);

  if (!row) throw notFound('Photo not found');

  if (role === 'admin') {
    const [event] = await db
      .select({ eventId: events.eventId })
      .from(events)
      .where(and(eq(events.eventId, row.eventId), eq(events.createdBy, userId)))
      .limit(1);
    if (!event) throw notFound('Photo not found');
  } else {
    const [membership] = await db
      .select({ eventId: eventMembers.eventId })
      .from(eventMembers)
      .where(and(eq(eventMembers.eventId, row.eventId), eq(eventMembers.userId, userId)))
      .limit(1);
    if (!membership) throw notFound('Photo not found');
  }

  return row;
}

function toPublicPhoto(row: {
  photoId: bigint;
  eventId: bigint;
  uploadedBy: bigint;
  filename: string;
  fileSize: bigint;
  contentType: string;
  photoStatus: string;
  createdAt: Date;
  updatedAt: Date;
}): PublicPhoto {
  return {
    photo_id: row.photoId.toString(),
    event_id: row.eventId.toString(),
    uploaded_by: row.uploadedBy.toString(),
    filename: row.filename,
    file_size: row.fileSize.toString(),
    content_type: row.contentType,
    photo_status: row.photoStatus as PhotoStatus,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  };
}

function extractExtension(filename: string): string | null {
  const dot = filename.lastIndexOf('.');
  if (dot === -1 || dot === filename.length - 1) return null;
  return filename.substring(dot + 1).toLowerCase();
}

function contentTypeToExtension(contentType: string): string {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/heic': 'heic',
  };
  return map[contentType] ?? 'bin';
}
