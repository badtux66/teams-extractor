# ClubScan

> A safer, more transparent nightlife ecosystem — discover clubs, evaluate venues with
> structured trust signals, share experiences, and make informed decisions.

ClubScan is a production-grade mobile platform built to scale. This repository contains the
full architecture (Phases 1–7) and the production code foundation (Phase 8).

## Repository layout

```
clubscan/
├── docs/        Architecture (8 phases): product, DB, backend, frontend, infra, security, folders
├── backend/     NestJS modular monolith (Clean Architecture + DDD + CQRS where it pays off)
├── mobile/      Expo (React Native) app — design system, navigation, state, API client
├── docker-compose.yml
└── README.md
```

## Architecture docs

| Phase | Document |
|---|---|
| 1 | [Product Architecture](docs/01-product-architecture.md) |
| 2 | [Database Design](docs/02-database-design.md) |
| 3 | [Backend Architecture](docs/03-backend-architecture.md) |
| 4 | [Frontend Architecture](docs/04-frontend-architecture.md) |
| 5 | [Infrastructure Architecture](docs/05-infrastructure-architecture.md) |
| 6 | [Security Architecture](docs/06-security-architecture.md) |
| 7 | [Folder Structures](docs/07-folder-structures.md) |
| 8 | [Implementation Status](docs/08-implementation-status.md) |

## Quick start (local)

```bash
# 1) Bring up Postgres (PostGIS), Redis, MinIO, Mailhog
cd clubscan
docker compose up -d postgres redis minio createbuckets mailhog

# 2) Backend
cd backend
cp .env.example .env
npm install
npm run prisma:generate
npm run prisma migrate dev        # baseline schema
psql "$DATABASE_URL" -f prisma/sql/postgis.sql   # geospatial augmentation
npm run prisma:seed
npm run start:dev                 # http://localhost:3000/api/v1 (docs at /api/v1/docs)
```

## The ClubScan Score

Venues are rated across nine structured categories (Security, Staff behavior, Fair pricing,
Crowd quality, Music quality, Sound system, Cleanliness, **Safety for women**, Atmosphere).
The composite 0–100 score is a weighted, recency-decayed, reputation-weighted, Bayesian-shrunk
aggregate that prioritizes safety and resists manipulation. See
[Backend §11](docs/03-backend-architecture.md) and `backend/src/modules/scoring`.

## Tech stack

**Mobile:** Expo · TypeScript · Expo Router · TanStack Query · Zustand · RHF + Zod · NativeWind
**Backend:** NestJS · TypeScript · Prisma · PostgreSQL · Redis
**Auth:** JWT (access) + rotating refresh tokens + Google/Apple OAuth (JWKS-verified)
**Infra:** Docker · GitHub Actions · S3-compatible storage · FCM (firebase-admin) · Sentry · OpenTelemetry

## License

UNLICENSED — proprietary.
