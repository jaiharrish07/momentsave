import { Router } from 'express';
import { validate } from '../../middleware/validate';
import { requireAuth, requireAdmin } from '../../middleware/rbac';
import {
  createEventSchema,
  addMemberSchema,
  eventIdParamSchema,
} from './events.schemas';
import * as eventsController from './events.controller';
import { eventPhotosRouter } from '../photos/photos.routes';
import { eventGalleryRouter } from '../galleries/galleries.routes';

export const eventsRouter = Router();

eventsRouter.post(
  '/',
  requireAdmin,
  validate(createEventSchema),
  eventsController.createEvent
);

eventsRouter.get('/', requireAuth, eventsController.listEvents);

eventsRouter.get(
  '/:eventId',
  requireAuth,
  validate(eventIdParamSchema),
  eventsController.getEvent
);

eventsRouter.post(
  '/:eventId/members',
  requireAdmin,
  validate(addMemberSchema),
  eventsController.addMember
);

eventsRouter.get(
  '/:eventId/members',
  requireAuth,
  validate(eventIdParamSchema),
  eventsController.listMembers
);

// Nested photo router: /api/events/:eventId/photos/...
eventsRouter.use('/:eventId/photos', eventPhotosRouter);

// Nested gallery creation: POST /api/events/:eventId/gallery
eventsRouter.use('/:eventId/gallery', eventGalleryRouter);
