# Phase 1 — landing v7 and showcase v6

18 October 2026. Implementation scope only: public landing and isolated interactive marketing showcase. Existing Next.js/Prisma/PostgreSQL application preserved. No schema/API/authentication/plan/financial-domain changes, migrations, email, commands, deployments, commits or pushes performed in this phase.

## Implementation

- app/page.tsx renders approved v7 through components/marketing/approved-landing.tsx. Static, trusted build-time markup is stored in lib/marketing/approved-markup.ts; it contains no scripts, data URIs, user input or executable handlers. This is semantic HTML, not a screenshot, iframe or whole embedded standalone document.
- app/marketing.css scopes approved styling and prevents legacy CSS leaking into marketing. app/globals.css and authenticated layouts remain unchanged.
- lib/marketing/showcase-runtime.js adapts the original approved fixture renderer into a lazily imported module, scoped to the marketing root. No eval, API calls, local/session storage, live financial writes or hardware requests. Cleanup removes scroll listeners and restores the root on unmount.
- lib/marketing/accessibility.ts adds keyboard tab navigation and mobile Escape handling without changing appearance.
- All 14 original assets retain their bytes and source display crops/filters/transforms. docs/APPROVED_ASSET_MANIFEST.json records SHA-256. Original embedded icon symbols retained as supplied.
- Prices/room/property/user caps come from lib/plans.ts. Starter/Plus CTAs pass ?plan to existing registration; effective Free and requested upgrade semantics unchanged. Privacy/terms and old demo routes remain available.
- Two small required disclosures distinguish product exploration from customer data and marked CCTV photos from live video. Smart Room footer anchor repaired.

## Reproduce the import

node scripts/import-approved-landing.mjs <absolute-path-to-approved-V3.zip>

The importer validates shared showcase structure, extracts original assets, scopes styles, rejects operational capabilities in fixture JS and writes source provenance. The ZIP/reference HTML is not shipped in public/. Reference HTML stays under ignored artifacts/handoff-v3-reference/. The one-time importer uses existing transitive PostCSS tooling and is not part of application runtime/build.

## Validation

- Production build/typecheck: passed; one source CSS alignment compatibility warning remains non-blocking.
- 12 unit tests: passed (10 existing plus original asset integrity and showcase isolation tests).
- node tests/landing-v7.http.mjs: read-only checks passed for public links, anchors, original asset response bytes, plan-selection registration notices and legacy public routes. No business writes.
- tests/acquisition.integration.mjs: updated only obsolete homepage assertions/asset checks for the approved v7 surface; financial/account journey assertions retained. Database-mutating suites were not executed in Phase 1.
- Browser: 28 role/module menus populated; filters/dialogs/keyboard/CCTV/FAQ/mobile navigation and Starter CTA verified. 320/390/820/1440px no horizontal document overflow. Production console errors: none observed.
- 33 pre-existing backend/domain/schema/migration files match baseline, line-ending-normalized. No database access required for this page.
- Source+implementation visual comparisons and gate: ../design-qa.md. Artifacts: ../artifacts/phase1/.

## Rollback / next gate

Restore app/page.tsx from baseline to reinstate the older landing; new scoped marketing files/assets then become unused. No database rollback is needed. The older page and its CSS/components were not removed from the committed baseline.

Wait for owner approval of Phase 1 visual parity before Phase 2 post-login v5.3. Verification/invitations, Hostinger email and backend security findings remain pending Phase 3; no claim that they were implemented here.
