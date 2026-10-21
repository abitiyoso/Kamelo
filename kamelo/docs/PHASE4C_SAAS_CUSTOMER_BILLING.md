# Phase 4C — SaaS Customer 360 and subscription ledger

18 October 2026. This increment connects the existing approved v5.3 admin customer/subscription screens and owner organization settings to real SaaS billing records. It preserves the public v7/v6 assets, green backoffice identity, navigation, authentication, existing plan catalog and resident finance. It does not establish full V3 or commercial-launch completion.

## Delivered behavior

- Platform Customer 360: server-backed organization search/filter/pagination, real organization/active-paid/follow-up totals, primary owner contact, aggregate property/room counts, billing profile, upgrade requests and subscription history. No resident directory, tenant rent/proof files, CCTV or room secrets are exposed by these projections.
- Organization billing profile: legal billing name/address, business contact and source reference. Owner can edit their own organization's profile; platform admin can manage customer billing profiles. Tax identifiers are encrypted and masked in read projections, including invoice snapshots. Billing contact changes do not replace the login identity or invitation recipient.
- Separate SaaS invoices/entries/events: catalog-priced Starter/Plus periods of 1–12 calendar months, frozen billing snapshots and immutable invoice financial fields. Period end clamps to month end where needed. Overlapping issued periods are rejected. No historical payment is inferred from an existing paid plan or upgrade approval.
- Manual reconciliation: partial receipts, duplicate-reference checks, overpayment protection, refunds bounded by the original receipt, append-only correction entries, and controlled cancellation of unactivated invoices with zero net receipts. Recording a receipt/refund does not move money. Refunds/corrections leave entitlement unchanged for explicit administrator review.
- Paid-period activation is a separate, confirmed platform action. Net receipts must equal the invoice total and the service period must currently apply. Future/expired periods cannot activate, an existing finite term cannot be shortened, and replacing a legacy unlimited manual entitlement requires an additional explicit confirmation. Existing Organization plan/status/expiry remain the canonical entitlement fields. Activation updates compatible pending upgrade requests and records the before/after state.
- Owners can inspect their own SaaS invoices, balances, entries and history from organization settings. Financial mutations/activation remain platform-only. Staff and other organizations cannot read these records.

Adding a customer follows the existing verified owner registration flow. The admin onboarding entry explains this and opens registration; it does not create a parallel identity, share a password or fabricate a customer account. Support Center, live integrations and provider-specific payment automation remain separately gated.

## Compatibility and boundaries

Existing `free`/`starter`/`plus` pricing/capacity and expiry fallback are preserved. There is no newly invented trial/grace duration or automated cancellation/dunning policy. SaaS expiry/refunds do not delete resident records, settle rent or invoke room/door control commands. New accounting tables are never joined into resident income totals.

The legacy `/api/manage` manual upgrade activation remains compatible. It now locks the target organization, rechecks admin/session and request state, and appends a clearly labeled legacy activation event. It still does not imply a payment or create a financial entry. The new admin UI uses invoice reconciliation and paid-period activation; legacy callers remain explicit manual entitlements rather than a reconstructed ledger.

The new admin directory requires the existing PLATFORM session context. An administrator currently in an organization workspace sees a workspace-selection prompt. Existing admin privileges do not automatically expose all customer records inside an ordinary owner/staff view. Platform admin operational APIs remain separated from tenant data.

No gateway, automatic debit, actual refund/transfer, real email, statutory tax engine, invoice PDF, recurring renewal scheduler, SaaS proof-upload workflow or new support-case system is claimed. The current prices are billed as catalog amounts; no tax/discount policy is inferred. Existing Hostinger live-delivery gates remain off.

## File-by-file changes

| File | Change |
|---|---|
| `prisma/schema.prisma` | SaaSBillingProfile, SubscriptionInvoice, SubscriptionEntry and SubscriptionEvent with scoped FK/index/unique relations. Organization remains the existing customer/entitlement model. |
| `prisma/migrations/20261018180000_subscription_ledger/migration.sql` | Additive schema, amount/state checks and append-only/frozen-invoice triggers. |
| `lib/subscription-rules.mjs` | Calendar periods, bounded signed movements and financial status separate from entitlement. |
| `lib/subscriptions.ts` | Encrypted/masked profiles, all-history totals, safe invoice projections, issue/receipt/refund/correction/void/activation transactions and events. |
| `app/api/subscriptions/route.ts` | Platform directory/detail plus owner-own data, pagination, fresh permission checks and idempotent writes. |
| `app/api/manage/route.ts` | Compatible legacy activation target lock, fresh admin/session validation and explicit non-financial history event. |
| `components/workspace/admin-server.tsx` | Platform context gate; customer data loads through the scoped API rather than a truncated server-only list. |
| `components/workspace/admin.tsx` | Approved shell/navigation connects customer/subscription screens to the new workspace. |
| `components/workspace/subscriptions.tsx` | Customer directory, billing profile, invoice/entry/event history, manual operations and owner-own panel. |
| `components/portal.tsx` | Owner organization settings include the separate SaaS billing panel. |
| `app/workspace.css` | Scoped subscription wrapping, readable actions and vertical invoice layout on narrow screens. |
| `tests/subscription.test.mjs` | Calendar/leap-year, bounded movement and financial-state rules. |
| `tests/subscriptions.integration.mjs` | Nine real HTTP/PostgreSQL scenario groups. |
| `scripts/phase4c-qa-migrate.mjs` | QA-only migration with existing-data preservation snapshots. |
| `scripts/phase4c-qa-verify.mjs` | Complete nine-suite QA runner. |
| `package.json` | Dedicated subscription and full Phase 4C test commands. |

README/status/design QA and SHA256 review manifest record this scope. Generated clients/build output, runtime databases and private QA credentials are excluded from the review copy.

## Migration and rollback

Only the disposable PostgreSQL database on loopback port 55432 was migrated. Hashes and counts matched before/after for all 21 recorded existing tables, including Upgrade, resident finance, contracts/deposits, identities/grants and prospects. See `artifacts/phase4c/migration-preservation.json`. No data backfill or inferred receipts were written. Existing/main/production database was not migrated.

Before production: verify exact target and migration history, back up and rehearse restore, validate the restore on UTF8 staging (the Windows embedded QA instance uses WIN1252), inject encryption/operational secrets and run the staged regression suite. Preserve encryption keys with backups. New triggers depend on the preceding lifecycle-history migration. Assess DDL lock time with actual data volume.

Backout should revert the application while retaining financial tables/snapshots for reconciliation. Do not drop paid invoices, rewrite immutable history or erase customer/resident data. Reverse erroneous ledger records through explicit correction entries. Any entitlement rollback must be separately reviewed against the recorded before/after events; refund recording does not silently revoke a customer's service period.

## Security and verification

Writes use same-origin checks, actor rate limits, organization advisory locks, fresh session/account/role verification and actor/domain-bound idempotency hashes. Owner writes are restricted to their own billing profile. Duplicate keys with changed data fail; identical retries reuse the committed result. Receipt references are case-insensitively checked under the same lock. Invoice, entry and event pagination is scoped to the target organization, and aggregate totals cover full history rather than the visible page. Reads use private/no-store and no-referrer headers. Secret SQL/Prisma errors are sanitized.

Passed: production build/typecheck, 22 unit tests and 68 API scenario groups across nine suites. The nine new groups exercise platform context/owner/staff/CSRF boundaries, encrypted tax profile and stale revisions, immutable invoice snapshots/catalog pricing/period overlap, partial/duplicate/concurrent receipts, explicit paid-period activation and legacy term safeguards, refund/correction immutability, future activation and cancellation, serialized legacy compatibility, resident invoice preservation/expiry fallback, and all-history aggregates/pagination. A test assertion was corrected to use the existing string-valued `plan` API response; the API contract was retained.

Full API regression passed before final UI-only status/overflow/readability refinements. Final build and bounded desktop/mobile checks verify those refinements; see [visual QA](PHASE4C_DESIGN_QA.md), `artifacts/phase4c/regression-results.json`, `subscriptions-tests.json` and logs. No real email, real transfer/refund, production migration, deployment, commit or push was performed.

Next incremental work: property expenses and reconciled cash reporting; platform support and integration health; messaging, imports/privacy operations; configured external payment/email/hardware/AI integrations. Trial/grace/retention policies and provider acceptance need supplied business configuration; they are not simulated as live service behavior.
