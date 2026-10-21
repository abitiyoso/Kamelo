# Phase 4N — Portal reminder browser QA

20 October 2026. Tests used synthetic accounts/receivables on localhost:3001 and disposable PostgreSQL:55432, with transactional mail redirected to the local sink. Approved branding, public pages and existing green backoffice components were retained.

## Observed journey

1. Owner opens Keuangan > Saldo awal piutang > batch details > Tinjau penerimaan REMINDER-BROWSER.
2. Existing tenant sharing is displayed read only. The reminder preview shows the exact verified recipient, Rp250,000 remainder, reference and due date.
3. Owner explicitly checks the confirmation and publishes the portal reminder. The saved result shows one history entry and the 24-hour cooldown; another publication is disabled.
4. Tenant signs in and chooses the actual STAY workspace, opens Tagihan and REMINDER-BROWSER details. The same reference, timestamp and Rp250,000 snapshot appear. Current remaining balance is still Rp250,000; no payment or receipt is created.
5. On the separate settled synthetic source, reminder history changes from page 1 to page 2 of 42 entries while the payment evidence remains on page 1 of 1. Historical snapshot guidance and the current zero remainder remain visible.

No security-sensitive sharing grants were changed through the browser. No real message or payment was sent. Publishing is an internal portal record and does not indicate delivery/read confirmation.

## Responsive evidence

Owner reminder history was inspected at desktop and 390 x 844. Tenant details were inspected at desktop, 390 x 844 and 320 x 720. Measured document widths remain within their viewports, text wraps and mobile navigation stays available. Viewport overrides were reset after testing. Reminder history reuses the bounded scrolling region and independent pagination controls.

| File under `artifacts/phase4n`   | Observation                                        |
| -------------------------------- | -------------------------------------------------- |
| `owner-reminder-published.png`   | Owner saved result, immutable history and cooldown |
| `owner-reminder-mobile-390.png`  | Owner small-screen controls and history            |
| `tenant-reminder-desktop.png`    | Current saldo and matching reminder snapshot       |
| `tenant-reminder-mobile-390.png` | Wrapped tenant reminder and controls               |
| `tenant-reminder-mobile-320.png` | Minimum-width tenant reminder                      |
| `tenant-reminder-pagination.png` | Reminder pagination separate from proof history    |
| `browser-metrics.json`           | Exact viewport/document measurements and checks    |

## Automated validation and timing

44 unit tests passed. Cumulative regression passed 182 API scenario groups across 20 suites, including 12 reminder groups. After the final recipient-field projection and independent reminder-page refinements, the optimized build passed and both affected suites passed again: 13 tenant-proof groups and 12 reminder groups. Final typecheck also passed. The cumulative run and final targeted reruns have separate logs; they are not represented as a second full regression run.

QA migration snapshots preserved row hashes in 41 existing tables. Evidence includes `build.log`, `unit.log`, `typecheck.log`, `migration-preservation.json`, `regression-results.json`, twenty suite logs, `opening-tenant-final.log` and `opening-reminders-final.log`. Tests cover no-cash writes, identity boundaries, revoked access, exact retries, concurrency, stale preview, settled/upcoming/void sources, pending evidence, immutable records and bounded pagination.

Owner 320 px was not separately tested in this increment. Automated schedules, external delivery/read receipts, production UTF-8 backup restore and UAT remain pending. These results do not assert full V3 acceptance or live provider operation.
