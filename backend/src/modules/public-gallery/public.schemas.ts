import { z } from 'zod';

const publicTokenSchema = z
  .string()
  .min(1, 'public_token required')
  .max(64, 'public_token too long');

/**
 * GET /api/public/galleries/:publicToken
 * Get gallery preview info (title only) before entering PIN.
 * Only published galleries are visible; else 404.
 */
export const getPublicGallerySchema = z.object({
  params: z.object({
    publicToken: publicTokenSchema,
  }),
});

/**
 * POST /api/public/galleries/:publicToken/verify-pin
 * Customer submits PIN. On success, backend sets gallery session cookie.
 */
export const verifyPinSchema = z.object({
  body: z.object({
    pin: z.string().regex(/^\d{4,10}$/, 'PIN must be 4-10 digits'),
  }),
  params: z.object({
    publicToken: publicTokenSchema,
  }),
});

/**
 * GET /api/public/galleries/:publicToken/photos
 * List published photos. Requires gallery session cookie.
 */
export const listPublicPhotosSchema = z.object({
  params: z.object({
    publicToken: publicTokenSchema,
  }),
});

/**
 * GET /api/public/galleries/:publicToken/photos/:photoId/download
 * Get presigned S3 download URL. Requires gallery session cookie.
 */
export const downloadPhotoSchema = z.object({
  params: z.object({
    publicToken: publicTokenSchema,
    photoId: z.string().regex(/^\d+$/, 'photoId must be a positive integer'),
  }),
});
