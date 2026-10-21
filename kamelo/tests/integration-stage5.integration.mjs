import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { PrismaClient } from "../generated/prisma/index.js";
import { verifiedFixture } from "./helpers/identity.mjs";
const url = new URL(process.env.DATABASE_URL || "http://invalid"),
  base = process.env.TEST_URL;
assert.equal(url.hostname, "127.0.0.1");
assert.equal(url.port, "55432");
assert.equal(url.pathname, "/kamelo_phase2_qa");
assert.equal(base, "http://127.0.0.1:3001");
const db = new PrismaClient(),
  suffix = Date.now(),
  password = "Integration-Stage5-QA-password-123";
const ok = (r) => {
  assert.equal(r.status, 200, JSON.stringify(r));
  return r.result || r;
};
function client() {
  let cookie = "";
  return {
    async call(path, body) {
      const r = await fetch(base + path, {
        method: body ? "POST" : "GET",
        headers: {
          Cookie: cookie,
          Origin: base,
          "Content-Type": "application/json",
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      if (r.headers.get("set-cookie"))
        cookie = r.headers.get("set-cookie").split(";")[0];
      return { status: r.status, ...(await r.json()) };
    },
    async register(label) {
      const email = `integration5-${label}-${suffix}@example.test`;
      ok(
        await this.call("/api/auth", {
          action: "register",
          name: "Integration QA " + label,
          email,
          password,
          phone: "081234567890",
        }),
      );
      await verifiedFixture(db, base, cookie, email);
      return db.user.findUniqueOrThrow({ where: { email } });
    },
  };
}
const admin = client(),
  owner = client(),
  anon = client();
let groups = 0;
const pass = (s) => {
  groups++;
  console.log("PASS", s);
};
try {
  const a = await admin.register("admin");
  await owner.register("owner");
  assert.equal((await anon.call("/api/platform-health")).status, 401);
  assert.equal((await owner.call("/api/platform-health")).status, 403);
  await db.user.update({ where: { id: a.id }, data: { platformAdmin: true } });
  assert.equal((await admin.call("/api/platform-health")).status, 403);
  ok(await admin.call("/api/account", { action: "switch", type: "PLATFORM" }));
  const snapshot = async () => {
    const result = {};
    for (const table of [
      "Invoice",
      "Payment",
      "OpeningReceipt",
      "Stay",
      "Room",
      "Guest",
      "FinancialDocument",
      "FinancialDocumentReview",
      "EmailOutbox",
    ]) {
      const rows = await db.$queryRawUnsafe(
        `SELECT to_jsonb(t)::text AS row FROM "${table}" t ORDER BY to_jsonb(t)::text`,
      );
      result[table] = createHash("sha256")
        .update(JSON.stringify(rows))
        .digest("hex");
    }
    return result;
  };
  const before = await snapshot(),
    report = ok(await admin.call("/api/platform-health"));
  assert.equal(report.preflight.mode, "OFFLINE_CONFIGURATION_REVIEW");
  assert.equal(report.preflight.liveAcceptance, "PENDING_EXTERNAL_SETUP");
  assert.equal(report.preflight.networkRequests, 0);
  assert.equal(report.preflight.application.origin, "LOCAL_HTTP");
  assert.equal(report.preflight.application.worker, "CONFIGURED_UNVERIFIED");
  assert.equal(report.preflight.services[0].state, "LOCAL_ONLY");
  assert(report.preflight.services.every((s) => s.liveVerified === false));
  pass(
    "Only active platform context sees offline acceptance prerequisites; credentials never establish live verification",
  );
  const safe = JSON.stringify(report);
  for (const secret of [
    process.env.OPERATIONS_JOB_KEY,
    process.env.DATA_ENCRYPTION_KEY,
    process.env.DATABASE_URL,
  ])
    if (secret) assert(!safe.includes(secret));
  for (const field of [
    "encryptedPayload",
    "SMTP_PASSWORD",
    "SMTP_USERNAME",
    "storageKey",
    "authorization",
  ])
    assert(!safe.includes(field));
  for (let n = 0; n < 3; n++) ok(await admin.call("/api/platform-health"));
  assert.deepEqual(await snapshot(), before);
  assert.equal((await admin.call("/api/platform-health?page=0")).status, 400);
  pass(
    "Read-only safe platform report preserves cash, stays, documents and email outbox hashes",
  );
  await db.user.update({ where: { id: a.id }, data: { platformAdmin: false } });
  assert.equal((await admin.call("/api/platform-health")).status, 401);
  await db.user.update({ where: { id: a.id }, data: { platformAdmin: true } });
  pass(
    "Revoked platform authority is rechecked for every preflight report request",
  );
  await mkdir("artifacts/integration-stage5", { recursive: true });
  await writeFile(
    "artifacts/integration-stage5/preflight-api.json",
    JSON.stringify(
      {
        groups,
        scope: "Disposable QA only",
        providerRequests: 0,
        emailsSent: 0,
        liveAcceptance: "PENDING_EXTERNAL_SETUP",
        hashesPreserved: before,
        preflight: report.preflight,
      },
      null,
      2,
    ),
  );
  await writeFile(
    ".local-secrets/integration-stage5-browser.json",
    JSON.stringify({ adminEmail: a.email, password }, null, 2),
  );
  console.log("Integration stage 5 API groups passed:", groups);
} finally {
  await db.$disconnect();
}
