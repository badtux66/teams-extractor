# ClubScan — Phase 7: Folder Structures

> **Status:** Phase 7 of 8 · The definitive directory layout for backend and mobile.
> Phase 8 code is generated into these trees.

---

## 1. Monorepo Root (`clubscan/`)

```
clubscan/
├── docs/                       # phases 1–7 (this set)
├── backend/                    # NestJS API (modular monolith)
├── mobile/                     # Expo React Native app
├── docker-compose.yml          # local dev stack
├── .env.example
└── README.md
```

## 2. Backend (`clubscan/backend/`) — Clean Architecture per module

```
backend/
├── prisma/
│   ├── schema.prisma           # canonical schema (Phase 2)
│   ├── migrations/             # incl. raw SQL for PostGIS + extensions
│   └── seed.ts                 # genres, app_config, super-admin, dev demo data
├── src/
│   ├── main.ts                 # bootstrap: helmet, CORS, validation pipe, OTel, Sentry
│   ├── app.module.ts           # composition root (imports all feature + platform modules)
│   │
│   ├── platform/               # cross-cutting infrastructure (Shared Kernel)
│   │   ├── prisma/             # PrismaModule + PrismaService
│   │   ├── redis/              # RedisModule (cache, throttler store)
│   │   ├── config/             # typed ConfigModule, AppConfig loader, feature flags
│   │   ├── event-bus/          # EventBusPort + in-process adapter (swappable)
│   │   ├── audit/              # AuditModule, @Audit() interceptor
│   │   ├── i18n/               # nestjs-i18n setup + en/tr catalogs
│   │   ├── observability/      # OTel + Sentry init, LoggingInterceptor
│   │   ├── http/               # AllExceptionsFilter, response/serializer interceptor
│   │   ├── security/           # guards: JwtAuthGuard, RolesGuard, PoliciesGuard, throttler
│   │   └── pagination/         # cursor helpers, base DTOs
│   │
│   ├── shared/                 # framework-agnostic shared kernel
│   │   ├── domain/             # base Entity, AggregateRoot, ValueObject, DomainEvent, Result
│   │   ├── ids/                # uuidv7 generator, branded id types
│   │   └── errors/             # domain/app error types → mapped to RFC7807
│   │
│   └── modules/                # one folder per bounded context
│       ├── auth/
│       │   ├── domain/         # Token VO, Credentials, policies
│       │   ├── application/    # use-cases: Register, Login, Refresh, OAuthLogin, ResetPwd
│       │   │   ├── ports/      # TokenServicePort, OAuthVerifierPort, MailerPort
│       │   │   └── dto/        # request/response DTOs (zod schemas)
│       │   ├── infrastructure/ # JwtTokenService, GoogleVerifier, AppleVerifier, Mailer
│       │   └── presentation/   # AuthController, strategies, guards wiring
│       ├── users/              # (same 4-layer shape)
│       ├── profiles/           # profile + follows + reputation
│       ├── venues/             # venue catalog (+ raw geo SQL repo)
│       ├── events/
│       ├── reviews/            # review commands
│       ├── scoring/            # ScoreCalculator (domain) + VenueScore read model (CQRS)
│       ├── search/             # discovery + search (Postgres FTS/trgm/geo) behind a port
│       ├── moderation/         # reports, cases, sanctions, AI moderation port
│       ├── safety/             # incidents + escalation state machine
│       ├── notifications/      # notifications + feed fan-out + FcmGateway
│       ├── analytics/          # ingest + metrics queries
│       ├── media/              # S3 presign + MediaAsset lifecycle
│       └── admin/              # moderator/admin dashboard composition
│
├── test/                       # e2e + integration (vitest/jest + supertest)
├── Dockerfile
├── package.json  tsconfig.json  nest-cli.json  .eslintrc  vitest.config.ts
└── .env.example
```

**Module internal convention (every `modules/<x>`):**
`domain/` (entities, VOs, domain services, events — no framework) →
`application/` (use cases, `ports/`, `dto/`, mappers) →
`infrastructure/` (Prisma repos implementing ports, external adapters) →
`presentation/` (controllers, guards/policies, swagger) → `<x>.module.ts` (DI wiring).

## 3. Mobile (`clubscan/mobile/`) — feature-first

```
mobile/
├── app/                        # Expo Router routes (Phase 4 §3 tree)
│   ├── _layout.tsx  (auth)/  (tabs)/  venue/  event/  user/  review/  settings/
│   ├── safety/  +not-found.tsx
├── src/
│   ├── components/
│   │   ├── ui/                 # design-system primitives (Button, ScoreRing, ...)
│   │   └── domain/             # VenueCard, ReviewCard, FeedItem, ...
│   ├── features/               # mirrors backend contexts
│   │   ├── auth/   ├── profile/   ├── venues/   ├── events/
│   │   ├── reviews/ ├── discovery/ ├── search/   ├── notifications/
│   │   ├── feed/   └── safety/
│   │       # each: queries.ts, mutations.ts, schema.ts (zod), components/, hooks/
│   ├── lib/
│   │   ├── api/                # client.ts (auth-refresh interceptor) + endpoints/
│   │   ├── query/              # QueryClient, persistence, keys
│   │   └── analytics/          # event beacon
│   ├── stores/                 # zustand: authStore, uiStore, composerStore
│   ├── theme/                  # tokens, ThemeProvider, color scales
│   ├── i18n/                   # i18next setup + en/ tr/ catalogs
│   ├── hooks/                  # shared hooks (useColorScheme override, useDebounce, ...)
│   └── utils/                  # formatters (Intl), geo, image compression
├── assets/                     # fonts, icons, splash
├── app.json / app.config.ts    # Expo + EAS config, deep links, plugins
├── tailwind.config.js          # NativeWind tokens
├── babel.config.js  metro.config.js  tsconfig.json  package.json
└── .env.example
```

## 4. Naming & Conventions
- Files: `kebab-case.ts`; classes `PascalCase`; DI tokens `UPPER_SNAKE` symbols.
- Ports suffixed `.port.ts`; adapters `.adapter.ts`/`.repository.ts`; use cases `*.use-case.ts`
  or `*.service.ts`; DTOs `*.dto.ts` (+ zod `*.schema.ts`).
- Absolute imports: backend `@/modules/...`, `@/platform/...`; mobile `@/features/...`.
- Tests colocated `*.spec.ts` (unit) + `test/*.e2e-spec.ts`.

---

*End of Phase 7. Phase 8 generates production code into these trees.*
