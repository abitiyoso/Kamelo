# Stage 2 — Combined dashboard and resident home balances

20 October 2026. Completed locally for review as an extension of the approved backoffice and resident UI. Existing logo, photographs, green identity, navigation and public pages are retained.

## Owner behavior

The dashboard now loads a dedicated owner-scoped financial snapshot. Outstanding and overdue figures combine issued invoices with active historical opening receivables, with separate source totals/counts. Draft/void/future-issued invoices and void/future-as-of opening batches do not enter current debt. Overdue means due before today in Asia/Jakarta; due today is outstanding but not overdue. A stable oldest-due list shows ten items per page, with source-specific links to Tagihan or Keuangan. Totals cover the database, not the existing invoice list's fifty-row page.

Cash received includes invoice payments and net opening receipts, using the same extracted daily cash helper as the existing finance report. Net paid expenses include refunds and corrections; surplus is cash received minus net paid expenses. Deposit receipts, liability movements and deductions remain outside operating income/surplus. Uploaded pending proofs change neither cash nor debt. The proof priority now counts pending invoice and opening evidence and links to the combined queue.

The current month-to-date comparison uses the previous calendar month through the matching day, clamped to its last day. A zero previous cash base produces no fabricated percentage. The six-month chart shows actual monthly cash, net paid expenses and surplus through today. It supports negative net expenses/surplus and offers an exact-value table. Current-month values are partial. It does not invent historical monthly arrears; current outstanding is shown separately. Corrections restate their original recorded period, following existing ledger rules.

The dashboard exposes refresh, explicit loading/error states and no combined-money fallback to paginated invoice data. Occupancy, operational tasks and contracts continue to use their existing portal sources. Financial snapshot refresh does not claim push/realtime delivery or requery every operational module. The current property selector is retained; the API also supports an organization-wide aggregate for authorized consumers.

## Resident behavior

The resident home card now shows own current invoice debt plus opening balances explicitly shared to that exact account/stay/grant. It includes the source split, overdue amount and earliest due source/reference. It no longer displays an invoice-only “no open bill” result when shared opening debt exists. Aggregate amounts cover all authorized invoices even though the existing invoice details list remains capped at one hundred.

Fresh billing permission and share/source matching are checked transactionally. Revoked shares disappear from the home aggregate; other residents' balances and unshared historical balances are excluded. Without billing permission the summary is null and invoices are withheld. Returning home or explicitly refreshing reloads the resident summary. Invoice and opening detail/upload workflows remain separate.

## Changes by file

| File                                                            | Change                                                                                                                 |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `lib/finance-report.ts`                                         | Extract unchanged canonical invoice/opening/expense daily cash queries into financeCashDaily; finance report reuses it |
| `lib/dashboard.ts`                                              | Owner snapshot, scoped debt/proof aggregation, comparison/trend and bounded overdue list                               |
| `lib/dashboard-periods.mjs`                                     | Calendar comparison and six-month boundaries                                                                           |
| `app/api/dashboard/route.ts`                                    | Fresh owner context, validated scope/page, private repeatable-read snapshot                                            |
| `components/owner-dashboard.tsx`                                | Combined KPIs, source drilldown, proof priority, manual refresh and actual cash chart                                  |
| `components/portal.tsx`, `components/workspace/proof-queue.tsx` | Queue navigation intent and focus after the target data is ready, avoiding jumps during invoice-list layout changes    |
| `components/workspace/finance.tsx`                              | Export existing negative-value-capable CashChart for reuse                                                             |
| `lib/resident-finance.ts`                                       | Exact-grant, unpaginated own balance aggregation and earliest due source                                               |
| `app/api/resident/route.ts`                                     | Fresh transactional billing projection and home summary, retaining existing invoice projection                         |
| `components/identity/resident-portal.tsx`                       | Combined own balance card and refresh on home entry                                                                    |
| `tests/dashboard.test.mjs`                                      | Three calendar boundary unit tests                                                                                     |
| `tests/dashboard.integration.mjs`                               | Twelve additional isolated API scenario groups                                                                         |
| `scripts/dashboard-qa-verify.mjs`                               | Cumulative twenty-two-suite runner                                                                                     |
| `scripts/dashboard-review-sync.mjs`                             | Explicit SHA-verified review copy allowlist                                                                            |

## Data, authorization and validation

No schema change or migration was required. All twenty existing migration hashes and schema bytes match the previous reviewed copy; see `artifacts/dashboard-stage2/data-plan.json`. Tests use disposable PostgreSQL:55432 and app:3001, not the main database. The new reads do not create receipts, payments, reminders or device commands. Integration snapshots verify invoice/payment/opening/proof/deposit/expense-entry row hashes are unchanged by dashboard/resident reads.

Owner reads resolve current organization membership inside the transaction; cross-owner, staff, tenant, missing/invalid property and revoked-member access are denied. Monetary aggregates fail closed if outside safe integer precision. Resident financial reads recheck the exact billing grant against the initial workspace and use repeatable-read transactions. Queries bind values through Prisma SQL parameters and return no storage keys, tokens, passwords, encrypted notes or arbitrary external links.

Production build/typecheck, 47 unit tests and 207 API scenario groups across 22 suites pass. Tests cover canonical finance equality, opening/invoice source breakdown, calendar comparison, deposit exclusion, pending proof counts, sharing/revocation, database-wide totals beyond fifty/one-hundred-row display limits, pagination, empty/portfolio scope, draft/void/future sources, original-period corrections, negative expenses and read-only/security boundaries. Browser and responsive evidence are in [design QA](DASHBOARD_STAGE2_DESIGN_QA.md).

Stage 2 is complete locally. Four large delivery stages remain: automated reminders/notifications, remaining finance/document requirements, real integration acceptance, and final UAT/release. No commit, push, deployment, production migration, real email, device command or funds transfer occurred. See [delivery progress](REMAINING_DELIVERY_STAGES.md).
