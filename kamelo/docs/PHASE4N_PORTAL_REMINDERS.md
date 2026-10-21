# Phase 4N — Historical balance reminders in the tenant portal

20 October 2026. This increment adds owner-published reminders to the existing Phase 4K/M historical receivables workflow. Existing invoice rules, authentication, pricing and approved public/backoffice visual identity remain in place.

## Behavior

The owner opens a receivable's tenant evidence panel, refreshes the reminder preview, checks the recipient/amount/due date and explicitly confirms publication. The reminder is recorded in the selected tenant portal's balance details. It is not an email, WhatsApp message, push notification or a claim that the recipient read it. No contact channel or public payment link is generated.

The source must be open, have a positive current remainder and be due today or earlier in Asia/Jakarta. It must have an explicit active share to a verified account with an active billing grant for the same guest/property/stay/user. Pending evidence suppresses publication until reviewed. Each receivable has a rolling 24-hour cooldown across share changes. A fresh preview digest binds the share, remaining amount, due date, reference and previous reminder. Concurrent receipt changes invalidate an old preview.

Owners see immutable publication history. Tenants see only reminders for their current exact share and only after fresh tenant authorization. A replacement or newly shared account does not inherit another share's history. Historical amounts are clearly labeled snapshots; current remaining balance remains the authority. Later settlement/void does not rewrite or delete history. Reminder publication changes neither debt nor cash and creates no receipt/invoice.

Both owner and tenant history use twenty rows per page. Tenant reminders and payment evidence have independent page controls. Reminders appear inside Tagihan > saldo details, not on the tenant home card or a global notifications inbox.

## Files and data plan

| File                                                                      | Change                                                                                                                |
| ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `prisma/schema.prisma`                                                    | Add OpeningReminder and source/share relations                                                                        |
| `prisma/migrations/20261020100000_opening_portal_reminders/migration.sql` | Add one immutable reminder table, scoped history indexes, source/recipient/amount checks and restrictive foreign keys |
| `lib/opening-reminders.ts`                                                | Eligibility, fresh preview, publication audit and safe history projection                                             |
| `app/api/opening-balances/route.ts`                                       | Owner preview/history and confirmed idempotent publication in the existing organization lock/command flow             |
| `lib/opening-tenant.ts`                                                   | Add current-share reminder projection to tenant details                                                               |
| `app/api/opening-tenant/route.ts`                                         | Bounded independent reminder page parameter                                                                           |
| `components/workspace/opening-reminders.tsx`                              | Preview, explicit publication, eligibility reasons and history                                                        |
| `components/workspace/opening-evidence.tsx`                               | Embed in the existing evidence panel                                                                                  |
| `components/workspace/opening-balances.tsx`                               | Accurate portal-only reminder guidance                                                                                |
| `components/identity/opening-balances.tsx`                                | Tenant history, snapshot explanation and independent pagination                                                       |
| `tests/opening-reminders.integration.mjs`                                 | Isolated synthetic integration scenarios                                                                              |
| `scripts/phase4n-qa-migrate.mjs`                                          | Fixed QA target and before/after snapshots                                                                            |
| `scripts/phase4n-qa-verify.mjs`                                           | Cumulative regression runner                                                                                          |
| `scripts/phase4n-review-sync.mjs`                                         | SHA-verified source and evidence allowlist                                                                            |

Only disposable PostgreSQL port 55432 was migrated. Before/after hashes preserve existing row values across 41 tables, including OpeningShare and OpeningProof. Applied earlier migrations were not edited. No main database migration, commit, push or deployment was performed. Production requires backup/restore validation, UTF-8 restore acceptance and reviewed release execution.

## Security and validation

Only a fresh scoped owner context can publish. Same-origin and existing write rate limits apply. The organization advisory lock serializes reminder, proof and receipt writes. Exact command retries reuse their recorded response; changed-payload keys conflict. A new-key retry during cooldown cannot create a second reminder. Fresh recipient eligibility is checked after the lock. Database triggers prevent source/recipient snapshot mismatch and any history update/delete. API histories exclude actor IDs, share IDs and internal notes from the tenant projection. No tenant input controls reminder copy or its destination.

Production build/typecheck, 44 unit tests and 182 API scenario groups across 20 suites pass; logs are recorded under `artifacts/phase4n`. Scenario coverage includes owner/staff/tenant/cross-owner isolation, explicit share and confirmation, same-origin, stale previews, duplicate/concurrent commands, no cash side effects, database immutability, permission revocation, replacement identity, pending proof suppression, settlement, future/void sources and bounded history pagination. See [browser QA](PHASE4N_DESIGN_QA.md) for observed UI results and verification timing.

## Remaining scope

Automated schedules, email/WhatsApp delivery and delivery/read receipts remain pending. Also pending: a global combined evidence queue, consolidated dashboard and home-card receivables insights, provider/bank validation, refunds, receipt issuance/retention policy and production UAT/rollout. This is a portal reminder increment, not full V3 completion. No real email, device command or funds transfer occurred.
