import { Request, Response, NextFunction } from 'express';
import { unauthorized } from '../../utils/errors';
import { parseBigIntParam } from '../../utils/params';
import * as galleriesService from './galleries.service';
import { notFound } from '../../utils/errors';
/**
 * POST /api/events/:eventId/gallery
 * Admin creates a gallery. PIN returned once in the response body.
 */
export async function createGallery(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw unauthorized();
    const adminId = BigInt(req.user.userId);
    const eventId = parseBigIntParam(req.params.eventId, 'eventId');
    const title = req.body.title as string;

    const { gallery, pin } = await galleriesService.createGallery(adminId, eventId, title);

    res.status(201).json({
      data: {
        gallery,
        pin,
        message: 'Gallery created. This PIN is shown once — save it or share it now.',
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/galleries/:galleryId
 * Admin views their gallery (draft or published).
 */
export async function getGallery(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw unauthorized();
    const adminId = BigInt(req.user.userId);
    const galleryId = parseBigIntParam(req.params.galleryId, 'galleryId');

    const gallery = await galleriesService.getGallery(adminId, galleryId);
    res.json({ data: { gallery } });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/galleries/:galleryId/photos
 * Bulk add photos, all-or-nothing.
 */

/**
 * GET /api/events/:eventId/gallery
 * Fetch the gallery for a specific event (nested route).
 */
export async function getGalleryForEvent(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw unauthorized();
    const adminId = BigInt(req.user.userId);
    const eventId = parseBigIntParam(req.params.eventId, 'eventId');

    const gallery = await galleriesService.getGalleryByEventId(adminId, eventId);
    if (!gallery) throw notFound('Gallery not found');

    res.json({ data: { gallery } });
  } catch (err) {
    next(err);
  }
}


export async function addPhotos(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw unauthorized();
    const adminId = BigInt(req.user.userId);
    const galleryId = parseBigIntParam(req.params.galleryId, 'galleryId');

    const photoIds: bigint[] = (req.body.photo_ids as string[]).map((id) => BigInt(id));

    const result = await galleriesService.addPhotosToGallery(adminId, galleryId, photoIds);
    res.status(200).json({ data: result });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/galleries/:galleryId/photos/:photoId
 */
export async function removePhoto(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw unauthorized();
    const adminId = BigInt(req.user.userId);
    const galleryId = parseBigIntParam(req.params.galleryId, 'galleryId');
    const photoId = parseBigIntParam(req.params.photoId, 'photoId');

    await galleriesService.removePhotoFromGallery(adminId, galleryId, photoId);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/galleries/:galleryId/regenerate-pin
 */
export async function regeneratePin(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw unauthorized();
    const adminId = BigInt(req.user.userId);
    const galleryId = parseBigIntParam(req.params.galleryId, 'galleryId');

    const { pin } = await galleriesService.regeneratePin(adminId, galleryId);
    res.json({
      data: {
        pin,
        message: 'PIN regenerated. All previous customer sessions have been invalidated.',
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/galleries/:galleryId/publish
 */
export async function publish(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw unauthorized();
    const adminId = BigInt(req.user.userId);
    const galleryId = parseBigIntParam(req.params.galleryId, 'galleryId');

    const gallery = await galleriesService.publishGallery(adminId, galleryId);
    res.json({ data: { gallery } });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/galleries/:galleryId/photos
 * List photos currently in the gallery (admin view).
 */
export async function listGalleryPhotos(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw unauthorized();
    const adminId = BigInt(req.user.userId);
    const galleryId = parseBigIntParam(req.params.galleryId, 'galleryId');

    const photos = await galleriesService.listPhotosInGalleryForAdmin(adminId, galleryId);
    res.json({ data: { photos } });
  } catch (err) {
    next(err);
  }
}