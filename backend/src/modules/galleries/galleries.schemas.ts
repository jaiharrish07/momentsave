import { z } from 'zod';

const titleSchema = z
  .string()
  .trim()
  .min(1, 'Title is required')
  .max(200, 'Title too long');

/**
 * POST /api/events/:eventId/gallery
 * Admin creates gallery for their event.
 * PIN is auto-generated and returned once.
 */
export const createGallerySchema = z.object({
  body: z.object({
    title: titleSchema,
  }),
  params: z.object({
    eventId: z.string().regex(/^\d+$/, 'eventId must be a positive integer'),
  }),
});

/**
 * POST /api/galleries/:galleryId/photos
 * Bulk add photos to gallery.
 */
export const addPhotosSchema = z.object({
  body: z.object({
    photo_ids: z
      .array(
        z
          .union([z.string(), z.number()])
          .transform((v) => String(v))
          .refine((v) => /^\d+$/.test(v), 'photo_id must be a positive integer')
      )
      .min(1, 'At least one photo_id required')
      .max(1000, 'Cannot add more than 1000 photos at once'),
  }),
  params: z.object({
    galleryId: z.string().regex(/^\d+$/, 'galleryId must be a positive integer'),
  }),
});

/**
 * DELETE /api/galleries/:galleryId/photos/:photoId
 */
export const removePhotoSchema = z.object({
  params: z.object({
    galleryId: z.string().regex(/^\d+$/, 'galleryId must be a positive integer'),
    photoId: z.string().regex(/^\d+$/, 'photoId must be a positive integer'),
  }),
});

/**
 * Path-only schemas for the various admin gallery endpoints.
 */
export const galleryIdParamSchema = z.object({
  params: z.object({
    galleryId: z.string().regex(/^\d+$/, 'galleryId must be a positive integer'),
  }),
});
