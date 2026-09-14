import { Request, Response, NextFunction } from 'express';
import { env } from '../../config/env';
import { unauthorized } from '../../utils/errors';
import * as authService from './auth.service';

/**
 * Cookie options shared across auth cookie writes.
 *
 * httpOnly:  JavaScript on the page cant read the cookie (XSS defense)
 * secure:    only sent over HTTPS in production. In dev over http, we relax it.
 * sameSite:  strict in prod (CSRF defense). lax in dev to keep API calls working.
 * maxAge:    7 days — matches session TTL in Redis.
 */
function cookieOptions() {
  const isProd = env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'strict' as const : 'lax' as const,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
    path: '/',
  };
}

/**
 * POST /api/auth/register
 * Public endpoint. Creates an admin, logs them in, returns the user.
 */
export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const { user, sessionToken } = await authService.registerAdmin(req.body);
    res.cookie(env.SESSION_COOKIE_NAME, sessionToken, cookieOptions());
    res.status(201).json({
      data: {
        user,
        message: 'Admin registered successfully',
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/auth/login
 * Public endpoint. Verifies credentials, creates a session.
 */
export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const { user, sessionToken } = await authService.login(req.body);
    res.cookie(env.SESSION_COOKIE_NAME, sessionToken, cookieOptions());
    res.status(200).json({
      data: {
        user,
        message: 'Login successful',
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/auth/logout
 * Requires an authenticated user. Deletes their session and clears the cookie.
 */
export async function logout(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      throw unauthorized();
    }
    await authService.logout(req.user.sessionToken);
    res.clearCookie(env.SESSION_COOKIE_NAME, { path: '/' });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/auth/me
 * Returns the currently authenticated user, from req.user.
 * Requires an authenticated user.
 */
export async function whoami(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      throw unauthorized();
    }
    res.json({
      data: {
        user: {
          user_id: req.user.userId,
          role: req.user.role,
        },
      },
    });
  } catch (err) {
    next(err);
  }
}
