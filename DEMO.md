# Demo credentials & walkthrough

Live app: **https://momentsave.vercel.app**

## Accounts

| Role | Email | Password | user_id |
|------|-------|----------|---------|
| Admin | `demo-admin@momentsave.app` | `DemoAdmin2026!` | 18 |
| Team member | `demo-team@momentsave.app` | `DemoTeam2026!` | 19 |

## Pre-configured demo data

- **Event**: "Anjali & Raj Wedding" (event_id 4)
- **Assigned**: `demo-team@momentsave.app` is a photographer for this event
- **Gallery**: create one during the demo (Manage gallery on the event page)

---

## Full walkthrough (5 minutes)

### 1. Log in as admin

- Open https://momentsave.vercel.app
- Click **Log in**
- Email: `demo-admin@momentsave.app`
- Password: `DemoAdmin2026!`

You land on the events dashboard. You'll see "Anjali & Raj Wedding" already created.

### 2. Explore the event

- Click **Anjali & Raj Wedding**
- You see: photo grid (empty until team uploads), member sidebar (Demo Photographer), "Manage gallery" button.

### 3. Switch to team member

- **Log out** (top right)
- Log in with `demo-team@momentsave.app` / `DemoTeam2026!`
- You now see "My uploads" and an **Upload photo** button (admin controls are hidden — team members can't create events or add members).

### 4. Upload a photo

- Click **Upload photo**
- Pick any JPEG or PNG under 20 MB
- Progress shows, then a green "Just uploaded" tile appears

The upload went **browser → presigned S3 URL → S3 in Mumbai**. The backend never handled the bytes — only signed the URL and confirmed completion.

### 5. Curate a gallery (back as admin)

- Log out, log back in as `demo-admin@momentsave.app`
- Go to the event, click **Manage gallery**
- Enter title (e.g. "Wedding Album") → **Create**
- **PIN is shown once** — save it, that's the customer's access code
- Add photos: check the ones you want, click **Add N to gallery**
- Click **Publish**

### 6. Share with customer

- Copy the public gallery URL from the Manage gallery page
- Open in a private/incognito browser window (no admin cookies)
- Enter the PIN → viewer opens
- Click a thumbnail → full-screen lightbox with zoom, arrow navigation, and download button

### 7. Regenerate PIN

- Back as admin, on Manage gallery, click **Regenerate PIN**
- New PIN shown, old PIN + all customer sessions invalidated
- The incognito tab from step 6 will 401 on next request

---

## What each flow proves

| Flow | Proves |
|------|--------|
| Admin registration & login | Session cookies (HttpOnly, Secure, SameSite=Strict) work end-to-end |
| Team member sees only assigned events | Role-aware backend queries |
| Team member upload | Presigned S3 URL flow works browser-side, backend confirms via HEAD |
| Admin can view uploaded photos | Preview URL endpoint with cross-event auth check |
| Gallery creation returns PIN once | Bcrypt-hashed PIN, only plaintext during response |
| Publish blocks empty gallery | Business rule enforced at service layer |
| Customer PIN entry sets cookie | Separate `momentsave_gallery_session` cookie namespace |
| Customer cross-gallery URL fails | Session bound to specific `public_token` |
| Regenerate PIN kicks off active viewers | Redis session index enables mass invalidation |
| Download from lightbox works | Presigned S3 GET URL, byte-for-byte identical to upload |