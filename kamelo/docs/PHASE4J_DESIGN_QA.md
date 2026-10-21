# Phase 4J browser QA — XLSX

19 October 2026. Final production build on `http://127.0.0.1:3001/app/rooms`, synthetic QA owner and a generated two-sheet XLSX only.

The approved green owner shell, logo, fonts, navigation and room cards remain in place. Both previously delivered import panels now accept CSV/XLSX using one shared picker; no separate page/navigation or public-page redesign.

Verified browser flow:

1. Actual file chooser upload of a workbook with Rooms and Residents sheets. Neither is silently selected. Selecting Rooms loads its `harga,nomor` headers; owner reverses the mapping to number column2/rate column1.
2. Use-sheet conversion fills canonical CSV with X-01/Rp1,500,000 and X-02/Rp1,750,000. The source mapping collapses into a summary. Existing domain preview produces two valid rows and save remains disabled pending confirmation.
3. Returning to source mapping clears CSV and the previous preview/save action. Applying the mapping again and re-previewing permits confirmation. Save reports **2 kamar berhasil diimpor**, updates the room count to3 and adds both cards/history.
4. Second actual upload of the same file in the resident panel. Owner selects Residents; seven source fields load. Native 1904-calendar date cells become2026-10-20. Preview shows distinct billing days12 and25, new profiles, billing automation off and no automated locks. Confirmation then reports **2 masa tinggal berhasil diimpor** and updates cards/history.
5. Room mapping at1440×1000,390×844 and320×720; resident seven-field mapping at390×844. At390 document width375; at320 width305. No document-wide horizontal overflow, controls stack on mobile. Both final commits reported zero captured console errors. Viewport override reset; result tab retained.

Evidence in `artifacts/phase4j/`:

- `xlsx-desktop-mapping.png`, `xlsx-desktop-preview.png`, `xlsx-desktop-saved.png`
- `xlsx-mobile-390.png`, `xlsx-mobile-320.png`, `xlsx-resident-mobile-390.png`
- `xlsx-resident-preview.png`, `xlsx-resident-saved.png`, `browser-metrics.json`

Browser upload/mapping/commit tested both paths; downloadable templates were generated from valid XLSX fixture encoding and parsing is covered by unit tests. Browser template downloads, invalid-file browser cases and browser rollback were not separately executed; those errors/rollback are verified by unit/API assertions. This is bounded functional/responsive QA, not a full assistive-technology audit or production sign-off. Existing approved-asset byte tests pass.
