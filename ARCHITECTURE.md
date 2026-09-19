# MomentSave — Architecture & Database

Full-stack photo sharing platform for events. Photographers upload photos to shared events; admins curate them into galleries; customers view them through a PIN-protected link — no account required.

---

## 1. System Architecture

### 1.1 Topology

```
┌─────────────────────────────┐
│  Browser                    │
│  (Admin / Team / Customer)  │
└──────────────┬──────────────┘
               │ HTTPS + cookie
               ▼
┌─────────────────────────────┐
│  Vercel Edge (Global CDN)   │
│  Next.js 16 · React Query   │
│  shadcn/ui · Tailwind        │
└──────────────┬──────────────┘
               │ HTTPS + cookie (credentials: include)
               ▼
┌─────────────────────────────┐
│  CloudFront                 │  ← HTTPS termination
│  (ap-south-1)               │
└──────────────┬──────────────┘
               │ HTTP (VPC)
               ▼
┌─────────────────────────────┐
│  Elastic Beanstalk          │
│  Node.js 22 + Express       │  ← single instance, behind Nginx
│  (ap-south-1)               │
└─┬───────────┬──────────┬────┘
  │           │          │
  ▼           ▼          ▼
┌────┐   ┌─────────┐   ┌────────────────┐
│RDS │   │ Upstash │   │  S3 Bucket     │
│PG16│   │  Redis  │   │  (private)     │
│SSL │   │  TLS    │   │  presigned URL │
└────┘   └─────────┘   └────────────────┘
                              ▲
                              │ browser PUTs/GETs bytes directly
                              │ (never through backend)
                              │
                           Browser
```

**Region:** every AWS service is in `ap-south-1` (Mumbai). Upstash Redis is region-anchored to the same. Only Vercel Edge is global.

### 1.2 Tech stack

| Layer                        | Technology                                                                 |
|------------------------------|----------------------------------------------------------------------------|
| **Frontend**                 | Next.js 16 (App Router), TypeScript, Tailwind CSS, shadcn/ui, React Query, `yet-another-react-lightbox` |
| **Backend**                  | Node.js 22, TypeScript, Express, Drizzle ORM, Zod validation               |
| **Database**                 | PostgreSQL 16 (RDS in production, local Postgres in dev)                   |
| **Session Store & Rate Limiting** | Redis (Upstash in production, Docker locally)                         |
| **Object Storage**           | AWS S3 (`ap-south-1`, private bucket, presigned URLs only)                 |
| **Testing**                  | Vitest + Supertest against a real test database                            |

### 1.3 Data-flow highlights

- **Photo bytes never traverse the backend.** Uploads: browser → S3 (via 5-minute presigned PUT URL, AWS Signature V4). Downloads: browser → S3 (via 1-hour presigned GET URL). The Node.js backend only signs URLs and stores metadata.
- **Two session namespaces.** Admin/team sessions live in `momentsave_session` cookie (7-day sliding). Customer PIN sessions live in `momentsave_gallery_session` cookie (2-hour sliding, bound to a specific `public_token`). They can never satisfy each other's checks.
- **Region-local writes.** RDS, S3 and EB are in the same VPC → single-digit-ms latency for the HEAD verification we do on upload confirm.

### 1.4 Upload flow (3 phases)

```
1. Client asks for URL      → backend INSERTs photo row (status=pending)
                              backend signs 5-min S3 PUT URL
                              backend returns {photo_id, upload_url}
2. Client PUTs bytes to S3  → S3 stores object (no backend involvement)
3. Client confirms upload   → backend HEADs S3 (verifies object exists + size)
                              backend UPDATEs row (status=uploaded)
```

Failure modes handled by design:

- Client PUT never happens → HEAD returns 404 → mark `status=failed`.
- Client uploaded a smaller/larger file than declared → size mismatch → mark `failed`.
- Client never confirms → cleanup job (setInterval every 15 min) deletes `pending` rows older than 1 hour + their S3 objects.

### 1.5 Customer flow

```
Preview (public):   GET /public/galleries/:publicToken       → title only
Verify PIN:         POST .../verify-pin  {pin}               → Set-Cookie: gallery_session
List photos:        GET .../photos (with cookie)             → session bound to publicToken
Download:           GET .../photos/:id/download              → presigned S3 GET URL
```

Every step returns **404 (not 403)** for unauthorized access — a customer with a session for gallery A gets identical responses whether gallery B is a draft, unpublished, or doesn't exist. No enumeration surface.

---

## 2. Database Design

Six tables in PostgreSQL 16. All primary keys are `BIGINT GENERATED ALWAYS AS IDENTITY`.

### 2.1 Entity relationships

```
       users ─────┬──── creates ────► events
                  │                      │
                  │                      │
                  ├──── joins ─────►  event_members ◄─── (M:N)
                  │                      │
                  │                      │
                  ├──── uploads ────► photos
                  │                      │
                  │                      │
                  └──── creates ────► galleries (one per event, UNIQUE event_id)
                                         │
                                         │
                                     gallery_photos ◄─── (M:N)
                                         │
                                         │
                                         └──── contains ────► photos
```

### 2.2 Schema

#### `users`
| Column | Type | Notes |
|---|---|---|
| `user_id` | `BIGINT` PK | identity |
| `name` | `TEXT` NOT NULL | |
| `email` | `TEXT` UNIQUE | |
| `password_hash` | `TEXT` | bcrypt, cost 12 |
| `role` | `TEXT` CHECK | `admin` \| `team_member` |
| `created_at` | `TIMESTAMPTZ` | default `NOW()` |

Single accounts table. Admins can self-register; team members are always created by an admin (no public sign-up). The role CHECK constraint is enforced at the DB level, not just in code.

#### `events`
| Column | Type | Notes |
|---|---|---|
| `event_id` | `BIGINT` PK | identity |
| `event_name` | `TEXT` | |
| `created_by` | `BIGINT` FK → `users.user_id` | `ON DELETE RESTRICT` |
| `created_at` | `TIMESTAMPTZ` | default `NOW()` |

One event has exactly one owning admin.

#### `event_members`
| Column | Type | Notes |
|---|---|---|
| `event_id` | `BIGINT` FK → `events.event_id` | `ON DELETE CASCADE` |
| `user_id` | `BIGINT` FK → `users.user_id` | `ON DELETE RESTRICT` |
| `joined_at` | `TIMESTAMPTZ` | default `NOW()` |

**Composite PK** `(event_id, user_id)` — prevents duplicate assignments. Cascades on event delete, restricts on user delete (a team member with historical assignments cannot be silently deleted).

#### `photos`
| Column | Type | Notes |
|---|---|---|
| `photo_id` | `BIGINT` PK | identity |
| `event_id` | `BIGINT` FK → `events.event_id` | `ON DELETE RESTRICT` |
| `uploaded_by` | `BIGINT` FK → `users.user_id` | `ON DELETE RESTRICT` |
| `filename` | `TEXT` | as provided by client |
| `s3_key` | `TEXT` | opaque, generated server-side, never returned |
| `file_size` | `BIGINT` CHECK `≥ 0` | bytes |
| `content_type` | `TEXT` | signed into presigned URL |
| `photo_status` | `TEXT` CHECK | `pending` \| `uploaded` \| `failed` |
| `created_at` | `TIMESTAMPTZ` | default `NOW()` |
| `updated_at` | `TIMESTAMPTZ` | default `NOW()` |

`s3_key` never leaves the server — customers get presigned URLs, not raw keys. `photo_status` tracks the three-phase upload lifecycle.

#### `galleries`
| Column | Type | Notes |
|---|---|---|
| `gallery_id` | `BIGINT` PK | identity |
| `event_id` | `BIGINT` FK, UNIQUE | one gallery per event |
| `title` | `TEXT` | |
| `pin_hash` | `TEXT` | bcrypt, cost 12 |
| `public_token` | `TEXT` UNIQUE | 128-bit URL-safe random |
| `status` | `TEXT` CHECK default `'draft'` | `draft` \| `published` |
| `published_at` | `TIMESTAMPTZ` NULL | |
| `expiry_date` | `TIMESTAMPTZ` NULL | |
| `created_by` | `BIGINT` FK | `ON DELETE RESTRICT` |
| `created_at` | `TIMESTAMPTZ` | default `NOW()` |

Constraints worth calling out:

- `UNIQUE(event_id)` — one gallery per event, enforced at DB level. No ambiguity about which gallery gets the PIN.
- `UNIQUE(public_token)` — the customer URL key; indexed for O(1) lookup.
- CHECK: `status='published'` implies `published_at IS NOT NULL`. Prevents the "published without a timestamp" corrupt state.

The plaintext PIN is only ever returned in the response to `create gallery` or `regenerate PIN`. After that, only `pin_hash` exists in the DB.

#### `gallery_photos`
| Column | Type | Notes |
|---|---|---|
| `gallery_id` | `BIGINT` FK | `ON DELETE CASCADE` |
| `photo_id` | `BIGINT` FK | `ON DELETE CASCADE` |
| `added_at` | `TIMESTAMPTZ` | default `NOW()` |

**Composite PK** `(gallery_id, photo_id)` — prevents duplicate additions (bulk add is idempotent). Both cascades on parent delete — removing a gallery association doesn't touch the underlying photo row or its S3 object.

### 2.3 Indexes

Beyond auto-created PK and UNIQUE indexes, six explicit btree indexes support hot query paths:

```sql
CREATE INDEX idx_events_created_by       ON events (created_by);        -- admin "my events"
CREATE INDEX idx_event_members_user_id   ON event_members (user_id);    -- team "my events" (PK indexes event_id only)
CREATE INDEX idx_galleries_created_by    ON galleries (created_by);
CREATE INDEX idx_photos_event_id         ON photos (event_id);          -- event photo listing
CREATE INDEX idx_photos_uploaded_by      ON photos (uploaded_by);       -- team "my uploads"
CREATE INDEX idx_gallery_photos_photo_id ON gallery_photos (photo_id);  -- reverse lookup (PK indexes gallery_id only)
```

Every FK column is either the leading column of a composite PK or has its own btree index. No unindexed FKs.

### 2.4 Design decisions

**Why one gallery per event.**
Enforced by `UNIQUE(event_id)`. Two galleries per event would create ambiguity: which gets the PIN? Which link? A single canonical gallery per event matches the intent ("this is the customer view of this event") and simplifies both the schema and the mental model.

**Why bcrypt-hash the 6-digit PIN.**
A 6-digit PIN has only 1M possible values. In plaintext, a stolen DB dump means every PIN is instantly recovered. With bcrypt cost 12 (~250ms per guess), offline attack against a single PIN takes ~3 days. Combined with online rate limiting (5 attempts / 15 min per IP + gallery), effectively unbreakable in practice.

**Why `RESTRICT` on entity FKs but `CASCADE` on join tables.**
Accidental deletion of a user or event should not silently drop dozens of dependent rows. `RESTRICT` forces the caller to explicitly reason about dependencies. Join tables are pure associations — cascading them is the right semantics (unassign a member when their event is deleted).

**Why 404 hides existence.**
When a team member requests event 5 (owned by someone else) vs event 999 (does not exist), both return `{"error":{"code":"NOT_FOUND","message":"Event not found"}}`. This prevents ID enumeration. Every service function checks ownership as part of the same query that fetches the row, so "not visible to you" and "does not exist" are indistinguishable from the outside.

**Why `s3_key` is server-generated.**
Client-provided keys would allow path traversal and object squatting attacks. The backend generates keys as `events/{event_id}/photos/{random-token}.{ext}`. The key is never returned to any client — only the presigned URL.

**Why sequence gaps are intentional.**
Postgres `IDENTITY` sequences advance on INSERT attempts even when the transaction rolls back. So gallery IDs might go `1, 3` (event 2's gallery creation may have failed at some point). This is by design — sequences are optimized for concurrent inserts, not gap-free IDs.

---

## 3. Security posture summary

| Concern | Mechanism |
|---|---|
| Password / PIN storage | bcrypt cost 12 |
| Session tokens | 32 bytes from `crypto.randomBytes`, stored in Redis |
| Cookies | `HttpOnly` + `Secure` + `SameSite=Strict` in prod |
| Login brute force | 5 failed / 15 min per (IP + email), Redis-backed |
| PIN brute force | 5 attempts / 15 min per (IP + public_token) |
| PIN rotation | Regenerating PIN also invalidates every gallery session bound to that public_token |
| S3 bucket | Block All Public Access ON; IAM policy scoped to bucket ARN |
| Presigned URLs | 5-min upload, 1-hour download, content-type signed in |
| Enumeration | Uniform 404 for missing OR forbidden |
| CORS | Explicit allowlist + Vercel preview URL regex, `credentials: true` |
| Cross-gallery hijack | Gallery session cookie is bound to a specific `public_token` |
| Transport | HTTPS end-to-end (CloudFront, RDS SSL, Redis TLS, S3 HTTPS) |

---

**Live app:** https://momentsave.vercel.app
**Repo:** https://github.com/jaiharrish07/momentsave