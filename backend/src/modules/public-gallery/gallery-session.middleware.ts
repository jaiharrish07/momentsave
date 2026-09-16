import { Request, Response, NextFunction } from 'express';
import { env } from '../../config/env';
import { unauthorized, forbidden } from '../../utils/errors';
import { readGallerySession } from './gallery-session';

/**
 * Require a gallery session cookie AND verify it was issued for
 * the specific public_token in the URL. This is the customer-side
 * equivalent of requireAdmin — proves the client passed the PIN.
 *
 * Design: a session for gallery A CANNOT view gallery B. This prevents
 * a common attack where a customer authorized on one gallery tries
 * to enumerate others by swapping the URL token.
 */
export async function requireGallerySession(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.[env.GALLERY_SESSION_COOKIE_NAME] as string | undefined;
    if (!token) return next(unauthorized('Gallery session required'));

    const session = await readGallerySession(token);
    if (!session) return next(unauthorized('Gallery session expired'));

    const urlToken = req.params.publicToken;
    if (session.publicToken !== urlToken) {
      // Cookie is for a different gallery. Not usable here.
      return next(forbidden('Session not valid for this gallery'));
    }

    next();
  } catch (err) {
    next(err);
  }
}
