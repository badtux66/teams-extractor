# ClubScan — Phase 1: Product Architecture

> **Status:** Phase 1 of 8 · **Owner:** Platform Architecture · **Last updated:** 2026-06-04
>
> This document defines the product vision, scope, domain model, system topology, and
> architectural principles for ClubScan. It is the source of truth that every later phase
> (database, backend, frontend, infra, security, code) must conform to. No code is written
> in this phase — this is the contract.

---

## 1. Mission & Product Thesis

**Mission:** Create a safer, more transparent nightlife ecosystem where users can discover
clubs, evaluate venues, share experiences, and make informed decisions.

**Thesis:** Nightlife is a high-trust, high-risk social activity that is currently served by
generic review apps (Google Maps, Yelp) and event aggregators (RA, DICE) that were never
designed around **safety** and **structured, category-level trust signals**. ClubScan's
defensible wedge is a **weighted, multi-dimensional scoring system** (with an explicit
*Safety-for-Women* signal) combined with **first-class moderation and safety reporting**.
This is a community-and-data product, not a booking product — we win on trust, coverage, and
signal quality.

### 1.1 Brand Personality (drives every UX & content decision)

| Trait | Implication |
|---|---|
| **Trustworthy** | Transparent scores, visible moderation, no pay-to-rank. Verified badges. |
| **Modern** | Premium dark-first aesthetic, motion, fast perceived performance. |
| **Data-driven** | Every venue surfaces structured metrics, not just stars. |
| **Community-first** | Reputation, follows, feed; contributors are recognized. |

### 1.2 Visual North Star

Spotify (dark, content-dense, media-forward) × Resident Advisor (event-centric, editorial) ×
Apple/Linear/Notion (restraint, typography, spacing discipline). See Phase 4.

---

## 2. Target Users & Personas

| Persona | Goal | Primary jobs-to-be-done |
|---|---|---|
| **The Explorer** (core consumer) | Find a good, safe night out tonight/this weekend | Discover venues & events near me, filter by genre/safety, read trustworthy reviews |
| **The Contributor** (power user) | Build reputation, help others | Write structured reviews, upload photos, follow people, earn reputation |
| **The Safety-Conscious User** | Avoid unsafe venues | Read *Safety-for-Women* / *Security* scores, report incidents |
| **Venue Owner/Manager** (later phase) | Manage venue presence | Claim venue, respond to reviews, view analytics (read-only in v1) |
| **Moderator / Admin** (internal) | Keep the platform safe & clean | Triage reports, action content/users, audit |

> **v1 scope note:** Venue owners are **out of scope for write access** in the first release.
> Venues are platform-curated + community-suggested. Owner claiming is a Phase-2 product epic.

---

## 3. Scope: Feature Epics → Capabilities

The 12 core feature areas map to **bounded contexts** (Section 5). Below is the capability
inventory used to drive the backlog and the API surface.

| # | Epic | Key capabilities (v1) |
|---|---|---|
| E1 | **Identity & Auth** | Email signup + verification, password reset, Google & Apple OAuth, JWT access + rotating refresh tokens, multi-device session management, device revocation |
| E2 | **User Profiles** | Username, bio, avatar, social links, verification status, reputation score |
| E3 | **Venues** | Clubs, bars, festivals, events, lounges; rich metadata, photos, hours, genres, capacity, geo, aggregate metrics |
| E4 | **Scoring** | 9 structured rating categories, weighted algorithm, recency + reputation weighting, Bayesian shrinkage |
| E5 | **Reviews** | CRUD, image upload, edit history, AI moderation, reporting, admin review |
| E6 | **Community** | Follow/unfollow, followers/following, activity feed, notifications |
| E7 | **Event Discovery** | Browse, filter, save, share events |
| E8 | **Search** | Venues, events, cities, genres, users; geo + full-text |
| E9 | **Moderation** | Roles, bans, shadow bans, content review, report queues |
| E10 | **Analytics** | Venue/event views, CTR, review engagement, retention |
| E11 | **Safety** | Structured incident reports (harassment/violence/discrimination/unsafe), escalation workflows |
| E12 | **i18n** | English + Turkish, locale-aware formatting, server-driven + client catalogs |

---

## 4. The ClubScan Scoring System (product spec)

This is the product's core IP. Detailed algorithm + storage land in Phase 2/3; the **product
rules** are fixed here.

### 4.1 Rating categories (1–5 each, per review)

1. Security
2. Staff behavior
3. Fair pricing
4. Crowd quality
5. Music quality
6. Sound system
7. Cleanliness
8. **Safety for women** *(elevated, see weighting)*
9. Overall atmosphere

### 4.2 Composite "ClubScan Score" (0–100) — design principles

The displayed venue score is **not** a naive average. It must resist manipulation, reward
trust, and prioritize safety. The algorithm (formalized in Phase 3) follows these rules:

- **Category weights** (sum = 1.0), tunable via config, default:
  Safety for women `0.18`, Security `0.16`, Staff behavior `0.12`, Crowd quality `0.10`,
  Fair pricing `0.10`, Cleanliness `0.10`, Music quality `0.10`, Sound system `0.08`,
  Overall atmosphere `0.06`.
- **Bayesian shrinkage** toward the global mean for low-volume venues (prior weight `m`),
  so 1 glowing review can't crown a venue.
- **Reviewer reputation weighting:** higher-reputation, verified users count more
  (capped to prevent oligarchy).
- **Recency decay:** exponential half-life (default 180 days) — a venue's score reflects its
  *current* state.
- **Anti-abuse:** one scored review per user per venue (editable); shadow-banned & flagged
  reviews excluded from aggregates; rate limits + velocity checks.
- **Transparency:** category sub-scores and review count always shown next to the composite.

### 4.3 Safety as a first-class citizen

- *Safety for women* and *Security* carry the highest weights.
- A venue with safety incident reports above a threshold gets a **safety advisory** surfaced
  in the UI (not auto-defamation — threshold + moderation gated).
- Safety reports (E11) are a **separate pipeline** from reviews (E5): they are private,
  escalation-driven, and never publicly attributed.

---

## 5. Domain Model — Bounded Contexts (DDD)

ClubScan is decomposed into bounded contexts. v1 ships as a **modular monolith** (NestJS
modules = contexts) with strict module boundaries so contexts can later be extracted into
services without rewriting domain logic. This is the pragmatic path to "scale to millions"
without premature microservice tax.

```
┌──────────────────────────────────────────────────────────────────────────┐
│                            ClubScan Domain Map                             │
├───────────────┬───────────────┬───────────────┬──────────────────────────┤
│  Identity &   │   Profile &    │    Venue       │        Review &          │
│  Access (IAM) │   Reputation   │   Catalog      │        Scoring           │
│               │                │                │                          │
│ users, creds, │ profiles,      │ venues, events,│ reviews, ratings,        │
│ sessions,     │ follows,       │ photos, hours, │ aggregates, score calc   │
│ devices,      │ reputation     │ genres, geo    │ (CQRS read models)       │
│ oauth         │                │                │                          │
├───────────────┼───────────────┼───────────────┼──────────────────────────┤
│  Discovery &  │  Moderation &  │   Safety &     │   Notifications &        │
│  Search       │  Trust         │   Incidents    │   Activity Feed          │
│               │                │                │                          │
│ search index, │ roles, bans,   │ incident       │ feed events, push (FCM), │
│ filters, feed │ shadow bans,   │ reports,       │ in-app notifications     │
│ ranking       │ report queues, │ escalation     │                          │
│               │ AI moderation  │ workflows      │                          │
├───────────────┴───────────────┴───────────────┴──────────────────────────┤
│           Analytics & Telemetry (event ingestion, metrics, retention)      │
├────────────────────────────────────────────────────────────────────────── │
│        Platform / Shared Kernel (audit log, media/storage, i18n, config)   │
└────────────────────────────────────────────────────────────────────────────┘
```

### 5.1 Context responsibilities & ubiquitous language

| Context | Aggregate roots | Owns | Talks to |
|---|---|---|---|
| **IAM** | `User` (credentials), `Session`, `Device` | Auth, tokens, OAuth, devices | everything (issues identity) |
| **Profile & Reputation** | `Profile`, `Follow` | Public profile, social graph, reputation score | IAM, Review (reputation inputs) |
| **Venue Catalog** | `Venue`, `Event` | Venue/event master data, media, geo, hours | Search, Review |
| **Review & Scoring** | `Review`, `VenueScore` (read model) | Reviews, ratings, score aggregation (CQRS) | Venue, Profile, Moderation |
| **Discovery & Search** | (read models) | Search index, ranking, event discovery, feed ranking | Venue, Review, Profile |
| **Moderation & Trust** | `Report`, `ModerationCase`, `Sanction` | Reports, bans, shadow bans, queues, AI verdicts | every content context |
| **Safety & Incidents** | `IncidentReport`, `Escalation` | Safety reporting + escalation workflow | Moderation, Notifications |
| **Notifications & Feed** | `Notification`, `FeedEntry` | Push (FCM), in-app notifications, activity feed | all (consumes domain events) |
| **Analytics** | `AnalyticsEvent` (append-only) | View/CTR/engagement/retention | all (consumes events) |
| **Shared Kernel** | `AuditLogEntry`, `MediaAsset` | Audit trail, media/S3, i18n catalogs, feature flags | all |

### 5.2 Inter-context communication

- **Synchronous** (in-process within the modular monolith): query interfaces / application
  services exposed by each module. No cross-module Prisma access — modules talk via
  application-layer ports (Repository/Service interfaces).
- **Asynchronous** (domain events): a lightweight internal event bus (NestJS `EventEmitter`
  in v1, swappable to a real broker — Redis Streams / SQS / Kafka — behind the same port).
  Events drive **Notifications**, **Analytics**, **Search indexing**, and **Score
  recomputation** so the write path stays fast and the read path is eventually consistent.

Example event flow:
```
ReviewPublished ─► [Scoring] recompute VenueScore read model
                ─► [Search]  reindex venue
                ─► [Feed]    fan-out to followers' feeds
                ─► [Analytics] record engagement event
                ─► [Reputation] adjust author reputation
```

---

## 6. Architectural Principles (binding for all phases)

1. **Clean Architecture** — dependencies point inward. Layering per module:
   `domain` (entities, value objects, domain services — zero framework deps) →
   `application` (use cases, ports, DTOs, CQRS handlers) →
   `infrastructure` (Prisma repos, S3, FCM, OAuth adapters) →
   `presentation` (NestJS controllers, guards, interceptors).
2. **Domain-Driven Design** — bounded contexts (Section 5), ubiquitous language, aggregates
   enforce invariants. No anemic leakage of business rules into controllers.
3. **SOLID** — especially DIP: application depends on **ports** (interfaces); infrastructure
   provides adapters wired by NestJS DI.
4. **Repository Pattern** — Prisma is hidden behind repository interfaces in `application`.
   Domain never imports `@prisma/client`.
5. **CQRS where appropriate** — split for **Scoring** and **Discovery/Search/Feed**: writes
   go through command handlers and emit events; reads come from denormalized read models
   (`VenueScore`, search index, feed) optimized for query performance. Simple CRUD contexts
   (Profile edits, etc.) stay command/query-merged to avoid ceremony.
6. **Eventual consistency at the edges** — aggregates are read instantly; aggregate *scores*,
   feeds, and search may lag by seconds. UI is designed to tolerate this.
7. **Everything auditable** — privileged actions write immutable `AuditLogEntry`.
8. **Config over code** — score weights, rate limits, thresholds, feature flags are config.
9. **API-first** — REST contract (Phase 3) is the boundary; the mobile app is one consumer.

---

## 7. System Topology (logical)

```
                         ┌───────────────────────────┐
                         │     Mobile App (Expo)      │
                         │  RN · TS · Expo Router ·   │
                         │  React Query · Zustand ·   │
                         │  RHF+Zod · NativeWind      │
                         └─────────────┬─────────────┘
                                       │ HTTPS (REST/JSON, JWT)
                                       ▼
                         ┌───────────────────────────┐
                         │   Edge / CDN + WAF + TLS   │
                         │   (rate limit, DDoS, CDN)  │
                         └─────────────┬─────────────┘
                                       ▼
            ┌──────────────────────────────────────────────────────┐
            │              NestJS API (modular monolith)            │
            │  Auth · Profile · Venue · Review/Scoring · Search ·   │
            │  Moderation · Safety · Notifications · Analytics      │
            │  ── guards, rate limiter, validation, audit, i18n ──  │
            └───┬───────────┬──────────┬─────────┬────────┬─────────┘
                │           │          │         │        │
                ▼           ▼          ▼         ▼        ▼
        ┌───────────┐ ┌──────────┐ ┌───────┐ ┌──────┐ ┌──────────────┐
        │PostgreSQL │ │  Redis   │ │  S3   │ │ FCM  │ │ External APIs │
        │ (Prisma)  │ │ cache /  │ │object │ │ push │ │ Google Maps · │
        │ primary + │ │ rate-lim │ │storage│ │      │ │ OAuth · AI    │
        │ replicas  │ │ /queues  │ │ +CDN  │ │      │ │ moderation    │
        └───────────┘ └──────────┘ └───────┘ └──────┘ └──────────────┘

        Cross-cutting observability: Sentry (errors) · OpenTelemetry
        (traces/metrics/logs) → collector → backend (e.g. Grafana/Tempo/Prom).
```

### 7.1 Why a modular monolith first

- One deployable, one DB, transactional integrity where it matters (reviews ↔ scores).
- Bounded-context module boundaries make extraction to services a **mechanical** later step.
- Cheapest path to correctness and velocity at <10M users; horizontal scale via stateless
  API replicas + read replicas + caching covers the early growth curve.

### 7.2 Scaling path (when metrics demand it)

1. Stateless API → horizontal autoscale behind LB.
2. Postgres read replicas for read-heavy contexts (Discovery, Venue, Scoring read models).
3. Redis for hot caches (venue pages, scores, sessions) + rate limiting + async queues.
4. Extract **Search** to a dedicated engine (OpenSearch/Meilisearch) — interface already
   abstracted.
5. Extract **Analytics** ingestion to a stream + columnar store.
6. Promote the in-process event bus to a real broker; peel off the highest-load contexts
   (Notifications, Analytics, Search) into services.

---

## 8. Non-Functional Requirements (NFRs)

| Category | Target (v1 → scale) |
|---|---|
| **Availability** | 99.9% API; graceful degradation (cached venue pages survive DB blips) |
| **Latency** | p95 < 300ms for read endpoints (cached), < 800ms for search; perceived instant via optimistic UI + skeletons |
| **Scalability** | Stateless API; design assumes 10M+ users, 100k+ venues, 10M+ reviews |
| **Consistency** | Strong for writes within an aggregate; eventual for scores/feed/search (seconds) |
| **Security** | OWASP ASVS L2 target; see Phase 6 |
| **Privacy/Compliance** | GDPR/KVKK (Turkey): data export & deletion, consent, data minimization; safety reports access-controlled |
| **Observability** | Every request traced (OTel), errors to Sentry, audit log for privileged actions |
| **Accessibility** | WCAG 2.1 AA intent on mobile (contrast, dynamic type, screen reader labels) |
| **i18n** | EN + TR at launch; all user-facing strings externalized |

---

## 9. Key End-to-End User Flows (v1)

These flows are the acceptance lens for the API and UI design in later phases.

1. **Onboard & verify** — signup → email verification → profile setup → location permission →
   personalized discovery.
2. **OAuth onboard** — Continue with Google/Apple → (first time) choose username → discovery.
3. **Discover tonight** — open app → geo + "open now" venues + nearby events → filter by
   genre/safety → venue detail.
4. **Evaluate a venue** — venue detail shows ClubScan Score, category breakdown, photos,
   hours, reviews → user decides.
5. **Contribute a review** — rate 9 categories → write text → attach photos → submit →
   AI moderation → published (or held) → score recomputes → followers' feeds update.
6. **Follow & feed** — follow a contributor → their new reviews/photos appear in activity feed
   + push notification.
7. **Save & share an event** — discover event → save → receive reminder → share deep link.
8. **Report unsafe behavior** — venue/review → "Report safety concern" → structured incident
   form → escalation workflow → moderator triage (private).
9. **Moderation triage** — moderator opens report queue → reviews flagged content/AI verdict
   → action (dismiss / remove / warn / ban / shadow ban) → audit logged → reporter notified
   of resolution (without exposing target identity for safety reports).

---

## 10. Roles & Authorization Model (product-level)

| Role | Capabilities |
|---|---|
| **User** | CRUD own profile/reviews, follow, save, report, view public content |
| **Moderator** | All User + view report queues, action reviews/comments, issue warnings, temporary bans, resolve reports |
| **Admin** | All Moderator + manage venues/events, permanent bans, shadow bans, manage moderators, view analytics dashboards |
| **Super Admin** | All Admin + role management, platform config (weights/flags), access full audit log, data-protection actions |

Enforced via RBAC + policy guards (Phase 3) and reflected in moderation tooling (Phase 3/6).
Sensitive transitions (ban, role change, config change) are **always audit-logged**.

---

## 11. Analytics & Safety as Product Surfaces

- **Analytics (E10)** is event-sourced: the app and API emit typed events
  (`venue_viewed`, `event_viewed`, `review_card_clicked`, `review_helpful_marked`, sessions).
  These power CTR, engagement, and retention cohorts. PII-minimized, consent-aware.
- **Safety (E11)** runs an **escalation state machine**:
  `SUBMITTED → TRIAGED → INVESTIGATING → ACTIONED|DISMISSED → CLOSED`, with severity-based
  SLAs and auto-escalation if unactioned. Violence/credible-threat reports fast-path to Admin.
  Detailed in Phase 3 (workflow) and Phase 6 (access control).

---

## 12. Technology Stack — Rationale Summary

| Layer | Choice | Why |
|---|---|---|
| Mobile | Expo (RN) + TS + Expo Router | Cross-platform, OTA updates, file-based routing, fast iteration |
| Data/Server state | TanStack Query | Caching, background refetch, pagination, optimistic updates |
| Client state | Zustand | Minimal, ergonomic global UI/session state |
| Forms | React Hook Form + Zod | Performant forms + shared schema validation (client & server reuse) |
| Styling | NativeWind | Tailwind ergonomics → consistent design system on RN |
| API | NestJS + TS | First-class DI, modular architecture, guards/interceptors, DDD-friendly |
| DB | PostgreSQL | Relational integrity, PostGIS-class geo, JSONB flexibility, full-text |
| ORM | Prisma | Type-safe, migrations, fits Repository pattern behind interfaces |
| Auth | JWT + rotating refresh + OAuth (Google/Apple) | Stateless access, secure long sessions, social onboarding |
| Storage | S3-compatible | Durable media, presigned uploads, CDN fronting |
| Push | FCM | Cross-platform push |
| Maps | Google Maps | Mature places/geo on mobile |
| Infra | Docker + GitHub Actions CI/CD | Reproducible builds, automated pipelines |
| Observability | Sentry + OpenTelemetry | Errors + distributed tracing/metrics/logs |

---

## 13. Out of Scope for v1 (explicit)

- Venue owner self-service write access / claiming (Phase-2 epic).
- Ticketing / payments / reservations.
- DMs / real-time chat.
- Web client (API is web-ready; client is mobile-first v1).
- ML-trained reputation/ranking models (heuristic + config-driven first).

---

## 14. Phase Map & Deliverables

| Phase | Deliverable | Artifact location |
|---|---|---|
| **1. Product architecture** ✅ | This document | `clubscan/docs/01-product-architecture.md` |
| 2. Database design | ER diagram, schema, Prisma models | `clubscan/docs/02-*`, `clubscan/backend/prisma/` |
| 3. Backend architecture | Modules, REST API, DTOs, validation, authz, rate limiting, audit, scoring algorithm | `clubscan/docs/03-*`, `clubscan/backend/` |
| 4. Frontend architecture | Design system, theme, navigation, state, API client | `clubscan/docs/04-*`, `clubscan/mobile/` |
| 5. Infrastructure | Docker, CI/CD, deploy plan, observability | `clubscan/docs/05-*`, compose/CI files |
| 6. Security | Threat model, OWASP controls, authz policies, file upload, audit | `clubscan/docs/06-*` |
| 7. Folder structures | Definitive backend + mobile trees | `clubscan/docs/07-*` |
| 8. Production code | Incremental, working code | `clubscan/backend/`, `clubscan/mobile/` |

---

## 15. Open Decisions to Confirm Before Phase 2

1. **Deployment target** for infra phase (e.g., AWS ECS/Fargate + RDS + S3, or Fly.io/Render,
   or self-hosted Docker Compose). Affects Phase 5 specifics. *(Default assumption: AWS-style
   containerized + managed Postgres + S3-compatible.)*
2. **AI moderation provider** (e.g., OpenAI moderation, AWS Rekognition/Comprehend, or a
   pluggable port with a stub). *(Default: define a `ContentModerationPort` with a provider
   adapter; ship a deterministic rule-based + pluggable AI adapter.)*
3. **Search engine** — Postgres FTS + trigram + PostGIS for v1, abstract behind a port for a
   later OpenSearch/Meilisearch swap. *(Default: Postgres-native for v1.)*

Unless you direct otherwise, Phase 2 will proceed on the **default assumptions** above.

---

*End of Phase 1. Awaiting confirmation to proceed to **Phase 2: Database Design**.*
