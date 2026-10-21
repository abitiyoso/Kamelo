# Phase 4L — opening receivable collections and corrections

19 October 2026. Additive improvement of the Phase 4K register and existing property finance reports. Approved landing v7, showcase v6 and backoffice v5.3 brand assets, navigation and layout are retained.

## Delivered

Owners can open Keuangan → Saldo awal piutang → Rincian batch → Tinjau penerimaan. The panel shows original debt, net receipts and remaining balance, then accepts a confirmed manual receipt with integer rupiah amount, actual date, method, reference and encrypted review note. Partial and full receipts are supported. Dates must be on/after the source as-of date and no later than today. Amounts cannot exceed the remaining debt. The active/overdue register totals now subtract net receipts and count only records with a positive remaining balance.

Receipts are append-only. Correcting an erroneous record appends an exact negative entry on the original receipt date, using its original amount, method and reference. This corrects the original cash-report period without fabricating a current cash movement. The original entry remains marked as corrected, and both entries remain visible in paginated history. A correction is not a refund of real money. Actual refund workflows are not implemented here.

Confirmed commands use the existing owner session, fresh membership checks, organization transaction lock and shared idempotency ledger. An exact retry returns the original response; changed payloads cannot reuse the key. The server validates all fields again. Responses remain private/no-store. Notes are encrypted using the existing application key; audit metadata contains only source ID and amount. Original invoices, payments, deposits, prices and source debt amounts are not rewritten.

## Cash and matching integration

- Finance cash received, surplus, comparison, daily/monthly charts, portfolio report and movement CSV include opening receipts and their negative correction entries through a separate `OPENING` source. No synthetic invoice/payment is generated and no matching row adds cash a second time.
- The source opening principal itself is not cash. Only its recorded receipts enter cash at their actual receipt date; corrections retain that date.
- Existing manual statement reconciliation now accepts `OPENING` receipts alongside rent and expense entries. Amount must match exactly and direction must be incoming. The existing one-record/one-statement-line rule, unique active statement reference, revocation history and source immutability remain enforced.
- A matched receipt cannot be corrected until its manual match is revoked. Corrected receipts and negative correction entries cannot be matched as new bank transactions.
- A batch with any receipt history, even fully reversed receipts, cannot be voided. Source data and resident references remain retained. The UI explains this and offers review of receipt history instead.
- Saving or correcting a receipt refreshes both the register and the currently selected finance filters. Refreshing uses current component state rather than an old property callback.

Receipt references are unique case-insensitively **within one opening receivable**, including corrected receipt references. A corrected source reference cannot be silently reused. This does not automatically identify a duplicate across different receivables or existing invoice payments; the owner must verify the declaration that the money has not already been recorded elsewhere. Automatic bank reconciliation, split statement allocation and payment provider verification remain out of scope.

## Files

| File | Change |
| --- | --- |
| `prisma/schema.prisma` | Append-only receipt model, reversal relation and optional finance-match source |
| `prisma/migrations/20261019120000_opening_receipts/migration.sql` | One new table, nullable match FK, indexes and receipt/source/match guards |
| `lib/opening-receipts.ts` | Scoped detail with 20-entry pagination, net debt summary, confirmed receipt/correction writes |
| `lib/opening-balances.ts` | Reject source batch void after receipt history exists |
| `app/api/opening-balances/route.ts` | Owner-only receipt/detail actions, preserved origin/idempotency checks and scoped summary |
| `lib/finance-report.ts` | Union receipts/corrections into cash/chart/movement queries |
| `lib/finance.ts`, `app/api/finance/route.ts` | Reuse manual statement matching for opening receipts |
| `components/workspace/opening-receipts.tsx`, `opening-balances.tsx`, `finance.tsx` | Receipt review/form/correction/history, batch protection and cash refresh |
| `tests/opening-receipts.integration.mjs` | 11 grouped receipt, security, concurrency, correction, reporting and matching scenarios |
| `scripts/phase4l-*`, package scripts | Guarded QA migration, complete regression and SHA review copy |

No new package dependency. The existing room/resident import, templates and workbook security limits are unchanged.

## Database and preservation

The migration was applied only to the named disposable PostgreSQL QA database at loopback port 55432. Counts and SHA-256 hashes of existing values in 38 old business tables matched before/after. For `FinanceMatch`, both snapshots omit the newly added nullable `openingReceiptId` field; all its old columns and rows are compared. The original Phase 4K migration remains byte-for-byte unchanged.

The receipt table restricts source/reversal deletion. A trigger locks the source receivable while validating its active state, date, exact reversal and net amount bounds. DB-only concurrent inserts were tested: one excessive competing receipt fails. Receipt edits/deletion, overcollection, invalid reversal values and source void after receipts are independently blocked by the database. New match guards preserve the opening source ID and validate property, receipt amount and uncorrected state. Existing match rows gain only a nullable field; their source and statement rules remain active.

Production migration, backup/restore acceptance, UTF-8 restore rehearsal, deployment and live-provider acceptance remain pending. Rollback of application entry points must retain the financial tables and audit history rather than deleting receipt/source data. No commit, push, deployment, main-database migration, external email, bank transfer or device action was performed.

## Verification and remaining scope

Optimized production build and TypeScript check pass. All 44 unit tests and 18 isolated API suites pass: 157 scenario groups, including 11 for receipts. Coverage includes partial/full receipts, confirmation/validation, scoped owner-only access, membership revocation, encrypted notes/minimal audits, idempotency and reference reuse, exact original-date reversals, matched-receipt protection, scoped bank-match history, immutable DB guards, API/direct-DB concurrency, paginated history, CSV/chart/cash integration and preservation of invoice/payment/deposit rows.

Browser QA verified receipt entry, exact debt/cash changes, correction restoring both values, and successful statement matching through the existing UI. Desktop and 390/320-pixel mobile checks are in [Phase 4L design QA](PHASE4L_DESIGN_QA.md).

This completes manual owner collection for the opening-debt register. Tenant visibility, tenant proof upload for this ledger, reminders, attachments/receipts issued to tenants, real refunds and automated payment providers remain pending. Existing homepage/dashboard invoice metrics and invoice collection insights remain invoice-based; this phase consolidates opening collections in the **Keuangan** reports only. Wider Customer 360/report/tenant integration needs its own scoped follow-up. No whole-V3 completion is claimed.

Review branch: `codex/phase4l-opening-receipts`.
