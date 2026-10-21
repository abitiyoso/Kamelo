# Phase 4K — opening receivables register

19 October 2026. Incremental owner-only register for historical outstanding rent. Approved landing v7, showcase v6 and backoffice v5.3 assets, navigation and visual system are retained.

## Delivered and boundaries

Keuangan → Saldo awal piutang accepts CSV upload/paste and XLSX with explicit sheet and column selection. Each batch has an as-of date, encrypted source note and up to 50 positive receivables. Each row binds an explicitly selected existing resident profile, a normalized source reference, integer rupiah amount and actual due date. Existing profiles are never silently selected or created. Missing profiles must be reviewed through existing resident management first.

Preview makes no business writes. Confirmation recomputes preview and compares a digest of source, dates, mappings and selected profiles. Organization locking, fresh owner membership checks, idempotency keys and a partial database unique index prevent duplicate active source references. References matching an existing Kamelo invoice number, including void invoices, are rejected. Other semantic duplicates with different references still require owner review; this is not automatic reconciliation of every legacy ledger.

Active and overdue totals are shown separately from the cash-period report. Existing invoices, payments, deposits, expenses, cash metrics, subscription pricing and tenant portals are not rewritten. This phase records and reviews debt only: collection, reminders, proof submission, partial settlement, corrections through payments, tenant balance visibility and inclusion in broader receivables reports remain future work. It does not import credits, deposits, bank balances or general-ledger opening accounts. It does not close an accounting period or create historical invoices.

Source rows are immutable. An owner may void an entire batch with an explicit confirmation and encrypted reason; rows and original amounts remain available for review. A corrected batch may reuse a reference after its old batch is voided. Void does not transfer funds. Resident import rollback refuses to delete a profile linked to any opening record, including voided history.

## Files

| Files | Change |
| --- | --- |
| `lib/opening-balances-csv.mjs`, `lib/opening-balances.ts` | Parsing, normalized references, matching candidates, preview digest, atomic commit and whole-batch void |
| `app/api/opening-balances/route.ts` | Owner-only scoped GET with 20-batch pagination and POST with origin, rate, fresh membership and idempotency checks |
| `components/workspace/opening-balances.tsx`, `finance.tsx` | Expandable finance panel, mapping, explicit profile selection, confirmation and retained detail history |
| `lib/import-workbook.mjs`, `app/api/import-files/route.ts`, `components/workspace/import-file.tsx` | Bounded XLSX balance mapping, Text references and native date support; accurate per-kind row limits |
| `lib/resident-import.ts` | Preserve profiles referenced by opening financial history during rollback |
| `prisma/schema.prisma`, `prisma/migrations/20261019095000_opening_receivables/migration.sql` | Add two tables, indexes, constraints and immutable/deferred consistency triggers |
| `public/templates/kamelo-saldo-awal.csv`, `.xlsx` | Downloadable examples with text identifiers and native date cells |
| `tests/opening-balances.test.mjs`, `tests/opening-balances.integration.mjs` | Parser, XLSX, source, scope, concurrency, numeric, immutable-history and regression coverage |
| `scripts/phase4k-*` | Template generation, guarded QA migration, regression runner and SHA-verified review sync |

No new runtime dependency. XLSX retains Phase 4J's ZIP/XML bounds and rejection of formula, macro, external link, merged or hidden data. Source workbook bytes are not stored. Notes/reasons use the existing application encryption key. Audits contain count and total, without source note text. Owner responses are private/no-store; candidate phone values are masked. Data remains scoped to the existing organization authorization model.

## Additive migration and rollout

Only the explicitly named disposable PostgreSQL QA instance at loopback port 55432 was migrated. The guarded migration script compared counts and SHA-256 row hashes for 36 pre-existing business tables before/after; all matched. Applied migration bytes are retained unchanged in the review copy. The main database has not been migrated.

Two new tables use restrictive financial foreign keys. A partial unique index covers active property/reference pairs; amount is limited to 1–1,000,000,000 per row. Batch size is 1–50. Before triggers forbid deletion, source mutation and reopening voided rows. Deferred constraint triggers validate final row count, shared property/guest scope and whole-batch state at transaction commit. See PostgreSQL's [constraint-trigger semantics](https://www.postgresql.org/docs/current/sql-createtrigger.html). The app computes aggregate totals as safe integers and tests totals above PostgreSQL's 32-bit row amount range.

Production acceptance still requires a UTF-8 restore rehearsal, reviewed backup/rollback procedure, migration deployment approval and environment verification. Do not drop imported financial history to roll back an application release; disable entry points while retaining the new tables. Real services remain unconfigured; all email activity in tests used the local sink.

## Verification

- Production build and TypeScript check pass; 44 unit tests pass.
- All 17 isolated API suites pass: 146 scenario groups, including 13 opening-balance groups.
- Tests cover anonymous/staff/cross-owner/hostile-origin denial; explicit existing-profile choice; read-only preview; duplicate and invoice-reference blocking; confirmation/digest/key binding; concurrent duplicate imports; amounts over 32-bit aggregate range; actual XLSX multipart conversion; downloadable templates; fresh revocation; paginated scoped history; immutable/deferred DB checks; retained void history and resident rollback protection.
- Hash snapshots of invoices, payments, deposits, expenses and finance matches remain equal across register and void operations.
- Browser evidence is recorded in [Phase 4K design QA](PHASE4K_DESIGN_QA.md).

Local review branch: `codex/phase4k-opening-receivables`. No commit, push, deployment, external email or main-database migration was performed. The V3 handoff is not yet wholly complete; next financial increment is reviewed collection/settlement of these separately recorded opening receivables.
