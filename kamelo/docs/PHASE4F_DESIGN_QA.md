# Phase 4F bounded browser QA

19 October 2026. Local production preview `http://127.0.0.1:3001`, synthetic verified accounts only. Approved v5.3 owner, staff and resident shells/navigation retain their existing green identity and assets.

Observed journey: owner opens Kotak Masuk, opens the active room 02 conversation and submits a reviewed message. Assigned staff signs in, opens Pesan, reads that exact message and replies. Verified resident chooses the existing room 02 stay workspace, opens Pesan, sees only its own conversation, reads the staff reply and submits a response. The recipient/staff login uses existing synthetic credentials and existing authorized contexts; browser actions grant no new permission and contact no external person.

| Surface | Viewport | Observed result |
|---|---|---|
| Owner and staff conversation | Desktop | Actual shared content, staff assignment, status and escaped history in bounded approved-style dialog. |
| Owner conversation | 320 × 740 | Document width 320; dialog width 286, client/scroll width 271; close action 48px. No horizontal overflow. |
| Owner after Escape | 320 × 740 | Focus returns to Buka percakapan; document width 305 with scrollbar. |
| Resident conversation | 390 × 844 | Document width 390; dialog width 356, client/scroll width 341. No horizontal overflow. |
| Resident inbox | Desktop | Only room 02 resident conversation is shown; no owner routing controls. |
| Ended-stay inbox | Final build | Tulis pesan is disabled; existing authorized conversation history remains accessible. |

Evidence under `artifacts/phase4f`: messages-owner-desktop.png, messages-owner-mobile320.png, messages-staff-desktop.png, messages-tenant-desktop.png, messages-tenant-mobile390.png, messages-checkout-disabled.png and messages-final-owner.png. Final build changes only inactive tenant compose availability and empty-recipient guidance; the existing conversation layout is retained. Final browser checks confirm disabled checkout composition and the owner's ability to read the resident's reply. Temporary viewport override reset and the owner messaging preview retained.

No live notification delivery, real external messaging, device action or funds transfer was exercised. Backend isolation/revocation/concurrency and checkout tests are in the 92-group API regression. This is bounded Chromium QA, not exhaustive WCAG, physical-device, screen-reader, realtime or performance certification.
