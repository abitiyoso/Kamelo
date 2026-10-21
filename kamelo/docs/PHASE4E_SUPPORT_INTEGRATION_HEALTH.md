# Phase 4E — customer support and integration readiness

19 October 2026. Incremental completion of the approved v5.3 Support Center and Integrasi & Audit surfaces. Approved public v7/v6, shell/navigation, logo/photos, green identity and subscription/tenant financial rules are retained. This is a bounded increment, not full V3 acceptance.

## Delivered behavior

Owners open **Akun & Pengaturan → Bantuan pelanggan** to create categorized, prioritized organization tickets and read/reply to their timeline. The standalone `/account` screen exposes the same help to an active owner context, including owners who have not yet created a property. Staff and tenant contexts cannot use the organization support API. Their existing property-service workflows are unchanged.

The Platform ELENIO workspace exposes the cross-organization Support Queue with search, status filters and self-assignment. Admins can request owner information or record resolution; owner replies resume a waiting case. Owners can close a resolved case, and either authorized side can explicitly reopen it with a reason. Resolved/closed cases reject replies until reopened. Priority is an owner-supplied triage signal, not an SLA or external escalation notification. Assignment records responsibility; it does not grant access to customer content outside the shared case. Reassignment/impersonation, MFA elevation and temporary access to sensitive tenant/camera/device content are not implemented or enabled.

Every write requires a reviewed-content confirmation. Source subject/category/priority/organization remain immutable, while replies/status changes append an immutable revisioned timeline. The body is encrypted using the existing AES-GCM server encryption service. Searchable subject, routing/status and timestamps remain plaintext metadata. UI instructs users to omit passwords, PINs, keys, identity documents and resident details. Messages are plain text escaped by React, with no HTML interpretation, uploads, internal notes, silent edits or deletion. All shared case content is visible to the organization's owners and authorized platform admins; the case itself never opens room, camera, identity, proof or credential access.

## Integration and audit scope

The read-only platform panel shows six service readiness states, evaluated from existing implementation and safe configuration checks. Hostinger SMTP validates official host/port and credential presence without returning values. Configured/live-gated mail is labeled **unverified**, not connected. Local sink, disabled delivery and invalid configuration have distinct states. Other current adapters are explicitly unconnected, simulated or rule-based. No DNS, network probe, email, hardware command or external provider request is triggered.

Email queue counts show aggregate delivery states across the platform, without recipients, payloads, tokens or private errors. Provider acceptance is distinguished from inbox receipt. The audit viewer is deliberately restricted to existing `SAAS_*` and new `SUPPORT_*` events, with 30-row pagination and domain filters. It returns organization label, action, opaque target reference and timestamp; arbitrary metadata, actor identities, messages and tenant/security audit events are excluded. This is a support/subscription activity projection, not a complete security-access audit or incident monitoring system.

## File-by-file changes

| Files | Change |
|---|---|
| `prisma/schema.prisma` | SupportCase, SupportEntry, organization and assignee relations; scoped/filter/FK indexes. |
| `prisma/migrations/20261018230000_support_cases/migration.sql` | Additive tables, constraints, immutable source/history triggers and sequential revisions. |
| `lib/support.ts`, `lib/support-rules.mjs` | Scoped case commands, encrypted append-only conversation, guarded transitions and support audit. |
| `app/api/support/route.ts` | Owner/platform private reads and writes; organization isolation, pagination, optimistic revision, same-origin/rate limit, fresh role/session checks, organization lock and actor/domain-bound idempotency. |
| `lib/integration-readiness.mjs`, `app/api/platform-health/route.ts` | Secret-free readiness projection, aggregate queue and restricted audit read API. |
| `components/workspace/support.tsx` | Approved-style queue, owner submission, detail/reply/claim/status/history dialogs, loading/errors and retry-preserving commands. |
| `components/workspace/platform-health.tsx` | Readiness cards, aggregate queue and paginated audit filters. |
| `components/workspace/admin.tsx`, `components/identity/account-settings.tsx` | Connect existing admin modules and owner account help entry point. |
| `app/workspace.css` | Scoped wrapping, bounded modal layout and 44px dialog actions. |
| `tests/support.test.mjs`, `tests/support.integration.mjs` | Transition/readiness, authorization, concurrency, immutable history, projection privacy and all-history pagination checks. |
| `scripts/phase4e-qa-migrate.mjs`, `scripts/phase4e-qa-verify.mjs`, `package.json` | Disposable-only migration/preservation, regression runner and package commands. |
| README, status, design QA, phase reports/manifest and curated evidence | Review scope, verification and artifact hashes. |

## Migration, security and rollback

Only disposable PostgreSQL on loopback 55432 was migrated. Hashes and counts for 28 existing tables matched before/after, including Phase 4D expense/reconciliation records. Evidence: `artifacts/phase4e/migration-preservation.json`. No historical backfill, data rewrite, main/production migration or new access grant occurred. The DDL depends on the earlier immutable-history helper. Assignee FK is indexed; case lookups/list/status and case timeline indexes match query scope. Real-volume query plans and production DDL lock time remain staging checks.

Writes reuse existing lifecycle command storage with a distinct SUPPORT domain, serialized organization lock, exact-payload retry hashing and a fresh session/membership/platform privilege check inside the transaction. Concurrent updates with the same revision allow one winner; stale attempts require an explicit detail refresh. Database triggers preserve sent messages and original case metadata. Reads are private/no-store and sanitize decryption/database failures. These protections do not substitute for final production security review, MFA policy, abuse controls or privacy/retention governance.

Before production: verify target/migration history; back up and rehearse restore on UTF8 staging; preserve the same encryption key alongside protected backups; confirm approved support access and retention policies, and run regression with actual volume. The embedded QA instance uses WIN1252; UTF8 restore remains unverified. To back out, revert the app while retaining case/event tables and encryption material. Do not drop customer history or rewrite sent messages. Deletion/privacy requests require a reviewed retention workflow, still pending.

## Verification

Production build/typecheck and 27 unit tests passed. All 11 isolated API suites passed: **84 scenario groups**, including seven new support groups. Coverage includes owner/platform/staff/anonymous and organization boundaries, origin/filter checks, explicit content consent, encryption, duplicate/changed retries, concurrent revision conflicts, legal state transitions, immutable timeline/source records, tenant invoice preservation, revoked platform access, secret-free readiness/audit projections and pagination beyond visible pages. No support write increased the email outbox count. The first run after the session break failed because the disposable database had stopped; after restarting that same QA database the full suite passed. Test harness fixes respected the existing staff plan limit and corrected an unused imported test helper.

Browser checks cover owner submission → platform search → self-assignment → admin reply, plus integration status/filter navigation and desktop/mobile layout. See [bounded browser QA](PHASE4E_DESIGN_QA.md). Final build follows only a 44px dialog-button CSS refinement; the final browser check verifies it. Earlier API results remain applicable to that CSS-only change.

No real emails, messages to external people, funds transfers, physical-device operations, deployment, production migration, commit or push occurred. Next remaining increments include scoped tenant/staff messaging, imports and privacy/retention request handling, configured provider acceptance and production rollout/restore/accessibility/performance checks. Keep the original V3 delta matrix as the overall acceptance source.
