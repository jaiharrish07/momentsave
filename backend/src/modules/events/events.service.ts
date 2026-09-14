import { eq, and, desc, sql } from 'drizzle-orm';
import { db } from '../../db/client';
import { events, eventMembers, users } from '../../db/schema';
import { conflict, forbidden, notFound } from '../../utils/errors';
import type { Pagination } from '../../utils/pagination';
import type { CreateEventInput } from './events.schemas';

export type PublicEvent = {
  event_id: string;
  event_name: string;
  created_by: string;
  created_at: Date;
};

export type PublicEventMember = {
  user_id: string;
  name: string;
  email: string;
  role: 'team_member';
  joined_at: Date;
};

/**
 * Admin creates an event.
 * The authenticated user becomes created_by.
 */
export async function createEvent(
  adminId: bigint,
  input: CreateEventInput
): Promise<PublicEvent> {
  const [inserted] = await db
    .insert(events)
    .values({
      eventName: input.name,
      createdBy: adminId,
    })
    .returning({
      eventId: events.eventId,
      eventName: events.eventName,
      createdBy: events.createdBy,
      createdAt: events.createdAt,
    });

  if (!inserted) throw new Error('Insert returned no row');

  return toPublicEvent(inserted);
}

/**
 * List events visible to the requester.
 *
 * - Admin: events they created (events.created_by = adminId).
 * - Team member: events they are assigned to (via event_members).
 */
export async function listEventsForUser(
  userId: bigint,
  role: 'admin' | 'team_member',
  pagination: Pagination
): Promise<{ events: PublicEvent[]; total: number }> {
  if (role === 'admin') {
    return listAdminEvents(userId, pagination);
  }
  return listTeamMemberEvents(userId, pagination);
}

async function listAdminEvents(
  adminId: bigint,
  pagination: Pagination
): Promise<{ events: PublicEvent[]; total: number }> {
  const rows = await db
    .select({
      eventId: events.eventId,
      eventName: events.eventName,
      createdBy: events.createdBy,
      createdAt: events.createdAt,
    })
    .from(events)
    .where(eq(events.createdBy, adminId))
    .orderBy(desc(events.createdAt))
    .limit(pagination.limit)
    .offset(pagination.offset);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(events)
    .where(eq(events.createdBy, adminId));

  return {
    events: rows.map(toPublicEvent),
    total: count,
  };
}

async function listTeamMemberEvents(
  teamMemberId: bigint,
  pagination: Pagination
): Promise<{ events: PublicEvent[]; total: number }> {
  const rows = await db
    .select({
      eventId: events.eventId,
      eventName: events.eventName,
      createdBy: events.createdBy,
      createdAt: events.createdAt,
    })
    .from(events)
    .innerJoin(eventMembers, eq(eventMembers.eventId, events.eventId))
    .where(eq(eventMembers.userId, teamMemberId))
    .orderBy(desc(events.createdAt))
    .limit(pagination.limit)
    .offset(pagination.offset);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(events)
    .innerJoin(eventMembers, eq(eventMembers.eventId, events.eventId))
    .where(eq(eventMembers.userId, teamMemberId));

  return {
    events: rows.map(toPublicEvent),
    total: count,
  };
}

/**
 * Get a single event, authorized for the requester.
 * Returns null if the event doesn't exist OR the requester can't see it.
 * Controller converts null to 404 (hides the distinction).
 */
export async function getEventForUser(
  eventId: bigint,
  userId: bigint,
  role: 'admin' | 'team_member'
): Promise<PublicEvent | null> {
  if (role === 'admin') {
    const [row] = await db
      .select({
        eventId: events.eventId,
        eventName: events.eventName,
        createdBy: events.createdBy,
        createdAt: events.createdAt,
      })
      .from(events)
      .where(and(eq(events.eventId, eventId), eq(events.createdBy, userId)))
      .limit(1);

    return row ? toPublicEvent(row) : null;
  }

  const [row] = await db
    .select({
      eventId: events.eventId,
      eventName: events.eventName,
      createdBy: events.createdBy,
      createdAt: events.createdAt,
    })
    .from(events)
    .innerJoin(eventMembers, eq(eventMembers.eventId, events.eventId))
    .where(and(eq(events.eventId, eventId), eq(eventMembers.userId, userId)))
    .limit(1);

  return row ? toPublicEvent(row) : null;
}

/**
 * Admin adds a team member to an event.
 *
 * Multi-hop authorization:
 *   1. Admin must own the event  → else 404 (hides existence)
 *   2. Target user must exist AND have role team_member  → else 404
 *   3. Not already assigned  → else 409
 */
export async function addMemberToEvent(
  adminId: bigint,
  eventId: bigint,
  targetUserId: bigint
): Promise<{ event_id: string; user_id: string; joined_at: Date }> {
  // Verify admin owns the event.
  const [event] = await db
    .select({ eventId: events.eventId })
    .from(events)
    .where(and(eq(events.eventId, eventId), eq(events.createdBy, adminId)))
    .limit(1);

  if (!event) {
    throw notFound('Event not found');
  }

  // Verify target user exists and is a team_member.
  const [target] = await db
    .select({ userId: users.userId })
    .from(users)
    .where(and(eq(users.userId, targetUserId), eq(users.role, 'team_member')))
    .limit(1);

  if (!target) {
    throw notFound('Team member not found');
  }

  try {
    const [inserted] = await db
      .insert(eventMembers)
      .values({
        eventId,
        userId: targetUserId,
      })
      .returning({
        eventId: eventMembers.eventId,
        userId: eventMembers.userId,
        joinedAt: eventMembers.joinedAt,
      });

    if (!inserted) throw new Error('Insert returned no row');

    return {
      event_id: inserted.eventId.toString(),
      user_id: inserted.userId.toString(),
      joined_at: inserted.joinedAt,
    };
  } catch (err: unknown) {
    if (isPgUniqueViolation(err)) {
      throw conflict('ALREADY_ASSIGNED', 'Team member is already assigned to this event');
    }
    throw err;
  }
}

/**
 * List members of an event.
 * Access:
 *   - Admin who owns the event.
 *   - Team member assigned to the event.
 *   - Others → 404.
 */
export async function listEventMembers(
  eventId: bigint,
  userId: bigint,
  role: 'admin' | 'team_member'
): Promise<PublicEventMember[] | null> {
  // First, authorization: does the requester have access to this event?
  const event = await getEventForUser(eventId, userId, role);
  if (!event) return null;

  const rows = await db
    .select({
      userId: users.userId,
      name: users.name,
      email: users.email,
      role: users.role,
      joinedAt: eventMembers.joinedAt,
    })
    .from(eventMembers)
    .innerJoin(users, eq(users.userId, eventMembers.userId))
    .where(eq(eventMembers.eventId, eventId))
    .orderBy(desc(eventMembers.joinedAt));

  return rows.map((r) => ({
    user_id: r.userId.toString(),
    name: r.name,
    email: r.email,
    role: 'team_member' as const,
    joined_at: r.joinedAt,
  }));
}

function toPublicEvent(row: {
  eventId: bigint;
  eventName: string;
  createdBy: bigint;
  createdAt: Date;
}): PublicEvent {
  return {
    event_id: row.eventId.toString(),
    event_name: row.eventName,
    created_by: row.createdBy.toString(),
    created_at: row.createdAt,
  };
}

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
