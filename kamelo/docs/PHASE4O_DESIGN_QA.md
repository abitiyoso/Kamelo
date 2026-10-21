# Unified proof queue — Browser and design QA

20 October 2026. Synthetic owner, invoice and opening-receivable fixtures on localhost:3001, disposable PostgreSQL:55432 and local mail sink. This completes stage 1 of the six remaining delivery stages for local review.

## Observed journey

1. Owner opens Tagihan & Pembayaran, searches QUEUE-BROWSER and sees one pending invoice file and one pending opening-balance file in the same queue. Counts describe files, not money.
2. Owner opens the Rp50,000 invoice proof, selects approval, enters a review note and explicitly confirms. The decision is retained; invoice payments change Rp400,000 to Rp450,000 and remaining invoice balance Rp600,000 to Rp550,000.
3. Owner opens the separate Rp50,000 opening proof from the same queue, chooses a new receipt, enters a review note and explicitly confirms. The opening remainder changes Rp1,250,000 to Rp1,200,000. The invoice remainder remains Rp550,000.
4. Pending search results become empty. Switching the status filter to Approved shows the two files with their original source labels. The existing invoice reminder panel remains below the queue.
5. Final layout reuses the existing wrapping finance filter row. Mobile table scrolling reaches the action column inside the bounded region. Buttons use short visible text with full source/reference accessible names. Owner details can still be opened from the final table.

No real funds moved. Decisions were bookkeeping on synthetic QA data. No new sharing grants, real messages or device commands were sent through the browser.

## Responsive evidence

Desktop and 390 x 844 / 320 x 720 owner layouts were checked. Document widths remain within viewport width. On mobile, the existing table region scrolls horizontally rather than widening the document; controls wrap and fixed navigation remains available. Viewport overrides were reset.

| File in `artifacts/phase4o`    | Evidence                                             |
| ------------------------------ | ---------------------------------------------------- |
| `queue-invoice-approved.png`   | Invoice saved decision and updated source balance    |
| `queue-opening-approved.png`   | Opening saved decision and updated source balance    |
| `queue-filters-desktop.png`    | Final wrapping filters and source counters           |
| `queue-approved-history.png`   | Approved invoice and opening file in one table       |
| `queue-mobile-390.png`         | Mobile filters and counters                          |
| `queue-mobile-actions-390.png` | Horizontally reachable action column                 |
| `queue-mobile-320.png`         | Minimum-width owner layout                           |
| `browser-metrics.json`         | Actual document/table measurements and observed flow |

## Automated verification and timing

All 44 unit tests and 195 API scenario groups across 21 suites pass. Thirteen new groups cover mixed-source queue behavior, access isolation, downloads, read-only browsing, stale/confirmed requests, canonical review paths, no duplicate cash, concurrency, history filtering, pagination and revoked membership. Final build/typecheck pass.

The cumulative API regression ran after final backend changes. Two later UI-only refinements reused existing wrapping layout classes and shortened visible action text without changing accessible names or business behavior. Optimized build and browser responsive/detail checks followed those refinements. The full API suite was not represented as rerun after those UI-only changes.

No migration was introduced. `data-plan.json` confirms schema bytes and all twenty previous migration hashes match the prior reviewed copy. This is not production UAT, query-load certification, external banking validation or full V3 release acceptance. Dashboard consolidation and its invoice-only badge/metrics are the next stage.
