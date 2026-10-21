# Phase 4M — Tenant opening balances and private payment evidence

Completed locally for review on 20 October 2026. This extends the Phase 4K/L historical receivables ledger; approved public designs and existing invoice workflows remain in place.

## Result

Owners explicitly share a historical balance with a verified resident billing account. The share binds the exact user, stay and OccupantAccess grant for the same guest/property. Matching a name or phone does not grant access. Revocation, billing permission removal or an invalid session immediately blocks subsequent reads and uploads.

In Tagihan, residents see shared original, paid and remaining amounts, due date and their own evidence history. They can upload a private JPG, PNG, WebP or PDF with amount, payment date, method, reference and optional encrypted note. Uploading records a pending claim and changes neither cash nor debt. Owners inspect evidence within the receivable details, reject it with a tenant-visible note, approve one new canonical receipt, or explicitly link an exact existing receipt without adding cash twice. Receipt reversal preserves the approved evidence and shows a correction notice to the tenant.

## Changes by file

| File                                                                   | Change                                                                                                                |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `prisma/schema.prisma`                                                 | OpeningShare and OpeningProof plus additive relations                                                                 |
| `prisma/migrations/20261019140000_opening_tenant_proofs/migration.sql` | Additive tables, indexes, checks and immutable lifecycle guards                                                       |
| `lib/opening-tenant.ts`                                                | Fresh context authorization, explicit shares, tenant projections, private evidence validation and atomic owner review |
| `lib/tenant.ts`                                                        | Shared private-file store/cleanup helpers                                                                             |
| `lib/opening-balances.ts`                                              | Prevent batch void after evidence history                                                                             |
| `app/api/opening-tenant/route.ts`                                      | Tenant list/detail and bounded multipart upload                                                                       |
| `app/api/opening-proofs/[id]/route.ts`                                 | Scoped authenticated attachment download                                                                              |
| `app/api/opening-balances/route.ts`                                    | Owner evidence projection and share/revoke/review actions                                                             |
| `components/identity/opening-balances.tsx`                             | Resident balance, upload and paginated evidence UI                                                                    |
| `components/identity/resident-portal.tsx`                              | Add opening balances to existing Tagihan view                                                                         |
| `components/workspace/opening-evidence.tsx`                            | Explicit share and owner evidence review controls                                                                     |
| `components/workspace/opening-receipts.tsx`                            | Embed evidence review and refresh receipt/cash views                                                                  |
| `components/workspace/opening-balances.tsx`                            | Updated guidance and guarded void control                                                                             |
| `tests/opening-tenant.integration.mjs`                                 | 13 additional integration scenario groups                                                                             |
| `scripts/phase4m-qa-migrate.mjs`                                       | Fixed disposable QA target and preservation snapshot                                                                  |
| `scripts/phase4m-qa-verify.mjs`                                        | Cumulative 19-suite regression runner                                                                                 |
| `scripts/phase4m-review-sync.mjs`                                      | Explicit SHA-verified review copy allowlist                                                                           |

## Data and security

Only disposable PostgreSQL port 55432 was migrated. Before/after snapshots preserve the existing values in 39 tables; evidence is in `artifacts/phase4m/migration-preservation.json`. Applied migration bytes were retained. Production deployment requires reviewed backup/restore, UTF-8 acceptance and migration execution in the release process; none occurred here.

Fresh authorization is repeated inside the transaction after the organization lock. Cross-owner, staff, other tenants, replacement accounts, anonymous users and legacy public-token routes cannot download evidence. A replacement account does not inherit the previous uploader's files. Private responses use no-store, attachment disposition, nosniff and sandbox headers. File keys and ciphertext are not exposed in API projections.

Uploads are limited to 5 MB, five pending claims per receivable, ten attempts per user per fifteen minutes and twenty history records per page. Byte signatures and declared MIME must agree. This is signature validation, not full malware scanning. Private storage must remain outside public assets with controlled backups and an agreed retention/scanning policy before production acceptance.

Exact request retries are idempotent, altered retry payloads conflict, duplicate active file hashes are rejected, and temporary files are removed after failed/reused writes. Encrypted notes and immutable evidence history are retained. Amount/date/reference checks, organization locking and canonical receipt rules prevent overcollection and duplicate cash recognition. Reviewed proofs cannot be silently edited or reopened.

## Validation

Production build, typecheck and 44 unit tests pass. Cumulative regression passed 170 API scenario groups across 19 suites, including 13 new groups for tenant proof security, sharing, retries, lifecycle, limits, pagination and cash integration. Full API regression preceded the final UI-only refresh/focus/scroll fixes; final build, unit/typecheck and browser checks followed those fixes. Prisma relation metadata was regenerated and typechecked afterward without changing application fields or migration bytes.

Browser QA on 20 October used synthetic accounts/files on localhost:3001. A Rp50,000 pending proof kept the remaining balance at Rp400,000; owner approval changed it to Rp350,000 and cash from Rp1,100,000 to Rp1,150,000 exactly once. See [design QA](PHASE4M_DESIGN_QA.md).

## Pending work

Opening-balance reminders, a global combined proof queue and consolidated dashboard/home insights remain pending; current dashboard invoice metrics and the tenant home invoice card do not include this ledger. Also pending: provider/bank verification, refunds, signed receipt issuance, retention policy, UTF-8 restore/UAT and production rollout. This is a completed bounded increment, not full V3 acceptance. No commit, push, deployment, main database migration, real email, device command or funds transfer was performed.
