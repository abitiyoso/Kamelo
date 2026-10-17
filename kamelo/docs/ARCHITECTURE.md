# Architecture

Kamelo is a modular monolith in one Next.js 15 application. Public pages render with the App Router. Authenticated portal pages check the server session before rendering a React client interface. Next.js API handlers validate input and apply business rules through Prisma against PostgreSQL. There is no separate backend service or external payment processor.

This document includes the current tenant-proof, billing-settings, metrics, and mock-lock additions. Their integration and regression validation are still pending; previous-release passing checks are recorded separately in [implementation status](IMPLEMENTATION_STATUS.md). Final product branding is [Kamelo by ELENIO](BRANDING_DIRECTION.md); existing technical identifiers and data remain unchanged.

## Source map

| Location | Responsibility |
|---|---|
| `app/page.tsx`, `app/pricing/`, `app/[page]/` | Landing, pricing, authentication pages, and draft legal pages. |
| `app/demo/`, `lib/demo.ts` | Read-only public sample properties with fixed demonstration dates. |
| `app/onboarding/[[...slug]]/` | Protected setup entry, implemented as one three-step flow. |
| `app/app/[[...slug]]/`, `components/portal.tsx` | Protected five-module portal, room details, invoice dialogs, property switcher, filters, and pagination. |
| `app/admin/`, `components/admin-panel.tsx` | Platform administrator organization list and manual upgrade activation. |
| `app/api/auth/route.ts`, `lib/auth.ts` | Registration, login/logout, password recovery, session lookup, and rate limits. |
| `app/api/manage/route.ts` | Scoped reads and transactional operations for properties, rooms, stays, billing, subscriptions, staff, and mock devices. |
| `app/tenant/[token]/`, `components/tenant-portal.tsx` | Invoice-scoped tenant view, payment evidence upload/status, and separately authorized simulated stay access. |
| `app/api/tenant/[token]/`, `app/api/proofs/[id]/`, `lib/tenant.ts`, `lib/proof-files.mjs` | Hashed expiring tenant links, bounded multipart uploads, private file access, and explicit payment-proof review. |
| `components/billing-tools.tsx`, `components/smart-access-panel.tsx` | Owner/staff invoice-link/review tools and labeled mock-lock access controls. |
| `lib/domain.mjs` | Pure currency, date, overlap, capacity, room-status, and capability rules. |
| `lib/metrics.ts`, `components/payment-trend.tsx` | Full-history financial aggregates, equal elapsed-period income comparisons, overdue/cohort collection insights, and accessible six-month payment graph independent of invoice pagination. |
| `lib/plans.ts` | Shared Free/Starter/Plus prices, capacities, feature entitlements, and IDR formatting. |
| `lib/iot.ts` | Provider contract, mock implementation, and unavailable live adapter. |
| `lib/smart-access.ts`, `lib/secrets.ts` | Room/stay-scoped access reconciliation and AES-256-GCM encryption for six-digit simulation PINs. |
| `lib/db.ts`, `prisma/` | Prisma Client lifetime, schema, and versioned database migrations. |
| `public/brand/`, `public/images/` | Supplied logo assets, generated LEO Stay poses, sourced stock photographs, and actual demo screenshot. |

Styling uses `app/globals.css`, with shared brand, pricing, mascot, onboarding, dialog focus, and team components. Tailwind, shadcn/ui, Auth.js, and Recharts were not added. Authentication uses a small equivalent server implementation. The application has a web manifest; no service worker or offline data synchronization is implemented.

## Request and authorization flow

1. Authentication reads the `kh-session` HTTP-only cookie and looks up its SHA-256 hash in `Session`.
2. An expired or missing session is rejected. Protected page entry points redirect to `/login`; APIs return an unauthorized response.
3. `GET /api/manage` restricts properties by `organizationId`. Staff also require the property ID in their server-stored assignment list. Passwords, session tokens, and reset tokens are excluded from its response.
4. Mutation APIs verify that the request origin matches `APP_URL`. Management requests are rate-limited per user.
5. Each management mutation opens a PostgreSQL transaction and obtains an organization advisory transaction lock. Capacity, reservation overlap, recurring-invoice, and payment-balance checks occur inside that transaction before the write and audit entry.
6. Owner-only operations include room/property editing, team access, subscription requests, device creation/mapping, and invoice voiding. Assigned staff can perform occupancy and invoice operations for their assigned properties. Payment recording and device control require separate explicit owner grants (`canRecordPayments` and `canControlDevices`), both false by default.

`platformAdmin` is separate from the customer `role`. Activation checks that flag and records an audit in the target organization. The local provisioning script is the current administrative bootstrap mechanism. Owner changes to staff assignments or sensitive permissions revoke that staff member's sessions and record the resulting permissions in audit metadata. The schema uses application-validated string states rather than database enums; organization scoping depends on the API implementation, not PostgreSQL row-level security.

## Authentication

Passwords use scrypt with a random 16-byte salt and a 64-byte derived key; verification uses a timing-safe comparison. Raw random session tokens are sent only in cookies and hashed before storage. Sessions expire after seven days; production cookies also use `Secure`, with `SameSite=Lax` and path `/`.

Reset tokens are random, stored as hashes, expire after one hour, are consumed transactionally, and revoke all sessions when the password changes. Email delivery is conditional on `MAIL_ENDPOINT` and `MAIL_API_KEY`. The endpoint receives `{to, subject, text}` with bearer authentication. No email provider adapter or email verification flow has been validated.

Rate-limit buckets persist in PostgreSQL. They use a 15-minute window: authentication defaults to eight attempts per email key, password-recovery requests to three, and management mutations to 100 per user. This is a basic application control, not a complete abuse-prevention system.

## Tenant links and private payment evidence

An authenticated manager creates a link through a property-scoped management action for an issued invoice. The random 32-byte token is returned once for sharing; only its SHA-256 hash is stored in `TenantLink`. Links expire after 14 days. Creating another link revokes previous active links for the invoice. Bearer links require no owner session and expose only their invoice, payment summaries, proof review status, and any explicitly permitted access for that invoice's stay. `includeAccess` is granted only to links created by an owner or staff with device-control permission; an ordinary invoice link must not return smart-access details.

`GET /api/tenant/[token]` validates the token and expiry, rate-limits reads, and returns a private, noncached response with a no-referrer policy. `POST /api/tenant/[token]/proof` validates origin and upload limits before storing evidence. Files are JPEG, PNG, or PDF up to 5 MB; actual signatures and declared types must agree. Amount/date/method/reference are validated separately. Pending/approved duplicate content hashes and more than five pending proofs per invoice are rejected. Database failures clean up the file written by that upload.

Proof content lives under `PROOF_STORAGE_DIR`, defaulting to `storage/payment-proofs/`, outside `public/`. Opaque UUID storage keys and paths are never sent to the tenant. Downloads pass through scoped authorization in `/api/proofs/[id]`; database records alone do not make the file public. Hosted storage must be persistent and writable by the runtime user, and restored together with its database metadata.

Uploading creates a `PaymentProof` in `PENDING` state and never alters the invoice balance. Only an owner or staff explicitly granted `canRecordPayments` can approve/reject it within their property scope. Approval requires explicit confirmation that funds arrived, rechecks invoice state and balance inside the organization-locked transaction, records one `Payment`, and marks the proof `APPROVED`. A repeated approval returns the existing payment rather than adding another one. Rejection requires a review note and marks `REJECTED`; the tenant can read that reason. Neither a photograph nor a PDF constitutes provider-confirmed payment.

## Operational and financial rules

`Property.type` selects monthly kos occupancy or nightly hotel reservations. Stays use validated local `YYYY-MM-DD` dates, with checkout as an exclusive boundary. Adjacent reservations are permitted; overlapping `ACTIVE`, `CONFIRMED`, or `CHECKED_IN` stays are rejected. Operational readiness (`READY`, `CLEANING`, `MAINTENANCE`) is stored separately from derived occupancy. Hotel checkout sets the room to `CLEANING`; an assigned staff member or owner may mark readiness through a dedicated action that cannot change the room's number or rate. Future monthly stays do not make a room occupied before their start date.

Invoices store immutable issued totals and JSON line items in integer rupiah. Drafts can be edited before issue. Issued invoices cannot be silently edited; an owner may void an unpaid invoice with a recorded reason. Payments require explicit confirmation of receipt, a positive integer amount, a nonfuture date, and an amount no greater than the remaining balance. Payment and void operations are audited. QRIS is a manual recording label, not an integration.

Payment status and overdue display are derived from invoice status, due date, and the sum of recorded payments. The persisted `UNPAID` state is also used for issued invoices that have become partially or fully paid. Draft and void invoices are excluded from financial totals. Current-month income means payment records dated from the first of the current Asia/Jakarta month through today; it is not an accounting profit calculation. Six monthly database aggregates supply the accessible SVG payment graph with month/value text.

Income change compares the current elapsed month against the same elapsed days of the previous month, clamped to its last valid day. Both date ranges are returned for labeling. A zero previous value yields no growth percentage when current income is positive; two zero values are unchanged. Overdue count/balance includes all issued invoices with `due < today` and a remaining balance. Occupancy is today's derived room status, not a historical growth estimate. Collection rate uses the value of invoices issued this month through today as its denominator and payments against that same cohort through today as its numerator; without issued value it is unavailable. These queries ignore invoice pagination and supply factual text insights rather than forecasts.

Paid kos recurring billing is an explicit user action for a selected stay and month. It clamps a billing day such as 31 to the last valid day of that month, validates the occupancy period, and returns the existing invoice for a repeated stay/month. There is no scheduled billing job or automatic reminder sender.

Each stay has its own billing day and rate, so tenants need not share a property-wide due date. The owner billing-settings workflow updates name/phone and the stay's billing day/rate for subsequent invoicing; issued invoice line items, due dates, totals, and payment records retain their previous values. Manual WhatsApp reminders prepare a message with the balance, due date, and tenant portal/upload link. The operator sends it from WhatsApp; opening a link is not a delivered-message event.

Plan limits are shared configuration and enforced server-side across the organization. An expired/inactive paid subscription receives Free entitlements without deleting existing rooms, occupants, invoices, or payments. Existing staff are not automatically deleted or disabled on downgrade; further account/room/property growth and paid recurring billing are restricted. The admin UI activates upgrade requests, but does not provide a complete cancellation, expiry scheduling, or downgrade administration workflow.

## Simulated room access and secrets

`SmartAccess` is unique per device/stay pair. An explicitly configured mock lock can reconcile access with stay state, date range, room mapping, and automation settings. Kos access requires an active stay; hotel access additionally requires check-in. Future stays or reservations waiting for check-in are scheduled. Ended stays, checkout, disabled automation, and changed mappings request revocation. Access does not depend on invoice payment status.

Only an online mock lock exposing the supported access capability can confirm active/revoked simulation state. Failed/offline confirmation preserves the last confirmed device state and leaves affected access pending. A tenant PIN is revealed only for matching room/property/stay, valid dates, eligible status, enabled automation, online device, confirmed active state, and a link authorized to include access. Reconciliation occurs during relevant operations and authorized access refreshes; there is no continuously running scheduling worker or physical unlock operation.

The six-digit demonstration PIN is encrypted with AES-256-GCM, a fresh nonce, authentication tag, and versioned authenticated context. Plaintext PINs do not enter audit metadata or device-state JSON. A hosted instance requires a server-only 32-byte `DATA_ENCRYPTION_KEY` encoded as 64 hex characters. Only a loopback `APP_URL` permits a generated private fallback key in `.local-secrets/data-key`. Preserve that key for recovery; this small PIN-encryption facility is not a complete live Tuya credential vault.

## Reads, routes, and UI limits

The management response loads authorized properties, rooms with stay history, up to 100 guest rows per property, devices, and an invoice page of 50 records per property ordered newest first. A room filter scopes room invoice pagination and its record count. Financial summaries and six-month trends use database aggregates over all issued property history. Invoice search/filtering applies to the loaded page and is labeled accordingly. A separately requested `invoiceId` is looked up within the authorized property set and can open an invoice outside the current page; an inaccessible invoice returns 403. Room and stay lists are not separately paginated, so this implementation still requires load and query review beyond the intended small-property scale.

`/app/guests` and `/app/bookings` select Kamar & Tamu. `/app/rooms/[id]` selects the room and its authorized property. `/app/billing/[id]` selects the invoice's property and opens the detail dialog through a scoped server lookup. Settings subpaths show the consolidated settings module. `/admin`, `/admin/organizations`, and `/admin/subscriptions` reuse the same protected administration view. Unknown private catch-all paths are not a documented public API.

Loading, empty, success, validation, integration-unavailable, and service-error states exist in the primary flows. Dialogs include focus trapping, Escape closing, focus restoration, and accessible labels. Responsive layouts have been exercised at a 390 px viewport. These checks do not establish WCAG 2.2 AA conformance or complete device/browser coverage.

## External boundaries

Mock device control is local simulation and never reaches Tuya. WhatsApp reminders open a prepared `wa.me` link for the user to send manually. Reset mail uses a configurable trusted HTTP service, currently unconfigured. No payment gateway, OTA connection, automated WhatsApp delivery, or AI chatbot is included.

The implementation is delivered locally. The integrated release passed production build, TypeScript, ten unit tests and 21 integration groups (15 regression plus six tenant/smart groups), with desktop/mobile browser checks. The homepage adds owner-first positioning, a shared-demo deterministic LEO preview and explicit planned-feature labels; it does not implement an AI runtime. OVERDUE invoices are filtered by server-side unpaid balances with pagination, while the proof queue includes pending submissions beyond the current invoice page. Linux standalone/Docker configuration is present; container proof-volume permissions, restore procedure and hosted operation remain unverified. See [implementation status](IMPLEMENTATION_STATUS.md).
