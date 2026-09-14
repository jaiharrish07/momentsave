import { z } from 'zod';

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email('Invalid email address')
  .max(254, 'Email too long');

const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password too long');

const nameSchema = z
  .string()
  .trim()
  .min(1, 'Name is required')
  .max(100, 'Name too long');

/**
 * POST /api/team-members
 * Admin creates a team member account.
 */
export const createTeamMemberSchema = z.object({
  body: z.object({
    name: nameSchema,
    email: emailSchema,
    password: passwordSchema,
  }),
});

/**
 * POST /api/team-members/:teamMemberId/reset-password
 * Admin resets a team member's password.
 */
export const resetTeamMemberPasswordSchema = z.object({
  body: z.object({
    new_password: passwordSchema,
  }),
  params: z.object({
    teamMemberId: z.string().regex(/^\d+$/, 'teamMemberId must be a positive integer'),
  }),
});

export type CreateTeamMemberInput = z.infer<typeof createTeamMemberSchema>['body'];
export type ResetTeamMemberPasswordInput = z.infer<typeof resetTeamMemberPasswordSchema>['body'];
