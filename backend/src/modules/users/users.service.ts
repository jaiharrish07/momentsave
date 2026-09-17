import { eq, and, or, ilike, sql, desc } from 'drizzle-orm';
import { db } from '../../db/client';
import { users } from '../../db/schema';
import { hashSecret } from '../../utils/crypto';
import { conflict, notFound } from '../../utils/errors';
import type { PublicUser } from '../auth/auth.service';
import type { CreateTeamMemberInput } from './users.schemas';

/**
 * Admin creates a team member account.
 *
 * The admin (session user) sets the initial password AND becomes the owner
 * of the team member (users.created_by_admin_id). Only that admin can list,
 * reset the password of, or assign this team member to events.
 */
export async function createTeamMember(
  adminId: bigint,
  input: CreateTeamMemberInput
): Promise<PublicUser> {
  const passwordHash = await hashSecret(input.password);

  try {
    const [inserted] = await db
      .insert(users)
      .values({
        name: input.name,
        email: input.email,
        passwordHash,
        role: 'team_member',
        createdByAdminId: adminId,
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
 * List team members owned by this admin.
 *
 * Optional `search` filters by name or email (case-insensitive substring).
 * Trimmed empty search is treated as "no filter".
 */
export async function listMyTeamMembers(
  adminId: bigint,
  search?: string
): Promise<PublicUser[]> {
  const trimmed = search?.trim();
  const filter =
    trimmed && trimmed.length > 0
      ? and(
          eq(users.createdByAdminId, adminId),
          eq(users.role, 'team_member'),
          or(ilike(users.name, `%${trimmed}%`), ilike(users.email, `%${trimmed}%`))
        )
      : and(eq(users.createdByAdminId, adminId), eq(users.role, 'team_member'));

  const rows = await db
    .select({
      userId: users.userId,
      name: users.name,
      email: users.email,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(filter)
    .orderBy(desc(users.createdAt));

  return rows.map((r) => ({
    user_id: r.userId.toString(),
    name: r.name,
    email: r.email,
    role: 'team_member' as const,
    created_at: r.createdAt,
  }));
}

/**
 * Admin resets a team member's password.
 *
 * Ownership check:
 *   - Target user must have role = 'team_member'.
 *   - Target user must have been created by THIS admin.
 *   - Otherwise 404 (hide the distinction between "doesn't exist" and
 *     "belongs to someone else" — no cross-admin enumeration).
 *
 * Note: This does NOT invalidate the target's existing sessions.
 * Deferred as known limitation.
 */
export async function resetTeamMemberPassword(
  adminId: bigint,
  teamMemberId: bigint,
  newPassword: string
): Promise<void> {
  const passwordHash = await hashSecret(newPassword);

  const result = await db
    .update(users)
    .set({ passwordHash })
    .where(
      and(
        eq(users.userId, teamMemberId),
        eq(users.role, 'team_member'),
        eq(users.createdByAdminId, adminId)
      )
    )
    .returning({ userId: users.userId });

  if (result.length === 0) {
    throw notFound('Team member not found');
  }
}

/**
 * Verify a team member is owned by this admin.
 * Used from other modules (e.g. events) to reject cross-admin assignment.
 * Returns true iff the target exists, is a team_member, and belongs to this admin.
 */
export async function isTeamMemberOwnedByAdmin(
  adminId: bigint,
  teamMemberId: bigint
): Promise<boolean> {
  const [row] = await db
    .select({ userId: users.userId })
    .from(users)
    .where(
      and(
        eq(users.userId, teamMemberId),
        eq(users.role, 'team_member'),
        eq(users.createdByAdminId, adminId)
      )
    )
    .limit(1);
  return !!row;
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
