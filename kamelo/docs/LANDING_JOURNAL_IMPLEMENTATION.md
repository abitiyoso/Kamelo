# Complete landing page — selected concept 2

17 October 2026. The user selected the second image from the latest full-page ideation set and requested coding, integration and end-to-end functional testing. Exact source: `exec-d92c1b3a-585b-40ed-8b80-cb760687b18c.png` (725 × 2170 pixels), not the earlier partial homepage option. The existing Next.js/React/PostgreSQL application is retained.

## Implementation

- One cohesive homepage from full courtyard-photo hero through owner pains, Kos/Hotel types, optional Smart, three onboarding steps, plans/recommendation, FAQ, final owner photo and navy footer.
- Six custom photoreal assets created with built-in ImageGen using the exact selected concept; inspected, optimized and placed in the project. No screenshot was used as an image of the complete functional webpage. Photos and avatar are fictional AI illustrations.
- Existing original ELENIO logo kept byte-identical. Official `Logo Color White.png` copied from the user's logo directory to `public/brand/elenio-logo-color-white.png` for the navy footer, without recoloring.
- Responsive CSS uses a shared content grid, solid text surfaces, tablet/mobile stacking and visible focus states. Rendered desktop/mobile behavior was reviewed and passed within the scope documented in design-qa.md.
- Header, footer, property demo links, Smart consultation, registration, plan selection and legal links point to existing destinations. New task deep-link handling maps `?tab=tasks` to the existing room-operations view.
- Reminder prepare/copy/reset use the existing component, with a compact homepage variant and proper focus return after reset. Clipboard denial retains the existing selectable-text fallback. The wider `/demo/owner` remains available for tenant selection.
- Local task demo checkboxes update their progress count; their simulation-only status is visible. They never create operational records.
- Recommendation sidebar uses shared Free/Starter/Plus configuration. Default 20 rooms recommends Starter; expandable controls account for properties, users and recurring billing. Invalid inputs display an error; requirements above Plus lead to consultation.
- Actual prices remain Rp0 / Rp49.000 / Rp99.000 per month. New accounts start Free; paid selection creates an audited REQUESTED upgrade and onboarding notice until admin activation. No automatic payment or privilege grant.
- Smart status remains truthful: hardware/Tuya, CCTV/analytics, generative AI and automatic WhatsApp are not connected. Core browser workflows do not require hardware. Installation and services are separate; Ultimate is unavailable.

## Asset catalog and intended slots

Files are in `public/images/homepage/`. Slots are implementation targets, not browser measurements.

| Asset                        | Native WebP | Bytes  | Intended consumer                                               |
| ---------------------------- | ----------- | ------ | --------------------------------------------------------------- |
| journal-hero-v1.webp         | 1774 × 887  | 221404 | Full-width courtyard hero, ~680px desktop height, subject right |
| journal-room-v1.webp         | 1717 × 916  | 155690 | Room-condition example and Kos card, wide crops                 |
| journal-reception-v1.webp    | 1500 × 800  | 130854 | Guest-house reception card, ~2.3:1 desktop crop                 |
| journal-lock-v1.webp         | 1145 × 1374 | 95388  | Smart stripe portrait crop, lock at center-right                |
| journal-owner-coffee-v1.webp | 1717 × 916  | 155618 | Closing owner photo, wide right-aligned crop                    |
| journal-tenant-v1.webp       | 256 × 256   | 6380   | 40px fictional tenant avatar                                    |

PNG originals are retained. Total new WebP assets: 765334 bytes before Next image optimization. Asset prompts preserve warm Indonesian hospitality, white/wood/greenery and natural human moments; all exclude UI, text, logos and gradients from the generated photography. The logo assets are supplied originals rather than generated replacements.

## Validation

Production build/type checking, formatting and 10 unit tests passed. Against the production preview and local database, 15 Core regression groups, 6 tenant/smart groups, 7 operations groups and 5 acquisition groups passed (33 HTTP/API groups).

The new acquisition journey starts from a registered landing-page account, creates a property and rooms, adds two occupants with independent billing days and invoice due dates, generates a private tenant invoice link, uploads a synthetic payment proof, verifies upload does not pay the invoice, requires explicit received-funds confirmation, approves exactly once, then creates/completes a ticket and checks logout/login persistence. Selected-plan pending activation, invalid plans, duplicate rollback, every homepage link/anchor and all six new image URLs are also checked.

Two initial test-fixture errors were corrected: a missing payment method and assuming ticket creation returned a ticket ID rather than reloading the actual API state. No product validation was weakened to pass tests. Fixtures use `example.test` accounts and synthetic documents. No real messages, transfers or hardware commands are sent.

Reproduce after starting the local production runner, with `DATABASE_URL` exported:

```powershell
node --test tests/*.test.mjs
node tests/integration.mjs
node tests/tenant-smart.integration.mjs
node tests/operations.integration.mjs
node tests/acquisition.integration.mjs
```

Run suites sequentially: acquisition rollback checks count organizations/upgrades and must not overlap other database-mutating suites.

## Review completed — 17 October 2026

Permitted in-app browser access succeeded. The task-row layout leak, hero photo stacking, mobile specificity and lower-page spacing were corrected and recaptured. Final desktop document height is 4455px at 1440px viewport, compared with 5177px before correction. The source and implementation were reviewed side by side, including focused pain/pricing regions and mobile/footer. Root design-qa.md records final result: passed for this landing scope.

Actual browser checks covered reminder prepare/copy/reset, task count, plan recommendation states, FAQ/mobile menu and synthetic Starter registration through pending activation and three-room onboarding. No horizontal overflow at 320/390/780px; final production console had no errors. Build/typecheck, formatting, ten unit tests and five acquisition groups passed again. The earlier 28 other API groups were not rerun for this CSS review. See LANDING_BROWSER_QA.md for remaining unexecuted browser cases.

The production preview is running locally. Real external integrations remain unconfigured. This work does not deploy the site or refresh the older 13 October ZIP.
