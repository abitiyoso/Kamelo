# Kamelo by ELENIO

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
