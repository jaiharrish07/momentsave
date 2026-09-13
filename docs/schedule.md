### Full project roadmap

#### Phase 1 — Design (in progress)

| Step                                                   | Status                |
| ------------------------------------------------------ | --------------------- |
| Requirements extracted                                 | ✅ Done                |
| Priorities set (P0/P1/P2)                              | ✅ Done                |
| Tech stack chosen                                      | ✅ Done                |
| Failure-mode strategies (Redis down, orphaned uploads) | ✅ Done                |
| Database schema                                        | ✅ **Locked (v6)**     |
| API design                                             | ⬜ **Next**            |
| Auth flow design (login, session, PIN)                 | ⬜ Part of API design  |
| Authorization matrix (who can do what)                 | ⬜ Part of API design  |
| Project structure (folders, layers)                    | ⬜ Small step, ~30 min |
| AWS setup plan (RDS, S3, IAM, Elastic Beanstalk)       | ⬜ Small step, ~30 min |

#### Phase 2 — Backend implementation

|Step|Rough effort|
|---|---|
|Project scaffold (TS, Express, Drizzle config)|2 hours|
|Drizzle schema + first migration|2 hours|
|Auth (register admin, login, session middleware)|4 hours|
|RBAC middleware (admin / team_member checks)|1 hour|
|Events CRUD (create, list mine, get one)|2 hours|
|Event members (add, list, remove)|2 hours|
|S3 presigned URL flow (get URL, confirm upload)|3 hours|
|Photo listing (event-scoped, ownership-filtered)|2 hours|
|Gallery CRUD (create, add/remove photos, set PIN)|3 hours|
|Gallery publish endpoint|1 hour|
|Public gallery: PIN verify + list photos|3 hours|
|PIN rate limiting (Redis)|2 hours|
|Cleanup job (orphaned pending photos)|1 hour|
|Error handling, validation (Zod), logging|3 hours|

**Backend rough total: ~30 hours**

#### Phase 3 — Frontend implementation

|Step|Rough effort|
|---|---|
|Next.js scaffold, routing, layout|2 hours|
|Auth pages (login) + session context|3 hours|
|Admin: events list, create event, add members|3 hours|
|Admin: view all photos in event, select photos|3 hours|
|Admin: create/publish gallery, view share link|2 hours|
|Team member: assigned events, upload UI|3 hours|
|Team member: view own photos|1 hour|
|Public gallery: PIN entry, photo grid viewer|3 hours|
|Responsive polish, error/loading states|3 hours|

**Frontend rough total: ~23 hours**

#### Phase 4 — Infra & deployment

|Step|Rough effort|
|---|---|
|RDS Postgres provisioned + connected|1 hour|
|S3 bucket + IAM policy + CORS for direct upload|2 hours|
|Upstash Redis account + connection|30 min|
|Elastic Beanstalk deployment + env vars|3 hours|
|Vercel deployment + env vars|1 hour|
|CORS configuration between Vercel ↔ EB|1 hour|
|End-to-end smoke test on prod|1 hour|
|Domain / HTTPS setup (or accept EB default URL)|1 hour|

**Deployment rough total: ~10 hours**

#### Phase 5 — Testing

|Step|Rough effort|
|---|---|
|Test setup (Vitest / Jest, test DB)|2 hours|
|Auth tests (login, session, invalid creds)|2 hours|
|Authorization tests (team member cannot publish, etc.)|3 hours|
|Photo access control tests|2 hours|
|Gallery publish + PIN verify tests|2 hours|

**Testing rough total: ~11 hours**

#### Phase 6 — Documentation & submission

|Step|Rough effort|
|---|---|
|README (overview, stack, architecture, DB)|2 hours|
|Architecture diagram|1 hour|
|Setup instructions + env var list|1 hour|
|Deployment steps documented|1 hour|
|Demo credentials + gallery URL + PIN|30 min|
|Known limitations section|30 min|
|Final review + submission email|1 hour|

**Docs rough total: ~7 hours**

---

### Totals

|Phase|Hours|
|---|---|
|Design (remaining)|~3|
|Backend|~30|
|Frontend|~23|
|Deployment|~10|
|Testing|~11|
|Docs|~7|
|**Grand total**|**~84 hours**|

### Deadline math

- Today: **September 11, 2026** (Friday)
- Deadline: **September 20, 2026, 11:59 PM IST** (Sunday)
- **Days left: 9**