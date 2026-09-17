import { Router } from 'express';
import { validate } from '../../middleware/validate';
import { requireAuth, requireTeamMember, requireAdmin } from '../../middleware/rbac';
import {
  requestUploadUrlSchema,
  confirmUploadSchema,
  eventIdParamSchema,
} from './photos.schemas';
import * as photosController from './photos.controller';
import { z } from 'zod';

/**
 * Two routers here — because these endpoints have different URL shapes:
 *   /api/events/:eventId/photos/... (event-scoped)
 *   /api/photos/:photoId/... (photo-scoped, decoupled from event in URL)
 *
 * Wired separately in app.ts.
 */

export const eventPhotosRouter = Router({ mergeParams: true });

// Team member requests upload URL — for events they're assigned to.
eventPhotosRouter.post(
  '/upload-url',
  requireTeamMember,
  validate(requestUploadUrlSchema),
  photosController.requestUploadUrl
);

// Team member lists their own photos in event.
eventPhotosRouter.get(
  '/mine',
  requireTeamMember,
  validate(eventIdParamSchema),
  photosController.listMyPhotos
);

// Admin lists ALL photos in event they own.
eventPhotosRouter.get(
  '/',
  requireAdmin,
  validate(eventIdParamSchema),
  photosController.listAllEventPhotos
);

/**
 * Photo-scoped router: /api/photos/:photoId/...
 */
export const photosRouter = Router();

photosRouter.post(
  '/:photoId/confirm',
  requireTeamMember,
  validate(confirmUploadSchema),
  photosController.confirmUpload
);

photosRouter.get(
  '/:photoId/preview-url',
  requireAuth,
  validate(z.object({ params: z.object({ photoId: z.string().regex(/^\d+$/, 'photoId must be a positive integer') }) })),
  photosController.getPreviewUrl
);

photosRouter.get(
  '/:photoId/download-url',
  requireAuth,
  validate(z.object({ params: z.object({ photoId: z.string().regex(/^\d+$/, 'photoId must be a positive integer') }) })),
  photosController.getDownloadUrl
);