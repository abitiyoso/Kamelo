# Phase 3 — identity, access and transactional email readiness

18 October 2026. Implements the approved Phase 3 continuation of the existing application. Landing v7, Showcase v6, backoffice v5.3 assets, PostgreSQL business records, integer-IDR billing and existing plan rules are retained. This is a local review build, not production acceptance of the entire V3 backlog.

## Delivered and verified

- New registrations remain `PENDING` and cannot use business APIs until email verification. Verification uses a 256-bit single-use link, a hashed secret, stored expiry, bounded attempts, resend cooldown, generic duplicate-registration responses, and a matching signed-in identity. It does not mark property ownership as verified. Existing accounts remain operational as `LEGACY_ACTIVE`; their email addresses are **not** falsely marked verified.
- A single User can hold multiple organization memberships and occupant grants. Organization role/property/payment/device permissions are read from the selected active membership. Owners grant Staff access through an invitation; the old owner-created/shared-password `teamAdd` write is disabled. Reassignment and revocation invalidate old sessions. Legacy user permission columns are retained during transition.
- Staff and Tenant invitations have an intended email recipient, hashed rotating token, 48-hour expiry, explicit property/stay scope, acceptance/decline/reissue/revocation, issuer authority rechecks, atomic acceptance, and plan-capacity checks that reserve pending staff seats. Acceptance by invitation ID is permitted only for the signed-in verified intended recipient. Idempotent repeated acceptance does not duplicate membership or guests.
- Tenant accounts claim an existing Stay/Guest through `OccupantAccess`, without becoming organization members. `/resident` shows only the selected stay's bills, payment-proof workflow and active stay services. Own historical bills remain available after checkout; Wi-Fi, requests, and permitted mock controls stop when the stay ends. Arrears alone do not block room access. Physical lock controls remain governed by the existing simulated-provider rules.
- Personal account screens support name and notification preference updates, verified email change with current-password confirmation, password changes, reset, session listing/revocation and workspace switching. Email stays unchanged until the new address is verified; password/reset/email changes revoke old sessions. Session list IDs cannot be used as authentication tokens. Existing pre-migration reset links remain single-use during transition.
- Transactional outbox stores encrypted payloads and deduplication keys atomically with account/invitation state. Parallel workers claim rows using `FOR UPDATE SKIP LOCKED`. Stale/ambiguous sends become `UNKNOWN`, not automatic duplicate retries; known transient failures have bounded retries. `ACCEPTED` means provider acceptance, not inbox delivery.
- Local QA uses a private file sink with no SMTP/network mail. Hostinger SMTP 465/TLS or 587/STARTTLS is prepared server-side. Live delivery requires **both** `MAIL_LIVE_ENABLED=true` and an explicit recipient allowlist. HTML escaping, same-origin links, plain text, approved logo, minimum TLS and disabled URL/file attachments are tested. The legacy HTTPS adapter remains available under the explicit delivery gate.
- All 14 supplied email drafts are available. Verification, welcome, staff/tenant invitation, reset and security notices are wired. Billing/reminder/proof/task/subscription/support event-triggered emails remain for the appropriate later business phases; rendering a draft does not mean its workflow is implemented.

## Files changed in this phase

| Files | Change |
| --- | --- |
| `prisma/schema.prisma` | Add verification/account/session fields and membership, occupant, challenge, invitation and outbox models. |
| `prisma/migrations/20261018090000_identity_access_email/migration.sql` | Additive expansion and legacy membership/session backfill. No business-table updates, destructive drops or inferred verification. |
| `lib/auth.ts` | Hash-based session resolution and selected membership projection; pending/disabled account gates; legacy compatibility. |
| `lib/identity.ts`, `lib/identity-policy.mjs` | Verification/reset, contact changes, policy bounds, audit records and selected occupant resolution. |
| `lib/invitations.ts` | Recipient, issuer, capacity and stay checks; transactional acceptance and email drafting. |
| `lib/email/catalog.json`, `templates.mjs`, `transport.mjs`, `outbox.ts` | Approved draft catalog, safe rendering, sink/SMTP/legacy adapters, encrypted atomic queue and bounded worker. |
| `app/api/auth/route.ts` | Pending signup, verification email issuance, generic duplicate/forgot responses, legacy/new reset compatibility and contextual login. |
| `app/api/account/route.ts` | Profile, verified email/password changes, self-only session management and workspace switching. |
| `app/api/invitations/route.ts` | Scoped owner invitation/member/occupant management and recipient claim/decline. |
| `app/api/resident/route.ts`, `app/resident/[[...section]]/page.tsx` | Permanent authenticated resident entry and own-stay billing summary. |
| `lib/tenant.ts`, `app/api/stay/[token]/route.ts` | Session-bound account adapters reuse existing invoice/proof/stay rules; preserve old token paths. |
| `app/api/manage/route.ts`, `lib/operations.ts` | Team membership authority, explicit property grants, stale-permission recheck and membership-based task assignees. |
| `components/identity/*` | Approved-frame verify/invite/context picker, account security, owner invitation center and resident portal. |
| `components/auth-form.tsx`, `app/[page]/page.tsx` | Real authentication and account routes in the approved green frame. |
| `components/workspace/{card,modules,shell,admin}.tsx`, `components/portal.tsx` | Connect account actions, workspace picker and invitations; share card without circular imports. |
| `components/stay-portal.tsx`, `components/team.tsx`, `app/workspace.css` | Embedded resident services, invitation guidance and scoped form compatibility. |
| `.env.example`, `.dockerignore`, `package.json`, `pnpm-lock.yaml` | Explicit private configuration, packaging exclusions and Nodemailer dependency/worker/test commands. |
| `scripts/mail-worker.mjs`, `phase2-qa-preview.mjs`, `phase3-qa-{migrate,verify}.mjs` | Explicit mail worker and isolated test/migration harnesses. No automatic live sending. |
| `tests/helpers/identity.mjs`, existing integration suites, `tests/{identity.integration,email.test}.mjs` | Real sink-link fixture verification/invitation claims and new security/transport tests. No server bypass flag. |

## Database rollout and rollback

The additive migration has been applied **only** to disposable QA at loopback port 55432. Before/after counts and SHA-256 row snapshots for Invoice, Payment, Stay, Room, Guest and Organization are identical in `artifacts/phase3/migration-preservation.json` (243 invoices, 24 payments, 51 stays, 128 rooms, 51 guests, 21 organizations at migration time). Later test runs intentionally add synthetic records.

Before production approval: back up the database and encryption key; rehearse restore on a copy; measure migration duration/locks; inventory existing user emails/roles and mail-adapter configuration; review the migration and policy defaults; configure verified sending domain/recipient tests; generate the Prisma client; deploy the schema expansion before the new application. Keep the old user organization/role/grant columns and old token tables throughout the transition. Do not run the convenience local runner against a production URL.

The SQL backfills only existing OWNER/STAFF roles and their exact property/payment/device grants, then binds matching sessions. Revoked new memberships are never recreated by the legacy compatibility reader. New identities explicitly use `PENDING`, so the legacy default cannot activate public signups.

Rollback is application-first, with migration columns/tables retained. Once new memberships are accepted, the pre-Phase-3 application must **not** serve those new identities: it does not understand membership authority. Use a maintenance window and a reviewed forward fix/compatible rollback, or restore a tested backup before writes resume. Do not drop the new tables or revert financial history as a routine rollback.

## Email activation runbook

1. Keep `MAIL_DRIVER=disabled` on hosting until reviewed. For local isolated tests use `sink` with loopback `APP_URL`; private sink files live under ignored `.local-secrets/mail-sink` and must never be published.
2. Securely inject persistent `DATA_ENCRYPTION_KEY`, HTTPS `APP_URL`, strong `OPERATIONS_JOB_KEY` and Hostinger SMTP username/password. Do not paste credentials into chat or public `NEXT_PUBLIC_` variables. The connected Hostinger mailbox tool is not an SMTP credential source.
3. Confirm domain ownership, sender/reply-to approval, SPF/DKIM/DMARC, mailbox provisioning and actual Hostinger account settings. Defaults `hello@elenio.id` remain proposals pending business approval.
4. Separately approve a narrow test-recipient list. Configure `MAIL_DRIVER=smtp`, the live gate and allowlist only for that approved test. Run `pnpm worker:mail` explicitly. Verify inbox/spam and provider results before wider rollout. Never turn on broad delivery merely to complete a local test.
5. Inspect `UNKNOWN` sends manually before any replay. SMTP does not provide end-to-end exactly-once inbox delivery. Do not bulk-requeue expired verification or revoked invitation messages; issue a fresh request through the normal flow. `BLOCKED` rows require deliberate review/new issuance after configuration, not silent automatic replay.

The legacy `MAIL_ENDPOINT`/`MAIL_API_KEY` adapter is preserved, but existing deployments must configure the new explicit live gate and allowlist before switching application versions. This controlled change is required to prevent accidental outbound mail.

Official configuration sources checked: [Hostinger application/device settings](https://www.hostinger.com/support/4305847-set-up-hostinger-email-on-your-applications-and-devices/), [Nodemailer SMTP](https://nodemailer.com/smtp). No account credentials were accessed or changed.

## Validation and review

- Production build/typecheck passed; 17 unit tests passed, including all approved public/backoffice asset byte checks and all supplied email draft rendering.
- Full isolated regression: 15 core + 7 operations + 6 tenant/smart + 5 acquisition + 8 identity security + 1 workspace scenario groups passed. These are scenario groups, not assertion counts. Logs and machine-readable results are under `artifacts/phase3`.
- Identity cases include pending-user denial, hash/expiry/replay/attempt/cooldown, forwarded links, no duplicate User/org, invitation recipient/plan/issuer/rotation/revocation/concurrent acceptance, multiple organizations, foreign workspace denial, tenant invoice/proof-file isolation, upload without confirmed payment, checkout history/service separation, session/email/reset security and old reset-link compatibility.
- Queue tests include six real encrypted queued rows claimed by parallel workers exactly once, expired-message cancellation, stale lease uncertainty, authenticated worker and local-only delivery. Transport tests simulate known transient/permanent/ambiguous outcomes without calling SMTP.
- Browser checks use the production QA preview, synthetic accounts and the approved green shell at desktop 1440×900 and mobile 390×844. Covered resident login, own bill and existing proof display, account/navigation/logout, owner team/invite and account entry. Screenshots and bounded coverage are recorded in `docs/PHASE3_DESIGN_QA.md`. Credential mutation, invitation permission grants and email sends were tested through isolated APIs, not through browser actions on real accounts.

Preview: http://127.0.0.1:3001/ ; authenticated account: `/account`; resident: `/resident`; owner invitations: `/app/team`. Synthetic credentials are saved privately in ignored `.local-secrets/phase3-browser.json`, never in this report.

## Remaining / approval boundary

Phase 4 is still required for Customer 360, contract/deposit ledger and the remaining staff/tenant/billing lifecycle gaps. Phone verification, co-tenant financial rules, account export/closure request handling, platform MFA/elevated support, and legal retention policies are not claimed complete. Optional real AI/CCTV/IoT/locks/WhatsApp remain unconfigured. The mail outbox is prepared but no real delivery has been tested or activated. External-provider production failure modes and large-dataset migration performance still require staging validation.

No migration of the existing port-5432 database, live email, real device command, deployment, Git commit or push occurred in Phase 3. The review checkout contains the cumulative uncommitted Phase 1–3 changes on `codex/phase3-identity-access-email`.
