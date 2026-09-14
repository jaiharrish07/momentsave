import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';
import { readSession } from '../modules/auth/session';

/**
 * Reads the session cookie, looks it up in Redis, and attaches req.user
 * if valid. Does NOT reject unauthenticated requests — that is requireAuth.
 *
 * This middleware is registered globally so req.user is available on every
 * request. Endpoints choose whether to require it via RBAC middleware.
 */
export async function attachUser(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.[env.SESSION_COOKIE_NAME] as string | undefined;
    if (!token) {
      return next();
    }

    const session = await readSession(token);
    if (!session) {
      return next();
    }

    req.user = {
      userId: session.userId,
      role: session.role,
      sessionToken: token,
    };
    next();
  } catch (err) {
    // Redis down, corrupted data, etc. — do NOT crash the app.
    // Log and continue without a user; RBAC will reject if auth required.
    next(err);
  }
}
