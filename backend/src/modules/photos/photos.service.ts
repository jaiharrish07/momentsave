import { eq, and, desc, sql } from 'drizzle-orm';
import { db } from '../../db/client';
import { events, eventMembers, photos, users } from '../../db/schema';
import { badRequest, conflict, forbidden, notFound } from '../../utils/errors';
import { generateS3Key } from '../../utils/crypto';
import { generatePresignedUploadUrl, headObject } from '../../s3/client';
import { env } from '../../config/env';
import type { Pagination } from '../../utils/pagination';
import type { RequestUploadUrlInput } from './photos.schemas';

export type PhotoStatus = 'pending' | 'uploaded' | 'failed';

export type PublicPhoto = {
  photo_id: string;
  event_id: string;
  uploaded_by: string;
  filename: string;
  file_size: string;
  content_type: string;
  photo_status: PhotoStatus;
  created_at: Date;
  updated_at: Date;
};

export async function requestUploadUrl(
  userId: bigint,
  eventId: bigint,
  input: RequestUploadUrlInput
): Promise<{ photo_id: string; upload_url: string; expires_at: Date; }> {
  if (input.file_size > env.MAX_FILE_SIZE_BYTES) {
    throw badRequest('FILE_TOO_LARGE', `File size exceeds maximum of ${env.MAX_FILE_SIZE_BYTES} bytes`);
  }

  const [membership] = await db
    .select({ eventId: eventMembers.eventId })
    .from(eventMembers)
    .where(and(eq(eventMembers.eventId, eventId), eq(eventMembers.userId, userId)))
    .limit(1);

  if (!membership) throw notFound('Event not found');

  const extension = extractExtension(input.filename) ?? contentTypeToExtension(input.content_type);
  const s3Key = generateS3Key(eventId, extension);

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
    .returning({ photoId: photos.photoId });

  if (!inserted) throw new Error('Insert returned no row');

  const expiresInSeconds = 300;
  const uploadUrl = await generatePresignedUploadUrl(s3Key, input.content_type, expiresInSeconds);
  const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);

  return {
    photo_id: inserted.photoId.toString(),
    upload_url: uploadUrl,
    expires_at: expiresAt,
  };
}

export async function confirmUpload(userId: bigint, photoId: bigint): Promise<PublicPhoto> {
  const [row] = await db
    .select()
    .from(photos)
    .where(and(
      eq(photos.photoId, photoId),
      eq(photos.uploadedBy, userId),
      eq(photos.photoStatus, 'pending')
    ))
    .limit(1);

  if (!row) throw notFound('Photo not found');

  const head = await headObject(row.s3Key);
  if (!head) {
    // Only mark failed if still pending — never overwrite an uploaded row.
    await db
      .update(photos)
      .set({ photoStatus: 'failed', updatedAt: new Date() })
      .where(and(eq(photos.photoId, photoId), eq(photos.photoStatus, 'pending')));
    throw badRequest('UPLOAD_NOT_FOUND', 'S3 object was not uploaded');
  }

  if (BigInt(head.size) !== row.fileSize) {
    await db
      .update(photos)
      .set({ photoStatus: 'failed', updatedAt: new Date() })
      .where(and(eq(photos.photoId, photoId), eq(photos.photoStatus, 'pending')));
    throw badRequest('SIZE_MISMATCH', 'Uploaded file size does not match declared size');
  }

  const [updated] = await db
    .update(photos)
    .set({ photoStatus: 'uploaded', updatedAt: new Date() })
    .where(and(eq(photos.photoId, photoId), eq(photos.photoStatus, 'pending')))
    .returning();

  if (!updated) throw notFound('Photo not found');

  return toPublicPhoto(updated);
}

export async function listMyPhotos(
  userId: bigint,
  eventId: bigint,
  pagination: Pagination,
  statusFilter?: PhotoStatus
): Promise<{ photos: PublicPhoto[]; total: number }> {
  const [membership] = await db
    .select({ eventId: eventMembers.eventId })
    .from(eventMembers)
    .where(and(eq(eventMembers.eventId, eventId), eq(eventMembers.userId, userId)))
    .limit(1);

  if (!membership) throw notFound('Event not found');

  const status = statusFilter ?? 'uploaded';

  const rows = await db
    .select()
    .from(photos)
    .where(and(
      eq(photos.eventId, eventId),
      eq(photos.uploadedBy, userId),
      eq(photos.photoStatus, status)
    ))
    .orderBy(desc(photos.createdAt))
    .limit(pagination.limit)
    .offset(pagination.offset);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(photos)
    .where(and(
      eq(photos.eventId, eventId),
      eq(photos.uploadedBy, userId),
      eq(photos.photoStatus, status)
    ));

  return { photos: rows.map(toPublicPhoto), total: count };
}

export async function listAllEventPhotos(
  adminId: bigint,
  eventId: bigint,
  pagination: Pagination,
  statusFilter?: PhotoStatus
): Promise<{ photos: PublicPhoto[]; total: number }> {
  const [event] = await db
    .select({ eventId: events.eventId })
    .from(events)
    .where(and(eq(events.eventId, eventId), eq(events.createdBy, adminId)))
    .limit(1);

  if (!event) throw notFound('Event not found');

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

  return { photos: rows.map(toPublicPhoto), total: count };
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
