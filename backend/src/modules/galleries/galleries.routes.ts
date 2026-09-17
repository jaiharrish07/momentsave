import { Router } from 'express';
import { validate } from '../../middleware/validate';
import { requireAdmin } from '../../middleware/rbac';
import {
  createGallerySchema,
  addPhotosSchema,
  removePhotoSchema,
  galleryIdParamSchema,
} from './galleries.schemas';
import { z } from 'zod';

import * as galleriesController from './galleries.controller';

/**
 * Event-nested creation route: /api/events/:eventId/gallery
 * Wired under eventsRouter with mergeParams so :eventId is visible.
 */
export const eventGalleryRouter = Router({ mergeParams: true });

eventGalleryRouter.get(
  '/',
  requireAdmin,
  validate(z.object({ params: z.object({ eventId: z.string().regex(/^\d+$/, 'eventId must be a positive integer') }) })),
  galleriesController.getGalleryForEvent
);

eventGalleryRouter.post(
  '/',
  requireAdmin,
  validate(createGallerySchema),
  galleriesController.createGallery
);

/**
 * Gallery-scoped routes: /api/galleries/:galleryId/...
 */
export const galleriesRouter = Router();

galleriesRouter.get(
  '/:galleryId',
  requireAdmin,
  validate(galleryIdParamSchema),
  galleriesController.getGallery
);

galleriesRouter.post(
  '/:galleryId/photos',
  requireAdmin,
  validate(addPhotosSchema),
  galleriesController.addPhotos
);

galleriesRouter.delete(
  '/:galleryId/photos/:photoId',
  requireAdmin,
  validate(removePhotoSchema),
  galleriesController.removePhoto
);

galleriesRouter.post(
  '/:galleryId/regenerate-pin',
  requireAdmin,
  validate(galleryIdParamSchema),
  galleriesController.regeneratePin
);

galleriesRouter.post(
  '/:galleryId/publish',
  requireAdmin,
  validate(galleryIdParamSchema),
  galleriesController.publish
);

galleriesRouter.get(
  '/:galleryId/photos',
  requireAdmin,
  validate(galleryIdParamSchema),
  galleriesController.listGalleryPhotos
);