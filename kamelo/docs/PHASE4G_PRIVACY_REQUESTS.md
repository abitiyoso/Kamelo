# Phase 4G — personal privacy requests and account summary

19 October 2026. Incremental addition to the approved account and Support Center surfaces. Approved public v7/v6, backoffice v5.3 navigation/identity, PostgreSQL business data, financial rules and provider gates retained. This increment is not complete V3 acceptance or a final legal/retention policy.

## Delivered behavior

Verified account holders open **Akun → Privasi & salinan data** in an owner, staff, resident or standalone account context. They can request COPY, CORRECTION, DELETION or CLOSE_ACCOUNT review, add information, withdraw an open request or ask for reconsideration after a response/decline. Requests belong to the individual user, not the current organization role. An owner cannot see a staff member's or resident's personal privacy request simply by owning the property. Users can request review even after property access ends, as long as their own account remains verified and active.

Authorized Platform ELENIO admins use **Support Center → Permintaan privasi**. Filters cover request type/status and 20-row pagination. Reviewers can begin review, ask for information, record a referenced response or decline with an explanation. Final response/decline requires an IN_REVIEW state and a review reference. The requester can read the same immutable history and request reconsideration; duplicate open requests of the same type are blocked. Request withdrawal is distinct from deletion of the request history.

Status **Tanggapan dicatat / RESPONDED** records a response only. No endpoint executes account closure, data deletion, anonymization, profile correction or financial alteration. Retention, ownership, legal basis, identity recovery and final fulfillment remain reviewed operations requiring approved business policy. No retention duration, statutory deadline or automatic execution is invented. CANCELLED retains both account and request history. No email/WhatsApp notification is sent or queued by this flow.

Messages and review references are encrypted through the existing AES-GCM server service. Request type, state, source user, revision and timestamps remain routing metadata. Creation explicitly explains the audience and review-only effect. React renders text rather than HTML; attachments, identity-document uploads and credential submission are not introduced. Sent history and original requester/type cannot be rewritten or deleted. Platform view exposes requester display name and shared request text, not a customer's entire profile, resident records, camera feed, proofs or credentials.

## Account summary download

**Unduh ringkasan akun** returns a private JSON attachment for the authenticated user only. It includes their own profile/contact/verification preferences, active organization memberships, active unrevoked stay grants with property/room/date labels, and statuses of their own privacy requests. It excludes passwords, sessions/tokens, encrypted payloads, financial documents, other users' contact details and shared conversation text. It is explicitly an account summary, not a complete personal-data access package or organization backup.

Arbitrary user/organization selectors are rejected; platform mode cannot download a customer's summary. Downloads use no-store, no-referrer, nosniff and a fixed attachment filename. No export file is persisted by the server. Each collection is capped at 1,000 records; an oversized summary returns an explicit request-for-review error rather than truncating. Full documents/transactions or a broader copy are handled through the review request, not silently included in this download. Browser acceptance observed a real download, parsed the downloaded JSON and verified own-account/scope/no-credential checks without adding its personal payload to review artifacts.

## File map

| File | Change |
|---|---|
| `prisma/schema.prisma` | PrivacyRequest/PrivacyEntry and requester relation, indexes and unique history sequence. |
| `prisma/migrations/20261019070000_privacy_requests/migration.sql` | Additive tables, valid states, unique open kind per account, immutable source/history and sequential revision triggers. |
| `lib/privacy-rules.mjs`, `lib/privacy.ts` | Review-only state transitions, fresh verified actor/platform checks, encrypted history and bounded own-account summary. |
| `app/api/privacy/route.ts` | Scoped private list/detail/download and same-origin, rate-limited, user-locked, actor/domain-idempotent writes. |
| `components/workspace/privacy.tsx` | Request/summary UI, reviewed submission, references, filters, pagination, feedback and bounded dialogs. |
| `components/identity/account-settings.tsx` | Verified personal privacy entry point; existing support and privacy panels are mutually exclusive. |
| `components/workspace/admin.tsx` | Add privacy review tab inside existing Support Center navigation. |
| `tests/privacy.test.mjs`, `tests/privacy.integration.mjs` | Transition policy, forbidden execution claims, identity isolation, summary privacy, review/cancel races, preservation, immutability and pagination limits. |
| `scripts/phase4g-qa-migrate.mjs`, `scripts/phase4g-qa-verify.mjs`, `package.json` | Disposable-only migration preservation and reproducible verification. |
| README/status/design QA, phase reports/manifest and curated artifacts | Scope, verification, visual evidence and file hashes. |

## Migration, security and rollback

Only disposable PostgreSQL on loopback port 55432 was migrated. Hashes/counts for 32 pre-existing tables matched before/after, including messages, support and financial records. No backfill, main/production migration or existing data rewrite occurred. Evidence: `artifacts/phase4g/migration-preservation.json`. Applied migration bytes/checksum are retained. It depends on the previous immutable-history helper. Requester/filter/sort indexes and leading request-history unique indexes match the bounded queries.

Writes recheck verification, account state and platform context inside the transaction, after locking the requester. Current revision is required for follow-up; concurrent competing updates allow one winner. LifecycleCommand exact-retry responses use a PRIVACY domain and actor hash, with the requester's canonical organization only as internal command storage; no organization-scoped read permission is granted by that storage. Partial uniqueness independently protects one open kind per account. Reads are consistently scoped and sanitized. Personal privacy histories are not added to the general support/subscription audit projection.

Before production: verify target/history, back up and rehearse UTF8 restore, preserve encryption keys with protected backups, approve fulfillment/retention/legal/access-recovery policies, and review scale/DDL locks, security and accessibility. Embedded QA uses WIN1252; production UTF8 restore remains unverified. Backout should revert the app while retaining request/history tables and encryption material. Do not drop records to simulate fulfillment. Actual erasure/closure requires a separate reviewed implementation, including accounting retention and ownership continuity.

## Verification and remaining scope

Production build/typecheck, **29 unit tests**, and all **13 isolated API suites / 100 scenario groups** passed. Eight new privacy groups cover anonymous/verified/platform/origin boundaries; own JSON attachment projection; encrypted explicit requests/idempotency/duplicate races; same-organization personal isolation and reviewed references; competing review/withdrawal; immutable history; all-history queue/entry pagination and oversized-summary refusal; and revoked platform/unverified identity rejection.

Tests compare actual synthetic account, invoice/payment and message-history hashes and confirm the outbox count stays unchanged through privacy commands. The export-cap test uses 1,001 additional closed synthetic request fixtures to exercise the bound; these are QA test data, not user submissions or completed legal requests. Full API regression precedes only the final clearer over-limit error; the targeted eight-group privacy suite passed again with an explicit error-message assertion.

Browser coverage includes downloaded-file verification, duplicate rejection with retained form text, reviewed submission, referenced platform response, account continuity and 320/390px dialogs. See [bounded browser QA](PHASE4G_DESIGN_QA.md).

No real external emails/messages, deletion, account closure, funds transfer, hardware operation, production migration/deployment, commit or push occurred. Remaining V3 work includes imports and broader exports, approved retention/fulfillment/ownership-recovery policy and implementation, configured external-provider acceptance, and production restore/performance/accessibility/security rollout checks.
