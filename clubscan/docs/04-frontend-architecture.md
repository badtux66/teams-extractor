# ClubScan — Phase 4: Frontend Architecture (Mobile)

> **Status:** Phase 4 of 8 · **Stack:** Expo (RN) · TS · Expo Router · TanStack Query ·
> Zustand · React Hook Form + Zod · NativeWind · Sentry
>
> Defines the design system, theme, navigation, state architecture, and API client. Code is
> scaffolded under `clubscan/mobile/`.

---

## 1. App Architecture Principles

- **Feature-first foldering** mirroring backend contexts (`features/auth`, `features/venues`,
  `features/reviews`, `features/discovery`, `features/profile`, `features/safety`,
  `features/notifications`).
- **Server state ≠ client state.** TanStack Query owns all server data (caching, retries,
  pagination, optimistic updates). Zustand owns ephemeral/global UI + session state only.
- **Schema-driven.** Zod schemas validate forms (RHF resolver) and parse API responses —
  mirroring backend DTO rules so the contract is enforced on both ends.
- **Typed API client** generated around the Phase 3 REST contract; one `apiClient` with auth
  refresh interceptor.
- **Dark-first** premium nightlife aesthetic; full light mode; system-driven with override.
- **Offline-tolerant reads** via Query persistence; optimistic writes for follow/save/helpful.

## 2. Design System & Theme

### 2.1 Tokens (NativeWind / Tailwind config)
- **Color (dark default):** `bg.base #0A0A0F`, `bg.elevated #14141C`, `surface #1C1C28`,
  `border #2A2A38`, `text.primary #F5F5F7`, `text.muted #A1A1B5`.
  **Brand:** `primary #7C5CFC` (electric violet), `accent #FF4D8D` (neon pink),
  `success #2ED573`, `warn #FFB020`, `danger #FF4757`, `safety #36C5F0`.
  Light mode is a token remap, not a separate component set.
- **Score color scale:** red→amber→green ramp for 0–100 (the ClubScan Score ring).
- **Typography:** display/headline/title/body/label scale; system font + optional `Satoshi`/
  `Inter` via expo-font; dynamic-type aware.
- **Spacing:** 4-pt base scale (`1=4px … 8=32px`); radii `sm 8 / md 12 / lg 20 / pill 999`.
- **Elevation:** layered surfaces + subtle glow on primary CTAs (nightlife feel).
- **Motion:** `react-native-reanimated`; 150–250ms ease; press scale, shared-element venue
  transitions, skeleton shimmer.

### 2.2 Theme system
- `ThemeProvider` exposes tokens via context + NativeWind `dark:` variants.
- `useColorScheme()` + persisted user override (Zustand `uiStore`, AsyncStorage).
- All components consume semantic tokens (never raw hex).

### 2.3 Component library (`src/components/ui`)
Primitives: `Button`, `IconButton`, `Input`, `TextArea`, `Select`, `Chip`, `Badge`, `Avatar`,
`Card`, `Sheet` (bottom sheet), `Modal`, `Toast`, `Skeleton`, `Tabs`, `SegmentedControl`,
`RatingStars`, `ScoreRing` (animated composite score), `CategoryBar` (per-category score),
`EmptyState`, `Spinner`, `Divider`, `ListItem`, `SearchBar`, `FilterSheet`, `MapPreview`
(Google Maps), `ImageGallery`, `PhotoPicker`. All themed, accessible (labels, hit slop,
contrast), RTL-safe.

Composite domain components: `VenueCard`, `VenueHeader`, `EventCard`, `ReviewCard`,
`ReviewComposer`, `UserCard`, `FeedItem`, `NotificationItem`, `ReportSheet`,
`SafetyReportForm`.

## 3. Navigation (Expo Router, file-based)

```
app/
  _layout.tsx                 root: providers, theme, splash, auth gate
  (auth)/                     unauthenticated stack
    welcome.tsx  login.tsx  register.tsx  verify-email.tsx
    forgot-password.tsx  reset-password.tsx  choose-username.tsx
  (tabs)/                     authenticated tab bar
    _layout.tsx               Discover | Search | Create | Activity | Profile
    index.tsx                 Discover (home: near me, events, top venues)
    search.tsx
    create.tsx                review composer entry
    activity.tsx              feed + notifications
    profile.tsx               current user
  venue/[slug].tsx            venue detail (score, reviews, events, map)
  event/[id].tsx              event detail
  user/[username].tsx         public profile
  review/[id].tsx             review detail / edit
  settings/                   account, sessions, devices, language, theme
  safety/report.tsx           safety incident form
  +not-found.tsx
```
- Auth gate in root layout: redirect to `(auth)` if no valid session; deep links
  (`clubscan://venue/...`, universal links) resolve to detail screens (share feature).

## 4. State Architecture

### 4.1 Server state — TanStack Query
- Query keys namespaced: `['venues',params]`, `['venue',slug]`, `['venue',id,'reviews']`,
  `['feed']`, `['me']`, `['notifications']`, etc.
- Infinite queries for lists (cursor pagination from API).
- Mutations with optimistic updates + rollback for: follow/unfollow, save event, mark helpful,
  read notification. Invalidate venue + score after review submit.
- Persisted cache (AsyncStorage) for offline reads; staleTime tuned per resource.

### 4.2 Client state — Zustand stores
- `authStore`: tokens (SecureStore), current user snapshot, hydration state, login/logout.
- `uiStore`: theme override, locale, onboarding flags, active filters.
- `composerStore`: in-progress review draft (ratings, body, photos) — survives navigation.
- No server data duplicated into Zustand.

### 4.3 Forms — RHF + Zod
- `zodResolver` per form; schemas in `features/*/schema.ts` mirror backend validation.
- Inline field errors, submit disabled until valid, server error mapping to fields.

## 5. API Client Architecture

- `src/lib/api/client.ts`: typed fetch wrapper (or axios) with:
  - base URL from env, JSON, `Authorization` header from `authStore`,
  - **401 interceptor**: single-flight refresh via `/auth/refresh`, queue + retry, logout on
    refresh failure,
  - request id propagation, Zod response parsing, RFC7807 error normalization to `ApiError`.
- `src/lib/api/endpoints/*`: one module per context returning typed functions used by Query
  hooks (`features/*/queries.ts`, `features/*/mutations.ts`).
- Analytics beacon batches events to `/analytics/events`.

## 6. Internationalization
- `i18next` + `expo-localization`; namespaces per feature; EN + TR catalogs in `src/i18n`.
- Locale persisted (uiStore) and synced to backend (`user.locale`); date/number via `Intl`.

## 7. Maps & Media
- `react-native-maps` (Google provider) for venue map + "near me" discovery; clustering.
- Photo upload flow: pick → request `/media/presign` → PUT to S3 → `/media/:id/complete` →
  attach `assetId` to review. Image compression client-side before upload.

## 8. Quality & DX
- TS strict; ESLint + Prettier; absolute imports (`@/`); Jest + React Native Testing Library
  for components/hooks; Detox (later) for E2E; Sentry RN SDK; EAS Build/Update for OTA.

---

*End of Phase 4.*
