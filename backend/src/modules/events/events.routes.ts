import { Router } from 'express';
import { validate } from '../../middleware/validate';
import { requireAuth, requireAdmin } from '../../middleware/rbac';
import {
  createEventSchema,
  addMemberSchema,
  eventIdParamSchema,
} from './events.schemas';
import * as eventsController from './events.controller';

export const eventsRouter = Router();

// Create event — admin only.
eventsRouter.post(
  '/',
  requireAdmin,
  validate(createEventSchema),
  eventsController.createEvent
);

// List events — any authenticated user, role-aware inside the service.
eventsRouter.get('/', requireAuth, eventsController.listEvents);

// Get one event — any authenticated user, service filters by role.
eventsRouter.get(
  '/:eventId',
  requireAuth,
  validate(eventIdParamSchema),
  eventsController.getEvent
);

// Add member — admin only.
eventsRouter.post(
  '/:eventId/members',
  requireAdmin,
  validate(addMemberSchema),
  eventsController.addMember
);

// List members — any authenticated user with access to the event.
eventsRouter.get(
  '/:eventId/members',
  requireAuth,
  validate(eventIdParamSchema),
  eventsController.listMembers
);
