# Phase 4I — resident CSV onboarding

19 October 2026. Bounded V3 improvement of the existing application. Public landing v7/showcase v6 and the v5.3 backoffice identity/navigation/assets are retained. This completes the resident CSV increment; it does not complete XLSX, opening balances or production rollout.

## Delivered flow

Owner → **Properti & Kamar → Impor penghuni dari CSV**. Upload or paste UTF-8 comma-separated CSV (100,000 bytes, up to 50 records), map seven distinct columns, preview each row, resolve profile collisions explicitly, preview again and confirm before committing. Template: `/templates/kamelo-penghuni.csv`.

Columns: room number, name, Indonesian phone, start date, end date, integer IDR tariff, billing day. Dates use valid YYYY-MM-DD; end must follow start and is mandatory for HOTEL. Due day is independent per stay, 1–31. Room must already exist uniquely in this property and be READY. No rooms or properties are created here. Tariffs use the existing property's monthly/nightly mode; fractional or locale-formatted amounts are rejected.

Existing profile candidates are scoped to the selected property and found through Indonesian phone variants or case-insensitive exact name. If there is a candidate, owner must choose one explicitly; no automatic merge or overwrite. Candidate phones are masked in the selector. Reusing a profile preserves its stored name/phone even if the CSV differs. More than 20 candidates requires manual identity review. Intra-file duplicate name/phone for a new profile is blocked; overlapping room/profile periods are blocked within the file and against ACTIVE/CONFIRMED/CHECKED_IN stays. People with genuine shared names/phones that cannot be resolved here require manual entry/review; this is not fuzzy identity matching or a merge tool.

Commit reuses `lifecycleWrite(returnStay)` and existing availability/access synchronization, creating ACTIVE kos stays and CONFIRMED hotel reservations. The preview and confirmation disclose property billing automation and automated lock presence: **existing opted-in operations may create billing/access activity after import**, and access synchronization during commit may already create MOCK access records. Real providers remain unavailable/unconfigured. Import does not independently create historical invoices, payments, balances, contracts, deposits, invitations, tenant login accounts or email. A tenant account invitation remains a separate owner action.

## Integrity and rollback

- Existing active owner/session/membership and property/organization scope are checked before and after the shared organization advisory lock. Same-origin and rate limiting are enforced. Preview digest binds rows, profile candidates/choices, scope, property mode and automation flags; changed data requires a fresh preview.
- Actor/domain-bound idempotent lifecycle command keys allow exact retry and reject changed payloads. Batch creation, new guests, canonical stays/access changes, encrypted snapshots and audits are one transaction.
- Personal snapshots use existing AES-256-GCM encryption. GET history exposes only batch id, count, state and dates, limited to the 20 newest property batches. Raw CSV/profile data is not stored in audit metadata or lifecycle command responses.
- Rollback is all-or-nothing under organization and row locks. Every stay must match its original scalar snapshot and have no invoices (including drafts), smart access, stay links, occupant grants, tickets, messages, transfers, converted prospect, contract or deposit account. Invitations are checked explicitly because their stay reference has no FK. Any such history blocks rollback, even if revoked/closed.
- A newly created guest must match its snapshot, have only the imported stay, no invoice and no Resident 360 profile. Reused guests are never deleted or changed. Rooms are never deleted by this importer. Once rollback succeeds, batch history and encrypted snapshots remain immutable; audit records retain the action without plaintext personal data.
- This compares current data, not an event-history assertion that no edit was ever made and reverted. Encryption-key backup/rotation and retention remain operational requirements; privacy fulfillment policy is separately pending.

## Files and database

| File | Change |
| --- | --- |
| `lib/room-import-csv.mjs` | Extract shared bounded table parser, preserve room-import validation |
| `lib/resident-import-csv.mjs` | Seven-column mapping, literal dates, canonical phone, money/due day validation |
| `lib/resident-import.ts` | Identity/availability review, digest, canonical stay creation, encrypted history and guarded rollback |
| `app/api/resident-imports/route.ts` | Scoped no-store history and owner-only idempotent preview/commit/rollback |
| `components/workspace/resident-import.tsx`, `components/portal.tsx` | Expandable import UI using existing scoped green backoffice styles |
| `public/templates/kamelo-penghuni.csv` | Static example template |
| `prisma/schema.prisma`, migration `20261019090000_resident_imports` | Add ResidentImportBatch, restricted property FK, indexed property/date lookup, record/state checks, immutable one-way history trigger |
| Tests, phase scripts, package scripts and reports | Isolated QA, regression and review evidence |

Migration only adds one table, index, function and trigger. **Only disposable QA port 55432 was migrated**. All 35 existing business-table before/after hashes match, including prior import history. Main PostgreSQL, production mail/devices and deployment were not changed. No commit or push in this increment. Before a separately approved production rollout: backup/restore rehearsal, UTF-8 acceptance, intact applied migration checksums, encryption key configuration, migrate deploy and Prisma client regeneration. Do not modify applied migration SQL.

## Verification

Production build and TypeScript pass. **36 unit tests; 126 API scenario groups across 15 sequential suites pass** (112 existing plus 14 resident import groups). New scenarios cover scope/origin/staff/fresh membership, no-write preview, confirmation/stale digest, duplicate CSV rows, exact retry and changed key payload, independent due days, explicit legacy profile reuse with no overwrite, safe rollback retaining reused identities, changed-stay rejection, draft invoice preservation, contract/deposit and pending-invitation guards, hotel status/dates/readiness, concurrent import deduplication, immutable encrypted snapshots, and disclosed MOCK lock creation blocking rollback. Public template HTTP is verified. Import itself emitted no email or unsolicited financial/account/contract records in the no-automation fixture.

Review checkout: `exports/github-publish/kamelo`, local branch `codex/phase4i-resident-imports`. Forty-six explicit source/evidence files have matching SHA-256 hashes; the separate manifest is copied too. Review diff whitespace check and workspace TypeScript check pass after synchronization. Secrets, runtime databases, dependencies and generated/build output are excluded.

Browser QA covers actual CSV file chooser upload, new/existing profile collision review, explicit choice plus re-preview, confirmation, successful two-stay commit and desktop/390/320 responsive checks. See [browser QA](PHASE4I_DESIGN_QA.md). QA database encoding remains WIN1252; production UTF-8 migration/restore acceptance is not implied.

## Still pending

Direct XLSX parsing; historical opening-balance accounting/import; history pagination beyond latest 20; wider onboarding acceptance; real Hostinger/AI/CCTV/Tuya provider acceptance; privacy retention/fulfillment policy; main database rollout and hosting. CSV users can currently export XLSX to UTF-8 CSV. Opening balances must be designed as explicit reviewed financial entries, never fabricated paid invoices/payments or a rewrite of old records.
