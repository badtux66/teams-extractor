# ClubScan — Phase 6: Security Architecture

> **Status:** Phase 6 of 8 · Target: OWASP ASVS L2, OWASP Top 10 coverage, OWASP MASVS (mobile)
>
> Threat model, controls, authz policies, secure uploads, privacy/compliance, and the audit
> model. Security is a cross-cutting concern realized in Phase 3 guards/interceptors and Phase
> 5 infra.

---

## 1. Threat Model (STRIDE, key risks)

| Threat | Vector | Mitigation |
|---|---|---|
| **Spoofing** | Stolen tokens, OAuth replay | Short JWT TTL, hashed rotating refresh + reuse detection, server-side OAuth token verification, device binding |
| **Tampering** | Mass-assignment, param tampering, IDOR | Whitelist DTOs, ownership policies (ABAC), UUID v7 (non-enumerable), authz on every object access |
| **Repudiation** | "I didn't ban them" | Immutable audit log for all privileged actions |
| **Information disclosure** | PII leak, safety-report exposure, stack traces | Field serialization stripping, RBAC on safety data, RFC7807 (no stack/SQL leakage), least-privilege DB |
| **Denial of service** | Brute force, scraping, review spam | Redis rate limiting (tiered), velocity checks, WAF, pagination caps, query timeouts |
| **Elevation of privilege** | Role escalation, JWT forgery | RS256 + JWKS, role in token validated against DB status, SUPER_ADMIN-only role changes, audited |

Abuse-specific: review brigading → Bayesian shrinkage + reputation weighting + rate limits +
one-review-per-venue + AI/human moderation. Fake venues → curated/admin publish workflow.

## 2. OWASP Top 10 Controls

1. **Broken Access Control** — global `JwtAuthGuard` + `RolesGuard` + `PoliciesGuard`;
   default-deny; ownership checks; shadow-ban scoping; no client-trusted authz.
2. **Cryptographic Failures** — TLS everywhere; Argon2id password hashing; tokens hashed
   (SHA-256) at rest; secrets in secret manager; no sensitive data in logs.
3. **Injection** — Prisma parameterized queries; raw geo SQL uses bound params; input
   validation; output is JSON (no template injection); HTML stripped from user text.
4. **Insecure Design** — threat-modeled flows, safety pipeline isolation, least privilege,
   defense in depth.
5. **Security Misconfiguration** — Helmet headers, CORS allowlist, disabled `x-powered-by`,
   non-root container, minimal base image, env-separated config, no default creds.
6. **Vulnerable Components** — `pnpm audit`/Dependabot in CI, pinned lockfile, base image
   scanning.
7. **Identification & Auth Failures** — strong password policy + zxcvbn, email verification,
   lockout/throttle on login & reset, secure session/device management, refresh rotation.
8. **Software & Data Integrity** — signed artifacts, CI provenance, OTA updates signed (EAS),
   migration integrity (advisory-lock guarded).
9. **Logging & Monitoring Failures** — audit log + OTel + Sentry; alerting on auth anomalies
   and report-queue spikes.
10. **SSRF** — no user-supplied URLs fetched server-side except validated OAuth endpoints;
    media via presigned PUT (client→S3), backend never proxies arbitrary URLs.

## 3. HTTP Hardening
- **Helmet**: HSTS, `X-Content-Type-Options`, `Referrer-Policy`, frame-deny, CSP for any web
  surface. **CORS**: explicit origin allowlist, credentials off (bearer tokens).
- **CSRF**: API is token-based (Authorization header, not cookies) → CSRF not applicable to
  the mobile bearer flow; any cookie-based web admin uses SameSite=strict + CSRF tokens.
- **XSS**: server stores plain text (HTML stripped); mobile renders text (no HTML injection);
  any web admin escapes + CSP.

## 4. Authorization Policies (enumerated)
- `CanEditReview`: actor is review author (and not banned) OR role ≥ MODERATOR.
- `CanDeleteReview`: author OR role ≥ MODERATOR (moderator delete = audited removal).
- `CanViewIncident` / `CanTransitionIncident`: role ∈ {MODERATOR, ADMIN, SUPER_ADMIN}.
- `CanIssueSanction`: WARNING/CONTENT_REMOVAL ≥ MODERATOR; bans ≥ ADMIN; role change =
  SUPER_ADMIN only. All audited.
- `CanManageVenue`: ADMIN+ (v1; owner-claim deferred).
- `CanViewSession/Device`: owner only.

## 5. Secure File Uploads
- Presigned **PUT** direct to S3; backend issues short-TTL URL scoped to `key` + `content-type`
  + max size. Allowed MIME allowlist (image/jpeg|png|webp|heic); size cap (e.g. 10MB).
- Server-side validation on `/media/:id/complete`: re-check content-type/size via S3 head;
  optionally async image processing (strip EXIF/GPS, re-encode, generate thumbnails) to
  neutralize malicious payloads and protect privacy. Assets `PENDING`→`READY`; only `READY`
  assets owned by caller can attach to content. Private bucket; access via CDN signed URLs.

## 6. Privacy & Compliance (GDPR / KVKK)
- **Lawful basis + consent** for analytics; PII-minimized events.
- **Data subject rights:** export (`/me/export`, async) and erasure (hard-delete + anonymize
  authored content, audited). Soft-delete first, purge on request.
- **Data minimization:** safety reports support anonymity; reporter identity never exposed to
  targets; access logged.
- **Retention:** audit/analytics retention windows; token tables auto-expire; EXIF/GPS
  stripped from photos by default.

## 7. Audit Trail
- Append-only `audit_log_entries` via `@Audit()` interceptor: who/what/when/where for bans,
  shadow bans, role changes, content removals, config changes, safety-data access, new-device
  logins. Immutable, queryable by SUPER_ADMIN, exportable for incident response.

## 8. Mobile (MASVS) Notes
- Tokens in **SecureStore/Keychain** (not AsyncStorage); certificate pinning option;
  jailbreak/root awareness for sensitive flows; no secrets bundled (only public config);
  OTA bundles signed by EAS.

## 9. Secrets & Key Management
- JWT signing via rotating RS256 keys (JWKS); per-env keys; refresh tokens single-use rotated;
  DB/Redis/S3 creds least-privilege and rotated; nothing secret in the repo (enforced by
  secret scanning in CI).

---

*End of Phase 6.*
