import { z } from 'zod';

/**
 * Allowed image content types.
 * heic accepted because iPhones default to HEIC.
 */
const ALLOWED_CONTENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
] as const;

/**
 * POST /api/events/:eventId/photos/upload-url
 * Team member requests a presigned URL to upload one photo.
 */
export const requestUploadUrlSchema = z.object({
  body: z.object({
    filename: z.string().trim().min(1, 'filename required').max(255, 'filename too long'),
    content_type: z.enum(ALLOWED_CONTENT_TYPES, {
      message: `content_type must be one of: ${ALLOWED_CONTENT_TYPES.join(', ')}`,
    }),
    file_size: z
      .number()
      .int('file_size must be an integer')
      .positive('file_size must be positive'),
  }),
  params: z.object({
    eventId: z.string().regex(/^\d+$/, 'eventId must be a positive integer'),
  }),
});

/**
 * POST /api/photos/:photoId/confirm
 * Team member confirms upload completed.
 */
export const confirmUploadSchema = z.object({
  params: z.object({
    photoId: z.string().regex(/^\d+$/, 'photoId must be a positive integer'),
  }),
});

/**
 * Path validation for event-scoped photo listings.
 * Query params (page, limit, status) handled by parsePagination in controller.
 */
export const eventIdParamSchema = z.object({
  params: z.object({
    eventId: z.string().regex(/^\d+$/, 'eventId must be a positive integer'),
  }),
});

export type RequestUploadUrlInput = z.infer<typeof requestUploadUrlSchema>['body'];
export const ALLOWED_PHOTO_CONTENT_TYPES = ALLOWED_CONTENT_TYPES;
