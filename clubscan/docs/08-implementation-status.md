# ClubScan — Phase 8: Implementation Status

> Living record of what production code exists. Backend **typechecks, lints clean, and unit
> tests pass** (`tsc --noEmit`, `eslint --max-warnings 0`, `vitest`). All 12 bounded contexts
> have working modules. **Hardening Phases 1–3 complete** (security/auth, DB/performance, core
> business logic). **Phase 4 (observability)** is in progress — FCM push and audit interceptor
> are live; Sentry/OTel still pending.

## Backend modules (NestJS, `clubscan/backend/src/modules`)

| Context | Module | Status | Notable endpoints |
|---|---|---|---|
| IAM | `auth` | ✅ | register, verify-email, login, refresh (rotating + reuse detection), logout(-all), forgot/reset, oauth/google, oauth/apple |
| IAM | `users` | ✅ | `/me/sessions` (list/revoke), `/me/devices` (register FCM/list/remove) |
| Profile & Reputation | `profiles` | ✅ | `/me`, `/me/profile`, `/users/:username`, follow/unfollow, followers/following + reputation ledger |
| Venue Catalog | `venues` | ✅ | list (filter/geo/sort, repository pattern + raw PostGIS), detail |
| Venue Catalog | `events` | ✅ | discover (filters), detail, save/unsave, saved list, share deep link |
| Review & Scoring | `reviews` | ✅ | create (9 ratings + photos + AI/rule moderation), edit (+history), delete, helpful |
| Review & Scoring | `scoring` | ✅ | `ScoreCalculator` (pure, 7 unit tests) + `VenueScore` read-model reactor |
| Discovery & Search | `search` | ✅ | unified venues/events/users/cities/genres |
| Moderation & Trust | `moderation` | ✅ | reports, case queue, case transitions, sanctions (ban/shadow-ban/removal, ADMIN-gated), audited |
| Safety & Incidents | `safety` | ✅ | submit incident (anonymous option), restricted queue, escalation state machine + SLAs |
| Notifications & Feed | `notifications` | ✅ | feed (fan-out-on-write), notifications list/read, FCM gateway, event reactors |
| Analytics | `analytics` | ✅ | batched ingest beacon, admin overview metrics |
| Shared Kernel | `media` | ✅ | S3 presigned upload + server-side complete validation |
| Platform | `health` | ✅ | liveness + readiness (DB check) |

## Platform layer (`clubscan/backend/src/platform`)

- `prisma` (service/module) · `config` (env validation + runtime `AppConfig` scoring loader)
- `event-bus` (port + in-process adapter) · `audit` (immutable log) · `security` (JWT guard,
  RBAC guard, decorators) · `http` (RFC7807 filter) · `pagination` (cursor) · shared kernel
  (UUID v7, domain errors, domain events).

## Cross-cutting wired globally

- `ZodValidationPipe` (whitelist) · `AllExceptionsFilter` (problem+json) ·
  `ThrottlerGuard` → `JwtAuthGuard` → `RolesGuard` (order matters) · `AuditInterceptor`
  (auto-logs all mutations — POST/PUT/PATCH/DELETE — with actor, IP, sanitized body;
  fire-and-forget) · Helmet · CORS allowlist · Swagger at `/api/v1/docs`.

## Event-driven reactors (eventual consistency)

```
review.published ─► scoring.recompute · feed.fanOut · reputation +10
user.followed    ─► notification + push · reputation +1
incident.submitted ─► escalation SLA scheduling (severity-based)
event.saved      ─► (analytics hook point)
```

All reactors use idempotency keys to safely handle at-least-once delivery.

## Mobile (`clubscan/mobile`)

Expo Router app with auth gate, design tokens (NativeWind), API client with single-flight
token refresh, TanStack Query (+persistence), Zustand stores (SecureStore), i18n (EN/TR),
`ScoreRing`/`VenueCard`/`Button`, and Welcome/Login/Register/Discover/Venue-detail/tab screens.

## Verification commands

```bash
cd clubscan/backend
npm install && npx prisma generate   # may require network for engine binaries
npx tsc --noEmit        # ✅ no errors
npx eslint "src/**/*.ts" # ✅ 0 problems
npx vitest run          # ✅ 7 passed
```

## Known follow-ups (next iterations)

- Search/Analytics extraction to dedicated stores when load dictates (ports already abstracted).
- Sentry + OpenTelemetry integration (wiring pending).
- Mobile polish & i18n (Phase 5).
- Integration/e2e tests (supertest).
