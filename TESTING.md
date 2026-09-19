# Testing

53 tests across 4 files covering the four security-critical areas the challenge asks for.

---

## Run the tests

```powershell
cd backend

# One-time setup
psql -U postgres -c "CREATE DATABASE momentsave_test;"

# Ensure Redis is running
docker start momentsave-redis

# Run all tests
npm test
```

Runtime: ~80 seconds.

Expected output:

Test Files 4 passed (4)
Tests 53 passed (53)

---

## Coverage by area

The challenge specifies four required test areas. Here's how each is covered:

### 1. Authentication and Authorization (`tests/auth.test.ts`)

14 tests.

**Registration:**
- Registers a new admin and sets session cookie with HttpOnly flag
- Rejects duplicate email with 409
- Rejects invalid email format with 400
- Rejects password shorter than 8 chars with 400

**Login:**
- Logs in with correct credentials
- Wrong password returns 401 with uniform "invalid" message
- Nonexistent email returns 401 with the same uniform message (enumeration protection)

**Session middleware (whoami):**
- Returns user info with valid session cookie
- Returns 401 without a cookie
- Returns 401 with an invalid cookie

**Logout:**
- Clears the session so subsequent requests are unauthenticated

**RBAC:**
- Team member cannot create an event
- Team member cannot create another team member
- Admin cannot use team-member-only endpoints (upload photo)
- Reset-password on an admin's user_id returns 404 (hides admin existence)

**Rate limiting:**
- Blocks after 5 failed login attempts with 429
- A different email from the same IP is unaffected

### 2. Photo access controls (`tests/photos.test.ts`)

12 tests.

**Upload URL generation:**
- Assigned team member gets a presigned URL
- Unassigned team member gets 404 (hides existence)
- Admin cannot generate upload URL (403 — team-only)
- Invalid content_type rejected with 400
- File exceeding max size rejected with 400

**Photo listing:**
- Team member sees only their own uploads via `/photos/mine`
- Admin sees all photos in their event via `/photos`

**Preview URL access:**
- Team member gets preview URL for photo in their event
- Team member cannot preview photo from event they don't belong to (404)
- Admin cannot preview photo from another admin's event (404)
- 401 without authentication

### 3. Gallery publishing workflows (`tests/galleries.test.ts`)

14 tests.

**Creation:**
- Admin creates gallery with auto-generated 6-digit PIN shown once
- Prevents second gallery for the same event (409)
- Team member cannot create gallery (403)
- Subsequent GET never includes the PIN

**Add photos:**
- Adds photos and reports counts (added, already_in_gallery)
- Idempotent: re-adding same photo returns already_in_gallery
- Rejects cross-event photos with bad_photo_ids list (all-or-nothing)
- Rejects empty photo_ids array

**Publish workflow:**
- Blocks empty gallery with EMPTY_GALLERY (400)
- Publishes non-empty gallery with status "published" and published_at timestamp
- Prevents double-publish with ALREADY_PUBLISHED (409)

**PIN regeneration:**
- Returns new 6-digit PIN, different from original

### 4. PIN-protected access verification (`tests/public-gallery.test.ts`)

13 tests.

**Preview endpoint:**
- Returns title only for published gallery (no gallery_id, photo_count, event_id leaked)
- Returns 404 for draft (unpublished) gallery
- Returns 404 for nonexistent token — same code as draft (enumeration protection)

**PIN verification:**
- Wrong PIN returns 401
- Correct PIN sets HttpOnly gallery session cookie
- Malformed PIN format rejected with 400

**Photo access after PIN:**
- Lists photos with session cookie
- Response omits s3_key, event_id
- Blocks photos endpoint without gallery session (401)
- Session for gallery A cannot view gallery B (403 — cross-gallery hijack blocked)
- Customer can request presigned download URL for photo in gallery

**Rate limiting:**
- Blocks after 5 wrong PIN attempts with 429
- Even the correct PIN is blocked during the rate limit window (prevents timing race)

**PIN regeneration invalidates sessions:**
- Existing customer session becomes invalid after admin regenerates PIN
- Verified via before/after request pair

---

## Test infrastructure

### Real database, not mocks

Tests run against a real Postgres database (`momentsave_test`) and real Redis (Docker). Pure mocks would hide errors like missing indexes, wrong FK cascades, or Zod schema mismatches.

Every test file uses `beforeEach` to `TRUNCATE ... RESTART IDENTITY CASCADE` and flush Redis keys — so tests are isolated but exercise real code paths.

### Fast bcrypt

`.env.test` sets `BCRYPT_COST=4` (vs. 12 in production). Same code path, ~100x faster hashing. Real security is enforced by the deployed config, not by the test bcrypt cost.

### S3 real signing (not mocked)

Presigned URL generation runs against the real AWS SDK. No HTTP calls are actually made — signing is pure computation. Tests verify the URL is well-formed but never attempt PUT/GET during tests.

### Supertest against a fresh app

`createApp()` is called once per test file. Each test uses `.set('Cookie', ...)` to inject session cookies from the helper.

### Vitest configuration

- `pool: "forks"` with `singleFork: true` — one process, sequential execution. Necessary because tests share the DB + Redis.
- `setupFiles: ["tests/setup.ts"]` — runs before every test file, migrates DB, connects Redis.
- Test timeout: 20 seconds per test (generous for CI stability).

---

## What isn't tested

- **The presigned URL bytes actually work end-to-end** — verified manually with curl (see the deployment doc) and browser upload; not automated because it would require live S3 PUT/GET.
- **CloudFront caching behavior** — end-to-end concern, tested manually.
- **Frontend components** — no React Testing Library suite. The UI is thin, most logic is in hooks. Interview trade-off: prioritized backend security tests over UI unit tests given the 4-day deadline.
- **Load tests** — no k6 or similar. Single-instance backend is not designed for high concurrency.