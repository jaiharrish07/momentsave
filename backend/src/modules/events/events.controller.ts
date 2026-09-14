import { Request, Response, NextFunction } from 'express';
import { unauthorized } from '../../utils/errors';
import { parseBigIntParam } from '../../utils/params';
import { parsePagination, paginatedResponse } from '../../utils/pagination';
import * as eventsService from './events.service';
import { notFound } from '../../utils/errors';

/**
 * POST /api/events
 * Admin creates an event.
 */
export async function createEvent(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw unauthorized();
    const adminId = BigInt(req.user.userId);

    const event = await eventsService.createEvent(adminId, req.body);
    res.status(201).json({ data: { event } });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/events
 * Role-aware list.
 */
export async function listEvents(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw unauthorized();
    const userId = BigInt(req.user.userId);
    const role = req.user.role;
    const pagination = parsePagination(req.query);

    const { events, total } = await eventsService.listEventsForUser(userId, role, pagination);

    res.json({
      data: paginatedResponse('events', events, pagination, total),
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/events/:eventId
 * Role-aware detail. 404 if not visible to requester.
 */
export async function getEvent(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw unauthorized();
    const userId = BigInt(req.user.userId);
    const role = req.user.role;
    const eventId = parseBigIntParam(req.params.eventId, 'eventId');

    const event = await eventsService.getEventForUser(eventId, userId, role);
    if (!event) throw notFound('Event not found');

    res.json({ data: { event } });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/events/:eventId/members
 * Admin adds a team member to an event they own.
 */
export async function addMember(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw unauthorized();
    const adminId = BigInt(req.user.userId);
    const eventId = parseBigIntParam(req.params.eventId, 'eventId');
    const targetUserId = BigInt(req.body.team_member_id);

    const membership = await eventsService.addMemberToEvent(adminId, eventId, targetUserId);

    res.status(201).json({ data: { membership } });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/events/:eventId/members
 * Admin (owner) or assigned team_member can list.
 */
export async function listMembers(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw unauthorized();
    const userId = BigInt(req.user.userId);
    const role = req.user.role;
    const eventId = parseBigIntParam(req.params.eventId, 'eventId');

    const members = await eventsService.listEventMembers(eventId, userId, role);
    if (!members) throw notFound('Event not found');

    res.json({ data: { members } });
  } catch (err) {
    next(err);
  }
}
