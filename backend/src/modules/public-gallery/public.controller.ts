import { Request, Response, NextFunction } from 'express';
import { env } from '../../config/env';
import { parseBigIntParam } from '../../utils/params';
import { parsePagination, paginatedResponse } from '../../utils/pagination';
import * as publicService from './public.service';

/**
 * Cookie options for the gallery session.
 * Same shape as auth cookies but different name — separate namespace.
 */
function gallerySessionCookieOptions() {
  const isProd = env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? ('strict' as const) : ('lax' as const),
    maxAge: 2 * 60 * 60 * 1000, // 2 hours
    path: '/',
  };
}

/**
 * GET /api/public/galleries/:publicToken
 * Public — returns minimal info for PIN entry screen.
 */
export async function getGalleryPreview(req: Request, res: Response, next: NextFunction) {
  try {
    const publicToken = req.params.publicToken as string;
    const preview = await publicService.getPublicGalleryPreview(publicToken);
    res.json({ data: { gallery: preview } });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/public/galleries/:publicToken/verify-pin
 * Public — accepts PIN, returns cookie on success.
 * Rate-limited via middleware chain.
 */
export async function verifyPin(req: Request, res: Response, next: NextFunction) {
  try {
    const publicToken = req.params.publicToken as string;
    const pin = req.body.pin as string;

    const { sessionToken, title } = await publicService.verifyPinAndCreateSession(publicToken, pin);
    res.cookie(env.GALLERY_SESSION_COOKIE_NAME, sessionToken, gallerySessionCookieOptions());

    res.json({
      data: {
        gallery: { title },
        message: 'Verified. You can now view this gallery.',
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/public/galleries/:publicToken/photos
 * Session-gated — customer sees the list of photos in the gallery.
 */
export async function listPhotos(req: Request, res: Response, next: NextFunction) {
  try {
    const publicToken = req.params.publicToken as string;
    const pagination = parsePagination(req.query);

    const { photos, total } = await publicService.listPhotosInGallery(publicToken, pagination);
    res.json({ data: paginatedResponse('photos', photos, pagination, total) });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/public/galleries/:publicToken/photos/:photoId/download
 * Session-gated — returns a short-lived presigned S3 URL.
 */
export async function downloadPhoto(req: Request, res: Response, next: NextFunction) {
  try {
    const publicToken = req.params.publicToken as string;
    const photoId = parseBigIntParam(req.params.photoId, 'photoId');

    const result = await publicService.getPhotoDownloadUrl(publicToken, photoId);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}
