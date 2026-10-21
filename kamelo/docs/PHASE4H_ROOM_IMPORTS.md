# Phase 4H — reviewed room onboarding import

19 October 2026. Bounded continuation of the existing V3 application, not a rebuild or completion of all onboarding/import requirements. Approved public pages and backoffice navigation, photos, logo and visual identity are retained.

## Delivered

Owner → Properti & Kamar → **Impor kamar dari CSV**. Upload or paste UTF-8 comma-separated CSV; download the working template; map number/rate columns by index; review every record and validation error before explicit confirmation. Up to 100 records / 100,000 UTF-8 bytes / 20 columns. Tariffs are whole integer IDR, 0–1,000,000,000, interpreted using the existing property's monthly/nightly mode. No dependencies added.

Import adds new rooms to the selected existing property. It never updates an existing room or creates a property, guest, stay, invoice, deposit, account, invitation, payment, email or device command. Duplicate numbers within the file or existing property are compared with NFKC + case folding; collisions block the complete batch. Owner edits the source and previews again; there is no silent skip, merge or overwrite. Malformed quoting, inconsistent columns, formula-like room identifiers, fractional/locale-dependent money and oversized input are rejected.

The server revalidates session, active owner membership, organization/property scope and effective subscription capacity. Writes share the existing organization advisory transaction lock. Preview digest binds scope, parsed rows, collisions, room count and effective plan limit; commit recomputes it. A changed preview is rejected. Actor/domain-bound lifecycle command keys support exact retry while refusing changed payloads. A batch either fully commits or leaves no rooms behind.

The owner sees the 20 newest import batches for this property. Rollback requires confirmation and is all-or-nothing: row locks plus current snapshots reject changed/deleted rooms or rooms referenced by stays, invoices, devices or prospects. Existing relational restrictions provide an additional database guard. Only the rooms created by that batch are deleted. The batch is retained with rollback actor/time, immutable snapshots and audit actions. A database trigger prevents deletion, editing the source/snapshot, reopening a rolled-back batch or modifying its terminal history. The snapshot describes the current unchanged room; this is not an event-history guarantee that no edit was ever made and reverted.

## Files and migration

| File | Change |
| --- | --- |
| `lib/room-import-csv.mjs` | Shared bounded CSV parser and row validation |
| `lib/room-import.ts` | Owner authorization, scoped preview, capacity/digest, atomic commit/guarded rollback |
| `app/api/room-imports/route.ts` | No-store scoped history, same-origin/rate-limited preview and idempotent writes |
| `components/workspace/room-import.tsx` | Upload/paste, template, mapping, preview, confirmation, retry and latest history |
| `components/portal.tsx`, `app/workspace.css` | Expandable owner-only entry point and scoped responsive styling |
| `public/templates/kamelo-kamar.csv` | Downloadable template |
| `prisma/schema.prisma`, migration `20261019080000_room_imports` | Add `RoomImportBatch`, restricted property FK, property/date index, checks and immutable history trigger |
| Tests/scripts/package/docs | Parser/API regression, isolated QA migration/runner, evidence and review manifest |

Migration creates one new table plus index/function/trigger; no old columns or rows are rewritten. **Applied only to disposable QA on 55432**. Before/after hashes match for 34 existing business tables, including privacy, messaging, resident, contract, deposit and financial records. Production requires a reviewed backup/restore rehearsal, current migration checksums and a separately authorized rollout. Do not edit already-applied migration SQL. Regenerate Prisma client before starting the app after migration. No main database migration, commit, push or deployment occurred in this increment.

## Verification

- Final production build and TypeScript check pass; 33 unit tests pass, including four CSV cases.
- 14 API suites ran sequentially against disposable QA: 100 existing scenario groups plus 12 import groups pass. Import suite was rerun after static-template correction, adding explicit staff write denial and template HTTP validation.
- Imports cover cross-organization/origin/anonymous/staff access; fresh membership; read-only preview; missing confirmation/stale digest; exact retry/changed payload; collision and entire-batch failure; expired-plan fallback; commit race; safe rollback and rollback retry; edited/occupied-room rollback rejection; minimal scoped history; immutable database history; no financial/guest/stay side effects from the import itself.
- Browser: real sign-in, paste/reordered mapping → preview → confirmed commit → refreshed room count; repeated import collision; template download validated; actual file chooser upload → preview → confirmed commit. Final browser reported zero captured console errors. Desktop/mobile evidence in `artifacts/phase4h/` and accompanying design QA report.
- Local email remained sink-only. QA WIN1252 compatibility is not proof of a production UTF-8 backup/restore acceptance test.
- Review checkout: `exports/github-publish/kamelo`, local branch `codex/phase4h-room-imports`. Forty-five explicit source/evidence files have matching SHA-256 hashes; the separate review manifest is also copied. Review `git diff --check` and the workspace TypeScript check pass after synchronization. Secrets, runtime databases, dependencies and generated/build output are excluded.

## Remaining V3 work / next dependencies

**XLSX parsing, resident import, initial balances and import-history pagination beyond the latest 20 are not delivered here.** XLSX users must export CSV UTF-8 for this room-only flow. Guest identity collision review must select/reuse existing Resident 360 identities without silently merging people by phone/email. Stay import needs date/readiness/overlap validation and explicit property mode, followed by guarded rollback that preserves dependent contracts, grants, messages, deposits and billing. Historical balances need a separately reviewed opening-balance accounting model; never infer paid invoices or manufacture payments from a spreadsheet. These precede broader onboarding acceptance. Live Hostinger email, AI/CCTV/Tuya acceptance, privacy fulfillment policy and production rollout remain separately pending.
