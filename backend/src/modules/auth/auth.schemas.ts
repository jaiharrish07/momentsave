import { z } from 'zod';

/**
 * Zod schemas for auth endpoints. These serve two purposes:
 *   1. Runtime validation of request bodies (in the validate middleware).
 *   2. TypeScript types via z.infer, so the controller gets a typed body.
 */

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

export const registerAdminSchema = z.object({
  body: z.object({
    name: nameSchema,
    email: emailSchema,
    password: passwordSchema,
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email: emailSchema,
    password: z.string().min(1, 'Password is required'),
  }),
});

export type RegisterAdminInput = z.infer<typeof registerAdminSchema>['body'];
export type LoginInput = z.infer<typeof loginSchema>['body'];
