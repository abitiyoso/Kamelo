# Stage 2 dashboard — Browser and responsive QA

20 October 2026, synthetic accounts on QA app localhost:3001 and disposable PostgreSQL:55432. Approved green branding, logo, photographs and navigation are retained. No actual provider, real message or money transfer was used.

## Verified owner journey

The populated property shows Rp300,000 current cash received, Rp2,700,114 outstanding, two pending proof files and Rp350,000 operating surplus. Net paid expenses are minus Rp50,000 because a supplier refunded a prior-period cost; the chart and exact-number table show that negative value without clipping it. The previous cash base is zero after a correction, so the KPI explicitly declines to calculate a percentage. Comparison dates are 1–20 October versus 1–20 September 2026.

The overdue list changes to page two while totals remain unchanged. The six-month chart and expanded number table show historical/current cash, expenses and surplus. Switching to Empty Dashboard Property resets all financial/proof figures and occupancy to zero; returning to the populated property restores that property's own snapshot.

The proof priority navigates and focuses the combined proof queue after its data is ready. The destination shows one pending invoice and one pending opening proof, matching the dashboard count. Focus and scroll were verified after the page's smooth scroll completed.

## Verified resident journey

The exact resident STAY workspace displays Rp2,200,114: Rp700,114 own invoice debt plus Rp1,500,000 explicitly shared opening debt. It excludes the owner's additional Rp500,000 unshared historical balance. The earliest due source/reference, current date and pending-proof explanation are shown. The home refresh control reloads the summary.

## Responsive evidence

Owner and resident were inspected at desktop, 390 x 844 and 320 x 720. Actual document widths remain within viewport width. KPI money values and descriptions wrap without widening the page; the existing bounded tables retain internal scrolling. Mobile navigation remains accessible. Viewport overrides were reset and the owner dashboard was left open for review.

| File in `artifacts/dashboard-stage2`             | Observation                                                     |
| ------------------------------------------------ | --------------------------------------------------------------- |
| `owner-kpis.png`                                 | Combined financial KPIs, comparison explanation and source card |
| `owner-debt-page2.png`                           | Overdue pagination without changing totals                      |
| `owner-cash-chart.png`                           | Negative-capable chart and exact-value table                    |
| `owner-empty-property.png`                       | Empty property zero states                                      |
| `owner-proof-priority.png`                       | Navigation to the matching combined queue                       |
| `owner-mobile-390.png`, `owner-mobile-320.png`   | Owner priorities/KPIs at both widths                            |
| `tenant-home.png`                                | Exact account's combined own balance                            |
| `tenant-mobile-390.png`, `tenant-mobile-320.png` | Resident card at both widths                                    |
| `browser-metrics.json`                           | Actual viewport/document widths and observed amounts            |

## Automated validation and timing

All 47 unit tests and 207 API scenario groups across 22 suites pass, including calendar boundary tests and twelve new dashboard groups. Full API regression ran after final financial/backend changes. Later UI-only refinements clarified the zero-base wording, removed unused client calculation and made queue navigation focus wait for ready data. Final optimized build, typecheck and browser checks followed those refinements; a second full API regression is not claimed.

The shared finance query extraction also passed existing finance, receipt, proof and deposit regression suites. Read-only integration snapshots confirm no ledger/proof rows changed during dashboard/home reads. Schema bytes and twenty existing migration hashes remain unchanged; there is no new migration.

This is local acceptance of stage 2, not production load certification, external banking verification or full V3 launch. Detailed row views retain their existing display limits, while the new aggregate summaries cover all authorized records. Four major delivery stages remain.
