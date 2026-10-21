import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { PrismaClient } from "../generated/prisma/index.js";
import { verifiedFixture, staffFixture } from "./helpers/identity.mjs";
const url = new URL(process.env.DATABASE_URL || "http://invalid"),
  base = process.env.TEST_URL;
assert.equal(url.hostname, "127.0.0.1");
assert.equal(url.port, "55432");
assert.equal(url.pathname, "/kamelo_phase2_qa");
assert.equal(base, "http://127.0.0.1:3001");
const db = new PrismaClient(),
  suffix = Date.now(),
  password = "Support-QA-only-password-123";
const today = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Jakarta",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());
const shift = (n) =>
  new Date(Date.parse(today + "T00:00:00Z") + n * 86400000)
    .toISOString()
    .slice(0, 10);
const hash = (v) =>
  createHash("sha256").update(JSON.stringify(v)).digest("hex");
function ok(r) {
  assert.equal(r.status, 200, JSON.stringify(r));
  return r.result || r;
}
function client() {
  let cookie = "";
  return {
    get cookie() {
      return cookie;
    },
    async call(path, body, origin = base) {
      const r = await fetch(base + path, {
        method: body ? "POST" : "GET",
        headers: {
          Origin: origin,
          Cookie: cookie,
          "Content-Type": "application/json",
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      const c = r.headers.get("set-cookie");
      if (c) cookie = c.split(";")[0];
      return { status: r.status, ...(await r.json()) };
    },
    async register(label) {
      const email = `support-${label}-${suffix}@example.test`;
      ok(
        await this.call("/api/auth", {
          action: "register",
          name: "Support QA " + label,
          email,
          password,
          phone: "081234567890",
        }),
      );
      await verifiedFixture(db, base, cookie, email);
      return db.user.findUniqueOrThrow({ where: { email } });
    },
    manage(action, p) {
      return this.call("/api/manage", { action, ...p });
    },
  };
}
const admin = client(),
  owner = client(),
  other = client(),
  staff = client();
let groups = 0;
const pass = (s) => {
  groups++;
  console.log("PASS", s);
};

try {
  const a = await admin.register("admin"),
    u = await owner.register("owner"),
    o = await other.register("other");
  await db.user.update({ where: { id: a.id }, data: { platformAdmin: true } });
  assert.equal((await admin.call("/api/platform-health")).status, 403);
  ok(await admin.call("/api/account", { action: "switch", type: "PLATFORM" }));
  const property = ok(
    await other.manage("property", {
      name: "Support QA property",
      type: "KOS",
      count: 1,
      rate: 1000000,
    }),
  );
  const staffEmail = `support-staff-${suffix}@example.test`;
  await db.organization.update({
    where: { id: o.organizationId },
    data: { plan: "starter", subscriptionStatus: "ACTIVE" },
  });
  ok(
    await staffFixture(db, base, other.cookie, {
      email: staffEmail,
      password,
      name: "Support Staff",
      phone: "081234567892",
      propertyIds: [property.id],
    }),
  );
  ok(
    await staff.call("/api/auth", {
      action: "login",
      email: staffEmail,
      password,
    }),
  );
  const orgId = u.organizationId;
  ok(
    await owner.manage("property", {
      name: "Support QA Residence",
      type: "KOS",
      count: 1,
      rate: 1000000,
    }),
  );
  const post = (c, action, p = {}) =>
    c.call("/api/support", {
      organizationId: orgId,
      action,
      key: randomUUID(),
      message: "Synthetic support review note",
      confirmed: true,
      ...p,
    });
  const detail = async (c, id, extra = "") =>
    ok(await c.call(`/api/support?caseId=${id}${extra}`));
  assert.equal((await client().call("/api/support")).status, 401);
  assert.equal((await staff.call("/api/support")).status, 403);
  assert.equal((await staff.call("/api/platform-health")).status, 403);
  assert.equal((await owner.call("/api/platform-health")).status, 403);
  assert.equal(
    (await other.call(`/api/support?organizationId=${orgId}`)).status,
    404,
  );
  assert.equal((await owner.call("/api/support?page=1.1")).status, 400);
  assert.equal((await owner.call("/api/support?status=SECRET")).status, 400);
  assert.equal(
    (await owner.call("/api/support", {}, "https://untrusted.example.test"))
      .status,
    403,
  );
  pass("owner/platform/staff/anonymous boundaries, origin and filters");
  const outboxBefore = await db.emailOutbox.count();
  const original = {
    organizationId: orgId,
    action: "create",
    key: randomUUID(),
    subject: "Synthetic subscription assistance",
    category: "BILLING",
    priority: "HIGH",
    message: "Private synthetic support text <script>alert(1)</script>",
    confirmed: true,
  };
  const created = ok(await owner.call("/api/support", original));
  assert.equal(
    ok(await owner.call("/api/support", original)).caseId,
    created.caseId,
  );
  assert.equal(
    (
      await owner.call("/api/support", {
        ...original,
        subject: "Changed retry payload",
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await post(owner, "create", {
        subject: "Invalid short",
        category: "BAD",
        priority: "HIGH",
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await post(owner, "create", {
        subject: "Unconfirmed ticket",
        category: "OTHER",
        priority: "NORMAL",
        confirmed: false,
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await post(admin, "create", {
        subject: "Admin cannot open on behalf",
        category: "OTHER",
        priority: "NORMAL",
      })
    ).status,
    400,
  );
  const id = created.caseId;
  let d = await detail(owner, id);
  assert.equal(d.case.status, "OPEN");
  assert.equal(d.entries.length, 1);
  assert.equal(d.entries[0].message, original.message);
  assert.ok(!JSON.stringify(d).includes("encryptedBody"));
  assert.ok(!JSON.stringify(d.entries).includes('actorId"'));
  const stored = await db.supportEntry.findFirstOrThrow({
    where: { caseId: id },
  });
  assert.ok(stored.encryptedBody.startsWith("v1."));
  assert.ok(!stored.encryptedBody.includes("synthetic"));
  assert.equal(await db.emailOutbox.count(), outboxBefore);
  assert.equal((await other.call(`/api/support?caseId=${id}`)).status, 404);
  assert.equal(
    (await post(other, "reply", { caseId: id, revision: 1 })).status,
    403,
  );
  pass(
    "encrypted shared ticket, explicit consent, exact retries and organization isolation without email",
  );
  assert.ok(await db.invoice.count() > 0);
  const before = hash(
    await db.invoice.findMany({
      where: { id: { not: "" } },
      orderBy: { id: "asc" },
    }),
  );
  const claim = { caseId: id, revision: 1 };
  const race = await Promise.all([
    post(admin, "claim", claim),
    post(admin, "reply", claim),
  ]);
  assert.deepEqual(race.map((r) => r.status).sort(), [200, 400]);
  d = await detail(admin, id);
  assert.equal(d.case.revision, 2);
  assert.equal(d.entryTotal, 2);
  if (!d.case.assigneeId) {
    ok(await post(admin, "claim", { caseId: id, revision: d.case.revision }));
    d = await detail(admin, id);
  }
  assert.equal(d.case.assigneeId, a.id);
  assert.equal(
    (
      await post(owner, "status", {
        caseId: id,
        revision: d.case.revision,
        status: "RESOLVED",
      })
    ).status,
    400,
  );
  assert.equal(
    (await post(admin, "claim", { caseId: id, revision: d.case.revision }))
      .status,
    400,
  );
  pass(
    "serialized competing replies/claim, stale revision and unauthorized transition guards",
  );
  async function change(c, action, extra = {}) {
    const current = await detail(c, id);
    ok(
      await post(c, action, {
        caseId: id,
        revision: current.case.revision,
        ...extra,
      }),
    );
    return detail(c, id);
  }
  d = await change(admin, "status", { status: "WAITING_CUSTOMER" });
  assert.equal(d.case.status, "WAITING_CUSTOMER");
  d = await change(owner, "reply", {
    message: "Owner supplied the missing subscription reference",
  });
  assert.equal(d.case.status, "IN_PROGRESS");
  d = await change(admin, "status", {
    status: "RESOLVED",
    message: "Synthetic issue reviewed and resolution recorded",
  });
  assert.equal(d.case.status, "RESOLVED");
  assert.equal(
    (await post(owner, "reply", { caseId: id, revision: d.case.revision }))
      .status,
    400,
  );
  d = await change(owner, "status", { status: "CLOSED" });
  assert.equal(d.case.status, "CLOSED");
  assert.equal(
    (
      await post(admin, "status", {
        caseId: id,
        revision: d.case.revision,
        status: "IN_PROGRESS",
      })
    ).status,
    400,
  );
  d = await change(owner, "reopen");
  assert.equal(d.case.status, "OPEN");
  assert.equal(d.case.assigneeId, a.id);
  assert.equal(
    hash(
      await db.invoice.findMany({
        where: { id: { not: "" } },
        orderBy: { id: "asc" },
      }),
    ),
    before,
  );
  pass(
    "owner replies resume waiting cases, platform resolution, owner closure and explicit reopen retain history",
  );
  await assert.rejects(
    db.supportEntry.update({
      where: { id: stored.id },
      data: { encryptedBody: "changed" },
    }),
  );
  await assert.rejects(db.supportEntry.delete({ where: { id: stored.id } }));
  await assert.rejects(
    db.supportCase.update({
      where: { id },
      data: { subject: "rewritten source", revision: { increment: 1 } },
    }),
  );
  await assert.rejects(db.supportCase.delete({ where: { id } }));
  const audit = await db.audit.findMany({
    where: { targetId: id, action: { startsWith: "SUPPORT_" } },
  });
  assert.equal(audit.length, d.case.revision);
  assert.ok(
    audit.every((r) => !JSON.stringify(r.metadata).includes("Synthetic")),
  );
  pass(
    "source and encrypted timeline immutable, revisioned support-only audit and resident finance preserved",
  );
  await db.audit.create({
    data: {
      organizationId: orgId,
      actorId: u.id,
      action: "TENANT_PRIVATE_MARKER",
      targetId: "private-tenant-target",
      metadata: { token: "do-not-leak" },
    },
  });
  let h = ok(
    await admin.call(
      `/api/platform-health?organizationId=${orgId}&domain=support`,
    ),
  );
  assert.equal(h.readiness.length, 6);
  assert.equal(h.readiness[0].state, "LOCAL_ONLY");
  assert.ok(!h.readiness.some((r) => r.state === "CONNECTED"));
  assert.ok(h.audits.every((r) => r.action.startsWith("SUPPORT_")));
  assert.ok(!JSON.stringify(h).includes("do-not-leak"));
  assert.ok(!JSON.stringify(h).includes("encryptedPayload"));
  assert.ok(!JSON.stringify(h).includes("actorId"));
  assert.ok(!JSON.stringify(h).includes(original.message));
  const outboxAtHealth = await db.emailOutbox.count();
  ok(await admin.call("/api/platform-health"));
  assert.equal(await db.emailOutbox.count(), outboxAtHealth);
  assert.equal((await admin.call("/api/platform-health?page=-1")).status, 400);
  assert.equal(
    (await admin.call("/api/platform-health?domain=tenant")).status,
    400,
  );
  await db.user.update({ where: { id: a.id }, data: { platformAdmin: false } });
  assert.equal((await admin.call("/api/platform-health")).status, 401);
  assert.equal(
    (await post(admin, "reply", { caseId: id, revision: d.case.revision }))
      .status,
    401,
  );
  await db.user.update({ where: { id: a.id }, data: { platformAdmin: true } });
  pass(
    "readiness and audit projections expose no private content, send nothing, and reject revoked platform access",
  );
  for (let n = d.entryTotal; n < 33; n++) {
    d = await change(owner, "reply", {
      message: `Synthetic paginated support follow-up ${n}`,
    });
  }
  assert.equal(d.entries.length, 30);
  assert.equal(d.entryTotal, 33);
  const older = await detail(owner, id, "&entryPage=2");
  assert.equal(older.entries.length, 3);
  assert.equal(older.entries.at(-1).revision, 1);
  for (let n = 0; n < 21; n++)
    ok(
      await post(owner, "create", {
        subject: `Support pagination fixture ${n}`,
        category: "OTHER",
        priority: "NORMAL",
      }),
    );
  let rows = ok(await owner.call("/api/support"));
  assert.equal(rows.total, 22);
  assert.equal(rows.rows.length, 20);
  assert.equal(ok(await owner.call("/api/support?page=2")).rows.length, 2);
  assert.equal(
    ok(await owner.call("/api/support?q=Synthetic%20subscription")).total,
    1,
  );
  h = ok(
    await admin.call(
      `/api/platform-health?organizationId=${orgId}&domain=support&page=2`,
    ),
  );
  assert.ok(h.audits.length > 0);
  assert.ok(h.total > 30);
  assert.equal(ok(await other.call("/api/support")).total, 0);
  pass(
    "all-history ticket counts, scoped search and paginated immutable conversation/audit",
  );
  await mkdir(".local-secrets", { recursive: true });
  await writeFile(
    ".local-secrets/phase4e-browser.json",
    JSON.stringify({
      base,
      owner: u.email,
      admin: a.email,
      password,
      caseId: id,
      organizationId: orgId,
    }),
  );
  await mkdir("artifacts/phase4e", { recursive: true });
  await writeFile(
    "artifacts/phase4e/support-tests.json",
    JSON.stringify(
      {
        groups,
        passed: true,
        externalEmail: false,
        completedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  );
} finally {
  await db.$disconnect();
}
