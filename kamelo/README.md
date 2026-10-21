**20 Oct 2026 — Stage 6 local release validation verified; production remains pending.** UTF-8 recovery preserved every public table/schema hash and 22 migration records; 645 private files copied, 54 encrypted financial snapshots recovered, with old synthetic proof fixtures separately accounted for. Six recovered-app security/load groups, all 25 existing API suites, 63 unit tests and typecheck pass. Bounded read load: 150 requests / five concurrent readers / zero errors / p95 146 ms; no production capacity claim. Recovered owner dashboard/receipt archive and 320/390 px browser checks pass. No runtime UI/schema change, main DB migration, live send, commit, push or deployment. See [release report](docs/RELEASE_STAGE6.md), [browser evidence](docs/RELEASE_STAGE6_BROWSER_QA.md) and [remaining gates](docs/REMAINING_DELIVERY_STAGES.md).

**20 Oct 2026 — Stage 5 local readiness verified; live acceptance remains pending.** Shared worker transport now validates origin/secret, rejects redirects and malformed responses, cancels requests on shutdown and bounds reminder cursors. A secret-safe offline preflight and platform-only prerequisite panel distinguish configuration from verified service. Optional Docker worker packaging/template prepared; Docker runtime not tested here. Build/typecheck, 63 unit tests and 25 isolated API suites pass. No schema migration, external provider call/send, main database change, commit, push or deploy. Real service resources/adapters and final release acceptance remain open. See [stage 5 report](docs/INTEGRATION_STAGE5.md), [browser QA](docs/INTEGRATION_STAGE5_DESIGN_QA.md) and [acceptance template](docs/INTEGRATION_LIVE_ACCEPTANCE.md).

**20 Oct 2026 — Remaining stage 4 complete locally: opening refunds, receipt issuance and retained financial archives.** Source-bound refunds/corrections and bank matching preserve cash/debt history. Owners issue immutable encrypted invoice/opening receipts; tenants view/download only currently authorized documents. KEEP/HOLD/review records are versioned without automatic deletion. Build/typecheck, 51 unit tests and 24 integration suites pass, including 11 new finance groups. QA migration preserved every original column value in 58 old tables. No real transfer/email, main database migration, commit, push or deploy. Two stages remain: real configured integration acceptance and final release acceptance; destructive retention policy remains a business/legal release dependency. See [finance report](docs/FINANCE_STAGE4.md), [browser QA](docs/FINANCE_STAGE4_DESIGN_QA.md) and [progress](docs/REMAINING_DELIVERY_STAGES.md).

**20 Oct 2026 — Remaining stage 3 complete locally: scheduled billing reminders.** Owner opt-in Jakarta schedules publish private invoice/opening reminders and optionally queue generic emails. Fresh access/share/balance/proof/policy checks, cooldown/dedupe, immutable history and dispatch cancellation are enforced. Build/typecheck, 49 unit tests and 23 integration suites pass, including 17 reminder groups. QA-only additive migration preserved all 56 pre-existing table hashes. No live SMTP, main database migration, commit, push or deployment. Three stages remain; finance completion is next. See [stage 3 report](docs/REMINDER_STAGE3.md), [browser QA](docs/REMINDER_STAGE3_DESIGN_QA.md), and [progress](docs/REMAINING_DELIVERY_STAGES.md).

**20 Oct 2026 — Remaining stage 2 complete locally: combined dashboard and resident home.** Owner KPIs/source drilldown combine invoice and opening debt; finance/report/dashboard share canonical daily cash queries. Current-month comparison, negative-capable six-month chart, actual surplus and combined proof priority are connected. Tenant home sums own invoices and explicitly shared opening debt beyond list pagination. Build/typecheck, 47 unit tests and 207 API groups across 22 suites pass; owner/tenant desktop and 320/390 px checked. No schema migration. See [stage 2 report](docs/DASHBOARD_STAGE2.md), [browser QA](docs/DASHBOARD_STAGE2_DESIGN_QA.md) and [delivery progress](docs/REMAINING_DELIVERY_STAGES.md). Four large stages remain; automated reminders/notifications are next.

**20 Oct 2026 — Remaining stage 1 complete locally: unified owner proof queue.** Invoice/opening files share scoped filters, counts, private details and confirmed canonical review while ledgers remain separate. Exact retries, stale-balance checks and existing-receipt linking prevent duplicate cash. Build/typecheck, 44 unit tests and 195 API scenario groups across 21 suites pass. No schema migration; all twenty prior migration hashes retained. See [queue report](docs/PHASE4O_UNIFIED_PROOF_QUEUE.md), [browser QA](docs/PHASE4O_DESIGN_QA.md) and [six-stage progress](docs/REMAINING_DELIVERY_STAGES.md). Five large stages remain; dashboard consolidation is next.

**20 Oct 2026 — Phase 4N portal reminders:** owners can preview and explicitly publish a historical balance reminder to the exact shared tenant account. Due/open/positive balances only, pending-proof suppression, 24-hour cooldown, immutable snapshots and independent tenant history pagination are enforced. No cash changes or external delivery. Build/typecheck, 44 unit tests and 182 API groups across 20 suites pass; old row hashes preserved in 41 QA tables. Owner/tenant browser flow and mobile layouts verified. See [Phase 4N report](docs/PHASE4N_PORTAL_REMINDERS.md) and [browser QA](docs/PHASE4N_DESIGN_QA.md). Automated/external reminders, unified queue/insights and production acceptance remain pending.

**20 Oct 2026 — Phase 4M tenant opening proofs:** explicit account/stay/grant sharing, private resident proof upload, owner rejection/approval and exact existing-receipt linking are implemented. Pending evidence changes neither cash nor debt. Build/typecheck, 44 unit tests and 170 API groups across 19 suites pass; additive migration preserved old values in 39 QA tables. Browser approval and 320/390 px resident layouts verified. See [Phase 4M report](docs/PHASE4M_TENANT_OPENING_PROOFS.md) and [browser QA](docs/PHASE4M_DESIGN_QA.md). Opening reminders, unified insights/queue and production/provider acceptance remain pending.

**19 Oct 2026 — Phase 4L opening collections:** owners can record partial/full receipts, correct mistaken entries with retained history, and reconcile them manually. Net receipts enter finance cash/chart/movement reports once without creating invoices. Build/typecheck, 44 unit tests and 157 API groups across 18 suites pass; migration preserved old values in 38 QA tables. See [Phase 4L report](docs/PHASE4L_OPENING_RECEIPTS.md) and [browser QA](docs/PHASE4L_DESIGN_QA.md). Opening-ledger tenant visibility, reminders/proofs, refunds, dashboard consolidation and production acceptance remain pending.

**19 Oct 2026 — Phase 4K opening receivables:** owner-only CSV/XLSX register now records historical debt with explicit profile/source review, separate totals and retained whole-batch void history. Build/typecheck, 44 unit tests and 146 isolated API scenario groups pass. QA migration preserved hashes across 36 old business tables. See [Phase 4K report](docs/PHASE4K_OPENING_RECEIVABLES.md) and [browser QA](docs/PHASE4K_DESIGN_QA.md). Collection/settlement, tenant visibility, broader opening accounts and production/provider acceptance remain pending.

**19 Oct 2026 — Phase 4J XLSX imports:** both room and resident importers now accept XLSX with explicit sheet selection, column mapping, typed dates/text identities and bounded read-only conversion before the existing confirmed import. Build/typecheck, 41 unit tests and 133 isolated API scenario groups pass. See [Phase 4J report](docs/PHASE4J_XLSX_IMPORTS.md) and [browser QA](docs/PHASE4J_DESIGN_QA.md). No schema migration. Opening balances, wider onboarding/production acceptance and live providers remain pending.

**19 Oct 2026 — Phase 4I resident CSV imports:** owner upload/paste, seven-column mapping, explicit existing-profile collision review, per-stay billing day, canonical stay creation and guarded rollback are implemented. Build/typecheck, 36 unit tests and 126 isolated API scenario groups pass. See [Phase 4I report](docs/PHASE4I_RESIDENT_IMPORTS.md) and [browser QA](docs/PHASE4I_DESIGN_QA.md). Direct XLSX, opening balances, wider onboarding/production acceptance and live providers remain pending.

**19 Oct 2026 — Phase 4H room imports:** owner room-only CSV upload/paste, column mapping, collision/capacity preview, atomic confirmed import and guarded whole-batch rollback are implemented. Production build/typecheck, 33 unit tests and 112 isolated API scenario groups pass. See [Phase 4H report](docs/PHASE4H_ROOM_IMPORTS.md) and [browser QA](docs/PHASE4H_DESIGN_QA.md). XLSX, resident/balance imports, main database rollout and live providers remain pending.

**19 Oct 2026 — Phase 4G personal privacy:** verified account summary download and encrypted personal privacy requests now connect to the approved Support Center review queue. Responses record review without erasing data or closing accounts. Production build/typecheck, 29 unit tests and 100 isolated API groups passed. See [Phase 4G report](docs/PHASE4G_PRIVACY_REQUESTS.md) and [browser QA](docs/PHASE4G_DESIGN_QA.md). Actual retention/fulfillment policies, imports and production/provider acceptance remain pending.

**19 Oct 2026 — Phase 4F scoped messaging:** owner and verified resident conversations now connect to assigned staff through the approved inbox. Threads bind stay plus user identity; encrypted immutable history, routing/revocation, concurrency and checkout restrictions are enforced on the server. Production build/typecheck, 27 unit tests and 92 isolated API groups passed. See [Phase 4F report](docs/PHASE4F_SCOPED_MESSAGES.md) and [browser QA](docs/PHASE4F_DESIGN_QA.md). Live notifications, privacy/import work and production rollout remain pending.

**19 Oct 2026 — Phase 4E support and integration readiness:** owner organization tickets and encrypted revisioned replies connect to the approved platform Support Center; Integrasi & Audit shows safe configuration states, aggregate email queue and scoped support/subscription activity. Production build/typecheck, 27 unit tests and 84 isolated API groups passed. See [Phase 4E report](docs/PHASE4E_SUPPORT_INTEGRATION_HEALTH.md) and [browser QA](docs/PHASE4E_DESIGN_QA.md). No main database rollout or live provider activation; broader V3 work remains.

**18 Oct 2026 — Phase 4D property finance:** owner expense bills, partial payments/refunds/corrections, scoped cash reports/charts, separate deposits, manual reconciliation and safe CSV exports are implemented. Production build/typecheck, 25 unit tests and 77 isolated API scenario groups passed. See [Phase 4D report](docs/PHASE4D_PROPERTY_FINANCE.md) and [browser QA](docs/PHASE4D_DESIGN_QA.md). Main database, deployment and live providers remain pending.

**18 Oct 2026 — Phase 4C SaaS billing:** Customer 360, encrypted/masked organization billing profiles, a separate subscription ledger, partial receipts/refunds/corrections, and explicit paid-period activation are implemented. Owner sees only their own SaaS billing. Production build/typecheck, 22 unit tests and 68 isolated API groups passed. See [Phase 4C report](docs/PHASE4C_SAAS_CUSTOMER_BILLING.md) and [browser QA](docs/PHASE4C_DESIGN_QA.md). External payment/email, production rollout, support cases and remaining V3 modules are pending.

**18 Oct 2026 — Phase 4B prospects:** approved Prospek & Penyewaan now supports consent/source capture, survey and follow-up, revised offers, immutable history and atomic conversion using existing room/stay rules. Production build/typecheck, 20 unit tests and 59 isolated API scenario groups passed. See [Phase 4B report](docs/PHASE4B_PROSPECTS.md) and [browser QA](docs/PHASE4B_DESIGN_QA.md). Broader SaaS Customer 360/subscription accounting and production rollout remain pending.

**18 Oct 2026 — Phase 4A resident/contract/deposit:** Resident 360, versioned manual contracts, room transfers and deposit liability settlement are implemented for review. Production build/typecheck, 20 unit tests and 50 isolated API scenario groups passed. This is a bounded increment, not all Phase 4 requirements. See [Phase 4A report](docs/PHASE4A_RESIDENT_CONTRACT_DEPOSIT.md) and [browser QA](docs/PHASE4A_DESIGN_QA.md). Production migration/deployment and live integrations remain pending.

**18 Oct 2026 — Phase 3 account/access/email readiness:** verified signup, membership/workspace switching, scoped staff/tenant invitations, permanent resident accounts, account/session security and encrypted local mail outbox are implemented for review. Production build/typecheck, 17 unit tests and 42 isolated API scenario groups passed. No real email or production database migration. See [Phase 3 report](docs/PHASE3_IDENTITY_ACCESS_EMAIL.md) and [bounded browser QA](docs/PHASE3_DESIGN_QA.md). Earlier phase reports below are historical.

> Latest: Phase 2 backoffice v5.3 connects Owner, Staff, Tenant and Admin shells to existing services. Missing V3 backend modules remain visibly gated. See [Phase 2 report](docs/PHASE2_BACKOFFICE_V53.md). No existing database migration or production deployment was performed. Local QA preview: `http://127.0.0.1:3001/demo`.

# Kamelo by ELENIO

**18 Oct 2026 — Phase 1 approved v7/v6:** public landing and 28-module marketing showcase implemented from final handoff assets, with scoped styling and existing route/plan integration. Production build, 12 unit tests, read-only HTTP and desktop/mobile browser checks passed. Backend/database/auth remain unchanged. See [Phase 1 report](docs/PHASE1_APPROVED_PUBLIC_V7.md) and root design-qa.md. Earlier landing reports below are historical. Phase 2 awaits visual sign-off.


**Latest complete landing update (17 Oct 2026):** implemented option 2 from the latest full-page concepts, from courtyard-photo hero to navy footer. Includes six custom photo assets, interactive reminder/tasks, real property demo paths, plan recommendation and connected upgrade-request registration/onboarding. Build/typecheck, ten unit tests and 33 HTTP/API scenario groups passed, including a complete customer-to-payment/task/session journey. Visual comparison and bounded desktop/mobile browser checks now passed after review corrections. See [implementation and test report](docs/LANDING_JOURNAL_IMPLEMENTATION.md), [browser coverage](docs/LANDING_BROWSER_QA.md) and [visual QA status](design-qa.md). The earlier [homepage release notes](docs/HOMEPAGE_ONBOARDING_2026-10-17.md) and descriptions below are historical.


**Latest functional continuation (13 Oct 2026):** [operations/dashboard report](docs/OPERATIONS_DASHBOARD_REPORT.md). Tickets and staff progress, active-stay services/Wi-Fi QR, owner-authorized guest MOCK controls, server-backed rules-mode LEO, opt-in recurring automation and periodic MOCK reconciliation are implemented. Production build/typecheck, 10 unit tests and 28 integration groups passed. External AI/Tuya/CCTV/automatic WhatsApp remain unconfigured. See [integration setup](docs/INTEGRATION_SETUP.md). Older release descriptions below are historical evidence, superseded by this report.


Latest landing revision: a complete local reminder trial, compact owner-first story and a public fixture-only tenant preview. Open [/demo/owner](http://127.0.0.1:3000/demo/owner) or [/demo/tenant](http://127.0.0.1:3000/demo/tenant); `?property=hotel` selects the hotel example. Neither demo creates customer links or writes financial data. Mobile height fell from 15,932 to 9,475 px (~40.5%). See the [current refinement report](docs/LANDING_REFINEMENT_REPORT.md) for files, validation and screenshots. Functional integration evidence in the paragraphs below belongs to the preceding release.

A local development application for Indonesian kos, guest houses, and small hotels. **Dari Masalah Properti, Jadi Tindakan Nyata.** The homepage leads with overdue collections, repetitive staff follow-up, and unnecessary electricity use, then demonstrates current workflows. Kamelo Core covers rooms, tenants, reservations, invoices, payments, and plan limits. Optional Smart is currently a clearly labeled simulation. The application uses Bahasa Indonesia, integer IDR amounts, and Asia/Jakarta operational dates.

The integrated change set passed its production build, TypeScript check, ten unit tests, and 21 integration scenario groups (15 regression + six tenant/smart groups). Browser checks covered desktop/mobile acquisition, interactive workflows, tenant upload → pending → owner approval, individual billing-day editing, and simulated access creation/revocation. These bounded local checks do not mean the entire PRD or production launch is complete. AI Agent, maintenance tickets, full Smart Stay/Wi-Fi, CCTV/Video Analytics, hosted deployment, reset email and live Tuya remain unavailable. See [implementation status](docs/IMPLEMENTATION_STATUS.md) and [change log](docs/CHANGELOG_2026-10-13.md).

## Stack

Next.js 15 App Router, React 19, TypeScript, plain CSS, Lucide icons, Zod, Prisma 6, and PostgreSQL. The development database can run through `embedded-postgres`; an external PostgreSQL database is also supported. Plan configuration lives in `lib/plans.ts`.

## Run locally

Use a recent Node.js 22 release (22.18+ supports the seed script's TypeScript import) and pnpm. The package pins pnpm 11.25.0; required Prisma and local PostgreSQL setup scripts are explicitly allowed. A frozen dependency installation and the local production launcher were verified. Run commands from the repository root.

```powershell
pnpm install --frozen-lockfile
Copy-Item .env.example .env
```

The convenience runner starts local PostgreSQL, generates Prisma Client, applies versioned migrations, starts Next.js and the operations worker:

```powershell
node scripts/run-local.mjs
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000). Keep this process running; Ctrl+C stops its child processes. The local database persists in `.local-db/`, which is ignored by Git. The runner always starts the embedded database on port 5432; use the explicit steps below when using an existing database or when that port is occupied.

The explicit equivalent is:

```powershell
# Terminal 1: local PostgreSQL, unless using an existing PostgreSQL service
pnpm db:local
```

```powershell
# Terminal 2: environment, schema, application
$env:DATABASE_URL = 'postgresql://koshotel:koshotel_local@127.0.0.1:5432/koshotel'
$env:APP_URL = 'http://127.0.0.1:3000'
pnpm db:generate
pnpm db:migrate
pnpm dev
```

Register through `/register`; no shared owner password is installed. Onboarding creates all requested rooms atomically and rejects a batch above the plan limit. A new Free account supports five rooms. The application remains usable without IoT.

`APP_URL` must match the origin used in the browser, including scheme, hostname, and port. `localhost` and `127.0.0.1` are different origins. Both mutation APIs reject a mismatched `Origin` header.

## Environment

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string used by Prisma. Local example credentials are for development only. |
| `APP_URL` | Canonical application origin for mutation checks and reset links. Use an HTTPS URL in production. |
| `MAIL_ENDPOINT` | Trusted server endpoint accepting reset email JSON. Empty by default. |
| `MAIL_API_KEY` | Server-only bearer credential for that mail endpoint. Empty by default. |
| `PROOF_STORAGE_DIR` | Private persistent directory for payment evidence; defaults to `storage/payment-proofs/`. Keep it outside `public/`, writable by the application, and include it in backups. |
| `DATA_ENCRYPTION_KEY` | Hosted-instance key for simulated access PIN encryption: 32 random bytes encoded as 64 hex characters. Keep it server-only and preserve it for restore; changing it without re-encryption prevents existing PINs from being read. |
| `OPERATIONS_JOB_KEY` | At least 64 random characters shared by server and operations worker; protects the scheduled job endpoint. |
| `TEST_URL` | Optional integration-test server URL; defaults to `http://127.0.0.1:3000`. |

Next.js and Prisma CLI read `.env`. Export `DATABASE_URL` explicitly for direct Node scripts, as in the examples. Do not commit secrets. Preserve existing database names, migration history, and internal `kh-session` cookie identifiers; branding does not require a data reset.

For a loopback `APP_URL`, the application can create and reuse a private local encryption key at `.local-secrets/data-key`. A nonlocal origin requires an explicit `DATA_ENCRYPTION_KEY` before simulated digital credentials can be used. Back up the key separately with restricted access; do not place keys or uploaded proof files in a public directory or source control. A hosted container needs a persistent writable volume for `PROOF_STORAGE_DIR` as well as its PostgreSQL volume.

Password reset pages and token processing are implemented, but reset email requests return an explicit unavailable state until both mail variables are configured. Live Tuya credentials are not accepted by the current application; its cloud adapter deliberately fails closed.

## Commands

| Command | Result |
|---|---|
| `pnpm dev` | Next.js development server bound to `127.0.0.1`. |
| `pnpm build` | Production build. |
| `pnpm start` | Serve an existing production build. |
| `pnpm typecheck` | TypeScript validation without emitting files. |
| `pnpm test` | Domain tests; no database or server needed. |
| `pnpm test:integration` | API/database scenarios against a running server and a disposable development database. |
| `pnpm test:tenant` | Six tenant billing, proof, insight and simulated-lock integration groups against the local server. |
| `pnpm test:operations` | Seven operational/guest/automation permission and concurrency integration groups. |
| `pnpm worker` | Run the minute-based job worker with the same APP_URL/OPERATIONS_JOB_KEY as the server. |
| `pnpm db:generate` | Generate Prisma Client into `generated/prisma/`. |
| `pnpm db:migrate` | Apply committed migrations with `prisma migrate deploy`. |
| `pnpm db:dev` | Create/apply development migrations after schema changes. |
| `pnpm db:local` | Start local-only embedded PostgreSQL on `127.0.0.1:5432`. |
| `pnpm db:seed` | Repeatable isolated demonstration records; creates no login accounts. |

The public `/demo` uses deterministic, read-only in-memory sample data and does not require database seeding. It switches between Kos Melati and Guest House Harmoni. Database seeds use separate demo organizations and stable identifiers.

Integration tests create synthetic organizations and retain their records for inspection. Never point this suite at a customer database. The optional `node scripts/e2e-account.mjs` creates a synthetic local browser-test account; its known test password makes it unsuitable for any shared or production environment.

## Core workflows

- Register and create a kos or hotel property with rooms.
- Create/edit rooms, track operational readiness, add occupants or reservations, check in/out, and reject overlapping stays. Owners can edit tenant name/phone and each stay's billing day/rate without rewriting issued invoices.
- Draft/edit/issue invoices, record partial or full manual payments, reject overpayments, void unpaid invoices with a reason, print invoices, and open a manual WhatsApp reminder.
- Generate one recurring invoice per active kos stay and month on paid plans, using each tenant's individual billing day and a last-day fallback for shorter months.
- Create a 14-day invoice-scoped tenant link, share it manually, and let the tenant upload JPEG/PNG/PDF payment evidence up to 5 MB. New links revoke earlier links for that invoice. Evidence stays pending until an owner or payment-authorized staff member confirms receipt and approves it; rejection includes a reason. Approval records one payment and rechecks the outstanding balance.
- Open a prepared manual WhatsApp reminder with the invoice balance, due date, and tenant link. The application does not send messages or claim delivery automatically.
- Read current occupancy, monthly received payments, outstanding/overdue balances, current-month invoice collection rate, and an accessible six-month graph. Up/down comparisons use equal elapsed days from this and the previous month; a zero previous-period baseline has no invented growth percentage. Invoice pages contain 50 records; financial aggregates cover all history independently of pagination.
- Request Starter/Plus upgrades, activate requests as a platform administrator, create staff within plan limits, and assign property access. Staff payment recording and device control default to denied; owners can grant or revoke each permission explicitly.
- Create/map mock devices and send supported, audited simulation commands. Mock smart-lock access follows eligible stays, dates, and hotel check-in/check-out; confirmed online simulation can expose a six-digit encrypted demonstration PIN through a separately permitted tenant link. Access never depends on whether rent is paid. This is simulated access provisioning, without physical unlocking or a live Tuya connection.

The five portal modules are Dashboard, Kamar & Tamu, Tagihan, Smart IoT, and Pengaturan. Guest/reservation management is integrated into Kamar & Tamu rather than separate top-level modules. Room and invoice links select the authorized property context; invoice links open the detail dialog even when the invoice is outside the current list page. The tenant portal is limited to its shared invoice and, only when permitted, that invoice's stay access; it is not an owner account or a general tenant directory.

CSV/XLSX import/export, reservation rescheduling/no-show workflows, automatic reminder delivery, a recurring background scheduler, full accounting, and live IoT remain outstanding or outside the current release scope. Smart date transitions are reconciled on relevant operations and access refresh, not by an always-running hardware scheduler.

## Administrator setup

Register a dedicated account, verify the intended operator's identity, then run the following locally with the correct `DATABASE_URL`:

```powershell
node scripts/admin.mjs verified-admin@example.com
```

This grants `platformAdmin` and writes an audit entry. `/admin` lists organizations and pending upgrades; `/admin/organizations` and `/admin/subscriptions` reuse the same protected consolidated view. Customer owners cannot grant themselves platform access through the web UI. Upgrade activation is manual and does not process money.

## Production build and deployment

On Windows, `next.config.ts` uses the normal Next.js build output:

```powershell
pnpm db:generate
pnpm db:migrate
pnpm build
pnpm start
```

`node scripts/run-local.mjs --production` can start the local database and an already-built Next.js production server. It does not run the build.

On Linux, Next.js emits standalone output. `Dockerfile` packages that output into a Node.js 22 image. `docker-compose.yml` supplies a local PostgreSQL 17 service; it does not deploy the application. A deployed application container also needs a writable persistent private upload volume configured with `PROOF_STORAGE_DIR`, and a protected `DATA_ENCRYPTION_KEY`. Docker was unavailable in the implementation environment, so the container build and volume permissions have not been validated. A deployment operator must provide durable PostgreSQL and proof storage, run migrations from the source/build environment, configure secrets and HTTPS, and supply coordinated backup/restore and operational monitoring before accepting real customer data. Do not expose the embedded development database or reuse its credentials publicly.

## Documentation

- [Product requirements](docs/PRD.md)
- [Final Kamelo branding direction](docs/BRANDING_DIRECTION.md)
- [Architecture and API behavior](docs/ARCHITECTURE.md)
- [Database, migrations, and recovery](docs/DATABASE.md)
- [Mock IoT and live Tuya prerequisites](docs/TUYA_INTEGRATION.md)
- [Brand assets](docs/BRAND_ASSETS.md) and [photography sources](docs/IMAGE_SOURCES.md)
- [Implementation status and limitations](docs/IMPLEMENTATION_STATUS.md)
