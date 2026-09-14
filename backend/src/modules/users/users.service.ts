import { eq, and } from 'drizzle-orm';
import { db } from '../../db/client';
import { users } from '../../db/schema';
import { hashSecret } from '../../utils/crypto';
import { conflict, notFound } from '../../utils/errors';
import type { PublicUser } from '../auth/auth.service';
import type { CreateTeamMemberInput } from './users.schemas';

/**
 * Admin creates a team member account.
 *
 * The admin (session user) sets the initial password. The team member later
 * signs in with that password. Password reset flow is admin-initiated
 * (see resetTeamMemberPassword) — no self-service email reset in scope.
 */
export async function createTeamMember(input: CreateTeamMemberInput): Promise<PublicUser> {
  const passwordHash = await hashSecret(input.password);

  try {
    const [inserted] = await db
      .insert(users)
      .values({
        name: input.name,
        email: input.email,
        passwordHash,
        role: 'team_member',
      })
      .returning({
        userId: users.userId,
        name: users.name,
        email: users.email,
        role: users.role,
        createdAt: users.createdAt,
      });

    if (!inserted) throw new Error('Insert returned no row');

    return {
      user_id: inserted.userId.toString(),
      name: inserted.name,
      email: inserted.email,
      role: 'team_member',
      created_at: inserted.createdAt,
    };
  } catch (err: unknown) {
    if (isPgUniqueViolation(err)) {
      throw conflict('EMAIL_EXISTS', 'An account with this email already exists');
    }
    throw err;
  }
}

/**
 * Admin resets a team member's password.
 *
 * Ownership check:
 *   - Target user must have role = 'team_member'.
 *   - Admins cannot reset other admins' passwords via this endpoint.
 *   - If the target doesnt exist OR is not a team_member, we return 404
 *     (hide the distinction — no admin-role enumeration).
 *
 * Note: This does NOT invalidate the target's existing sessions.
 * If we wanted to force-log-out on reset, we'd iterate Redis for their
 * sessions and delete them. Deferred as known limitation.
 */
export async function resetTeamMemberPassword(
  teamMemberId: bigint,
  newPassword: string
): Promise<void> {
  const passwordHash = await hashSecret(newPassword);

  const result = await db
    .update(users)
    .set({ passwordHash })
    .where(and(eq(users.userId, teamMemberId), eq(users.role, 'team_member')))
    .returning({ userId: users.userId });

  if (result.length === 0) {
    throw notFound('Team member not found');
  }
}

/**
 * Drizzle wraps pg errors — the real Postgres code is on err.cause.
 * 23505 = unique_violation.
 */
function isPgUniqueViolation(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;
  const asObj = err as { code?: unknown; cause?: unknown };
  if (asObj.code === '23505') return true;
  if (typeof asObj.cause === 'object' && asObj.cause !== null) {
    const cause = asObj.cause as { code?: unknown };
    if (cause.code === '23505') return true;
  }
  return false;
}
