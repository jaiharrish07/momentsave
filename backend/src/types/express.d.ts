/**
 * Type augmentation for Express Request. Adds our custom fields so
 * req.user is properly typed everywhere.
 */

declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        role: 'admin' | 'team_member';
        sessionToken: string;
      };
    }
  }
}

export {};
