# Phase 4D bounded browser QA

18 October 2026. Production preview `http://127.0.0.1:3001/app/finance`, synthetic disposable fixtures only. Approved v5.3 green workspace components, typography, logo and navigation reused. Public v7/v6 not redesigned.

Observed owner flow: existing QA account signs in, opens Keuangan, reads actual report/chart and expense history, creates an unpaid synthetic cost, opens manual reconciliation, switches through all report tabs and filters all organization properties then restores the active property. Creating the Rp25,000 bill increased booked/unpaid costs while cash outflow remained Rp90,061. Success feedback receives focus. No browser action transferred funds or submitted a reconciliation assertion.

| Surface | Viewport | Observed result |
|---|---|---|
| Report and daily chart | 1440 × 1000 | Existing green shell, three cash KPIs, separate deposit panel, readable actual daily series. |
| Expense history dialog | 390 × 844 | Document width 390; dialog width 356; client/scroll width 341. |
| Created expense dialog | 320 × 740 | Document width 320; dialog width 286; client/scroll width 271. All fields/history reachable by vertical scrolling. |
| Report after Escape | 390 × 844 | Focus returned to invoking Detail button; document width 375 with scrollbar. |
| Report and create action | 320 × 740 | Document width 305 with scrollbar, no document horizontal overflow; create action height 44px. Tables scroll within their container. |
| Mutasi / monthly / expenses tabs | 320 × 740 | All three switched successfully on final build; reselecting current monthly tab retained the report. |
| Manual match detail | 320 × 740 | Explicit manual status and amount/direction/reference/confirmation controls render in bounded dialog. |

Browser QA caught a client exception when changing tab: a newly selected movement renderer briefly received expense rows before the load effect cleared them. The tab event now clears the previous data atomically with the view change and skips reselecting the same view. Final build and the three-tab browser regression passed. Earlier API regression remains applicable: this fix changes only client state handling. Desktop final capture follows this fix; expense creation capture is from the same layout before it.

Evidence in `artifacts/phase4d`: finance-desktop.png, finance-final-desktop.png, expense-detail-desktop.png, expense-detail-mobile.png, finance-mobile320.png, expense-created-mobile320.png and manual-match-mobile320.png. Temporary viewport override reset; preview left open.

Financial recording/refunds/corrections and matching assertions were tested with isolated API fixtures. This is bounded Chromium interaction/layout coverage, not exhaustive WCAG, physical-device, performance or production acceptance certification.
