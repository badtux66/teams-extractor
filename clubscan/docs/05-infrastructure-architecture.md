# ClubScan — Phase 5: Infrastructure Architecture

> **Status:** Phase 5 of 8 · Docker · GitHub Actions CI/CD · Sentry · OpenTelemetry
>
> Defines environments, containerization, CI/CD pipelines, deployment topology, observability,
> backups, and scaling. Concrete files: `clubscan/backend/Dockerfile`,
> `clubscan/docker-compose.yml`, `.github/workflows/clubscan-*.yml`.

---

## 1. Environments

| Env | Purpose | Data |
|---|---|---|
| `local` | Dev via docker-compose (Postgres+PostGIS, Redis, MinIO=S3, Mailhog) | seeded demo |
| `ci` | Ephemeral test DB/Redis in Actions | throwaway |
| `staging` | Pre-prod mirror, OTA preview channel | anonymized |
| `production` | Live | real, backed up |

Config strictly via env vars (12-factor); secrets via the platform secret manager (never in
repo). `.env.example` documents every key.

## 2. Containerization

- **Backend:** multi-stage Dockerfile — `deps` → `build` (tsc + prisma generate) →
  `runtime` (distroless/node-slim, non-root user, only prod deps, `prisma migrate deploy` on
  start via entrypoint). Healthcheck hits `/health/ready`.
- **docker-compose (local):** `api`, `postgres` (postgis/postgis:16), `redis`,
  `minio` + `createbuckets`, `mailhog`, `otel-collector`. Named volumes; hot reload via
  bind mount in dev compose.
- **Mobile:** not containerized; built via **EAS Build**; OTA via **EAS Update** channels
  (staging/production).

## 3. CI/CD (GitHub Actions)

### `clubscan-backend-ci.yml` (PRs + main)
1. Setup Node, cache pnpm. 2. `pnpm install --frozen-lockfile`. 3. `prisma generate`.
4. Lint + typecheck. 5. Spin Postgres+Redis services → `prisma migrate deploy` → unit +
   integration tests (`vitest`/`jest`) with coverage gate. 6. `docker build` (no push on PR).
7. Build & push image to registry on `main`/tags.

### `clubscan-backend-cd.yml` (main / tag)
- On green CI: deploy image to **staging** → run `prisma migrate deploy` (job) → smoke test
  `/health` → manual approval → **production** rollout (rolling, health-gated) → Sentry
  release + sourcemaps + OTel deploy marker.

### `clubscan-mobile-ci.yml`
- Typecheck, lint, unit tests, `expo-doctor`, Zod/EAS config validation. Tagged release →
  `eas build` + `eas update` to the right channel; upload RN sourcemaps to Sentry.

### `clubscan-db-diagram.yml`
- Render the Mermaid ER diagram + Prisma ERD to SVG artifact on schema change.

## 4. Deployment Topology (production, default = AWS-style; portable)

```
Route53/DNS → CloudFront(CDN, static+media) + WAF
            → ALB (TLS term, HTTP/2) → ECS Fargate service (NestJS, N replicas, autoscale)
                                            │
                 ┌──────────────┬───────────┼───────────────┬──────────────┐
                 ▼              ▼           ▼               ▼              ▼
             RDS Postgres   ElastiCache   S3 (media,     Secrets Mgr   OTel Collector
             (Multi-AZ +    Redis         private +      / SSM         → Tempo/Prom/Loki
             read replicas) (cache,       presigned;                   (or Grafana Cloud)
                            throttler,    CDN-fronted)
                            queues)
```
- Stateless API → horizontal autoscale on CPU/RPS. Migrations run as a pre-deploy job, not in
  every container, to avoid races (entrypoint guards with advisory lock).
- Portable: the same containers run on Fly.io/Render/GKE; managed Postgres/Redis/S3-compatible
  swap in. MinIO locally = S3 in prod (same SDK).

## 5. Observability

- **OpenTelemetry:** traces (HTTP, Prisma, Redis, outbound), metrics (RED + business: reviews
  created, score recomputes, report queue depth), logs correlated by trace id → OTLP collector.
- **Sentry:** backend (errors + performance) and mobile (crashes + JS errors), release health,
  sourcemaps in CI. Alert rules → on-call.
- **Dashboards/SLOs:** API availability 99.9%, p95 latency, error rate, queue lag, DB
  connections, cache hit ratio. Synthetic `/health` checks + uptime alerts.

## 6. Data, Backups, DR

- RDS automated daily snapshots + PITR (≥7d); periodic restore drills. S3 versioning +
  lifecycle (cold-tier old media). Redis is cache/ephemeral (rebuildable; not source of truth).
- **RPO ≤ 15 min, RTO ≤ 1 h** target via Multi-AZ + PITR. Migrations are forward-only +
  reversible-where-safe; expand/contract pattern for zero-downtime schema changes.

## 7. Secrets & Config

- No secrets in git; injected at runtime (Secrets Manager/SSM/Actions secrets). Rotation for
  DB creds and JWT signing keys (JWKS rotation). Separate keys per environment.

## 8. Cost & Scale Levers
- CDN caching of venue pages + media; Redis read-through for venue detail/scores; read
  replicas for discovery; partition append-only tables monthly; extract Search/Analytics to
  dedicated stores when load dictates (ports already abstracted in Phase 3).

---

*End of Phase 5.*
