# MomentSave

> A photo sharing platform for events — photographers upload, admins curate, customers view with a PIN.

**Built for the TrizenAI internship challenge.**

---

## 📑 Table of Contents

1. [Overview](#overview)
2. [Live Application](#live-application)
3. [Demo Credentials](#demo-credentials)
4. [Features](#features)
5. [Tech Stack](#tech-stack)
6. [Architecture](#architecture)
7. [Repository Layout](#repository-layout)
8. [Local Setup](#local-setup)
9. [Testing](#testing)
10. [Security Model](#security-model)
11. [Documentation](#documentation)
12. [Author](#author)

---

## Overview

MomentSave is a role-based event photo sharing platform. It supports three distinct user flows — **Admins** curate and publish, **Photographers** upload, and **Customers** view galleries through a shareable PIN-protected link.

Uploaded photos flow directly from the browser to S3 via presigned URLs. The backend never proxies bytes.

```
Browser ──► Presigned S3 URL ──► S3 (ap-south-1)
```

---

## Live Application

| Resource        | URL                                                  |
|-----------------|------------------------------------------------------|
| **Frontend**    | https://momentsave.vercel.app                        |
| **Backend API** | https://d1jw45j3w4nhmu.cloudfront.net                |
| **Health Check**| https://d1jw45j3w4nhmu.cloudfront.net/health         |

---

## Demo Credentials

Log in at **https://momentsave.vercel.app/login**.

| Role                       | Email                          | Password           |
|----------------------------|--------------------------------|--------------------|
| **Admin**                  | `demo-admin@momentsave.app`    | `DemoAdmin2026!`   |
| **Team Member (Photographer)** | `demo-team@momentsave.app` | `DemoTeam2026!`    |

> 📖 A step-by-step walkthrough of every flow is available in [`docs/DEMO.md`](docs/DEMO.md).

---

## Features

### 👤 Admin
- Create and manage events
- Add and assign team members
- Curate photos into galleries
- Set PIN and publish galleries

### 📸 Team Member (Photographer)
- View assigned events
- Upload photos directly to S3 via presigned URLs

### 🎟️ Customer
- Open a shareable gallery link
- Enter PIN to access
- View gallery in a lightbox
- Download original photos

---

## Tech Stack

| Layer                        | Technology                                                                 |
|------------------------------|----------------------------------------------------------------------------|
| **Frontend**                 | Next.js 16 (App Router), TypeScript, Tailwind CSS, shadcn/ui, React Query, `yet-another-react-lightbox` |
| **Backend**                  | Node.js 22, TypeScript, Express, Drizzle ORM, Zod validation               |
| **Database**                 | PostgreSQL 16 (RDS in production, local Postgres in dev)                  |
| **Session Store & Rate Limiting** | Redis (Upstash in production, Docker locally)                         |
| **Object Storage**           | AWS S3 (`ap-south-1`, private bucket, presigned URLs only)                 |
| **Testing**                  | Vitest + Supertest against a real test database                            |

---

## Architecture

### Deployment Topology

```
Vercel (Next.js frontend)
        │
        │ HTTPS
        ▼
CloudFront (HTTPS termination, ap-south-1)
        │
        ▼
Elastic Beanstalk (Node.js 22, single instance, ap-south-1)
        │
        ├── RDS Postgres 16  (private subnet)
        ├── Upstash Redis    (rediss://)
        └── S3               (private bucket, presigned URLs)
```

> Full deployment details in [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

---

## Repository Layout

```
Photo_Sharing_Platform/
├── backend/                    # Express API, Drizzle ORM, tests
│   ├── src/
│   │   ├── modules/            # Vertical slices: auth, events, photos,
│   │   │                       #   galleries, public-gallery
│   │   ├── middleware/         # rbac, rateLimit, errorHandler, validate
│   │   ├── db/                 # Drizzle client, schema, migrations
│   │   ├── redis/              # ioredis client with keepalive + timeout wrapper
│   │   ├── s3/                 # AWS S3 client + presigned URL helpers
│   │   └── jobs/               # Orphaned photo cleanup
│   ├── tests/                  # Vitest suites (53 tests)
│   └── package.json
│
├── frontend/                   # Next.js app
│   ├── app/
│   │   ├── (auth)/             # login, register
│   │   ├── (dashboard)/        # authenticated area — events, team members,
│   │   │                       #   gallery mgmt
│   │   └── gallery/            # customer PIN entry + viewer (public)
│   ├── components/             # PhotoThumbnail, PhotoLightbox
│   ├── hooks/                  # React Query hooks per domain
│   ├── lib/                    # api client, auth context, S3 upload helper, types
│   └── package.json
│
└── docs/
    ├── ARCHITECTURE.md         # System architecture, database schema, security model
    ├── DEPLOYMENT.md           # AWS + Vercel setup, env vars, deploy commands
    ├── DEMO.md                 # Live demo walkthrough
    └── TESTING.md              # Test suite structure and how to run
```

---

## Local Setup

### Prerequisites

- Node.js 22
- PostgreSQL 17 (local)
- Docker (for Redis)
- AWS credentials for a test S3 bucket

### Backend

```bash
cd backend
npm install
cp .env.example .env                       # fill in DB URL, AWS creds, S3 bucket
docker run -d -p 6379:6379 --name momentsave-redis redis:7
npm run db:migrate
npm run dev                                # http://localhost:8081
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env.local                 # NEXT_PUBLIC_API_URL=http://localhost:8081
npm run dev                                # http://localhost:3000
```

> Full setup with all environment variables in [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

---

## Testing

**53 tests** covering the four security-critical areas the challenge requires:

| Area                                | Coverage                                                                                 |
|-------------------------------------|------------------------------------------------------------------------------------------|
| **Authentication + Authorization**  | Register, login, session middleware, RBAC, login rate limiting                           |
| **Photo Access Controls**           | Role-aware listings, cross-event denial, presigned URL authorization                     |
| **Gallery Publishing Workflows**    | Auto-PIN generation, one-per-event enforcement, publish blocks empty galleries, double-publish prevention |
| **PIN-Protected Access**            | Preview hides drafts, cross-gallery session hijack blocked, PIN rate limiting, session invalidation on PIN regeneration |

### Run the tests

```bash
cd backend
npm test
```

> Full breakdown in [`docs/TESTING.md`](docs/TESTING.md).

---

## Security Model

| Concern                       | Implementation                                                                                 |
|-------------------------------|------------------------------------------------------------------------------------------------|
| **Passwords & PINs**          | bcrypt cost 12                                                                                 |
| **Sessions**                  | Opaque Redis-backed tokens in HttpOnly + Secure + SameSite=Strict cookies (7-day sliding TTL) |
| **Login Rate Limits**         | 5 failed attempts per IP+email per 15 min                                                      |
| **PIN Rate Limits**           | 5 attempts per IP+gallery per 15 min                                                           |
| **Enumeration Protection**    | Uniform 404 responses whether a resource is missing or the caller lacks access                 |
| **S3**                        | Private bucket, block all public access, IAM policy scoped to bucket ARN, presigned URLs expire in 5 min (upload) / 1 hour (download) |
| **CORS**                      | Strict origin allowlist + Vercel preview URL regex                                             |
| **PIN Regeneration**          | Kills every customer session for that gallery via a Redis session index                        |

> Full security model and design decisions in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

---

## Documentation

| Document                                       | Description                                             |
|------------------------------------------------|---------------------------------------------------------|
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | System architecture, database schema, security model    |
| [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md)     | AWS + Vercel setup, environment variables, deploy steps |
| [`docs/DEMO.md`](docs/DEMO.md)                 | Live demo walkthrough                                   |
| [`docs/TESTING.md`](docs/TESTING.md)           | Test suite structure and how to run                     |

---

## Author

**Jai** — M.Tech Integrated Software Engineering
VIT Chennai (24MIS1054)