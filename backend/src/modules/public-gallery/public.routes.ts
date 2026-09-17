import { Router } from 'express';
import { validate } from '../../middleware/validate';
import { pinVerifyRateLimiter } from '../../middleware/rateLimit';
import { requireGallerySession } from './gallery-session.middleware';
import {
  getPublicGallerySchema,
  verifyPinSchema,
  listPublicPhotosSchema,
  downloadPhotoSchema,
} from './public.schemas';
import * as publicController from './public.controller';

export const publicGalleryRouter = Router();

publicGalleryRouter.get(
  '/:publicToken',
  validate(getPublicGallerySchema),
  publicController.getGalleryPreview
);

publicGalleryRouter.post(
  '/:publicToken/verify-pin',
  pinVerifyRateLimiter,
  validate(verifyPinSchema),
  publicController.verifyPin
);

publicGalleryRouter.get(
  '/:publicToken/photos',
  validate(listPublicPhotosSchema),
  requireGallerySession,
  publicController.listPhotos
);

publicGalleryRouter.get(
  '/:publicToken/photos/:photoId/download',
  validate(downloadPhotoSchema),
  requireGallerySession,
  publicController.downloadPhoto
);

publicGalleryRouter.get(
  '/:publicToken/photos/:photoId/preview-url',
  validate(downloadPhotoSchema),
  requireGallerySession,
  publicController.previewPhoto
);
