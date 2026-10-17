# Landing refinement — verified 13 October 2026

The [latest user direction](LANDING_REFINEMENT_DIRECTION.md) governs this targeted continuation of the existing application. The original ELENIO logo, photos, mascot assets, stack, authentication, APIs, data schema and working `/demo` remain intact. No image was generated or replaced.

## Completed

- Seven-part story: hero/trial; three owner pains; workflows and owner/tenant paths; LEO; Smart Stay/Room; existing pricing; FAQ and closing CTA. Removed repeated impact/differentiation/expansion sections.
- Approved shorter hero copy and two CTA priorities. Its readable live panel replaces the miniature dashboard screenshot as the primary product proof. Existing photography is a supporting, explicitly illustrative crop; navy/blue and translucent layered panels follow the supplied Social & Identity and Visual Language references.
- Complete reminder trial from existing demo invoices: choose one of three occupants → correct balance/due date → prepare message → copy with feedback/manual fallback → reset. Local state only; no sender, financial update, storage or backend request. Keyboard preparation focuses the message and reset focuses the first occupant.
- `/demo/owner` reuses the same trial. `?property=hotel` retains the hotel fixture. Original `/demo?tab=...&property=hotel` read-only PMS remains available, with CTA wording “Lihat contoh”. Check-in/out workflows select the appropriate hotel context.
- `/demo/tenant` reuses `TenantPortal` with fixture-only local mode, never a bearer token. Optional `property=hotel` and `embedded=1` support the relevant example and readable phone frame. Demo proof submission validates the selected file then retains only local metadata/PENDING state; it never uploads bytes, records a payment or creates a proof-download API link. Reload clears the local proof. The real token-based portal keeps its existing default behavior.
- Mobile Menu → Solusi / Demo / Harga, close-on-navigation, Escape and visible focus. Owner login is explicitly labeled. Residents receive a link from their manager rather than a new registration flow.
- LEO keeps five questions and shows summary, related data, next action and a relevant CTA. Its rule-based preview status is short and visible; actual AI execution is not claimed.
- Smart Stay uses the actual tenant component in a phone frame and a five-step journey. Current billing, simulated access, planned Wi-Fi/control/automation, and optional future CCTV/analytics are distinguished. No real-device control was added.

## Application files changed

Existing: `app/page.tsx`, `app/globals.css`, `components/brand.tsx`, `components/home-workflows.tsx`, `components/tenant-portal.tsx`.

Added: `components/reminder-demo.tsx`, `components/mobile-public-menu.tsx`, `lib/demo-tenant.ts`, `app/demo/owner/page.tsx`, `app/demo/tenant/page.tsx`.

Documentation: README, PRD, IMPLEMENTATION_STATUS, the verbatim latest direction, this report and the verification artifact. Product image assets, API routes, database schema/migrations, entitlements and subscription prices were not changed.

## Validation

- Final production build and TypeScript passed. All ten existing unit tests passed. Prettier passed across app/components/lib/tests/scripts/package.json. There is no standalone ESLint configuration; no separate ESLint result is claimed.
- Desktop at 1280 × 900 and mobile at 390 × 844 checked. Settled mobile default height: **9,475 px**, versus directly measured previous **15,932 px**, a **40.5% reduction**. No horizontal overflow or broken product image was observed. Height can vary with fonts, open disclosures and selected/expanded demo state.
- All four workflow tabs and both property choices checked; keyboard arrow selection and hotel context work. All five LEO answers and relevant link destinations checked. All five FAQ disclosures open/close. Mobile menu navigation, Escape, visible outline and anchors below the header checked.
- Reminder trial checked for Dewi, Rizky and Nadia, contextual amounts/dates, keyboard prepare/copy, actual copy/paste of the generated message into a local form, success feedback and reset. Both Kos and hotel standalone examples checked.
- Public tenant example checked, including correct hotel property/balance, local pending proof, unchanged balance, no proof API link, and reset on reload. Login/register forms and original PMS deep links were inspected without submitting registration or sending external messages.
- Reduced-motion CSS rules were inspected; no operating-system motion setting was changed or emulated. Formal WCAG/cross-browser/performance certification remains outside these checks.
- Fresh production browser console: zero errors/warnings observed. Database row counts before/after trials were identical: invoices 467, payments 37, proofs 19, tenant links 28, devices 24, audits 493. This was a read-only count comparison; no customer record was opened.
- Official logo SHA256 still matches its supplied original: `00E7CB514B48A4E5E52DB62552397263B6AEF2B914595AFC714EA13711ECB254`.

The previous functional release's 15 regression plus six tenant/smart integration groups remain baseline evidence; they were not rerun to mutate additional fixture data during this local-only landing revision.

## Screenshots

- `artifacts/landing-refined-desktop.jpg`
- `artifacts/landing-refined-mobile.jpg`
- `artifacts/reminder-demo-copied.jpg`
- `artifacts/stay-preview-refined.jpg`

## Remaining limits

Actual AI Agent, staff tickets/assignment, full Stay/Wi-Fi/guest controls, CCTV/Video Analytics and real Tuya/energy automation remain unavailable. The original PMS demo remains read-only; the new reminder trial and public tenant example provide safe local interaction. Clipboard access requires browser permission, with manual selection/copy fallback. Authentic Indonesian property/installation photos, live services, hosting and production acceptance remain separate dependencies.
