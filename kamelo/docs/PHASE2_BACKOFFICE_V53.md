# Phase 2 — backoffice v5.3

18 October 2026. Improvement of the existing application, using the approved V3 handoff. This phase connects the approved workspace structure to existing services. It does not implement the remaining V3 backend backlog or authorize a production launch.

## Delivered

- Owner: approved green shell, sidebar/menu order, mobile navigation, original building/lobby/room imagery, priority cards, actual receipt/occupancy/receivable KPIs, six-month payment chart, task queue, property/room and billing workflows. Existing individual due dates, manual reminder tools, proof review and subscription requests remain available.
- Resident directory: searches actual stays in the selected property and opens the existing room/stay record. This is not cross-property Customer 360 or verified resident identity.
- Staff: assigned task queue with real counts; progress/status/history dialog; vacant-room readiness review. Rate changes, payments and tenant identity management are not offered as ordinary staff actions.
- Tenant: approved shell and home structure, private invoice/proof workflow, scoped stay services, Wi-Fi, permitted mock room controls and request history. Invoice and stay links keep their separate existing authorization scopes. A token link is not a verified permanent tenant account.
- Admin: platform-admin server guard, actual organization search/counts and existing manually confirmed subscription activation. Platform billing remains separate from tenant rent.
- Account screens display the actual profile and access context. Profile/contact verification, invitations, workspace membership switching and session management remain disabled pending Phase 3.
- CCTV/AI, contracts/deposits, leads, inbox, visitors/packages, expenses/surplus, announcements and platform support/audit screens explicitly describe missing prerequisites. No fictitious operational events, cameras, contracts, cash surplus or delivery confirmations are persisted.
- LEO uses the existing property-scoped rules endpoint. Generative AI is not connected. Smart Room remains the existing explicitly labelled MOCK provider.

## Files changed

| Files | Purpose |
| --- | --- |
| `app/workspace.css` | Scoped approved v5.3 CSS and compatibility rules for existing forms; no public-landing selector changes. |
| `components/workspace/shell.tsx`, `lib/workspace/navigation.ts` | Owner/Staff/Tenant/Admin navigation, mobile More menu, role labels and account entry. No prototype role picker. |
| `components/workspace/modules.tsx` | Actual resident directory, readonly account profile, rule-based LEO, CCTV readiness and unavailable-service states. |
| `components/workspace/staff.tsx` | Approved staff queue/readiness presentation using existing ticket/readiness writes and dialog focus handling. |
| `components/workspace/resident.tsx` | Approved tenant home structure around the existing separately scoped token portals. |
| `components/workspace/admin.tsx`, `admin-server.tsx` | Verified admin workspace around existing organizations and upgrade services. |
| `components/portal.tsx`, `owner-dashboard.tsx` | Connect existing owner/property/billing/task/device functions to the new shell and data-driven overview. |
| `components/stay-portal.tsx`, `tenant-portal.tsx` | Keep existing token validation, proof uploads, device consent and service writes inside the tenant workspace. |
| `components/team.tsx` | Existing member access assignments remain; hide password-sharing staff creation UI until verified invitations exist. Existing API compatibility is retained. |
| `components/auth-form.tsx` | POST fallback and hydration-ready submit prevent native GET submission of credentials. No auth-provider or password-policy replacement. |
| `app/app/[[...slug]]/page.tsx` | Verified role/page guard; retain direct room/invoice links and explicit legacy staff payment/device grants. |
| `app/admin/page.tsx`, `app/admin/[section]/page.tsx` | Server-controlled admin sections, including gated support/integration/account pages. |
| `app/api/manage/route.ts` | Own profile projection; assigned staff tasks; redact finance/rates/contacts/proofs and devices unless explicitly permitted. Existing owner metrics and financial writes retained. |
| `app/api/proofs/[id]/route.ts`, `app/api/leo/route.ts` | Enforce staff finance permission for private proof files and financial LEO topics. Existing token proof scope retained. |
| `public/brand/kamelo-backoffice.png`, `public/images/backoffice/*`, `lib/workspace/assets.json` | Seven byte-identical supplied logo/photos, recorded in `BACKOFFICE_ASSET_MANIFEST.json`. |
| `tests/workspace.integration.mjs`, `workspace-assets.test.mjs` | Isolated QA fixtures, role/deep-link/grant/redaction tests and approved asset hashes. |
| `tests/integration.mjs`, `tenant-smart.integration.mjs` | Check owner stored rate separately from staff-redacted rate; deny unauthorized staff proof download. |
| `scripts/phase2-qa-db.mjs`, `phase2-qa-preview.mjs`, `.gitignore` | Disposable QA database at 55432 and production preview at 3001; keep database files and encryption key out of Git. |

## Database and compatibility

No Prisma schema or migration file changed. Existing customer/development databases were not migrated, reset or seeded. Six existing migrations were loaded into the separate fresh `kamelo_phase2_qa` database on localhost:55432 only. All test writes are synthetic. The QA-only database and encryption key are ignored by Git. The preview script always points at this QA database and binds localhost.

Existing organization/property boundaries, authentication sessions, pricing, plan capacity, billing dates, payment idempotency, manual proof confirmation, pending upgrade activation, encrypted private data, and unpaid-balance-independent physical access remain authoritative. Prototype localStorage/OTP, fabricated transactions and role switching are not imported.

Staff financial redaction intentionally changes the response for a staff account without payment permission. Staff with explicit legacy payment/device grants retain their scoped API and direct-route access. This is not the new V3 granular membership/permission model; that remains a later backend phase.

## Validation

- Production build and TypeScript check passed.
- 13 unit tests passed, including byte hashes for all seven backoffice assets and 14 public assets.
- Existing integration suites: 15 core + 7 operations + 6 tenant/smart + 5 acquisition groups passed against the production QA preview. Landing read-only route/anchor/asset checks passed.
- Added workspace tests passed: assigned-task projection, staff finance/device/rate redaction, explicit finance/device grants, room/invoice direct-link compatibility, role routes, admin guard, token scope and LEO finance denial.
- Browser coverage and matched source captures are in `artifacts/phase2`; final bounded visual review is recorded in root `design-qa.md`.

## Review / remaining work

Preview: http://127.0.0.1:3001/demo (public readonly owner sample), `/app/dashboard` (QA authenticated workspace), `/admin` (verified QA platform admin). These previews use synthetic records only. Private fixture links/credentials are in ignored `.local-secrets/phase2-browser.json`; never publish that file.

Phase 3 is required for verification, invitations, identity/membership/account mutation and Hostinger transactional email. Later phases implement the contracts/deposit ledger, full Customer 360 and integration backends. No real email/device command, deployment, Git commit or push was performed in Phase 2. Visual differences required by live data and missing services are documented, not masked with prototype values. Existing inner CRUD/token forms retain their backend contracts and receive scoped styling; this phase is not a claim of pixel-identical reproduction of every prototype dialog.

Review working branch: `codex/phase2-approved-backoffice-v53` in `exports/github-publish`. Phase 1 and Phase 2 changes remain uncommitted and unpushed.
