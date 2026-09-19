# Deployment

How to run MomentSave locally and how each production piece is configured.

---

## Table of contents

1. [Prerequisites](#prerequisites)
2. [Local development](#local-development)
3. [Environment variables](#environment-variables)
4. [Production infrastructure](#production-infrastructure)
5. [Backend deployment (Elastic Beanstalk)](#backend-deployment-elastic-beanstalk)
6. [Frontend deployment (Vercel)](#frontend-deployment-vercel)
7. [Troubleshooting](#troubleshooting)

---

## Prerequisites

- **Node.js 22** (backend + frontend)
- **PostgreSQL 17** (or newer) for local development
- **Docker** for local Redis
- **AWS account** with S3 bucket + IAM user
- **AWS CLI** for testing S3 access

---

## Local development

### Backend

```powershell
cd backend
npm install

# Start local Redis
docker run -d -p 6379:6379 --name momentsave-redis redis:7

# Create local Postgres database
psql -U postgres -c "CREATE DATABASE momentsave;"

# Configure env (see below)
Copy-Item .env.example .env    # then fill in values

# Run migrations
npm run db:migrate

# Start dev server
npm run dev
```

Backend runs on `http://localhost:8081`. Health check: `http://localhost:8081/health`.

### Frontend

```powershell
cd frontend
npm install

# Configure env
Copy-Item .env.example .env.local  # then fill in NEXT_PUBLIC_API_URL

npm run dev
```

Frontend runs on `http://localhost:3000`.

### Tests

```powershell
cd backend

# Create test database
psql -U postgres -c "CREATE DATABASE momentsave_test;"

# Configure test env
# Copy .env.example to .env.test — set DB name to momentsave_test, BCRYPT_COST=4

npm test
```

53 tests should run in ~80 seconds.

---

## Environment variables

### Backend (`.env`)

```env
NODE_ENV=development                 # 'production' on EB
PORT=8081

# Postgres
DATABASE_URL=postgres://postgres:PASSWORD@localhost:5432/momentsave

# Redis
REDIS_URL=redis://localhost:6379

# AWS
AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=<IAM_ACCESS_KEY>
AWS_SECRET_ACCESS_KEY=<IAM_SECRET>
S3_BUCKET_NAME=momentsave-photos-jai-x7k2

# Sessions
SESSION_COOKIE_SECRET=<32+ char random string>
SESSION_COOKIE_NAME=momentsave_session
GALLERY_SESSION_COOKIE_NAME=momentsave_gallery_session

# CORS
FRONTEND_URL=http://localhost:3000   # 'https://momentsave.vercel.app' in prod

# Security
BCRYPT_COST=12                       # 4 in tests for speed
PIN_LENGTH=6

# Upload constraints
MAX_FILE_SIZE_BYTES=20971520          # 20 MB
```

### Frontend (`.env.local`)

```env
NEXT_PUBLIC_API_URL=http://localhost:8081       # 'https://d1jw45j3w4nhmu.cloudfront.net' in prod
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## Production infrastructure

Everything except Upstash lives in AWS `ap-south-1` (Mumbai).

| Resource | Service | Details |
|----------|---------|---------|
| Backend hosting | Elastic Beanstalk | Single instance, Node.js 22 on AL2023 |
| Backend proxy | CloudFront | HTTPS termination for the EB URL |
| Database | RDS PostgreSQL 16.15 | `db.t4g.micro`, single-AZ, publicly accessible with SG restriction |
| Session store | Upstash Redis | TLS, free tier |
| Photo storage | S3 | Block all public access, private bucket, presigned URLs |
| Frontend hosting | Vercel | Auto-deploy on push to `main` |

### AWS resources

- **IAM user**: `momentsave-backend`
  - Policy: `MomentSaveBackendPolicy` — scoped to `arn:aws:s3:::momentsave-photos-jai-x7k2/*`
  - Permissions: `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject`, `s3:HeadObject`
- **S3 bucket**: `momentsave-photos-jai-x7k2`
  - Block all public access: ON
  - CORS: allows PUT/GET/HEAD from localhost + vercel domain + preview URLs
- **RDS**: `momentsave-db.chsc00ymgi92.ap-south-1.rds.amazonaws.com`
  - Postgres 16.15
  - Security group inbound: EB security group + developer IP
- **CloudFront distribution**: `d1jw45j3w4nhmu.cloudfront.net`
  - Origin: EB URL (HTTP port 80)
  - Viewer protocol policy: Redirect HTTP to HTTPS
  - Cache policy: CachingDisabled (backend is dynamic)
  - Origin request policy: AllViewer (forwards headers + cookies)

### Upstash Redis

- Region-anchored (ap-south-1)
- URL format: `rediss://default:<TOKEN>@<HOST>.upstash.io:6379`
- Free tier: 10K commands/day, 256 MB

### Vercel

- Project: `momentsave`
- Framework: Next.js (auto-detected)
- Production domain: `momentsave.vercel.app`
- Environment variables set in Vercel dashboard:
  - `NEXT_PUBLIC_API_URL` = CloudFront URL (config type, not secret)

---

## Backend deployment (Elastic Beanstalk)

### Build the deploy zip

**Important**: PowerShell's `Compress-Archive` uses backslash paths (Windows-style) which break on Linux extraction. Use `tar.exe` (bundled with Windows 10+) for forward-slash paths:

```powershell
cd backend
Remove-Item deploy.zip -ErrorAction SilentlyContinue
tar.exe -a -c -f deploy.zip src package.json package-lock.json tsconfig.json drizzle.config.ts
```

Verify contents use forward slashes:

```powershell
tar.exe -tf deploy.zip | Select-Object -First 5
```

Should show `src/config/env.ts`, not `src\config\env.ts`.

### Verify no BOM in package.json

PowerShell's default text encoding is UTF-8 with BOM which breaks Node's JSON parser. If it appears:

```powershell
$content = Get-Content package.json -Raw
[System.IO.File]::WriteAllText((Resolve-Path package.json), $content, [System.Text.UTF8Encoding]::new($false))
```

### Upload

1. AWS Console → Elastic Beanstalk → `momentsave-prod` environment
2. **Upload and deploy** → choose `deploy.zip` → Deploy
3. Wait 2-3 min. Watch Events tab. Health goes OK → Deploying → OK.

### Verify

```powershell
curl.exe https://d1jw45j3w4nhmu.cloudfront.net/health
```

Should return `{"ok":true,"uptime":<low_number>}`. Low uptime confirms fresh restart.

### Environment variables on EB

Set via Console → Configuration → Software → Environment properties. Match the backend `.env` block above, with production values (RDS URL, Upstash URL, `NODE_ENV=production`, `FRONTEND_URL=https://momentsave.vercel.app`).

### Migrations on deploy

Not automatic. Run manually after schema changes:

```powershell
$env:DATABASE_URL="postgres://momentsave_admin:PASSWORD@momentsave-db.chsc00ymgi92.ap-south-1.rds.amazonaws.com:5432/momentsave"
npm run db:migrate
```

Requires developer IP to be in the RDS security group.

---

## Frontend deployment (Vercel)

Vercel auto-deploys on push to `main`:

```powershell
cd D:\Photo_Sharing_Platform
git add .
git commit -m "your message"
git push
```

Vercel picks it up within 30 seconds. Watch: https://vercel.com/jaiharrish07/momentsave/deployments

### First-time setup

1. Import Git repo at vercel.com
2. Root Directory: `frontend`
3. Framework: Next.js (auto)
4. Environment Variables:
   - `NEXT_PUBLIC_API_URL` = `https://d1jw45j3w4nhmu.cloudfront.net`
   - Must be **Config** type (not Secret)
5. Deploy

### Production domain

Settings → Domains → confirm `momentsave.vercel.app` is set as production. That's the URL that stays stable across deploys.

Preview URLs (`momentsave-<hash>.vercel.app`) are auto-generated per deployment. The backend CORS regex allows them, but for consistent testing use the production URL.

---

## Troubleshooting

### 500 on register / login

Most likely a Redis or Postgres connection failure. Check EB logs → Request Logs → Last 100 lines. Look for:

- `PostgresError: self-signed certificate in certificate chain` → `src/db/client.ts` missing RDS SSL config (`rejectUnauthorized: false`)
- `Redis error {"err":"Command timed out"}` → Upstash idle disconnect; `src/redis/client.ts` needs `keepAlive` + `reconnectOnError`

### CORS blocked

Backend CORS allows only production URL + Vercel preview URL regex. If you're testing from an unusual origin, add it to the allowlist in `src/app.ts`.

### Deploy zip extraction fails

`unzip appears to use backslashes as path separators` — you used PowerShell `Compress-Archive`. Use `tar.exe -a -c -f` instead.

### RDS connection refused

Verify:
1. Developer IP is in the RDS security group inbound rules
2. Security group allows port 5432 from your IP
3. RDS instance is `available` state

### Upstash "Command timed out"

Restart the EB app server for a temporary fix. Long-term: verify `src/redis/client.ts` has `keepAlive: 10000` and the `reconnectOnError` catches `"timed out"`.