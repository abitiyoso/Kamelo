# Phase 4I browser QA

19 October 2026, production preview `http://127.0.0.1:3001/app/rooms`, synthetic disposable QA accounts only.

Existing approved owner shell, green palette, typography, logo, navigation, room cards and public pages were retained. The new collapsed resident import panel uses Phase 4H's scoped controls, table scrolling, confirmations and history styles.

Verified:

- Synthetic owner signs in and opens Properti & Kamar → Impor penghuni dari CSV.
- Actual file chooser upload loads seven-column CSV containing a new profile for room12 and a prior profile for room13, with due days12 and25. Browser file chooser operation was unusually slow but completed successfully; no real personal file was uploaded.
- First preview blocks save until the existing profile is explicitly selected. Choosing the masked prior profile and previewing again yields two valid rows. The source person's stored identity is retained by the API's canonical reuse path.
- Preview displays billing automation off and no automated locks for those two rooms. Owner confirmation is required. Browser commit returns **2 masa tinggal berhasil diimpor** and adds the batch to history.
- After the chat/browser session was interrupted, the QA server and original synthetic owner context were restored without changing business data. The final saved screenshot shows the persisted two-stay batch in history after restart. The preview screenshot retains the earlier explicit profile selection; no second import was needed for recovery.
- Desktop1440×1000; mobile390×844 and320×720. Document widths375 and305 respectively, with no horizontal page overflow. Resident table content701px scrolls within containers311px and241px. Mapping stacks on mobile; confirmation wraps in a row. Table has a labeled keyboard-focusable scroll region.
- API tests verify rollback, including preservation of an existing profile and rejection when downstream records exist. Browser rollback and browser template download were not executed in this increment; template is checked over real HTTP by the integration suite.

Evidence in `artifacts/phase4i/`:

- `resident-desktop-preview.png`
- `resident-desktop-saved.png`
- `resident-mobile-390.png`
- `resident-mobile-320.png`

This is bounded functional/responsive QA, not a complete assistive-technology audit or production approval. Existing byte-level approved asset tests pass; no new whole-page landing/showcase recapture was required.
