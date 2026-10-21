// Read/load checks run only against the restored disposable copy, never production.
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { PrismaClient } from "../generated/prisma/index.js";
const config = JSON.parse(
    await readFile(".local-secrets/release-stage6/current.json", "utf8"),
  ),
  fixture = JSON.parse(
    await readFile(
      join(config.run, "fixtures/finance-stage4-browser.json"),
      "utf8",
    ),
  ),
  url = new URL(config.databaseUrl),
  base = "http://127.0.0.1:3002";
assert.equal(url.hostname, "127.0.0.1");
assert.equal(url.port, "55433");
assert.equal(url.pathname, "/kamelo_release_restore");
const db = new PrismaClient({ datasourceUrl: config.databaseUrl }),
  sha = (b) => createHash("sha256").update(b).digest("hex");
let groups = 0;
const pass = (s) => {
  groups++;
  console.log("PASS", s);
};
function client() {
  let cookie = "";
  return {
    async raw(path, body, origin = base) {
      assert(path.startsWith("/api/"));
      const r = await fetch(base + path, {
        method: body ? "POST" : "GET",
        redirect: "error",
        signal: AbortSignal.timeout(20000),
        headers: {
          Cookie: cookie,
          Origin: origin,
          "Content-Type": "application/json",
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      if (r.headers.get("set-cookie"))
        cookie = r.headers.get("set-cookie").split(";")[0];
      return r;
    },
    async json(path, body) {
      const r = await this.raw(path, body);
      assert.equal(r.status, 200, path + ": " + (await r.clone().text()));
      return r.json();
    },
    async login(email, password = fixture.password) {
      const r = await this.raw("/api/auth", {
        action: "login",
        email,
        password,
      });
      assert.equal(r.status, 200, "Recovered identity can sign in");
      const h = r.headers.get("set-cookie");
      assert.match(h, /HttpOnly/i);
      assert.match(h, /SameSite=lax/i);
      assert.match(h, /Secure/i);
    },
  };
}
const owner = client(),
  tenant = client(),
  staff = client(),
  other = client(),
  anon = client();
const financialHash = async () => {
  const result = {};
  for (const table of [
    "Invoice",
    "Payment",
    "OpeningReceivable",
    "OpeningReceipt",
    "PaymentProof",
    "OpeningProof",
    "FinancialDocument",
    "FinancialDocumentReview",
    "EmailOutbox",
    "Stay",
    "Room",
    "Guest",
    "ExpenseEntry",
  ]) {
    const rows = await db.$queryRawUnsafe(
      `SELECT to_jsonb(t)::text AS row FROM "${table}" t`,
    );
    result[table] = sha(JSON.stringify(rows.map((x) => x.row).sort()));
  }
  return result;
};
try {
  const original = await financialHash();
  await owner.login(fixture.ownerEmail);
  await tenant.login(fixture.tenantEmail);
  await other.login(fixture.ownerEmail.replace("-owner-", "-other-"));
  const ownerUser = await db.user.findUniqueOrThrow({
      where: { email: fixture.ownerEmail },
    }),
    staffMember = await db.orgMembership.findFirstOrThrow({
      where: {
        organizationId: ownerUser.organizationId,
        role: "STAFF",
        status: "ACTIVE",
      },
      include: { user: true },
    });
  await staff.login(staffMember.user.email);
  const contexts = (await tenant.json("/api/account")).contexts,
    stay = contexts.find((c) => c.type === "STAY");
  assert(stay);
  await tenant.json("/api/account", {
    action: "switch",
    type: "STAY",
    id: stay.id,
  });
  await tenant.json("/api/resident");
  pass(
    "Recovered owner, staff and tenant identities sign in; session cookies and exact stay context work",
  );
  const dashboardPath = "/api/dashboard?propertyId=" + fixture.propertyId,
    proofPath = "/api/proof-queue?propertyId=" + fixture.propertyId,
    documentPath = "/api/financial-documents?id=" + fixture.documentId,
    tenantDocumentPath =
      "/api/financial-documents?id=" + fixture.invoiceDocumentId;
  for (const path of [dashboardPath, proofPath, documentPath]) {
    const r = await owner.raw(path);
    assert.equal(r.status, 200);
    assert.match(r.headers.get("cache-control"), /private.*no-store/);
    assert.equal((await anon.raw(path)).status, 401);
    assert.equal((await other.raw(path)).status, 403);
    assert.equal((await staff.raw(path)).status, 403);
  }
  assert.equal((await tenant.raw(dashboardPath)).status, 403);
  assert.equal((await tenant.raw(proofPath)).status, 403);
  await tenant.json(tenantDocumentPath);
  const issued = await owner.json(documentPath);
  const html = await owner.raw(documentPath + "&format=html&download=1");
  assert.equal(html.status, 200);
  assert.match(
    html.headers.get("content-security-policy"),
    /default-src 'none'/,
  );
  assert.match(
    html.headers.get("content-security-policy"),
    /frame-ancestors 'none'/,
  );
  assert.equal(html.headers.get("x-content-type-options"), "nosniff");
  assert.match(html.headers.get("content-disposition"), /^attachment;/);
  assert(!(await html.text()).includes("<script"));
  pass(
    "Recovered billing/documents stay private; cross-organization, staff and tenant restrictions and safe HTML download hold",
  );
  for (const path of [
    "/api/proof-queue",
    "/api/financial-documents",
    "/api/manage",
    "/api/auth",
  ]) {
    const r = await owner.raw(
      path,
      { action: "invalid", key: randomUUID() },
      "https://untrusted.example",
    );
    assert.equal(r.status, 403);
  }
  for (const path of ["/api/jobs", "/api/jobs/mail", "/api/jobs/reminders"])
    assert.equal((await anon.raw(path, {})).status, 401);
  pass(
    "Foreign-origin writes and job requests without worker authorization fail closed",
  );
  const proofFixture = JSON.parse(
      await readFile(join(config.run, "fixtures/phase4m-browser.json"), "utf8"),
    ),
    proofOwner = client();
  await proofOwner.login(proofFixture.ownerEmail, proofFixture.password);
  const proof = await db.openingProof.findUniqueOrThrow({
    where: { id: proofFixture.proofId },
  });
  const file = await proofOwner.raw("/api/opening-proofs/" + proof.id);
  assert.equal(file.status, 200);
  assert.equal(sha(Buffer.from(await file.arrayBuffer())), proof.contentHash);
  assert.equal(
    sha(await readFile(join(config.proofDirectory, proof.storageKey))),
    proof.contentHash,
  );
  assert.match(file.headers.get("cache-control"), /no-store/);
  assert.match(file.headers.get("content-disposition"), /^attachment;/);
  assert.equal((await anon.raw("/api/opening-proofs/" + proof.id)).status, 404);
  assert.equal(
    (await other.raw("/api/opening-proofs/" + proof.id)).status,
    404,
  );
  assert.equal(
    (await staff.raw("/api/opening-proofs/" + proof.id)).status,
    404,
  );
  pass(
    "Recovered proof bytes download through owner authorization; anonymous, unrelated and staff accounts cannot read them",
  );
  const access = await db.occupantAccess.findUniqueOrThrow({
    where: { id: stay.id },
  });
  try {
    await db.occupantAccess.update({
      where: { id: stay.id },
      data: { revokedAt: new Date() },
    });
    assert.equal((await tenant.raw(tenantDocumentPath)).status, 403);
    assert.equal((await tenant.raw("/api/resident")).status, 403);
  } finally {
    await db.occupantAccess.update({
      where: { id: stay.id },
      data: { revokedAt: access.revokedAt },
    });
  }
  await tenant.json(tenantDocumentPath);
  pass("Revoked resident grants are checked on each restored-session request");
  // Small, explicit ceiling: 5 concurrent GET readers / 150 requests, not a production capacity claim.
  const targets = [
      [owner, dashboardPath],
      [owner, proofPath],
      [owner, "/api/financial-documents?propertyId=" + fixture.propertyId],
      [tenant, "/api/resident"],
      [tenant, tenantDocumentPath],
    ],
    metrics = [];
  for (const [c, p] of targets) await c.json(p);
  await Promise.all(
    Array.from({ length: 5 }, async (_, worker) => {
      for (let n = 0; n < 30; n++) {
        const [c, path] = targets[(worker + n) % targets.length],
          start = performance.now();
        const r = await c.raw(path);
        await r.arrayBuffer();
        metrics.push({
          endpoint: path.split("?")[0],
          status: r.status,
          ms: Math.round(performance.now() - start),
        });
      }
    }),
  );
  assert(metrics.every((m) => m.status === 200));
  assert.deepEqual(await financialHash(), original);
  const latency = metrics.map((m) => m.ms).sort((a, b) => a - b),
    percentile = (p) => latency[Math.ceil(latency.length * p) - 1];
  const load = {
    concurrency: 5,
    requests: metrics.length,
    errors: metrics.filter((m) => m.status !== 200).length,
    p50Ms: percentile(0.5),
    p95Ms: percentile(0.95),
    maxMs: latency.at(-1),
    financialAndOutboxHashesUnchanged: true,
    productionCapacityClaim: false,
  };
  pass(
    "Bounded concurrent reads preserve financial, occupancy and outbox data",
  );
  await mkdir("artifacts/release-stage6", { recursive: true });
  await writeFile(
    "artifacts/release-stage6/security-load.json",
    JSON.stringify(
      {
        completedAt: new Date().toISOString(),
        groups,
        environment: "UTF-8 recovery copy / loopback 3002",
        recoveryDocumentHash: issued.snapshotHash,
        load,
        hashes: original,
        emailsSent: 0,
        providerCommands: 0,
        productionAcceptance: false,
      },
      null,
      2,
    ),
  );
  console.log("Release recovery API groups passed:", groups);
} finally {
  await db.$disconnect();
}
