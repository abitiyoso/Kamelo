# Stage 5 — Local integration readiness; live acceptance pending

20 October 2026. User previously confirmed that external AI, Tuya/devices and CCTV resources are unavailable. This increment completes useful local preparation and failure-path verification. It does **not** complete stage 5 live acceptance or authorize production activation. Stages 5 and 6 remain open.

## Delivered

Three worker entry points now share a fixed-route transport helper. The helper validates APP_URL (HTTPS except exact local loopback HTTP), rejects URL userinfo/path/query/fragment, validates a bounded non-whitespace server key, sends the key only in the Authorization header, refuses redirects and validates bounded successful JSON responses. Upstream bodies/exceptions, customer records and credentials are never logged. Requests time out after 55 seconds, polling does not overlap and stop aborts in-flight requests and future timers. The reminder worker additionally rejects repeated/backward cursors and bounds cursor traversal.

The existing Hostinger encrypted outbox, live gate/recipient allowlist, TLS checks, unknown-delivery semantics and local sink remain unchanged. No SMTP, model, VMS or physical device was contacted. Real worker entry points were executed against synthetic loopback HTTP endpoints, not an external provider. Actual MOCK provider methods and every unimplemented Tuya live method were tested; the latter fail closed without network requests.

`pnpm integration:preflight` now emits a sanitized offline configuration report: origin mode, worker/DB/encryption/private-storage readiness, six existing integration states, provider prerequisites and release dependencies. It does not read .env automatically, query a database, contact a provider, send email or run a device. Status CONFIGURED_UNVERIFIED does not establish connection or running-process health. No private origins/credentials/recipient addresses/storage paths are printed. Optional `--require-live` exits 2 while live acceptance is pending; ordinary exit 0 only confirms report generation. No environment flag can turn this offline report into VERIFIED.

The existing Platform ELENIO Integrasi & Audit page displays this report in a compact read-only card. Current platform authority is required on every API request. Owners/staff/tenants do not receive global deployment prerequisites through this endpoint. Refresh failures clear the old panel data. Existing approved navigation, logo/photographs, green styling, financial logic, pricing and customer permissions are retained.

Dockerfile packages the three worker scripts and their dependency-free helper. An optional worker-only Compose template supplies the reviewed image, HTTPS origin and job key to separately supervised processes. No service was installed/launched. Docker is unavailable in this QA environment, so actual image/container build/run and supervision remain release acceptance tasks. The template requires no DB/SMTP credentials in worker processes; web server endpoints execute provider/database work.

## File map

| File                                                                                                            | Change                                                                                                              |
| --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `lib/worker-client.mjs`                                                                                         | Shared origin/secret validation, fixed-route HTTP, response/cursor guards and nonoverlapping shutdown-aware polling |
| `scripts/operations-worker.mjs`, `mail-worker.mjs`, `reminder-worker.mjs`                                       | Actual entry points use the common helper; existing scheduling intervals retained                                   |
| `lib/integration-preflight.mjs`, `scripts/integration-preflight.mjs`                                            | Offline safe report and strict refusal of unverified live acceptance                                                |
| `app/api/platform-health/route.ts`, `components/workspace/platform-health.tsx`                                  | Existing platform-only status panel includes prerequisites; no mutation/send controls                               |
| `Dockerfile`, `docker-compose.workers.yml`                                                                      | Worker packaging and opt-in supervision example; not deployed or container-tested                                   |
| `tests/worker.test.mjs`, `worker-transport.test.mjs`, `iot-provider.test.mjs`, `integration-preflight.test.mjs` | Origin/redirect/response/timeout cancellation, cursor, polling, actual CLI/adapter and offline-report contracts     |
| `tests/integration-stage5.integration.mjs`                                                                      | Platform context, secret-safe projection, read-only preservation and fresh revocation                               |
| `scripts/integration-stage5-qa-verify.mjs`, `integration-stage5-review-sync.mjs`                                | Isolated regression and explicit allowlisted review export                                                          |
| `docs/INTEGRATION_SETUP.md`, `INTEGRATION_LIVE_ACCEPTANCE.md`                                                   | Current configuration/runbook and unexecuted provider evidence template                                             |

No schema change or migration was introduced. All 22 applied migration files retain their bytes. Main database, external credentials/services, financial rules and provider gates were not changed.

## Validation

Production build and TypeScript pass. All 63 unit tests pass, including actual worker subprocesses against ephemeral loopback HTTP servers, real redirect rejection and actual adapter class contracts. All 25 disposable QA API suites pass, including three new preflight permission/preservation groups. Selected invoice/payment/opening/stay/room/guest/document/retention/outbox table hashes remained unchanged by repeated preflight API reads. Existing financial/refund/receipt, proof, dashboard, identity, lifecycle, import, support and reminder regressions remain passing.

Browser checks cover the platform panel, per-service prerequisites and responsive 320/390 px presentation. See INTEGRATION_STAGE5_DESIGN_QA.md and artifacts/integration-stage5. Evidence contains only synthetic QA metadata and sanitized configuration states. No real email, payment, camera feed, device action, main database migration, commit, push or deployment occurred.

## Live acceptance dependencies

Hostinger transport exists but still needs an approved mailbox/sender/test recipient, provider DNS configuration and authorized inbox/bounce/failure validation. CCTV/VMS, Tuya and generative LEO need both selected provider resources **and implementation of their live adapters**; credentials alone are insufficient. No fake live camera counts, physical command acknowledgement or generative answer was added. WhatsApp/gateway remain separate approved integration plans.

Use INTEGRATION_LIVE_ACCEPTANCE.md to record actual environment/version, scenarios, results, private evidence references and approval after resources are supplied. It is an unexecuted template and grants no action permission. Do not mark stage 5 complete, relabel simulation as live or claim inbox/device acceptance from these local tests. Stage 6 independently still needs final UAT/security/load, UTF-8 backup restore, approved retention/production migrations and deployment acceptance.
