import { Router } from 'express';
import { validate } from '../../middleware/validate';
import { requireAuth } from '../../middleware/rbac';
import { loginRateLimiter } from '../../middleware/rateLimit';
import { registerAdminSchema, loginSchema } from './auth.schemas';
import * as authController from './auth.controller';

export const authRouter = Router();

authRouter.post('/register', validate(registerAdminSchema), authController.register);
authRouter.post('/login', loginRateLimiter, validate(loginSchema), authController.login);
authRouter.post('/logout', requireAuth, authController.logout);
authRouter.get('/me', requireAuth, authController.whoami);
