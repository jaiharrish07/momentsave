import { Request, Response, NextFunction } from 'express';
import { unauthorized, badRequest } from '../../utils/errors';
import { parseBigIntParam } from '../../utils/params';
import { parsePagination, paginatedResponse } from '../../utils/pagination';
import * as photosService from './photos.service';
import type { PhotoStatus } from './photos.service';

const VALID_STATUSES: readonly PhotoStatus[] = ['pending', 'uploaded', 'failed'];

function parseStatusFilter(q: unknown): PhotoStatus | undefined {
  const query = (q ?? {}) as Record<string, unknown>;
  const raw = query.status;
  if (raw === undefined || raw === '') return undefined;
  if (typeof raw !== 'string') {
    throw badRequest('INVALID_STATUS', 'status must be a string');
  }
  if (!(VALID_STATUSES as readonly string[]).includes(raw)) {
    throw badRequest('INVALID_STATUS', `status must be one of: ${VALID_STATUSES.join(', ')}`);
  }
  return raw as PhotoStatus;
}

/**
 * POST /api/events/:eventId/photos/upload-url
 * Team member requests a presigned URL.
 */
export async function requestUploadUrl(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw unauthorized();
    const userId = BigInt(req.user.userId);
    const eventId = parseBigIntParam(req.params.eventId, 'eventId');

    const result = await photosService.requestUploadUrl(userId, eventId, req.body);
    res.status(201).json({ data: result });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/photos/:photoId/confirm
 * Team member confirms upload completed.
 */
export async function confirmUpload(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw unauthorized();
    const userId = BigInt(req.user.userId);
    const photoId = parseBigIntParam(req.params.photoId, 'photoId');

    const photo = await photosService.confirmUpload(userId, photoId);
    res.json({ data: { photo } });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/events/:eventId/photos/mine
 * Team member lists their own photos in an event.
 */
export async function listMyPhotos(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw unauthorized();
    const userId = BigInt(req.user.userId);
    const eventId = parseBigIntParam(req.params.eventId, 'eventId');
    const pagination = parsePagination(req.query);
    const statusFilter = parseStatusFilter(req.query);

    const { photos, total } = await photosService.listMyPhotos(
      userId,
      eventId,
      pagination,
      statusFilter
    );

    res.json({ data: paginatedResponse('photos', photos, pagination, total) });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/events/:eventId/photos
 * Admin lists all photos in an event they own.
 */
export async function listAllEventPhotos(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw unauthorized();
    const adminId = BigInt(req.user.userId);
    const eventId = parseBigIntParam(req.params.eventId, 'eventId');
    const pagination = parsePagination(req.query);
    const statusFilter = parseStatusFilter(req.query);

    const { photos, total } = await photosService.listAllEventPhotos(
      adminId,
      eventId,
      pagination,
      statusFilter
    );

    res.json({ data: paginatedResponse('photos', photos, pagination, total) });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/photos/:photoId/preview-url
 * Returns a presigned S3 URL for INLINE viewing (thumbnails, lightbox).
 * No Content-Disposition — the browser renders the image.
 */
export async function getPreviewUrl(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw unauthorized();
    const userId = BigInt(req.user.userId);
    const role = req.user.role;
    const photoId = parseBigIntParam(req.params.photoId, 'photoId');

    const result = await photosService.getPhotoPreviewUrl(userId, role, photoId);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/photos/:photoId/download-url
 * Returns a presigned S3 URL that forces the browser to DOWNLOAD the file
 * (Content-Disposition: attachment). Used by admin + team_member download
 * buttons.
 */
export async function getDownloadUrl(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw unauthorized();
    const userId = BigInt(req.user.userId);
    const role = req.user.role;
    const photoId = parseBigIntParam(req.params.photoId, 'photoId');

    const result = await photosService.getPhotoDownloadUrl(userId, role, photoId);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}