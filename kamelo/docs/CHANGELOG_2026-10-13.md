# Kamelo update — 13 October 2026

## Changed behavior

Homepage now leads with unpaid bills, repetitive staff follow-up and unnecessary electricity/AC use. Five pain cards connect each problem to impact and an actual or explicitly planned response. Business impact, Kos/hotel selector, four interactive workflows, a deterministic LEO operational preview, Smart Stay, separate CCTV Live View/Video Analytics, configured pricing and two conversion journeys follow. No new logo, invented savings, available Ultimate entitlement or live integration is claimed. Existing official ELENIO assets and licensed photography remain; application screenshots were refreshed.

The same update completes tenant invoice links, private proof upload and explicit payment review; individual tenant billing edits; factual dashboard graphs/up/down/zero-baseline indicators; an old-overdue filter and all-page pending-proof queue; and encrypted date/check-in-based simulated lock access. Core financial behavior and organization/property/staff authorization are preserved. Reconciliation runs on relevant mutations and authorized owner/tenant reads; it is not an unattended live scheduler.

## Files changed/added in this change set

- Public identity/conversion: `app/page.tsx`, `app/layout.tsx`, `app/manifest.ts`, `app/[page]/page.tsx`, `app/globals.css`, `components/brand.tsx`, `components/auth-form.tsx`, `components/onboarding.tsx`, `components/pricing.tsx`, new `components/home-workflows.tsx` and `lib/commercial.ts`.
- Owner UI/insights: `components/portal.tsx`, `components/payment-trend.tsx`, new `components/dashboard-insights.tsx`, `components/billing-tools.tsx`, `components/smart-access-panel.tsx`, `lib/metrics.ts`, `lib/demo.ts`.
- Tenant/server: new `components/tenant-portal.tsx`, `lib/tenant-types.ts`, `lib/tenant.ts`, `lib/proof-files.mjs`, `lib/smart-access.ts`, `lib/secrets.ts`, `app/tenant/[token]/page.tsx`, `app/api/tenant/[token]/route.ts`, `app/api/tenant/[token]/proof/route.ts`, `app/api/proofs/[id]/route.ts`; updated `app/api/manage/route.ts`.
- Persistence/deployment: `prisma/schema.prisma`, new `prisma/migrations/20261013072502_tenant_proofs_smart_access/migration.sql`, `.env.example`, `.gitignore`, `.dockerignore`, `Dockerfile`. Additive migration applied to the existing local database; no reset.
- Verification: new `tests/proof-files.test.mjs`, `tests/tenant-smart.integration.mjs`, `scripts/browser-fixture.mjs`; `package.json` adds `test:tenant`. Existing regression suite rerun. Synthetic fixture bearer links and encryption keys stay in ignored `.local-secrets/`; proof files stay in ignored private `storage/`.
- Screenshots: `public/images/features/dashboard-preview.jpg`, `rooms-preview.jpg`, new `billing-preview.jpg`; QA artifacts in `artifacts/kamelo-*.png` and `tenant-smart-verification.json`. Browser screenshots contain JPEG data; the latest refinement uses matching `.jpg` filenames.
- Documentation: `README.md`, `docs/PRD.md`, `ARCHITECTURE.md`, `DATABASE.md`, `TUYA_INTEGRATION.md`, `BRAND_ASSETS.md`, `IMPLEMENTATION_STATUS.md`, new verbatim `BRANDING_DIRECTION.md`, `OWNER_POSITIONING_DIRECTION.md` and this log. Photography license sources remain in `IMAGE_SOURCES.md`.

## Verification and limits

Production build and TypeScript passed; ten unit tests and 21 integration groups passed against the final local production server. Browser checks passed at desktop and 390 px, including keyboard workflow tabs, LEO draft, actual screenshot loading, tenant pending proof/owner confirmed approval, per-stay billing-day edit, simulated access creation and disable/revocation. No external message, real payment or physical-door command was executed. Formal security/accessibility/load, Docker/hosting and restore drills remain open.

Not implemented: actual AI Agent, tickets/tasks, complete Smart Stay/Wi-Fi/control portal, CCTV/Video Analytics, live Tuya/energy automation, automatic reminders/billing/access worker, reset mail delivery and available Ultimate pricing/entitlements. Hardware/service compatibility, deployment secrets/private storage and legal review remain external launch requirements.
