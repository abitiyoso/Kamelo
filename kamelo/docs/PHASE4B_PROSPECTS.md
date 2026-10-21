# Phase 4B — Prospects and rental conversion

18 October 2026. This increment connects the approved Backoffice v5.3 **Prospek & Penyewaan** screen to PostgreSQL and the existing resident/stay services. It improves the current application; approved public pages, logo, photos, palette and navigation are retained. Broader SaaS Customer 360/subscription accounting remains a separate pending increment.

## Implemented workflow

1. Owner records a prospect with contact, source, inquiry/consent reference, room interest, requested dates/budget, notes and optional follow-up time. Contact permission must be explicitly confirmed. Saving does not create an account, resident, stay or message.
2. Owner schedules a future survey, records follow-up notes and prepares/revises an offer with rent and terms. Pipeline states are New, Survey, Offer, Lost and Converted. Losing a prospect requires a reason; reopening explicitly returns it to New. Activity history is retained.
3. From Offer, owner confirms the checked profile, room, rent and dates. The server rechecks availability and creates exactly one stay through the existing lifecycle service. The conversion uses the latest offered rent. Kos uses existing ACTIVE semantics; a future stay remains future occupancy. Hotel requires an end date and creates CONFIRMED, without early check-in.
4. Owner may explicitly select an existing resident profile, with scoped name/phone search, or create a new one. Matching phone/email never claims an identity or merges records. Existing profile contact details remain unchanged when reused.
5. The resulting record links to Database Penghuni for contracts, billing and invitations. Conversion does not automatically agree to a contract, issue/pay an invoice, accept a deposit, send email or create portal access. Quotes do not hold rooms; a reservation only exists after successful stay creation.

The screen provides real active/survey/due-follow-up counts, rooms ready and vacant **today**, stage/search filters, 50-row pagination, 30-row activity pages, meaningful empty/error/success states and property scoping. The active count includes all property prospects, independently of the current search page. Availability for the actual requested interval is checked at conversion.

## File-by-file changes

| File | Change |
|---|---|
| `prisma/schema.prisma` | Prospect and ProspectActivity with property/room/converted-stay relations, unique history revisions and indexed scopes. |
| `prisma/migrations/20261018150000_prospect_pipeline/migration.sql` | Additive tables, FK/index/check constraints and append-only activity trigger. |
| `lib/prospects.ts` | Validated consent/contact, stage/survey/quote/follow-up commands, immutable history and atomic conversion reusing existing lifecycle rules. |
| `app/api/prospects/route.ts` | Owner-only property-scoped directory, search/filter/counts, detail and activity pagination. |
| `app/api/lifecycle/route.ts` | Prospect command dispatch inside the existing fresh owner/session check, organization lock and idempotency transaction. |
| `components/workspace/prospects.tsx` | Approved pipeline/table shell, capture/detail/offer/returning-profile forms, history and responsive dialogs. |
| `components/workspace/resident360.tsx` | Exports existing form/field primitives for reuse; existing lifecycle behavior retained. |
| `components/portal.tsx` | Connects Prospek Sewa navigation; supports background refresh for prospects and Resident 360 so saves retain dialog context. |
| `app/workspace.css` | Scoped filter, wrapping and history layout within the existing visual system. |
| `tests/prospects.integration.mjs` | Nine real HTTP/PostgreSQL scenario groups, including races, rollback, histories, returning residents and hotel booking. |
| `scripts/phase4b-qa-migrate.mjs` | Disposable-database-only migration with preservation snapshots of 18 existing tables. |
| `scripts/phase4b-qa-verify.mjs` | Eight-suite complete QA runner. |
| `package.json` | `test:prospects` and `test:phase4b` commands. |

README, implementation status, design QA and this report record the current scope. A SHA256 review manifest lists explicit review-copy files; runtime databases, generated client/build output and private fixtures/secrets are excluded.

## Data and security

Prospect commands use the existing organization advisory lock and atomically commit activity, business changes and actor-bound idempotency receipt. Duplicate retries reuse the committed result; a key with different data fails. Optimistic revisions reject stale edits or old quotes. Concurrent conversion to the same room has one winner; the loser leaves no orphan Guest/Stay. Converted prospects cannot be edited or converted again through these endpoints.

Every read/write is restricted to an authenticated owner and the organization's property. Writes recheck current session, membership, account state and property inside the transaction, with CSRF/origin and rate-limit protection. Staff cannot browse prospects through either endpoint; no leasing-manager permission is inferred from an unrelated staff grant. Tenant/platform contexts do not receive these owner records. Responses use private/no-store and no-referrer. Contact email remains unverified profile information, not login identity. Activity is immutable at DB level; values in activity metadata remain within the owner's property scope.

No external CRM scraping, contact enrichment, background WhatsApp/email, applicant screening or automated housing decisions are introduced. Privacy erasure/export/retention tooling and fine-grained future leasing-manager permissions require their own reviewed workflows; no delete endpoint is added here.

## Migration and release plan

The new migration ran only on disposable loopback QA PostgreSQL port 55432. Before/after hashes/counts matched for Invoice, Payment, Stay, Room, Guest, ResidentProfile, Contract, ContractVersion, DepositAccount, DepositEntry, DepositAdjustment, RoomTransfer, LifecycleCommand, Organization, User, Session, OrgMembership and OccupantAccess. Evidence: `artifacts/phase4b/migration-preservation.json`. No legacy backfill, production migration, main-database write, deploy, commit or push was performed.

Production remains gated on target/backup verification, restored staging, UTF8 server/client encoding verification (the embedded Windows QA instance uses WIN1252), migration-history validation, Prisma generation and staged regressions. New tables need no inferred historical data. Backout should roll back application code while retaining prospect/history tables for reconciliation; do not erase converted residents, stays or financial history. Trigger/function migration order depends on the preceding Phase 4A migration.

## Verification and boundaries

Passed production build/typecheck, 20 unit tests, and 59 API scenario groups across eight suites (the previous 50 plus nine prospect groups). Full API regression passed before final client-only dialog/focus refinements; the strengthened prospect suite was rerun against the final production build. Tests exercise consent and real dates, org/role/CSRF denial, stale revisions, quote revision, survey/loss/reopen, idempotent retries, unavailable/foreign rooms, conversion race rollback, returning profile reuse with existing unpaid invoice unchanged, hotel dates/status, append-only trigger, all-history counts and pagination. A QA plan-limit rejection during test development was corrected by using an explicitly provisioned Plus fixture for the two-property scenario; application pricing/limits were unchanged.

Bounded browser QA verifies synthetic prospect capture, note/offer saving, dialog persistence, explicit old-profile search, 320/390px layout and Escape focus restoration. Conversion commits were tested using synthetic API scenarios; no actual customer contract or financial action was performed in browser. See [visual QA](PHASE4B_DESIGN_QA.md), `artifacts/phase4b/regression-results.json`, `prospects-tests.json`, unit/API logs and screenshots.

Next separate increments: ELENIO SaaS Customer 360/legal billing profile and subscription ledger; expenses/reporting; messaging, imports/privacy operations; configured payment/email/hardware/AI integrations with provider-specific acceptance. This increment does not establish full V3 or production-launch completion.
