# Phase 4L — browser QA

19 October 2026. Optimized local build on `http://127.0.0.1:3001`, disposable QA database at port 55432. Only synthetic accounts, residents, receipt amounts and statement references were used. Existing credentials were used for sign-in; no new access was granted through the browser. No real funds moved and no email was sent externally.

The receipt workflow extends the existing luxury green finance panel, controls, narrow-screen navigation and scrollable tables. It does not redesign the approved landing, showcase or backoffice. Forms use labeled fields, explicit confirmations, live status feedback and focus on newly opened receipt headings or write results. History is limited to 20 entries per page.

## Browser results

1. Opened the existing synthetic receipt fixture, Keuangan, its source batch and the receipt panel. The source had Rp499,980 remaining; finance cash showed Rp1,000,020.
2. Entered a Rp50,000 transfer reference and review note. Save remained disabled before the explicit received-money/no-duplicate declaration.
3. Confirmed and saved. Remaining debt became Rp449,980; net receipts and finance cash both increased by exactly Rp50,000 to Rp1,050,020. New history and success feedback appeared.
4. Selected that receipt's correction action, supplied the reason and confirmed that this was a data correction rather than a refund. A negative Rp50,000 entry appeared, the original became corrected, debt returned to Rp499,980 and cash to Rp1,000,020.
5. Closed the register and opened Mutasi & pencocokan. Original/correction rows and their states appeared with the new opening source. Opened an active synthetic Rp1 receipt, entered a synthetic statement reference, and successfully saved a manual match. Matched/unmatched counts changed from 0/21 to 1/20, and retained match history appeared. There was no live bank connection.
6. Desktop at 1440×1000 and mobile at 390×844 and 320×720 were inspected. Document widths were 375 and 305 for the mobile viewports respectively (scrollbar allowance); no page-wide horizontal overflow. Wide tables scroll within their own labeled regions. Viewport overrides were reset and the final QA tab retained.

## Evidence

- `artifacts/phase4l/receipt-desktop-form.png`
- `artifacts/phase4l/receipt-desktop-saved.png`
- `artifacts/phase4l/receipt-desktop-corrected.png`
- `artifacts/phase4l/receipt-bank-match.png`
- `artifacts/phase4l/receipt-mobile-390.png`, `receipt-mobile-320.png`
- `artifacts/phase4l/browser-metrics.json`
- Build/typecheck/unit logs, 18 API suite logs, regression results, 11-group receipt result and 38-table migration preservation report.

Browser data and credentials under `.local-secrets` are excluded from the review copy. Screenshots contain synthetic values only. Automated/browser checks do not establish production UAT, formal accessibility certification, provider verification or backup/restore acceptance. Real refunds and tenant reminder/proof workflows for opening debt remain outside this increment.
