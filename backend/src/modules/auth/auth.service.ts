import { eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { users } from '../../db/schema';
import { hashSecret, verifySecret } from '../../utils/crypto';
import { badRequest, conflict, unauthorized } from '../../utils/errors';
import { createSession, deleteSession } from './session';
import type { RegisterAdminInput, LoginInput } from './auth.schemas';

/**
 * The public shape of a user, safe to return in API responses.
 * NEVER includes password_hash.
 */
export type PublicUser = {
  user_id: string;
  name: string;
  email: string;
  role: 'admin' | 'team_member';
  created_at: Date;
};

/**
 * Register a new admin.
 *
 * - Hashes the password with bcrypt cost 12.
 * - Inserts row with role='admin'.
 * - Returns the created public user AND a fresh session token.
 *
 * The controller sets the session cookie from the returned token.
 */
export async function registerAdmin(input: RegisterAdminInput): Promise<{
  user: PublicUser;
  sessionToken: string;
}> {
  const passwordHash = await hashSecret(input.password);

  try {
    const [inserted] = await db
      .insert(users)
      .values({
        name: input.name,
        email: input.email,
        passwordHash,
        role: 'admin',
      })
      .returning({
        userId: users.userId,
        name: users.name,
        email: users.email,
        role: users.role,
        createdAt: users.createdAt,
      });

    if (!inserted) {
      throw new Error('Insert returned no row — should not happen');
    }

    const sessionToken = await createSession({
      userId: inserted.userId.toString(),
      role: 'admin',
    });

    return {
      user: toPublicUser(inserted),
      sessionToken,
    };
  } catch (err: unknown) {
    // Unique violation on email — Postgres error code 23505.
    if (isPgUniqueViolation(err)) {
      throw conflict('EMAIL_EXISTS', 'An account with this email already exists');
    }
    throw err;
  }
}

/**
 * Login by email + password.
 *
 * On failure — user not found OR wrong password — return the SAME error.
 * This prevents email enumeration attacks.
 */
export async function login(input: LoginInput): Promise<{
  user: PublicUser;
  sessionToken: string;
}> {
  const [row] = await db
    .select()
    .from(users)
    .where(eq(users.email, input.email))
    .limit(1);

  if (!row) {
    throw unauthorized('Invalid email or password');
  }

  const passwordOk = await verifySecret(input.password, row.passwordHash);
  if (!passwordOk) {
    throw unauthorized('Invalid email or password');
  }

  const role = row.role as 'admin' | 'team_member';

  const sessionToken = await createSession({
    userId: row.userId.toString(),
    role,
  });

  return {
    user: toPublicUser(row),
    sessionToken,
  };
}

/**
 * Logout — destroy the session in Redis.
 * Idempotent: safe to call even if token is already invalid.
 */
export async function logout(sessionToken: string): Promise<void> {
  await deleteSession(sessionToken);
}

/**
 * Convert a raw DB user row into the public API shape.
 * BIGINT userId becomes string (JSON-safe).
 */
function toPublicUser(row: {
  userId: bigint;
  name: string;
  email: string;
  role: string;
  createdAt: Date;
}): PublicUser {
  return {
    user_id: row.userId.toString(),
    name: row.name,
    email: row.email,
    role: row.role as 'admin' | 'team_member',
    created_at: row.createdAt,
  };
}

/**
 * Postgres duplicate-key error detector.
 * The pg driver exposes err.code as a string for PostgreSQL error codes.
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

