import { Router } from 'express';
import { validate } from '../../middleware/validate';
import { requireAuth } from '../../middleware/rbac';
import { registerAdminSchema, loginSchema } from './auth.schemas';
import * as authController from './auth.controller';

export const authRouter = Router();

authRouter.post('/register', validate(registerAdminSchema), authController.register);
authRouter.post('/login', validate(loginSchema), authController.login);
authRouter.post('/logout', requireAuth, authController.logout);
authRouter.get('/me', requireAuth, authController.whoami);
