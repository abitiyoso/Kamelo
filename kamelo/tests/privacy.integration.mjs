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
  password = "Privacy-QA-only-password-123";
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
      const email = `privacy-${label}-${suffix}@example.test`;
      ok(
        await this.call("/api/auth", {
          action: "register",
          name: "Privacy QA " + label,
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
  const u = await owner.register("owner"),
    o = await other.register("other"),
    a = await admin.register("admin");
  const tenant = client(),
    t = await tenant.register("tenant");
  await db.organization.update({
    where: { id: u.organizationId },
    data: { plan: "plus", subscriptionStatus: "ACTIVE" },
  });
  const property = ok(
    await owner.manage("property", {
      name: "Privacy QA Residence",
      type: "KOS",
      count: 1,
      rate: 1000000,
    }),
  );
  const room = await db.room.findFirstOrThrow({
    where: { propertyId: property.id },
  });
  const stay = ok(
    await owner.manage("stay", {
      propertyId: property.id,
      roomId: room.id,
      name: "Privacy resident",
      phone: "081234567891",
      start: today,
      rate: 1000000,
      billingDay: 15,
    }),
  );
  const inv = ok(
    await owner.call("/api/invitations", {
      action: "create",
      kind: "TENANT",
      email: t.email,
      propertyIds: [property.id],
      stayId: stay.id,
    }),
  );
  ok(await tenant.call("/api/invitations", { action: "accept", id: inv.id }));
  const ctx = ok(await tenant.call("/api/account")).contexts.find(
    (c) => c.type === "STAY",
  );
  ok(
    await tenant.call("/api/account", {
      action: "switch",
      type: "STAY",
      id: ctx.id,
    }),
  );
  const staffEmail = `privacy-staff-${suffix}@example.test`;
  ok(
    await staffFixture(db, base, owner.cookie, {
      email: staffEmail,
      password,
      name: "Privacy Staff",
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
  await db.user.update({ where: { id: a.id }, data: { platformAdmin: true } });
  assert.equal((await admin.call("/api/privacy?platform=1")).status, 403);
  ok(await admin.call("/api/account", { action: "switch", type: "PLATFORM" }));
  const write = (c, action, data = {}, platform = false) =>
    c.call("/api/privacy", {
      action,
      key: randomUUID(),
      message: "Synthetic privacy review message",
      confirmed: true,
      platform,
      ...data,
    });
  const read = async (c, id, platform = false, page = 1) =>
    ok(
      await c.call(
        `/api/privacy?requestId=${id}&platform=${platform ? 1 : 0}&page=${page}`,
      ),
    );
  assert.equal((await client().call("/api/privacy")).status, 401);
  assert.equal((await owner.call("/api/privacy?platform=1")).status, 403);
  assert.equal((await tenant.call("/api/privacy?platform=1")).status, 403);
  assert.equal((await staff.call("/api/privacy?platform=1")).status, 403);
  assert.equal((await owner.call("/api/privacy?page=0")).status, 400);
  assert.equal((await owner.call("/api/privacy?kind=EXECUTE")).status, 400);
  assert.equal(
    (await owner.call("/api/privacy", {}, "https://untrusted.example.test"))
      .status,
    403,
  );
  pass(
    "verified account contexts, anonymous/platform boundaries, filter and origin enforcement",
  );
  const ownSummary = ok(await owner.call("/api/privacy?summary=1")),
    residentSummary = ok(await tenant.call("/api/privacy?summary=1"));
  assert.equal(ownSummary.profile.email, u.email);
  assert.equal(residentSummary.profile.email, t.email);
  assert.equal(residentSummary.stays[0].stay.room.number, room.number);
  for (const key of [
    '"password"',
    '"token"',
    '"encryptedPayload"',
    '"actorId"',
  ])
    assert.ok(!JSON.stringify(ownSummary).includes(key));
  assert.ok(!JSON.stringify(ownSummary).includes(t.email));
  assert.ok(!JSON.stringify(residentSummary).includes(u.email));
  assert.equal(
    (await owner.call(`/api/privacy?summary=1&userId=${o.id}`)).status,
    400,
  );
  assert.equal(
    (await admin.call("/api/privacy?summary=1&platform=1")).status,
    403,
  );
  const response = await fetch(base + "/api/privacy?summary=1", {
    headers: { Cookie: owner.cookie },
  });
  assert.ok(response.headers.get("cache-control").includes("no-store"));
  assert.ok(response.headers.get("content-disposition").includes("attachment"));
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  pass(
    "self-only private JSON summary uses current account and active grants without credentials or other residents",
  );
  const protectedUser = hash(
    await db.user.findUniqueOrThrow({ where: { id: u.id } }),
  );
  const invoiceWhere = {};
  assert.ok((await db.invoice.count()) > 0);
  const invoices = hash(
    await db.invoice.findMany({
      where: invoiceWhere,
      orderBy: { id: "asc" },
      include: { payments: true },
    }),
  );
  const messages = hash(
    await db.messageEntry.findMany({ orderBy: { id: "asc" } }),
  );
  const outboxBefore = await db.emailOutbox.count();
  const body = {
    action: "create",
    kind: "DELETION",
    key: randomUUID(),
    message: "Review retention only <script>alert(1)</script>",
    confirmed: true,
    requesterId: o.id,
  };
  const created = ok(await owner.call("/api/privacy", body)),
    id = created.requestId;
  assert.equal(ok(await owner.call("/api/privacy", body)).requestId, id);
  assert.equal(
    (
      await owner.call("/api/privacy", {
        ...body,
        message: "Changed request text",
      })
    ).status,
    400,
  );
  assert.equal(
    (await db.privacyRequest.findUniqueOrThrow({ where: { id } })).requesterId,
    u.id,
  );
  const raw = await db.privacyEntry.findFirstOrThrow({
    where: { requestId: id },
  });
  assert.ok(raw.encryptedBody.startsWith("v1."));
  assert.ok(!raw.encryptedBody.includes("Review retention"));
  assert.equal((await read(owner, id)).entries[0].message, body.message);
  assert.ok(!JSON.stringify(await read(owner, id)).includes('actorId"'));
  assert.equal(
    (await write(owner, "create", { kind: "COPY", confirmed: false })).status,
    400,
  );
  assert.equal(
    (await write(admin, "create", { kind: "COPY" }, true)).status,
    400,
  );
  const race = await Promise.all([
    write(owner, "create", { kind: "COPY" }),
    write(owner, "create", { kind: "COPY" }),
  ]);
  assert.deepEqual(race.map((r) => r.status).sort(), [200, 400]);
  const copyId = race.find((r) => r.status === 200).result.requestId;
  assert.equal(
    (await write(owner, "create", { kind: "DELETION" })).status,
    400,
  );
  pass(
    "reviewed encrypted requests, exact retries, forged-requester isolation and single open request per type",
  );
  assert.equal((await other.call(`/api/privacy?requestId=${id}`)).status, 404);
  assert.equal((await staff.call(`/api/privacy?requestId=${id}`)).status, 404);
  assert.equal((await tenant.call(`/api/privacy?requestId=${id}`)).status, 404);
  const staffRequest = ok(
    await write(staff, "create", { kind: "CORRECTION" }),
  ).requestId;
  const tenantRequest = ok(
    await write(tenant, "create", { kind: "COPY" }),
  ).requestId;
  assert.equal(
    (await owner.call(`/api/privacy?requestId=${staffRequest}`)).status,
    404,
  );
  assert.equal(
    (await owner.call(`/api/privacy?requestId=${tenantRequest}`)).status,
    404,
  );
  assert.equal(ok(await tenant.call("/api/privacy")).total, 1);
  assert.equal(ok(await staff.call("/api/privacy")).total, 1);
  let d = await read(owner, id);
  assert.equal(
    (
      await write(owner, "review", {
        requestId: id,
        revision: d.request.revision,
        status: "RESPONDED",
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await write(
        admin,
        "review",
        {
          requestId: id,
          revision: d.request.revision,
          status: "RESPONDED",
          reference: "REFERENCE-QA",
        },
        true,
      )
    ).status,
    400,
  );
  ok(
    await write(
      admin,
      "review",
      { requestId: id, revision: d.request.revision, status: "IN_REVIEW" },
      true,
    ),
  );
  d = await read(admin, id, true);
  assert.equal(
    (
      await write(
        admin,
        "review",
        { requestId: id, revision: d.request.revision, status: "RESPONDED" },
        true,
      )
    ).status,
    400,
  );
  ok(
    await write(
      admin,
      "review",
      {
        requestId: id,
        revision: d.request.revision,
        status: "NEEDS_INFORMATION",
        message: "Please clarify the requested retention scope",
      },
      true,
    ),
  );
  d = await read(owner, id);
  ok(
    await write(owner, "reply", {
      requestId: id,
      revision: d.request.revision,
      message:
        "Please retain mandatory financial history and review personal account data",
    }),
  );
  d = await read(owner, id);
  assert.equal(d.request.status, "IN_REVIEW");
  ok(
    await write(
      admin,
      "review",
      {
        requestId: id,
        revision: d.request.revision,
        status: "RESPONDED",
        reference: "RETENTION-REVIEW-QA",
        message:
          "Response recorded only. Retention and identity review remain pending; no data erased.",
      },
      true,
    ),
  );
  d = await read(owner, id);
  assert.equal(d.request.status, "RESPONDED");
  assert.equal(d.entries[0].reference, "RETENTION-REVIEW-QA");
  assert.equal(
    (
      await write(owner, "reply", {
        requestId: id,
        revision: d.request.revision,
      })
    ).status,
    400,
  );
  ok(
    await write(owner, "reopen", {
      requestId: id,
      revision: d.request.revision,
    }),
  );
  assert.equal((await read(owner, id)).request.status, "SUBMITTED");
  pass(
    "personal requests stay private from same-organization roles; reviewed referenced responses do not claim erasure",
  );
  d = await read(owner, id);
  const collision = await Promise.all([
    write(owner, "cancel", { requestId: id, revision: d.request.revision }),
    write(
      admin,
      "review",
      { requestId: id, revision: d.request.revision, status: "IN_REVIEW" },
      true,
    ),
  ]);
  assert.deepEqual(collision.map((r) => r.status).sort(), [200, 400]);
  const closeId = ok(
    await write(owner, "create", { kind: "CLOSE_ACCOUNT" }),
  ).requestId;
  d = await read(owner, closeId);
  ok(
    await write(owner, "cancel", {
      requestId: closeId,
      revision: d.request.revision,
    }),
  );
  assert.equal(
    hash(await db.user.findUniqueOrThrow({ where: { id: u.id } })),
    protectedUser,
  );
  assert.equal(
    hash(
      await db.invoice.findMany({
        where: invoiceWhere,
        orderBy: { id: "asc" },
        include: { payments: true },
      }),
    ),
    invoices,
  );
  assert.equal(
    hash(await db.messageEntry.findMany({ orderBy: { id: "asc" } })),
    messages,
  );
  assert.equal(await db.emailOutbox.count(), outboxBefore);
  pass(
    "competing review/withdrawal rejects stale revisions while account, invoices, payments, messages and mail remain unchanged",
  );
  await assert.rejects(
    db.privacyEntry.update({
      where: { id: raw.id },
      data: { encryptedBody: "rewrite" },
    }),
  );
  await assert.rejects(db.privacyEntry.delete({ where: { id: raw.id } }));
  await assert.rejects(
    db.privacyRequest.update({
      where: { id },
      data: { kind: "COPY", revision: { increment: 1 } },
    }),
  );
  await assert.rejects(db.privacyRequest.delete({ where: { id } }));
  const active = await read(owner, copyId);
  for (let n = active.total; n < 33; n++) {
    const current = await read(owner, copyId);
    ok(
      await write(owner, "reply", {
        requestId: copyId,
        revision: current.request.revision,
        message: `Synthetic retained information ${n}`,
      }),
    );
  }
  d = await read(owner, copyId);
  assert.equal(d.entries.length, 30);
  assert.equal(d.total, 33);
  assert.equal(
    (await read(owner, copyId, false, 2)).entries.at(-1).revision,
    1,
  );
  pass(
    "source and encrypted review history immutable, complete totals and history beyond thirty rows",
  );
  for (let n = 0; n < 21; n++) {
    const r = ok(await write(other, "create", { kind: "COPY" }));
    const current = await read(other, r.requestId);
    ok(
      await write(other, "cancel", {
        requestId: r.requestId,
        revision: current.request.revision,
      }),
    );
  }
  assert.equal(ok(await other.call("/api/privacy")).total, 21);
  assert.equal(ok(await other.call("/api/privacy")).rows.length, 20);
  assert.equal(ok(await other.call("/api/privacy?page=2")).rows.length, 1);
  assert.equal(ok(await other.call("/api/privacy?status=CANCELLED")).total, 21);
  assert.ok(
    ok(await admin.call("/api/privacy?platform=1&page=2")).rows.length > 0,
  );
  const oversized = await db.privacyRequest.createMany({
    data: Array.from({ length: 1001 }, () => ({
      requesterId: o.id,
      kind: "CORRECTION",
      status: "CANCELLED",
    })),
  });
  assert.equal(oversized.count, 1001);
  const overLimit = await other.call("/api/privacy?summary=1");
  assert.equal(overLimit.status, 400);
  assert.ok(overLimit.error.includes("Ringkasan melebihi batas unduhan"));
  pass(
    "scoped request queues paginate complete history and summary refuses over-limit rather than truncating",
  );
  await db.user.update({ where: { id: a.id }, data: { platformAdmin: false } });
  assert.equal((await admin.call("/api/privacy?platform=1")).status, 403);
  assert.equal(
    (
      await write(
        admin,
        "reply",
        { requestId: copyId, revision: d.request.revision },
        true,
      )
    ).status,
    400,
  );
  await db.user.update({ where: { id: a.id }, data: { platformAdmin: true } });
  const unverified = client();
  ok(
    await unverified.call("/api/auth", {
      action: "register",
      name: "Unverified privacy QA",
      email: `privacy-pending-${suffix}@example.test`,
      password,
      phone: "081234567890",
    }),
  );
  assert.equal((await unverified.call("/api/privacy?summary=1")).status, 403);
  const browserId = ok(
    await write(owner, "create", {
      kind: "CORRECTION",
      message:
        "Synthetic browser review request: clarify my account data summary without modifying billing history.",
    }),
  ).requestId;
  pass(
    "revoked platform privilege and pending identities cannot access privacy operations",
  );
  await mkdir(".local-secrets", { recursive: true });
  await writeFile(
    ".local-secrets/phase4g-browser.json",
    JSON.stringify({
      base,
      owner: u.email,
      admin: a.email,
      password,
      requestId: browserId,
    }),
  );
  await mkdir("artifacts/phase4g", { recursive: true });
  await writeFile(
    "artifacts/phase4g/privacy-tests.json",
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
