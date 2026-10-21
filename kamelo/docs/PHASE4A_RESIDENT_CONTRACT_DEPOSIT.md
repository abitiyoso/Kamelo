# Phase 4A — Resident 360, contracts and deposit liability

18 October 2026. Implemented incrementally on the existing PostgreSQL/Prisma application. This is a reviewable Phase 4A increment, not completion of every V3 requirement. Approved Landing v7, Showcase v6 and Backoffice v5.3 visual assets/navigation remain the baseline.

## Delivered behavior

- Owner Resident 360: property-scoped search/pagination, contact details, encrypted emergency contact with explicit consent, permanent guest identity, stays/rooms, issued billing totals, payments/proof metadata, service history and existing portal invitations. Returning stays explicitly reuse the selected guest; matching phone numbers never claim or merge identities.
- Contracts: proposed revisions, explicit recording of manual agreement, version/hash history, renewal proposals, expiry counts and tenant read-only agreed versions. Proposals do not silently extend occupancy. Overlap and stale-revision checks run before agreement. This records a manual agreement reference; it is not an electronic signature provider.
- Room transfer: one atomic command closes the former stay, creates the replacement stay, preserves guest identity and prior invoices, transfers deposit liability through balanced entries, explicitly carries existing occupant grants and creates the cleaning task. The prior portal context retains its financial history but cannot operate the closed stay. Returning independently later requires a new invitation.
- Recurring billing follows the transfer predecessor chain to reuse an already issued invoice for the same period, preventing a second recurring invoice after moving rooms. Manual charges remain explicit owner actions.
- Deposits: actual receipt/refund references, pending deduction reservations, inspection notes, explicit deduction approval/rejection and reversing entries. Deposit is a liability, never rent revenue or automatic invoice payment. Recording a refund does not move bank funds. Pending deductions cannot be consumed by a competing refund.
- Checkout closes the lifecycle and queues cleaning for kos as well as hotel stays. Unpaid rent does not prevent physical checkout or produce payment-based access lockout. Existing issued financial records remain available.

## File-by-file changes

| File | Change |
|---|---|
| `prisma/schema.prisma` | New resident profile, contract/version, deposit account/entry/adjustment, transfer and command receipt models; relational/index additions. |
| `prisma/migrations/20261018120000_resident_contract_deposit/migration.sql` | Additive tables, FK/index/check constraints and append-only version/ledger triggers. |
| `lib/lifecycle.ts` | Validated lifecycle commands, version/ledger writes, availability, consent encryption and checkout integration. |
| `lib/lifecycle-rules.mjs` | Bounded deposit movement/state and canonical idempotency hashes. |
| `lib/stay-billing.ts` | Same-period issued billing lookup across room transfers. |
| `lib/automation.ts` | Recurring generator uses transfer billing guard. |
| `lib/invitations.ts` | Tenant invitation accepts the existing hotel CONFIRMED booking state. |
| `app/api/lifecycle/route.ts` | Owner-scoped directory/details/writes, tenant own-stay projections, fresh permission checks and idempotency. |
| `app/api/manage/route.ts` | Checkout hooks, recurring reuse, contract-protected rate updates and real expiry count. |
| `components/workspace/resident360.tsx` | Connected directory, contract/deposit workspace, responsive dialogs and read-only resident panel. |
| `components/portal.tsx` | Existing navigation connects to new owner modules; demo retains explicit sample/unavailable states. |
| `components/owner-dashboard.tsx` | Real contract expiry priority. |
| `components/identity/resident-portal.tsx` | Agreed contract and deposit history remain readable after the stay ends. |
| `app/workspace.css` | Scoped lifecycle layout, wrapping, form and responsive rules within existing visual system. |
| `tests/lifecycle.test.mjs` | Deposit bounds/reservations/states and canonical hash rules. |
| `tests/lifecycle.integration.mjs` | Eight lifecycle scenario groups using real HTTP and isolated PostgreSQL. |
| `scripts/phase4-qa-migrate.mjs` | Hardcoded disposable QA migration and preservation snapshot. Never target production. |
| `scripts/phase4-qa-verify.mjs` | Seven-suite isolated QA regression runner. |
| `package.json` | Explicit lifecycle and Phase 4 QA commands. |

## Migration and release plan

Migration was applied only to disposable PostgreSQL on loopback port 55432. Ten existing tables were hashed before/after: Invoice, Payment, Stay, Room, Guest, Organization, User, Session, OrgMembership and OccupantAccess. Counts/content matched; see `artifacts/phase4/migration-preservation.json`. No inferred contract, deposit receipt or historical identity backfill is performed.

Before a production rollout: confirm the exact target/backup and restore drill; inspect migration history and UTF8 server/client encoding in a restored staging database; deploy the additive migration, generate Prisma client and run regression checks against restored data; review the application diff and operational runbook before release. Existing business data must not be treated as disposable QA fixtures. DDL locks/index creation on existing tables need a maintenance window assessment for the actual data volume.

The Windows embedded QA instance reports WIN1252. A technical transfer reference was changed to ASCII after a Unicode encoding failure; SQL errors are sanitized. This does not establish full Unicode compatibility for that instance. UTF8 staging verification is an outstanding production gate; no existing database encoding was changed.

Backout is application rollback with new tables/history retained for review and reconciliation. Never drop funded deposit accounts or mutate contract/ledger history to roll back. Restore from a verified backup only as a separately approved incident operation. Corrections normally append a version or reversing entry.

## Security and regression evidence

Owner commands require same-origin requests, rate limits, active owner membership/property scope and a fresh session/membership check inside the transaction. Organization advisory locks serialize lifecycle commands and existing billing operations. Actor-bound request hashes and unique command keys make identical retries return the committed result; reused keys with different payloads fail. Financial changes commit atomically with their command receipt and audit event.

Staff and platform contexts cannot use owner lifecycle endpoints. Tenant access requires the selected active occupant grant and billing permission; projections expose only that stay, agreed versions and own deposit history, omitting private actor/signature references and owner emergency contacts. No-store/no-referrer headers apply. Emergency details are encrypted and cleared when consent is removed. Contact email is unverified profile data, never account identity.

Passed: production build/typecheck, 20 unit tests, 50 API scenario groups across core (15), operations (7), tenant/smart (6), acquisition (5), identity (8), workspace (1) and lifecycle (8). Full API evidence precedes only the final client selection/status-label refinements; final production build passed afterward. Tests cover cross-org/role/CSRF boundaries, stale agreements, overlap, concurrent retries/transfers/refunds, reserved deductions, DB append-only triggers, old invoice preservation, transfer-period billing reuse, unpaid checkout, old/new portal scope, return identity and all-history totals/pagination.

Evidence: `artifacts/phase4/regression-results.json`, `lifecycle-tests.json`, suite logs and [bounded browser QA](PHASE4A_DESIGN_QA.md). No real email, bank transfer, hardware action, production migration, deployment, commit or push was performed in this increment.

## Remaining phases and dependencies

Phase 4B should add prospects/lead-to-resident conversion and broader SaaS Customer 360/subscription ledger, then expenses and reconciled financial reporting. Inbox/communications, import validation and migration tooling follow with their own permission/retention controls. Scheduled rent changes, contract document generation/e-sign provider and automatic deposit-to-invoice settlement are not implemented by this increment.

Hostinger live delivery remains behind the earlier explicit SMTP/live recipient gates. Gateway settlement, CCTV/AI, Tuya/Smart Room and generative LEO require supplied service configuration, provider-specific implementation and sandbox/device acceptance. Their readiness interfaces are not evidence of a live integration. Production acceptance must include restored UTF8 data, a migration/restore drill, secret configuration, permission review and external integration tests where configured.
