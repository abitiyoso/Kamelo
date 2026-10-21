# Kamelo landing — concept 2 visual review

Date: 17 October 2026. Route: http://127.0.0.1:3000/.

## Target and fresh evidence

Exact selected reference: C:/Users/Abi Tiyoso/.codex/generated_images/01a133a4-4ea4-74e1-8c19-4a7241c7d52a/exec-d92c1b3a-585b-40ed-8b80-cb760687b18c.png (725 × 2170). This is the second displayed result of the latest complete landing concepts. Its proportional height at 1440px is about 4310px.

Permitted in-app browser access succeeded during this review. Earlier blocked status is superseded. Production desktop viewport: 1440 × 1000; document client/scroll width 1425/1425, height 4455px. Mobile viewport: 390 × 844; client/scroll width 375/375, measured height 8899px. Browser screenshots hide the native scrollbar and can reflow the capture by 15px; comparisons normalize both images proportionally to 720px wide. Captures use logged-out initial state, default reminder, one completed sample task, 20 rooms/one property/one user/recurring off and collapsed FAQs. All photos decoded before capture.

- Before: artifacts/journal-review-before-desktop.jpg; artifacts/journal-comparison-before.png.
- Final: artifacts/journal-review-final-desktop.jpg; artifacts/journal-review-final-mobile.jpg.
- Source left / implementation right: artifacts/journal-comparison-final.png.
- Focused comparisons: artifacts/journal-compare-hero.png, journal-compare-pains.png, journal-compare-pricing.png.
- Mobile inspection: artifacts/journal-mobile-top.png, journal-mobile-middle.png, journal-mobile-bottom.png, journal-mobile-footer.png.

The full comparison and focused desktop/mobile regions were opened and visually inspected, including the footer. The mobile reference is a responsive interpretation of the selected desktop composition; no separate mobile mockup was supplied.

## Findings and correction loop

| Priority | Observed problem | Correction and verification |
| --- | --- | --- |
| P1 | Global label column layout made task rows excessively tall. | Scoped row direction, checkbox size and stable accessible names; three compact separate rows now align with the invoice/photo. Completion toggle verified. |
| P1 | Production desktop hero photo hidden behind its background. | Replaced negative image stacking with explicit image/content/caption layers. Rebuilt and recaptured: photo visible at desktop and mobile. |
| P2 | Invoice duplicate header/date and spacious lower page diverged from reference. | Compact avatar/date header, single balance, tighter section headings, onboarding, pricing and footer. Whole-page height reduced from 5177 to 4455px. |
| P2 | Hero specificity prevented narrow-screen layout overrides. | Separated container sizing from layout rules; mobile copy/photo stack and readable face crop verified. |

No unresolved P0/P1/P2 issue was observed within this route/state and tested sizes.

## Five fidelity surfaces

| Surface | Final visual assessment |
| --- | --- |
| Fonts and typography | Plus Jakarta Sans display / Inter body; strong navy/blue hierarchy, reference-like hero wraps and readable section titles. Small optical differences remain; no clipped headings observed. |
| Spacing and layout | Same hero, three pains, two property photos, navy Smart stripe, three onboarding steps, three plans plus finder, FAQ, photo closing and navy footer. Compact task/invoice rhythm restored. |
| Colors and tokens | ELENIO blue, navy, ice blue and white surfaces retained; white invoice text contrast fixed and readable; supplied official logo variants preserved. |
| Images | Six optimized individual photo assets, natural hospitality direction and working crops. AI illustration captions remain visible. These are generated equivalents, with some subject/crop differences from the concept. |
| Copy and content | Real prices/limits, tenant dates, manual reminder/proof semantics, activation and hardware availability retained. Additional disclosure/advanced controls deliberately make the page longer than the conceptual image. |

Remaining P3 differences: solid white navigation rather than the concept's photo-backed navigation; native accessible checkboxes rather than decorative circles; generated photo variations; truthful feature/activation disclosures and secondary FAQ. These do not prevent the selected visual hierarchy or primary flows.

## Verification

- Latest production build and type checking passed after the final stacking correction.
- Formatting check and ten unit tests passed.
- Five acquisition HTTP/API groups rerun successfully this review. Earlier 28 Core/tenant/smart/operations groups remain historical evidence; they were not rerun for CSS changes.
- Actual browser: reminder prepare/copy/reset and returned focus; sample task count; Free/Starter/Plus/consultation/invalid plan finder; FAQ; mobile menu; Starter registration to pending activation, property setup and three visible rooms; logout. Details: artifacts/journal-browser-checks.json and docs/LANDING_BROWSER_QA.md.
- No horizontal document overflow at 320, 390 or 780px. Menu present at tablet breakpoint. Final production console error list empty.
- Clipboard permission-denial fallback, every keyboard path, full cross-browser/accessibility coverage and complete payment flow through browser clicks were not tested in this review. HTTP/API payment/proof/task journey passed. No external messages, transfers or hardware commands were sent.

final result: passed
