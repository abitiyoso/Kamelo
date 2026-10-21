# Phase 4F — resident and assigned-staff conversations

19 October 2026. Incremental connection of approved v5.3 owner/staff inboxes and verified resident Pesan. Public Landing v7, Showcase v6, brand assets, typography, shell/navigation and existing financial/identity rules retained. This is not full V3 acceptance.

## Delivered behavior and permission boundaries

One conversation is keyed by **Stay + resident User**, not a room number or phone number. A verified resident uses the current authorized stay context; supplied recipient/stay identifiers never override that identity. Co-occupant grants do not implicitly share a user's conversation. A room transfer or renewal creates a different stay and does not merge old messages into a new conversation. Private temporary invoice/stay links do not grant messaging access.

Owners see conversations within their organization/property and can start a thread with an actively linked, verified resident. Starting an existing conversation appends to it rather than duplicating it. Owners assign or remove an active staff membership that has access to that property. Staff can read/reply only while both assignment and property membership remain valid. Reassignment removes the previous staff member's access immediately on subsequent requests, while preserving assignment history. Platform admin context cannot read resident conversations through this API. ELENIO support cases remain a separate domain.

Participants send reviewed plain-text messages. Sent text is encrypted using the existing server AES-GCM service, rendered as escaped text, and retained as immutable entries. Routing IDs, state, sequence, dates and actor roles remain metadata. Source resident/stay identifiers cannot be rewritten. Status/assignment changes append shared timeline entries with a reason. No message/body is included in general audit metadata. No attachments, credential sharing, silent edits or deletion controls are added.

Owner or assigned staff can close a conversation; an authorized active participant can explicitly reopen it. Checkout ends sending/start/reopen; an existing unrevoked resident grant can still read its own historical conversation. Owner retains scoped history and may close/archive an ended stay's thread. Revoked resident grants lose both reading and sending access. Recipient account suspension/closure also prevents new outgoing conversation messages. Existing financial records and smart-device permissions are unaffected.

Independent replies serialize and both persist, without requiring the sender to reload for another reply. Assignment/status changes require the current revision and reject stale competing updates. Exact actor/domain-bound retry keys reuse the result; changed data with the same key is rejected. Reads are private/no-store, use transactionally consistent pagination and omit encrypted payloads, actor IDs, resident emails/phones and billing/proof/device content.

## UI and delivery semantics

Existing owner/staff navigation opens Kotak Masuk/Pesan; verified resident navigation opens Pesan. Demo and limited token portals retain their existing honest unavailable state. Owner recipient search paginates 30 grants and labels active verified recipients; assignment lists are bounded to 100 eligible staff. Thread lists paginate 20, histories 30, newest first. Aggregates count the full scoped set, not only visible rows. Empty recipient results explain how to invite residents through Tim & Akses.

Messages are stored in the app. The UI provides explicit refresh and never claims a participant read the message or a device received it. There are no read receipts, unread badges, push/polling service, WebSocket subscription, email/WhatsApp notification, mass announcement, internal staff note or cross-stay group chat. Historical tenant compose is disabled using the existing resident summary; server checks remain authoritative if a stay ends while a screen is open.

## File map

| File | Change |
|---|---|
| `prisma/schema.prisma` | MessageThread/MessageEntry with stay/user/membership relations, unique conversation/sequence and scope/sort indexes. |
| `prisma/migrations/20261019050000_scoped_messages/migration.sql` | Additive tables, FK restrictions, value constraints, immutable source/entry triggers and sequential thread updates. |
| `lib/messages.ts` | Fresh session/context/grant resolution, scope predicates, recipient validation, staff routing, encrypted ledger and transitions. |
| `app/api/messages/route.ts` | Private list/detail/recipient API and same-origin/rate-limited, organization-locked, idempotent commands. |
| `components/workspace/messages.tsx` | Shared approved-style inbox, reviewed compose/reply, owner routing, shared history and dialog feedback/focus. |
| `components/portal.tsx` | Connect owner/staff messages while preserving demo unavailable state. |
| `components/identity/resident-portal.tsx` | Connect verified resident messages; use existing active-stay state for compose availability. |
| `tests/messages.integration.mjs` | Actual verified invitations, isolation, routing/revocation, concurrency, immutable history, checkout and invoice preservation. |
| `scripts/phase4f-qa-migrate.mjs`, `scripts/phase4f-qa-verify.mjs`, `package.json` | Disposable-only preservation/migration and reproducible verification commands. |
| README/status/design QA, phase report/manifest and curated artifacts | Review scope and bounded verification evidence. |

## Migration, rollback and security

Only disposable PostgreSQL at loopback 55432 was migrated. Hashes/counts of all 30 recorded pre-existing tables matched before/after, including support, expense and financial histories. See `artifacts/phase4f/migration-preservation.json`. No backfill or change to main/production PostgreSQL. The applied migration bytes/checksum are retained; it depends on the earlier history-preservation helper.

Before production: verify target/history, back up and rehearse UTF8 restore, preserve encryption keys with protected backups, review data-retention/support policy and assess query plans/DDL locks against actual volume. The embedded QA instance uses WIN1252; production UTF8 restore remains unverified. Backout should revert application code while retaining message tables and encryption material. Do not drop or rewrite user conversations. Privacy/export/deletion workflows remain a separate reviewed increment.

The API rechecks actor context and grants inside the write transaction, after acquiring the organization lock. Query predicates cover organization, stay/user identity and assigned membership/property. Client inputs never choose an elevated role. Immutable database triggers supplement API validation. Exact-key retries are scoped to actor and MESSAGES domain through existing LifecycleCommand storage. Decryption/database errors are sanitized. Final production security, retention, accessibility, abuse, scale and provider acceptance reviews remain outstanding.

## Verification

Production build/typecheck and **27 unit tests** passed. All **12 isolated API suites / 92 scenario groups** passed, including eight messaging groups: anonymous/platform/org/property boundaries; forged tenant recipient overrides and encrypted retry behavior; assignment/reassignment and revoked staff properties; concurrent replies and stale status/assignment races; immutable encrypted history; room/grant isolation and history pagination; actual synthetic invoice preservation and checkout freeze; limited-link/projection privacy. No message operation added an email-outbox record. A targeted recheck also verifies owner-start reuses an existing valid conversation.

Browser acceptance covers owner reply → assigned staff reads/replies → verified resident reads/replies, desktop and 320/390px dialogs, focus return and final compose availability. See [bounded browser QA](PHASE4F_DESIGN_QA.md). Full API regression precedes final client-only inactive-compose/empty-recipient guidance; final build and targeted checks cover those changes.

No real external messages/emails, money transfer, physical-device command, production migration/deployment, commit or push occurred. Remaining V3 increments include imports, privacy/retention and ownership recovery policy/workflows, provider configuration/acceptance and production restore/performance/accessibility/security rollout checks.
