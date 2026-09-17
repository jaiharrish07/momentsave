import { Router } from 'express';
import { validate } from '../../middleware/validate';
import { requireAdmin } from '../../middleware/rbac';
import {
  createTeamMemberSchema,
  resetTeamMemberPasswordSchema,
} from './users.schemas';
import * as usersController from './users.controller';

export const usersRouter = Router();

usersRouter.get(
  '/',
  requireAdmin,
  usersController.listTeamMembers
);

usersRouter.post(
  '/',
  requireAdmin,
  validate(createTeamMemberSchema),
  usersController.createTeamMember
);

usersRouter.post(
  '/:teamMemberId/reset-password',
  requireAdmin,
  validate(resetTeamMemberPasswordSchema),
  usersController.resetTeamMemberPassword
);
