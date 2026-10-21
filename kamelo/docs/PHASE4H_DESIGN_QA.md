# Phase 4H browser QA

19 October 2026. Production build preview at `http://127.0.0.1:3001/app/rooms`, using synthetic disposable QA data only.

The existing v5.3 owner shell, navigation, typography, logo, green palette and room cards are preserved. A collapsed import panel is added within Properti & Kamar. No public landing/showcase redesign.

Verified in the in-app browser:

- Existing synthetic owner signs in and opens the new import panel.
- Pasted `harga,nama_kamar` CSV maps number to second column/rate to first. Preview displays both correct IDR amounts; save is disabled until confirmation. Commit reports two rooms imported and updates the room count/cards.
- Repeating preview for committed numbers shows collisions and disables confirmation/save.
- The initial data-URI download check stalled. It was replaced with a static CSV template. Final link download returned a local file whose content starts with `nomor,tarif`; HTTP/API test also validates the actual template. File chooser upload of the template populated CSV content; preview and confirmed commit then succeeded.
- Preview at 390×844: viewport390/document375; table container311 with480 scroll content. At320×720: viewport320/document305; container241 with480 scroll content. No document-wide horizontal overflow; the table scrolls within its labeled keyboard-focusable region. Mapping stacks vertically. Checkbox and label remain on the same flex row and wrap naturally.
- Feedback has polite live status and receives focus after requests; inputs/buttons disable during writes. Browser captured zero console errors at the final successful commit.
- Desktop1440×1000 final preview and successful commit screenshots saved. Viewport override reset and result tab retained.

Evidence:

- `artifacts/phase4h/import-desktop-preview.png`
- `artifacts/phase4h/import-desktop-saved.png`
- `artifacts/phase4h/import-mobile-390.png`
- `artifacts/phase4h/import-mobile-320.png`

Rollback was verified through the real API and database assertions, including dependent-stay and edited-room rejection. It was not executed through the browser. This is bounded functional/responsive QA, not a complete assistive-technology audit or production sign-off. Other locked pages are covered by the existing approved-asset byte regression checks, not new full-page visual recaptures.
