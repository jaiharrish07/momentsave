import { Request, Response, NextFunction } from 'express';
import { unauthorized, forbidden } from '../utils/errors';

/**
 * Requires a valid session. Rejects with 401 if req.user is missing.
 * Use before requireAdmin/requireTeamMember when any authenticated user is fine.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return next(unauthorized());
  next();
}

/**
 * Requires an authenticated admin.
 * Returns 401 if not authenticated, 403 if authenticated but wrong role.
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return next(unauthorized());
  if (req.user.role !== 'admin') return next(forbidden('Admin access required'));
  next();
}

/**
 * Requires an authenticated team member.
 */
export function requireTeamMember(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return next(unauthorized());
  if (req.user.role !== 'team_member') return next(forbidden('Team member access required'));
  next();
}
