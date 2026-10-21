# Phase 1 — approved landing v7 / showcase v6

Date: 18 October 2026. Baseline: abitiyoso/Kamelo main ada39e35a8b2f05b58f21b7d87480d20bf36cd4a.

## Target and evidence

Target: approved-design/Kamelo_v5_5_Final_Web_v7.html in the supplied final handoff V3. Its #produk section is identical to showcase v6. Original source served privately at localhost:4173/landing-v7.html; application production build at localhost:3000/. No deployment.

Both original source and actual implementation captured through permitted in-app browser, with Owner/Ringkasan, Lobby camera and first FAQ open. Viewports: 1440×1000, 820×1000, 390×844, 320×844. Source left / implementation right in artifacts/phase1/compare-{desktop,tablet,mobile,320}.png. Focused comparisons: compare-top.png, compare-showcase.png, compare-bottom.png, compare-mobile-top.png, compare-mobile-showcase.png, compare-320-top.png. Full views and focused regions were opened and inspected. capture-metrics.json records native bitmap metadata; comparisons use equal proportional widths. Native scrollbars reserve 15px: client widths 1425/805/375/305. No document horizontal overflow at any target.

## Correction loop

P1 — inherited Google Inter from the earlier application changed wrapping/optical weights relative to standalone approved HTML. Scoped marketing uses the source's resolved system fallback face without altering existing authenticated fonts. Rebuilt and recaptured; hero/section/phone wrapping matches the target. The approved source declares Inter but does not load an Inter face itself; using the standalone resolved appearance is intentional.

P1 prevention — legacy global element styles could alter approved cards, controls and headings. Isolated the source under #kamelo-public, reset legacy declarations on that surface, and scoped original styles. Authenticated CSS was not edited.

Added arrow/Home/End keyboard behavior to existing role/module tabs and Escape to the mobile menu; no visual redesign. Native dialog Escape/focus behavior preserved. Normalized align-items:end to flex-end with equivalent rendering; one upstream align-items:start compatibility warning remains non-blocking.

## Five fidelity surfaces

| Surface        | Result                                                                                                                                                                                                                                       |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Typography     | Resolved face, weight, tracking, heading scale and responsive wraps compared against actual source at matched widths.                                                                                                                        |
| Layout/spacing | Same hero, proof strip, property cards/benefits, populated showcase, CCTV, Smart Room, plans, FAQ, final CTA and footer. Additional truthful disclosure lines account for vertical offsets (desktop source 6959px vs implementation 7023px). |
| Colors/tokens  | Source forest/ivory/gold tokens preserved and isolated. Source gradients, icon symbols and control shapes retained rather than approximated.                                                                                                 |
| Images         | All 14 original embedded WebP assets extracted byte-for-byte, including original logo. SHA-256 manifest and served-byte tests pass. Original source crops/transforms preserved.                                                              |
| Copy/content   | Approved source copy retained; real plan values supplied by existing lib/plans.ts. Only required fixture/non-live disclosures and working route/anchor mappings differ.                                                                      |

Source/implementation Smart Room boxes were additionally compared at 820px: picture 357×460, image 357×267.75, overlay 232.046875×188 in both. Full-page capture can change percentage-height rasterization; normal viewport geometry matches the original source and was not redesigned.

## Functional evidence

- Browser checked all 28 modules across Pemilik/Staf/Penghuni: meaningful populated screens.
- Drill-down dialog, Escape, all/action invoice filter, role keyboard movement, CCTV Lobby/Parkir and FAQ toggles passed.
- Mobile role switching, fitted 320px dialog, menu Escape and anchor-close passed.
- Actual Starter CTA leads to /register?plan=starter, showing existing Free entitlement and pending admin activation notice; no signup submitted.
- Final production page initializes showcase after hydration and return navigation. Final production console error list empty.
- 12 unit tests, read-only HTTP route/anchor/plan/asset checks, formatting and production build/typecheck passed.
- 33 existing backend/domain/schema/migration files compared with baseline after normalizing CRLF: no changes.
- Existing database-mutating suites not rerun in Phase 1; no production-readiness or backend-security-fix claim.

Browser details: artifacts/phase1/browser-checks.json. Implementation notes: docs/PHASE1_APPROVED_PUBLIC_V7.md.

## Accepted differences / remaining limits

Two visible captions identify public fixture data and non-live CCTV, as required by master V3. Local login/register routes replace prototype production URLs; plan buttons retain selected plan. Smart Room footer anchor now targets the actual section. Screenshot focus rings/dev overlays are capture states, not design replacements. No new images, logos, layouts, copy campaign or authenticated UI were invented. No P0/P1/P2 mismatch remains observed in the compared states. Full WCAG/browser-matrix/performance certification is outside this gate.

Phase 2 requires owner sign-off on this visual parity before proceeding.

final result: passed
