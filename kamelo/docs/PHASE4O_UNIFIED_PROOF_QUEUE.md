# Stage 1 of the remaining delivery plan — Unified owner proof queue

20 October 2026. Completed locally for review. Owners can inspect invoice and historical opening-balance evidence in one queue in Tagihan & Pembayaran. This is an incremental extension of existing services and approved green backoffice components, not a redesign or ledger merge.

## Result and boundaries

The queue defaults to pending evidence for the current property and offers all organization properties, source, status, literal reference/resident/room search, oldest/newest upload order and twenty records per page. Stable ordering includes source and proof ID to avoid overlap when upload times tie. Counts show pending invoice files, pending opening files and decision history; they do not represent revenue, debt or received funds. Summary counts follow property/source/search; list counts also follow status. There is no automatic refresh or bulk approval: the owner can explicitly refresh and inspect one proof.

Selected evidence shows its own source, current remaining amount, reference, property, resident, room and authenticated private download. Owners explicitly choose approval/rejection, enter a tenant-visible note and confirm the decision. The preview digest binds source, proof status/amount/date/method/reference and the current parent balance. Stale balance/proof changes require refreshed detail.

Invoice approval calls the existing billingToolsAction and creates its normal Payment. Opening approval calls the existing openingEvidenceWrite, which creates an OpeningReceipt or links an exact already-recorded receipt without adding cash twice. Existing overcollection/date/source rules and organization locking remain authoritative. Rejection changes neither ledger. Reviewed decisions cannot be replaced through this queue. Exact request retries replay the original result; changed payloads or concurrent new-key approvals cannot create another payment.

The owner queue replaces only the old owner invoice-only proof block. Existing reminder tools, invoice list, staff invoice proof review permissions and demo remain available. Owner opening proof review from the finance detail remains available. The consolidated queue is owner-only; staff privileges were not expanded.

## Changes by file

| File                                   | Change                                                                                                             |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `lib/proof-queue.ts`                   | Parameterized scoped UNION read, safe projection, count/filter/page logic, details and canonical review delegation |
| `app/api/proof-queue/route.ts`         | Fresh owner reads, same-origin confirmed writes, organization lock and idempotent command persistence              |
| `components/workspace/proof-queue.tsx` | Unified filter/count/table/detail/review UI using existing backoffice layout classes                               |
| `components/portal.tsx`                | Owner queue integration and background refresh of invoice summary after decisions                                  |
| `components/billing-tools.tsx`         | Optional old invoice-only queue visibility; staff/demo behavior retained                                           |
| `tests/proof-queue.integration.mjs`    | 13 additional synthetic API scenario groups                                                                        |
| `scripts/phase4o-qa-verify.mjs`        | Cumulative 21-suite regression runner                                                                              |
| `scripts/phase4o-review-sync.mjs`      | Explicit SHA-verified source/evidence allowlist                                                                    |

## Data and security plan

No schema change or migration was required. Existing invoice/opening proof tables and LifecycleCommand are reused. All twenty prior migration hashes and schema bytes match the previous reviewed copy; evidence is in `artifacts/phase4o/data-plan.json`. Main PostgreSQL was not migrated or modified by the test workflow. Earlier pending production migrations still require their release review, backup/restore and UTF-8 acceptance.

Each API request resolves a fresh owner organization context. Writes repeat that check after acquiring the existing organization advisory lock, including before exact-key replay. Queries restrict both UNION branches by organization; property filters are checked against that organization. Parameters are bound through Prisma.sql, and literal search does not interpret percent/underscore as wildcards. Page/order/status/source/query inputs are bounded or allowlisted. Responses are private/no-store and expose no file storage keys, hashes, tokens, passwords or encrypted internal notes. Downloads retain their existing source-specific authorization and attachment protections.

Only twenty queue rows are returned per page; total/summary counts scan scoped data using existing relationships/indexes. Large production datasets still need query-plan/load acceptance before rollout; this increment introduces no speculative index migration.

## Validation

Production build and typecheck pass. All 44 unit tests and 195 API scenario groups across 21 suites pass, including 13 new groups. New coverage includes identity/property isolation, malformed filters/literal search, mixed-source counts, safe projections, private downloads, read-only browsing, confirmed/stale requests, idempotency, invoice and opening approval, existing-receipt linking, rejection, concurrent decisions, stable pagination and owner revocation before replay.

Browser QA approved a synthetic Rp50,000 invoice proof and a separate Rp50,000 opening proof through the queue. Invoice remainder changed Rp600,000 to Rp550,000; opening remainder changed Rp1,250,000 to Rp1,200,000. Both appear in approved history. Final responsive checks and evidence are described in [design QA](PHASE4O_DESIGN_QA.md).

No commit, push, deployment, main database migration, real email, device command or funds transfer was performed. See [remaining delivery stages](REMAINING_DELIVERY_STAGES.md) for the next work; full V3 acceptance remains pending.
