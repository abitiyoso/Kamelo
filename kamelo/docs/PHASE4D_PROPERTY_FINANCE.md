# Phase 4D — property expenses and cash reporting

18 October 2026. Incremental implementation of the approved v5.3 Keuangan & Pengeluaran workspace. Landing v7, Showcase v6, the approved logo/photos, green identity, shell and navigation are retained. This is not complete V3 acceptance.

## Delivered behavior

Owners record a reviewed expense bill separately from an actual payment. Partial payments, supplier refunds, explicit corrections and zero-net cancellation retain the original source and append-only movement history. Duplicate references, concurrent overpayment, excess refunds and cross-property identifiers are rejected. Corrections restate the original entry date; actual refunds use the date funds were returned. A voided expense retains its prior-period cash movements.

Reports show actual resident rent receipts, net expense cash outflow and operating cash surplus for a selected property or the owner's organization. Daily charts cover up to 62 days; longer periods use monthly buckets. Comparisons use the contiguous preceding interval of equal length and display exact dates. Deposit receipts/refunds/liabilities remain separate from operating income. Pending proofs and the platform SaaS ledger are excluded. Expense balances use the report end date; detail dialogs explicitly show current recorded balances.

Manual reconciliation matches one recorded movement to one statement line with exact amount/direction, reference, date and owner confirmation. Revocation retains history; active matches must be revoked before correcting an expense entry. This is a manual review record, not automated bank verification or an imported statement feed.

Expenses, movements and monthly summaries export as private UTF8 BOM CSV with formula-injection protection and proper quote/newline escaping. Aggregates cover all scoped history; tables use 50-row pages, entry/match histories use 30. Exports reject more than 5,000 rows explicitly and ask for a narrower period rather than silently truncating.

## File map

| Files | Change |
|---|---|
| `prisma/schema.prisma`, `prisma/migrations/20261018210000_property_finance/migration.sql` | Expense, ExpenseEntry and FinanceMatch relations, indexes, signed-value checks, active-match uniqueness and immutable-history triggers. |
| `lib/finance.ts` | Scoped financial commands, audit events and ledger invariants inside existing lifecycle transactions. |
| `lib/finance-report.ts`, `lib/finance-rules.mjs` | Consistent scoped cash read model, deposit separation, comparison dates, chart series and safe CSV. |
| `app/api/finance/route.ts` | Owner-only private reports/details/exports in repeatable-read transactions. |
| `app/api/lifecycle/route.ts` | Existing same-origin/rate-limit/idempotency/advisory-lock command dispatcher extended with finance commands. |
| `components/workspace/finance.tsx`, `components/portal.tsx`, `app/workspace.css` | Connected approved finance workspace, filters, chart, expense dialogs and manual matching. |
| `components/owner-dashboard.tsx` | Replaces obsolete missing-ledger copy with direction to the period report; dashboard surplus itself remains unaggregated. |
| `tests/finance.test.mjs`, `tests/finance.integration.mjs` | Boundary, concurrency, immutable-history, cash/report, pagination and export tests. |
| `scripts/phase4d-qa-migrate.mjs`, `scripts/phase4d-qa-verify.mjs`, `package.json` | Disposable-only migration/preservation and repeatable verification commands. |
| README, status, design QA, phase report/manifest and curated evidence | Review instructions and bounded verification record. |

## Migration and rollback

Only the existing disposable PostgreSQL database at loopback port 55432 was migrated. Hashes and counts matched before/after for all 25 recorded pre-existing tables; see `artifacts/phase4d/migration-preservation.json`. No inferred financial entries or backfill were inserted. The migration depends on the previous immutable-history helper and adds indexes to existing Invoice/Payment tables. Main/production PostgreSQL was untouched.

Before production: verify target/history, back up and rehearse restore on UTF8 staging, assess DDL locks and query plans at real volume, supply environment secrets and run the staged suite. The embedded Windows QA database uses WIN1252; production UTF8 restoration has not been verified here. Backout should revert the app while retaining financial tables/history for reconciliation. Do not drop ledger data; correct recording errors with explicit compensating entries.

## Verification and limits

Production build/typecheck and 25 unit tests passed. All ten isolated API suites passed: 77 scenario groups, including nine new finance groups. Coverage includes owner/staff/platform/property/CSRF boundaries, idempotent retries, concurrent partial payments, source-bound refunds, revoke-before-correct, cross-month voided cash history, deposit/SaaS separation, immutable database history, all-history aggregates, daily/monthly chart totals, pagination and CSV limits/injection. Existing invoice/payment/proof snapshots remained unchanged by finance operations. Full API regression precedes final UI-only tab-transition and copy refinements; final build and browser checks cover those changes.

Reports follow current recorded status and can restate prior periods. They are not closed books, accounting profit or a bank balance: no opening balances, financing, automatic allocation of Kamelo subscription charges, tax accounting, split bank lines or bank integration. Cancellation of an invoice follows existing business rules. Browser coverage is bounded and documented separately.

No production migration/deployment, real email, real money transfer, hardware operation, commit or push occurred. Next increments remain platform support/integration health, messaging and import/privacy operations, plus configured provider acceptance for email, payment, CCTV/AI and Smart Room. See the original V3 delta matrix for remaining scope.
