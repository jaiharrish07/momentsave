import { badRequest } from './errors';

/**
 * Parse a URL path parameter as a BigInt.
 * Throws a well-formed 400 if the param is missing or not numeric.
 *
 * Used for all BIGINT primary key params (eventId, photoId, galleryId, etc.).
 * Zod already validates the shape at the middleware layer, so this is
 * belt-and-suspenders — but it satisfies TypeScript without unsafe casts.
 */
export function parseBigIntParam(value: string | string[] | undefined, name: string): bigint {
  if (typeof value !== 'string' || value.length === 0) {
    throw badRequest('INVALID_PARAM', `${name} is required`);
  }
  if (!/^\d+$/.test(value)) {
    throw badRequest('INVALID_PARAM', `${name} must be a positive integer`);
  }
  return BigInt(value);
}
