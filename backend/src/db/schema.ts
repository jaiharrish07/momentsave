import {
  pgTable,
  bigint,
  text,
  timestamp,
  check,
  primaryKey,
  index,
  uniqueIndex,
  foreignKey,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

/**
 * users
 * Both admins and team members. Discriminated by `role`.
 *
 * `createdByAdminId` scopes team members to the admin who created them.
 * NULL for admins (self-registered). Enforced non-null for team_member rows
 * via a CHECK constraint below.
 */
export const users = pgTable(
  'users',
  {
    userId: bigint('user_id', { mode: 'bigint' })
      .generatedAlwaysAsIdentity()
      .primaryKey(),
    name: text('name').notNull(),
    email: text('email').notNull().unique(),
    passwordHash: text('password_hash').notNull(),
    role: text('role').notNull(),
    createdByAdminId: bigint('created_by_admin_id', { mode: 'bigint' }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    roleCheck: check(
      'users_role_check',
      sql`${table.role} IN ('admin', 'team_member')`
    ),
    createdBySelfFk: foreignKey({
      columns: [table.createdByAdminId],
      foreignColumns: [table.userId],
      name: 'users_created_by_admin_id_fk',
    }).onDelete('restrict'),
    createdByAdminIdx: index('idx_users_created_by_admin_id').on(
      table.createdByAdminId
    ),
  })
);

/**
 * events
 * Owned by the admin who created it (created_by FK).
 */
export const events = pgTable(
  'events',
  {
    eventId: bigint('event_id', { mode: 'bigint' })
      .generatedAlwaysAsIdentity()
      .primaryKey(),
    eventName: text('event_name').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdBy: bigint('created_by', { mode: 'bigint' })
      .notNull()
      .references(() => users.userId, { onDelete: 'restrict' }),
  },
  (table) => ({
    createdByIdx: index('idx_events_created_by').on(table.createdBy),
  })
);

/**
 * event_members
 * Join table: which team members are assigned to which events.
 * Composite primary key prevents duplicate assignments.
 */
export const eventMembers = pgTable(
  'event_members',
  {
    eventId: bigint('event_id', { mode: 'bigint' })
      .notNull()
      .references(() => events.eventId, { onDelete: 'cascade' }),
    userId: bigint('user_id', { mode: 'bigint' })
      .notNull()
      .references(() => users.userId, { onDelete: 'restrict' }),
    joinedAt: timestamp('joined_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.eventId, table.userId] }),
    userIdx: index('idx_event_members_user_id').on(table.userId),
  })
);

/**
 * galleries
 * One gallery per event (event_id UNIQUE).
 * PIN stored as bcrypt hash, plaintext returned only at create/regenerate time.
 * status/published_at consistency enforced by CHECK.
 */
export const galleries = pgTable(
  'galleries',
  {
    galleryId: bigint('gallery_id', { mode: 'bigint' })
      .generatedAlwaysAsIdentity()
      .primaryKey(),
    eventId: bigint('event_id', { mode: 'bigint' })
      .notNull()
      .unique()
      .references(() => events.eventId, { onDelete: 'restrict' }),
    title: text('title').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiryDate: timestamp('expiry_date', { withTimezone: true }),
    pinHash: text('pin_hash').notNull(),
    publicToken: text('public_token').notNull().unique(),
    createdBy: bigint('created_by', { mode: 'bigint' })
      .notNull()
      .references(() => users.userId, { onDelete: 'restrict' }),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    status: text('status').notNull().default('draft'),
  },
  (table) => ({
    statusCheck: check(
      'galleries_status_check',
      sql`${table.status} IN ('draft', 'published')`
    ),
    publishedConsistencyCheck: check(
      'galleries_published_consistency_check',
      sql`(${table.status} = 'published' AND ${table.publishedAt} IS NOT NULL) OR (${table.status} = 'draft')`
    ),
    createdByIdx: index('idx_galleries_created_by').on(table.createdBy),
  })
);

/**
 * photos
 * event_id and uploaded_by are RESTRICT — we do not hard-delete users or events.
 * photo_status: pending | uploaded | failed.
 * s3_key is internal; never returned in public responses.
 */
export const photos = pgTable(
  'photos',
  {
    photoId: bigint('photo_id', { mode: 'bigint' })
      .generatedAlwaysAsIdentity()
      .primaryKey(),
    eventId: bigint('event_id', { mode: 'bigint' })
      .notNull()
      .references(() => events.eventId, { onDelete: 'restrict' }),
    uploadedBy: bigint('uploaded_by', { mode: 'bigint' })
      .notNull()
      .references(() => users.userId, { onDelete: 'restrict' }),
    filename: text('filename').notNull(),
    s3Key: text('s3_key').notNull(),
    fileSize: bigint('file_size', { mode: 'bigint' }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    photoStatus: text('photo_status').notNull(),
    contentType: text('content_type').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    fileSizeCheck: check(
      'photos_file_size_check',
      sql`${table.fileSize} >= 0`
    ),
    statusCheck: check(
      'photos_status_check',
      sql`${table.photoStatus} IN ('pending', 'uploaded', 'failed')`
    ),
    eventIdx: index('idx_photos_event_id').on(table.eventId),
    uploadedByIdx: index('idx_photos_uploaded_by').on(table.uploadedBy),
  })
);

/**
 * gallery_photos
 * Join table: which photos are in which galleries.
 * CASCADE on both sides — deleting a gallery or photo removes memberships.
 */
export const galleryPhotos = pgTable(
  'gallery_photos',
  {
    galleryId: bigint('gallery_id', { mode: 'bigint' })
      .notNull()
      .references(() => galleries.galleryId, { onDelete: 'cascade' }),
    photoId: bigint('photo_id', { mode: 'bigint' })
      .notNull()
      .references(() => photos.photoId, { onDelete: 'cascade' }),
    addedAt: timestamp('added_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.galleryId, table.photoId] }),
    photoIdx: index('idx_gallery_photos_photo_id').on(table.photoId),
  })
);
