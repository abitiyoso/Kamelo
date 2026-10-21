# Phase 4B bounded browser QA

18 October 2026. Production preview: `http://127.0.0.1:3001/app/leads`. Existing approved green v5.3 shell, typography, logo and owner navigation are retained. All records used in these checks are synthetic.

Observed workflow: create Nadia QA prospect with consent reference → view saved pipeline row → record a follow-up → prepare and save a nonbinding offer → inspect conversion form → search Budi as an existing resident profile. Quotes do not reserve rooms. No browser conversion/contract acceptance, external delivery or money movement was performed. Backend conversion paths are covered by isolated API tests.

Saving a note initially exposed a parent refresh unmounting the dialog. Background refresh was added for Prospect/Resident 360 saves; the dialog now remains open with the new activity. Final feedback also receives keyboard focus after save, retaining the modal keyboard context. Escape closes and restores focus to Kelola.

| Surface | Viewport | Result |
|---|---|---|
| Pipeline / offer | 1440 × 900 | Existing shell, table/KPIs, readable bounded dialog. |
| Conversion form | 390 × 844 | Document width 390, modal width 356; client/scroll width 341. |
| Conversion form | 320 × 740 | Document width 320, modal width 286; client/scroll width 271. No horizontal modal overflow. |
| Primary conversion action | 320 × 740 | 44px high, 233px wide. |
| Pipeline after closing dialog | 320 × 740 | Document width 305 with scrollbar; table stays within its scrolling container; focus returns to Kelola. |

Evidence under `artifacts/phase4b`: pipeline desktop, offer desktop, mobile conversion and 320px directory screenshots. Final desktop captures and feedback-focus check use the final production build; mobile captures precede only feedback-focus refinement with unchanged layout. This is bounded Chromium verification, not full cross-browser/device, accessibility or performance certification.
