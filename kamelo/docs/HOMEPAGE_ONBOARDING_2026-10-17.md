# Homepage and customer onboarding — 17 October 2026

User selected the second **homepage** concept, the warm photographic owner/reception direction. Earlier dashboard concepts are not the target. This implementation changes the existing homepage and acquisition flow; it does not redesign the owner dashboard or replace the application stack.

## Visible implementation

- Human photoreal hero with original ELENIO attribution, owner/staff task cue explicitly labelled as a sample, and working links to existing demo/registration routes.
- Editorial benefits and courtyard photo, followed by the existing complete reminder prepare/copy/reset simulation in a navy section.
- Interactive Kos vs Guest House/Hotel explanation, existing owner and tenant demo paths, and a three-step onboarding guide with the information users need to prepare.
- Available Core/guest services versus simulated/unconnected Smart, Tuya, CCTV, AI and automatic WhatsApp information. No invented testimonials, customer counts, savings or active live integrations.
- Existing Free/Starter/Plus prices and limits, plus a client-side plan finder using the same `lib/plans.ts` configuration. It accounts for total rooms, properties, owner/staff users and recurring-billing needs. Over-Plus requirements route to discussion without promising entitlement.
- Ten customer FAQs covering preparation, activation, individual due dates, manual sending/proof verification, tenant access, staff permissions, optional devices, migration and production readiness.

## Connected acquisition behavior

### Lower-homepage revision from user screenshot

The user approved the upper page and reported broken design below it. Their screenshot confirmed white-on-white reminder text, an overly heavy frame, and an unbalanced property-fit heading. The reusable white reminder panel now declares its own navy text and light color scheme; white text is scoped to the navy copy area. Its border is 1px on desktop and mobile. Lower headings now share a compact title/introduction grid, property-specific features have a unified light surface, onboarding has clearly ordered steps, and Core/Smart information is grouped in two panels. Homepage Smart pricing uses native expandable details so complete cost/readiness information remains available without another long initial block. Tablet layouts stack pricing and onboarding; mobile helper copy and controls were made more readable. The approved hero, benefits, photo assets and original logo were preserved. No prices, limits, entitlements, reminders or integration behavior changed.

Evidence: `artifacts/homepage-lower-before-2026-10-17.png`. Post-fix browser capture remains unavailable; see `design-qa.md`. Build/API checks do not close this visual gate.

Previously, `/register?plan=starter` and `/register?plan=plus` did not retain the plan choice. Now the registration page presents the selected package and explains the pending-activation process. Registration validates the optional plan against Free/Starter/Plus and creates a REQUESTED upgrade and audit in the same transaction as the new account. The organization remains on Free until an authorized admin activates an upgrade. Onboarding reads the actual pending request from the database and displays the effective limits. No payment is initiated.

Invalid plans are rejected; duplicate-account failures roll back the provisional organization and upgrade atomically. No schema migration or plan-price/limit change was needed.

## Assets

- `public/images/homepage/owner-reception-v2.webp`: 1448 × 1086; 135,854 bytes.
- `public/images/homepage/courtyard-v2.webp`: 1659 × 948; 399,164 bytes.
- Generated specifically from the selected visual reference using built-in Image Gen. WebP encoding only; PNG originals retained. Captions state AI illustration and do not imply customers or verified properties.
- Existing ELENIO logo checksum unchanged: `00E7CB514B48A4E5E52DB62552397263B6AEF2B914595AFC714EA13711ECB254`.

## Validation and limits

Production build, TypeScript, formatting and ten unit tests passed. The existing 28 integration groups passed; three new acquisition groups passed for homepage/routes/anchors/assets/content, request-to-registration/onboarding entitlements, and invalid/duplicate rollback behavior. Test records are synthetic, retained for inspection, and no messages or financial transactions were sent.

**Visual verification is blocked**, not passed: browser policy denied access to the localhost homepage. The source image and assets were inspected, but there is no fresh implementation screenshot or source/implementation comparison. Interactive client states, responsive layout and browser console still require permitted browser testing. See project-root `design-qa.md`. Do not interpret HTTP/build success as visual approval.

The application remains a local development preview. Public hosting, backups, email delivery, commercial policies and external integrations require additional setup before production onboarding. The homepage explains this rather than implying a hosted commercial service is already running.
