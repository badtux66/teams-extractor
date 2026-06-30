# ClubScan — Phase 3: Backend Architecture

> **Status:** Phase 3 of 8 · **Stack:** NestJS · TypeScript · Prisma · PostgreSQL · Redis
>
> Defines module decomposition, layering, the REST API contract, DTO/validation rules,
> authorization policies, rate limiting, audit logging, the event bus, and the canonical
> scoring algorithm. Production code is scaffolded under `clubscan/backend/`.

---

## 1. Layering (Clean Architecture, per module)

Every NestJS module follows the same four-layer shape. Dependencies point inward only.

```
presentation/   controllers, guards, interceptors, request/response DTOs (HTTP edge)
   │  depends on ▼
application/    use cases (commands/queries), ports (interfaces), application DTOs, mappers
   │  depends on ▼
domain/         entities, value objects, domain services, domain events (zero framework deps)
   ▲  implemented by
infrastructure/ Prisma repositories, S3/FCM/OAuth/AI adapters (implement application ports)
```

- **Domain** never imports `@nestjs/*` or `@prisma/client`.
- **Application** depends on **ports** (`*.repository.port.ts`, `*.gateway.port.ts`); never on
  concrete infra.
- **Infrastructure** provides adapters; wired by Nest DI tokens in each module.
- **CQRS**: `Scoring`, `Search`, `Feed` use `@nestjs/cqrs` command/query buses; simple CRUD
  modules keep services directly.

## 2. Module Map (modular monolith)

| Module | Bounded context | Key providers |
|---|---|---|
| `AuthModule` | IAM | AuthService, TokenService, OAuth strategies, guards |
| `UsersModule` | IAM | UserRepository, account lifecycle |
| `ProfilesModule` | Profile & Reputation | ProfileService, FollowService, ReputationService |
| `VenuesModule` | Venue Catalog | VenueService, VenueRepository (raw geo SQL) |
| `EventsModule` | Venue Catalog | EventService, SavedEventService |
| `ReviewsModule` | Review & Scoring | ReviewService (commands) |
| `ScoringModule` | Review & Scoring | ScoreCalculator (domain), VenueScore read model (CQRS) |
| `SearchModule` | Discovery & Search | SearchService (Postgres FTS/trgm/geo), DiscoveryService |
| `ModerationModule` | Moderation & Trust | ReportService, ModerationCaseService, SanctionService, AI port |
| `SafetyModule` | Safety & Incidents | IncidentService, EscalationService (state machine) |
| `NotificationsModule` | Notifications & Feed | NotificationService, FeedService, FcmGateway |
| `AnalyticsModule` | Analytics | AnalyticsIngestService, metrics queries |
| `MediaModule` | Shared Kernel | S3 presign service, MediaAsset lifecycle |
| `AdminModule` | cross | admin/moderator dashboards composition |
| **Platform modules** | — | `PrismaModule`, `RedisModule`, `EventBusModule`, `AuditModule`, `ConfigModule`, `I18nModule`, `HealthModule`, `ObservabilityModule` |

## 3. Cross-Cutting Concerns (global)

- **ValidationPipe** (whitelist + forbidNonWhitelisted + transform) with Zod-backed DTOs
  (`nestjs-zod`) — schemas shared in spirit with the mobile client (Phase 4).
- **Guards (global where sensible):** `JwtAuthGuard`, `RolesGuard` (`@Roles()`),
  `PoliciesGuard` (`@CheckPolicy()` for ABAC ownership checks), `ThrottlerGuard` (Redis store).
- **Interceptors:** `SerializerInterceptor` (strip sensitive fields), `AuditInterceptor`
  (global, auto-logs all mutation requests with actor, IP, sanitized body → AuditLogEntry),
  `LoggingInterceptor` (OTel span + request id), `ShadowBanInterceptor` (shadow-banned users
  see their own content as live but it's excluded from others' reads).
- **Filters:** `AllExceptionsFilter` → RFC7807 problem+json, Sentry capture, no stack leaks.
- **i18n:** `nestjs-i18n`, `Accept-Language` + user.locale; error messages translated (EN/TR).

## 4. Authentication & Token Strategy

- **Access token (JWT):** short-lived (15 min), `sub`, `role`, `status`, `sessionId`; signed
  RS256 (key rotation via JWKS). Stateless verification.
- **Refresh token:** opaque random 256-bit, **stored hashed** in `sessions`, long-lived
  (30 days), **rotated on every use**; `familyId` enables reuse detection → revoke family.
- **Endpoints:** `/auth/register`, `/auth/verify-email`, `/auth/login`, `/auth/refresh`,
  `/auth/logout`, `/auth/logout-all`, `/auth/forgot-password`, `/auth/reset-password`,
  `/auth/oauth/google`, `/auth/oauth/apple`.
- **OAuth:** verify Google ID token server-side; Apple identity tokens verified via JWKS
  (`jsonwebtoken` + `jwks-rsa` fetching Apple's public keys from
  `https://appleid.apple.com/auth/keys`); link or create user + `oauth_accounts`; first-time →
  username selection step.
- **Device & session mgmt:** `/me/sessions` (list/revoke), `/me/devices` (register FCM token,
  revoke). Refresh binds to `deviceId`.

## 5. Authorization Model

- **RBAC** via `@Roles(UserRole.MODERATOR, ...)` + `RolesGuard`.
- **ABAC/ownership** via `PoliciesGuard` + policy handlers, e.g. `CanEditReviewPolicy`
  (author or moderator), `CanViewIncidentPolicy` (safety/moderation roles only).
- **Role capability matrix** is the Phase 1 §10 table, enforced here.
- **Shadow ban:** writes succeed for the banned user (they see normal UX) but content carries
  `status=SHADOW_*`/author shadow-banned → excluded from other users' query scopes.

## 6. Rate Limiting (Redis-backed `@nestjs/throttler`)

| Bucket | Limit |
|---|---|
| Global default | 100 req / 60s / IP+user |
| `/auth/login`, `/auth/forgot-password` | 5 / 15 min / IP (brute-force guard) |
| `/auth/register` | 3 / hour / IP |
| Review create | 5 / hour / user (velocity/abuse guard) |
| Report/Incident create | 10 / hour / user |
| Media presign | 30 / hour / user |
| Search | 60 / min / user |

Exceeding → `429` with `Retry-After`. Distributed counters in Redis so it works across
replicas.

## 7. Audit Logging

`AuditInterceptor` is registered globally via `APP_INTERCEPTOR` and automatically logs all
mutation API calls (POST/PUT/PATCH/DELETE). Each entry records `actorId`, `action` (HTTP
method + route path), `ip`, and sanitized `metadata` (passwords/tokens/secrets redacted) to
`audit_log_entries`. The interceptor runs fire-and-forget so it never blocks the HTTP response.
Append-only; never updated.

Manual `AuditService.record()` calls remain in `ModerationService` and `SafetyService` for
additional context-rich audit entries (e.g. role changes, bans/shadow bans, content removal,
escalation state transitions).

## 8. Event Bus & CQRS Flow

- `EventBusPort` abstraction; v1 adapter = `@nestjs/cqrs` event bus / `EventEmitter2`
  (in-process). Swappable to Redis Streams/SQS/Kafka behind the same port.
- Domain events: `UserRegistered`, `ReviewPublished`, `ReviewRemoved`, `ReviewEdited`,
  `UserFollowed`, `EventSaved`, `ReportFiled`, `IncidentSubmitted`, `SanctionIssued`.
- **Reactors** (async handlers): score recompute, search reindex, feed fan-out, notification
  dispatch (+FCM), analytics ingest, reputation update.
- All reactors use **idempotency keys** — reputation events carry a unique `idempotencyKey`
  column; feed fan-out uses a composite unique constraint with `skipDuplicates`. This makes the
  system safe for at-least-once delivery semantics.
- Write path stays fast & transactional; projections update eventually (seconds).

## 9. REST API Contract (v1, prefix `/api/v1`)

> JSON, cursor pagination (`?cursor=&limit=`), `Authorization: Bearer <access>`.
> All list endpoints return `{ data: [...], nextCursor, total? }`. Errors are RFC7807.

### Auth
```
POST   /auth/register                 {email,password,username}
POST   /auth/verify-email             {token}
POST   /auth/login                    {email,password} -> {accessToken,refreshToken,user}
POST   /auth/refresh                  {refreshToken}  -> rotated pair
POST   /auth/logout                   {refreshToken}
POST   /auth/logout-all
POST   /auth/forgot-password          {email}
POST   /auth/reset-password           {token,password}
POST   /auth/oauth/google             {idToken[,username]}
POST   /auth/oauth/apple              {identityToken[,username]}
```
### Me / Profiles / Social
```
GET    /me                            current user + profile
PATCH  /me/profile                    {displayName?,bio?,avatarUrl?,isPrivate?,socialLinks?}
GET    /me/sessions  / DELETE /me/sessions/:id
GET    /me/devices   / POST /me/devices {platform,pushToken} / DELETE /me/devices/:id
GET    /users/:username               public profile + reputation
POST   /users/:id/follow  / DELETE /users/:id/follow
GET    /users/:id/followers  /  GET /users/:id/following
GET    /me/feed                       activity feed (cursor)
```
### Venues / Events / Discovery
```
GET    /venues                        ?city&type&genre&q&near=lat,lng&radius&sort&cursor
GET    /venues/:slug                  detail + score + photos + hours + genres
GET    /venues/:id/reviews            ?sort=recent|helpful&cursor
GET    /venues/:id/events
GET    /events                        ?city&genre&from&to&near&cursor (discovery + filters)
GET    /events/:id
POST   /me/saved-events/:eventId  / DELETE /me/saved-events/:eventId
GET    /me/saved-events
GET    /events/:id/share              -> deep link payload
```
### Reviews
```
POST   /venues/:id/reviews            {ratings{...9},body,photoAssetIds?}
PATCH  /reviews/:id                   (author; creates ReviewEdit snapshot)
DELETE /reviews/:id                   (author soft-delete or moderator)
POST   /reviews/:id/helpful  / DELETE /reviews/:id/helpful
GET    /reviews/:id
```
### Search
```
GET    /search?q=&type=venue|event|user|city|genre&near&cursor
```
### Moderation (MODERATOR+)
```
POST   /reports                       {targetType,targetId,reason,details?}   (any user)
GET    /moderation/queue              ?state&cursor
GET    /moderation/cases/:id
PATCH  /moderation/cases/:id          {state,resolution?,assignTo?}
POST   /moderation/cases/:id/sanction {type,reason,expiresAt?}
POST   /admin/users/:id/ban|shadow-ban|unban   (ADMIN+)
POST   /admin/users/:id/role          {role}    (SUPER_ADMIN)
```
### Safety (restricted)
```
POST   /safety/incidents              {category,severity,venueId?,description,occurredAt?,isAnonymous?}
GET    /safety/incidents              (SAFETY/MOD roles) ?state&severity&cursor
PATCH  /safety/incidents/:id          state transitions (escalation workflow)
```
### Media / Notifications / Analytics
```
POST   /media/presign                 {mime,size} -> {uploadUrl,assetId,key}
POST   /media/:assetId/complete       finalize (sets READY)
GET    /me/notifications  / POST /me/notifications/:id/read / POST /me/notifications/read-all
POST   /analytics/events              {events:[{type,properties,occurredAt}]}  (batched, beacon)
GET    /admin/analytics/*             dashboards (ADMIN+)
```
### Platform
```
GET    /health   /  GET /health/ready   (liveness/readiness)
GET    /config/public                 public feature flags + i18n bootstrap
```

## 10. DTO & Validation Rules (highlights, Zod-backed)

- **email**: RFC + lowercase normalize; **password**: ≥10 chars, upper+lower+digit, zxcvbn
  strength gate; **username**: `^[a-z0-9_]{3,20}$`, profanity + reserved-word check.
- **ratings**: each int 1–5, all 9 required; **body**: 10–4000 chars, trimmed, control-char
  stripped; **photoAssetIds**: ≤8, must belong to caller and be `READY`.
- **geo**: lat ∈ [-90,90], lng ∈ [-180,180], radius ≤ 50km.
- **pagination**: limit ≤ 50; cursor is opaque base64 of `(createdAt,id)`.
- **enums** validated against Prisma enums; unknown fields rejected (whitelist).
- All free text passes sanitization (strip HTML; store as plain text) — XSS defense in depth.

## 11. Canonical Scoring Algorithm (domain service `ScoreCalculator`)

Pure, deterministic, framework-free. Inputs: published, non-shadow-banned reviews for a venue.

```
For each review i with rating vector r_i (9 categories, 1..5):
  reviewWeight_i = recencyWeight_i * reputationWeight_i
    recencyWeight_i    = 0.5 ^ (ageDays_i / HALF_LIFE_DAYS)          // default HALF_LIFE=180
    reputationWeight_i = clamp(1 + log10(1 + reputation_i)/REP_K, 1, REP_CAP)  // default cap 2.0

For each category c:
  weightedAvg_c = Σ_i (reviewWeight_i * r_i,c) / Σ_i reviewWeight_i        // in [1..5]

Composite (raw, 1..5):
  effectiveN = Σ_i reviewWeight_i
  rawComposite = Σ_c (CATEGORY_WEIGHT_c * weightedAvg_c)                   // weights sum to 1

Bayesian shrinkage toward global mean μ (over all venues), prior strength m (default 8):
  shrunk = (effectiveN * rawComposite + m * μ) / (effectiveN + m)

Scale to 0..100:
  score = round( (shrunk - 1) / 4 * 100, 2 )

Safety advisory:
  safetyAdvisory = (avgSafetyForWomen < 2.5 && reviewCount >= MIN_N)
                   || (openIncidentCount(venue) >= INCIDENT_THRESHOLD)
```

- `CATEGORY_WEIGHT_c`, `HALF_LIFE_DAYS`, `m`, `REP_K`, `REP_CAP`, thresholds come from
  `AppConfig` (Phase 1 §4.2 defaults) — **config, not code**.
- Output persisted to `venue_scores` read model; recompute triggered by review events
  (debounced per venue). Idempotent; guarded by `lastComputedAt`.
- Excludes: PENDING/HELD/REMOVED reviews, shadow-banned authors, soft-deleted.

## 12. Error Model (RFC 7807)

```
{ "type":"https://clubscan.app/errors/validation",
  "title":"Validation failed","status":422,
  "detail":"...", "instance":"/api/v1/...","errors":[{path,message}] }
```
Codes: 400 malformed, 401 unauthenticated, 403 forbidden, 404, 409 conflict (dup review/
username), 422 validation, 429 rate-limited, 500 internal (no leakage; Sentry id returned).

## 13. Health, Config, Observability

- `/health` liveness; `/health/ready` checks DB + Redis.
- OpenTelemetry SDK auto-instruments HTTP/Prisma/Redis → OTLP collector; trace id on every log
  and error response. Sentry for exceptions with release + user (id only) context.

---

*End of Phase 3. Production NestJS code is scaffolded under `clubscan/backend/src` (Phase 8),
starting with platform modules + Auth + Users + Profiles + Venues + Reviews/Scoring.*
