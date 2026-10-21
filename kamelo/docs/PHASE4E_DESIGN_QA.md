# Phase 4E bounded browser QA

19 October 2026. Local production preview `http://127.0.0.1:3001`, synthetic QA accounts and tickets only. Existing approved v5.3 green owner/admin shell, navigation, logo and typography reused. Public v7/v6 source/assets unchanged.

Observed journey: existing owner signs in → Akun & Pengaturan → Bantuan pelanggan → creates a reviewed ticket → detail/history and success feedback appear. Existing authorized platform administrator signs in → chooses Platform ELENIO workspace → searches the new ticket → claims responsibility → replies. Owner signs in again and reads that exact reply in the same shared ticket. Browser actions created only synthetic support records and switched existing authorized contexts; they did not grant new access or contact external people.

The integration page shows six truthful readiness states plus aggregate email queue and a restricted support/subscription audit projection. The audit domain selector reloads the selected scope. No provider check/send/retry controls are presented.

| Surface | Viewport | Observed result |
|---|---|---|
| Owner ticket detail / admin reply | 1440 × 900 | Bounded dialog, readable consent/status/history, existing shell preserved. |
| Owner ticket dialog | 390 × 844 | Document width 390; dialog width 356; client/scroll width 341. |
| Owner ticket dialog | 320 × 740 | Document width 320; dialog width 286; client/scroll width 271. Vertical content reachable; no horizontal dialog overflow. |
| Escape from newly created ticket | 320 × 740 | Focus returned to Buat tiket bantuan; document width 305 with scrollbar. |
| Integration readiness | 320 × 740 | Document width 305 with scrollbar, cards wrap within page, existing mobile navigation retained. |
| Final dialog actions | 320 × 740 | Scoped button sizing corrected to override existing `.btn.small` minimum; final close button measured 48px, above the 44px minimum. |

Browser QA caught the 44px rule losing to the existing `.btn.small` selector. The scoped rule now includes `.btn`, preserving the visual system while enforcing the touch target. Final build and targeted browser measurements verify the CSS-only change; full API regression passed before this final styling refinement.

Evidence in `artifacts/phase4e`: owner-ticket-desktop.png, owner-ticket-mobile390.png, owner-ticket-mobile320.png, admin-ticket-reply-desktop.png, integrations-desktop.png, integrations-mobile320.png, owner-admin-reply-final.png and owner-admin-reply-mobile-final.png. Early owner/dialog captures precede the final button-size refinement; final reply captures follow it. Temporary viewport override reset and the owner reply preview retained.

Backend financial/permission/concurrency tests are covered by 84 isolated API groups and 27 unit tests. This is bounded Chromium interaction/layout QA, not exhaustive WCAG, physical-device, screen-reader, performance or production certification. Exact screenshots are synthetic; no real customer case or credentials are included.
