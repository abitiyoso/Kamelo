# Database and recovery

The persistent datastore is PostgreSQL, accessed with Prisma 6. `prisma/schema.prisma` is the schema source; versioned SQL migrations preserve the existing foundation, subscription lifecycle fields, and staff sensitive-operation permissions. The additive tenant-link, payment-proof and mock smart-access migration was applied to the existing local database, without reset, and verified through API tests. Prisma Client is generated into `generated/prisma/` and excluded from source control. Kamelo branding does not rename existing tables, database identifiers, migrations or the `kh-session` cookie.

## Models

| Model | Role and relevant constraints |
|---|---|
| `Organization` | Customer boundary, plan, subscription status, optional plan expiry. |
| `User` | Organization member; globally unique email; password hash; owner/staff role; assigned property ID array; separate platform administrator flag; `canRecordPayments` and `canControlDevices` grants, both false by default. |
| `Session` | Hashed session token primary key, user relation, expiry; cascades when its user is deleted. |
| `ResetToken` | Hashed one-time recovery token, user relation, expiry; cascades with user deletion. |
| `Property` | Organization-owned kos or hotel; organization lookup index. |
| `Room` | Property room number, integer rate, operational readiness; room number unique within property. |
| `Guest` | Property-owned name/phone; a new row is created with each new stay. |
| `Stay` | Room/guest relationship, local date range, rate, billing day, occupancy/reservation state; indexed by room and state. |
| `Invoice` | Property, room, guest, and stay references; globally unique invoice number; integer total; JSON line items; draft/issued/void state; unique stay/month pair for recurring bills. |
| `Payment` | Invoice payment, integer amount, date, method, reference, actor identifier, and timestamp. |
| `TenantLink` | One issued invoice, unique token hash, 14-day expiry, optional revocation time, and separate `includeAccess` flag. Creating a replacement revokes earlier links for that invoice. |
| `PaymentProof` | Invoice evidence metadata, amount/date/method/reference, private unique storage key, MIME type/size/content hash, pending/approved/rejected status, reviewer/note/time, and optional unique associated payment. File bytes are kept outside the database and `public/`. |
| `Device` | Property device, optional room mapping, provider, kind, automation flag, online state, capability/state JSON, and last sync time. |
| `SmartAccess` | Unique device/stay pair, access lifecycle status, local validity dates, encrypted six-digit simulation PIN, provider, and revocation timestamp. |
| `Audit` | Organization action, actor/target identifiers, safe JSON metadata, and timestamp; organization/time index. |
| `Upgrade` | Organization plan request and request/activation status. |
| `RateLimit` | Persistent attempt counter and expiry by opaque key. |

Most foreign keys restrict deletion; device room mappings are set to null if a room is deleted. No customer-facing bulk delete operation is implemented. Subscription changes do not delete records. Audit and payment actor IDs are stored identifiers, not user foreign keys.

## Data conventions and invariants

- Amounts are integer IDR, stored as PostgreSQL `INTEGER`. The API caps rates, individual amounts, and final invoice totals at Rp1 billion and checks safe arithmetic before writes. Discounts are negative invoice line items; final invoice totals must remain positive.
- Stay, invoice, and payment dates are validated ISO local-date strings (`YYYY-MM-DD`). Operational "today" is computed in Asia/Jakarta. Audit, payment creation, sync, and token expiries use timestamps.
- Stay end dates are exclusive. A null end means an open-ended kos occupancy. Overlap and readiness checks happen in the transaction.
- Invoice numbering uses a random `KH-` identifier backed by a global unique index. Recurring uniqueness is enforced on `(stayId, period)`; manual invoices have a null period.
- Full, partial, and overdue payment presentation is derived, rather than persisting a separate paid status after every payment.
- Organization and property access are validated by the application. Related records are scoped through their property; they do not each duplicate `organizationId`.
- All management writes take an organization advisory transaction lock. The database unique constraints remain a second guard for room numbers and recurring invoices. There is no database exclusion constraint for stay overlap and no row-level security policy.
- State values, staff property assignments, money rules, and cross-property relationships depend on API validation. Direct SQL or future code must preserve the same rules.
- Staff sensitive-operation grants are separate from property assignment. An owner can change them through team settings; the change writes an audit entry and revokes that staff user's sessions. A grant never bypasses organization/property scope.
- Mock command confirmations and provider-validation failures write audit entries. A failed command leaves confirmed device state untouched; its audit transaction commits before the API returns an error. There is no separate asynchronous command table.
- Billing days belong to individual stays, are validated from 1–31, and clamp to month end on generation. Owner updates to name/phone, rate, or billing day apply to future billing; previously issued invoices and payment records are retained unchanged.
- Raw tenant tokens are never stored. Token lookup checks hash, expiry, and revocation. `includeAccess` does not bypass stay, mapping, date, device-state, or staff-permission checks. Replacement links revoke earlier links for that invoice, so an older shared URL stops working.
- Proof upload never changes paid balance. `PENDING` proof can become `APPROVED` with one linked `Payment`, or `REJECTED` with a reason. A unique `paymentId`, transactional review, explicit receipt confirmation, and a fresh balance check prevent repeated approvals from recording duplicate money or exceeding the balance.
- Evidence file signatures and declared types must agree for JPEG/PNG/PDF, with a maximum of 5 MB. At most five proofs can be pending per invoice; pending/approved duplicate content hashes are rejected. Failed database writes remove the file written by that upload.
- A `SmartAccess` PIN is AES-256-GCM ciphertext, never plain JSON, audit metadata, or device state. Access is mock-only and requires appropriate stay dates/state, same-property room mapping, enabled automation, online device, and confirmed active simulation before disclosure. Unpaid invoices do not revoke or deny access.

The base-schema description above is historical. Later V3 increments add the subscription ledger, encrypted email outbox, identity/workspace records, opening balances, reminders and financial-document archives described in IMPLEMENTATION_STATUS.md. Live analytics, encrypted Tuya connections and a dedicated asynchronous live-device-command implementation remain pending.

## Local database

```powershell
pnpm db:local
```

`scripts/local-db.mjs` initializes and starts the bundled embedded PostgreSQL distribution, binds to `127.0.0.1:5432`, creates the `koshotel` database if needed, and persists data in `.local-db/`. Its user and password are fixed development values. Keep the process running while using the application. Ctrl+C requests a clean stop. Do not use this local setup as a public database.

Alternatively, `docker compose up -d db` uses the supplied PostgreSQL 17 service and volume, or `DATABASE_URL` can point to an independently managed PostgreSQL instance. The Docker option was not executed in the implementation environment. Do not run embedded and Docker PostgreSQL on the same port simultaneously.

## Migrations and seed data

With PostgreSQL running and `DATABASE_URL` set:

```powershell
pnpm db:generate
pnpm db:migrate
```

`db:migrate` applies existing migrations without resetting data. For an intentional development schema change, edit the Prisma schema, run `pnpm db:dev`, review the resulting SQL, and commit the migration. Generate the client again after schema changes. Avoid `prisma db push` or reset commands against customer databases; they are not part of the documented deployment path.

```powershell
$env:DATABASE_URL = 'postgresql://koshotel:koshotel_local@127.0.0.1:5432/koshotel'
pnpm db:seed
```

The repeatable seed upserts stable records into separate demo organizations for Kos Melati and Guest House Harmoni. It creates no user accounts or login credentials. Existing seeded records are not overwritten on rerun. Public `/demo` uses `lib/demo.ts` directly and does not depend on those database records.

`tests/integration.mjs`, `tests/tenant-smart.integration.mjs` and local browser fixture helpers write synthetic development records. Integration runs deliberately retain them for inspection; keep this data out of production. The integrated release passed 15 regression plus six tenant/smart scenario groups against the production server, including financial concurrency, grants/revocation, all-history pagination, private proof/link isolation, encrypted simulation access and individual billing settings. These bounded checks do not replace the recovery drill described below.

## Private files and encryption keys

`PaymentProof` stores metadata and an opaque storage key, not the evidence bytes. `PROOF_STORAGE_DIR` defaults to `storage/payment-proofs/` and must remain private, persistent, and writable by the runtime. A Docker application container needs a durable mounted upload volume; the PostgreSQL volume alone cannot recover evidence files. Proof downloads must use the scoped API rather than a static file URL.

Simulation PINs require a 32-byte `DATA_ENCRYPTION_KEY` encoded as 64 hex characters on hosting. With a loopback `APP_URL`, development may create a private fallback at `.local-secrets/data-key`. Back up this key through a restricted secret-management process. Existing ciphertext cannot be read if the key is lost or replaced without migration; keeping a database dump alone is insufficient for PIN recovery. Do not commit either private keys or uploaded evidence.

## Backup and restore procedure

Use the managed database provider's encrypted backups and retention policy for a hosted deployment. A PostgreSQL custom-format dump is a portable manual option. A disposable synthetic-data drill was exercised on 20 October 2026: WIN1252 QA source to a separate UTF-8 cluster, with all public row hashes, migration history and schema definitions preserved, Unicode round-trip, private-file recovery, encrypted-document recovery and scoped application checks. See [the stage 6 report](RELEASE_STAGE6.md) for exact timings, legacy fixture exceptions and remaining production acceptance. The following are general operator examples; they do not authorize running against production:

```powershell
# Use a restricted backup location and protect its contents as personal/financial data.
pg_dump --format=custom --file=koshotel-backup.dump $env:DATABASE_URL

# Restore into a separate, empty database first; do not overwrite a live database.
pg_restore --no-owner --dbname=$env:RESTORE_DATABASE_URL koshotel-backup.dump
```

Use client utilities compatible with the server version. Do not copy `.local-db/` while PostgreSQL is running as a substitute for a consistent backup. For a local directory snapshot, stop the database cleanly first and preserve the PostgreSQL version information alongside the files.

Coordinate a database backup with the private evidence files and the protected PIN encryption key, recording their compatible recovery point. After restoring to an isolated instance, check migration history, record counts, organization/staff isolation, invoice totals versus payment sums, recurring uniqueness, evidence-file availability and scoped downloads, reviewed-proof/payment relationships, tenant link expiry/revocation, and PIN decryption without exposing it in logs. Exercise a representative sign-in/room/billing workflow. Confirm that production notification and live-integration credentials are disabled in the restored test environment. Record recovery duration and data-loss window before relying on the procedure commercially.

Approved retention periods and destructive export/deletion policy, production backup encryption/access controls, scheduled backup monitoring and a restore on the actual hosting/provider with real roles/ACLs and RPO/RTO remain production-readiness work. The completed local drill does not establish those guarantees. The development legal pages are drafts and do not establish operational policies.
