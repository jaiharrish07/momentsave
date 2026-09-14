import { z } from 'zod';

const eventNameSchema = z
  .string()
  .trim()
  .min(1, 'Event name is required')
  .max(200, 'Event name too long');

/**
 * POST /api/events
 * Admin creates an event.
 * The requester (from session) becomes created_by.
 */
export const createEventSchema = z.object({
  body: z.object({
    name: eventNameSchema,
  }),
});

/**
 * POST /api/events/:eventId/members
 * Admin adds a team member to an event they own.
 */
export const addMemberSchema = z.object({
  body: z.object({
    team_member_id: z
      .union([z.string(), z.number()])
      .transform((v) => String(v))
      .refine((v) => /^\d+$/.test(v), 'team_member_id must be a positive integer'),
  }),
  params: z.object({
    eventId: z.string().regex(/^\d+$/, 'eventId must be a positive integer'),
  }),
});

/**
 * GET /api/events/:eventId
 * Path param validation only. Any authenticated user.
 */
export const eventIdParamSchema = z.object({
  params: z.object({
    eventId: z.string().regex(/^\d+$/, 'eventId must be a positive integer'),
  }),
});

export type CreateEventInput = z.infer<typeof createEventSchema>['body'];
export type AddMemberInput = z.infer<typeof addMemberSchema>['body'];
