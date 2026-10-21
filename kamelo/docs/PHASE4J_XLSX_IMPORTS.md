# Phase 4J — direct XLSX onboarding imports

19 October 2026. Incremental improvement of the existing room/resident importer. Approved landing v7, showcase v6, backoffice v5.3, logo/photos, navigation and existing financial/auth rules remain intact. Historical balances are not part of this increment.

## Delivered

Owner → **Properti & Kamar → Impor kamar/penghuni dari CSV / XLSX**. Select CSV or XLSX. For XLSX, choose a sheet explicitly, map source columns and choose **Gunakan lembar XLSX**. The selected values become editable canonical CSV in the existing importer; owner must then run domain preview, resolve collisions and confirm before saving. The server does not choose the first sheet or save business records during workbook reading. Returning to sheet/mapping selection clears the previous data, digest and confirmation. Completed source mapping collapses to a summary so two full mapping forms are not shown together.

Both importers retain CSV upload/paste and now offer downloadable `.xlsx` templates with identity fields stored as text and resident start dates stored as real Excel dates. The source workbook can have differently ordered columns; output is ordered to the existing room/resident field mapping. All existing plan limits, profile-selection rules, availability, individual billing days, canonical stay status/access synchronization, idempotency and guarded rollback continue through the existing APIs.

Room numbers, names and telephone columns must be Text cells in Excel. This prevents silently stripping leading zeros or treating formatted numeric identifiers as verified strings. Money and due days may be integer numeric cells or valid text accepted by existing validation. Properly formatted native Excel dates (1900 or 1904 calendars) become YYYY-MM-DD without local timezone shifting. Text YYYY-MM-DD is retained. Date-times, unformatted numeric date serials, booleans and unsafe/fractional numeric cells are rejected. An empty end date is retained for the existing KOS/HOTEL rule to decide validity. Formula cells are rejected even if they have cached results: copy/paste values first.

## File boundaries and privacy

- XLSX input: 1,000,000 bytes; multipart request body streamed with a 1,100,000-byte cap before form parsing. CSV retains its 100,000-byte limit.
- ZIP: up to 200 paths, each declared entry at most 2 MB, cumulative expanded declarations at most 4 MB. Duplicate/traversing paths are rejected. XML output sizes must match metadata; validated bounded XML is repackaged before the spreadsheet reader sees it. Nothing is extracted to filesystem paths.
- Workbook: up to 10 sheets, each within 20 columns and 101 rows including header; actual row/cell counts and sparse/dimension/cell references are bounded before spreadsheet parsing. The selected resident sheet is further limited to 50 records and the room sheet to100. Canonical CSV still has the original 100 KB limit. Large formatted-but-empty areas need to be removed before import.
- Data tables with hidden sheets/rows/columns, merged cells, formulas, macros, workbook connections/external relationships or XML entity declarations are rejected with actionable errors. Legacy `.xls`, macro `.xlsm`, encrypted and malformed files are unsupported. No formula, macro, external workbook link or device action is executed by the reader.
- File reading requires the existing owner session/membership and same-origin protection, with a dedicated rate limit and a second membership/session check after parsing. Responses are private/no-store. Inspect returns only sheet names, headers returns only header labels, and conversion returns only selected mapped values.
- Original workbook bytes are handled in memory and not persisted. No separate original-file provenance record is introduced. Stored business snapshots and audits remain those of the existing confirmed importer; resident snapshots stay encrypted. Owners may deliberately edit the canonical CSV before preview.

## Files and dependencies

| File | Change |
| --- | --- |
| `lib/import-workbook.mjs` | Bounded ZIP/XML preflight, workbook reading, sheet/mapping selection, typed value normalization to canonical CSV |
| `app/api/import-files/route.ts` | Owner-only streamed multipart inspect/headers/convert endpoint with no business writes |
| `components/workspace/import-file.tsx` | Shared CSV/XLSX selection and explicit sheet/mapping flow |
| `components/workspace/room-import.tsx`, `resident-import.tsx` | Integrate shared picker while retaining domain preview and confirmations |
| `public/templates/kamelo-kamar.xlsx`, `kamelo-penghuni.xlsx` | Downloadable text-identity/date-cell templates |
| `package.json`, `pnpm-lock.yaml` | Exact direct pins `read-excel-file`9.3.12 and `fflate`0.8.3, plus test scripts; install lifecycle scripts were disabled |
| Unit/API fixtures and phase scripts | Calendar/type/file rejection coverage, both real import paths, regression and review evidence |

The official [read-excel-file documentation](https://github.com/catamphetamine/read-excel-file#nodejs) documents Buffer input and native sheet values; its whole-workbook API is used after preflight. The official [fflate documentation](https://github.com/101arrowz/fflate#usage) documents filtering entries using declared original sizes. The additional limits, XML checks and repackaging are Kamelo application code, not claims of guarantees supplied by those libraries. Installed package source and tests were checked against the pinned versions.

No Prisma schema change or database migration was added/applied in this phase. Main PostgreSQL, production email/providers and deployment remain untouched. No commit or push. Review checkout uses a local branch; secrets, runtime databases, dependencies and build/generated output are excluded. New dependencies must be installed from the pinned lockfile when applying the review copy.

Review checkout: `exports/github-publish/kamelo`, branch `codex/phase4j-xlsx-imports`. Fifty-one explicit source/evidence files have matching SHA-256 hashes; the separate manifest is copied too. Review whitespace check and workspace TypeScript check pass after synchronization.

## Verification

Final production build and TypeScript pass. **41 unit tests and 133 API scenario groups across 16 sequential suites pass** (126 prior plus seven XLSX API groups). New unit cases cover multiple sheets/reordered columns/leading zeros, both Excel calendars, quoted values, numeric identifiers, date-times/serials, booleans, unsafe values, formula caches, external/macros/entity/hidden/merge rejection, expanded-byte limits, malformed files, sparse references, row/column/sheet bounds and invalid mapping.

New API groups cover anonymous/staff/origin/fresh-session guards, explicit sheet/mapping and no-write conversion; real room import; resident import with 1904 dates and independent due days; malformed/legacy/oversized/formula/numeric-identifier rejection; and rollback in dependency order with existing history guards preserved. Tests use only disposable QA on 55432 and loopback 3001 with email sink. Both public XLSX templates also pass actual HTTP download, workbook parsing and domain validation. Source-dependent browser operations were verified through both pickers: upload → choose sheet → map → convert → preview → confirmed room save, then upload the same workbook → resident sheet → preview → confirmed two-stay save. Desktop/mobile evidence: [design QA](PHASE4J_DESIGN_QA.md).

## Remaining V3 work

Opening-balance accounting/import, import-history pagination beyond latest20, wider onboarding acceptance, production UTF-8 backup/restore and rollout, privacy retention/fulfillment policy and live Hostinger/AI/CCTV/Tuya acceptance remain pending. Opening balances must be explicit reviewed financial entries with appropriate reversal rules, not fabricated payments or rewritten issued invoices.
