# Phase 4K — browser and design QA

19 October 2026. Local optimized build on `http://127.0.0.1:3001`, disposable database at port 55432, existing synthesized owner fixture. No external email or real financial transaction. The main database and port 3000 application were not migrated or replaced.

The new owner-only expandable register uses the existing approved luxury green backoffice shell, typography, controls, panels, table styling and mobile navigation. Landing v7, showcase v6, approved logos/photos and navigation were not redesigned. The existing cash report is preserved; the register explains its separate, all-date balance scope and current lack of collection/settlement.

## Browser flow verified

1. Signed in with an existing synthetic QA owner and opened Keuangan → Saldo awal piutang.
2. Entered a source note, uploaded a synthetic `.xlsx`, explicitly selected its sheet and reviewed five source mappings.
3. Converted its text identifiers, native Excel date and integer amount to canonical CSV; preview correctly required an explicit resident choice and kept saving disabled.
4. Selected the matching resident, previewed again and confirmed the source/debt declaration.
5. Saved one Rp750,000 opening receivable. Live success text appeared; active total changed from Rp3,250,000 to Rp4,000,000 and history gained one batch.
6. Reloaded the final build, opened persisted batch detail and verified the exact reference, due date, amount and source note. The detail heading receives focus. Void remains disabled until both reason and confirmation are supplied; whole-batch void and retained history were tested through the API.
7. Repeated workbook reading on the final build to verify mobile wrapping after a one-pixel overflow was found and fixed in long import buttons. Actual document widths were 305 at viewport 320 and 375 at viewport 390 (scrollbar allowance), with no page-wide horizontal overflow. Wide data tables scroll inside their labeled keyboard-focusable regions. A desktop screenshot and DOM measurement were also captured at 1440×1000.

Viewport overrides were reset after testing. The QA tab is retained as a deliverable. Browser fixture email, password and workbook remain under `.local-secrets` and are excluded from the review copy; screenshots contain synthetic resident data only.

## Evidence

- `artifacts/phase4k/opening-desktop-preview.png`: explicit-profile preview and disabled save before confirmation.
- `artifacts/phase4k/opening-desktop-saved.png`: success message and new history entry.
- `artifacts/phase4k/opening-desktop-detail.png`: persisted amount, source and due date in the final build.
- `artifacts/phase4k/opening-mobile-320.png`, `opening-mobile-390.png`: final narrow-screen mapping and history.
- `artifacts/phase4k/browser-metrics.json`: measured document widths, detail focus and flow summary.
- `build.log`, `typecheck.log`, `unit.log`, `regression-results.json`, suite logs and `migration-preservation.json`: build, 44 unit tests, 17 API suites / 146 scenario groups and existing-data preservation.

The complete suite passed before the last UI-only button-wrap/focus adjustment; the final optimized build and all 44 unit tests passed after that adjustment, and the browser rechecked the affected flow. Automated tests do not replace formal accessibility certification, production UAT, UTF-8 restore rehearsal or real provider acceptance. Settlement, reminders and tenant display for this ledger remain unimplemented; no whole-handoff completion is claimed.
