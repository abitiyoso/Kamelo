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
  password = "Message-QA-only-password-123";
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
      const email = `message-${label}-${suffix}@example.test`;
      ok(
        await this.call("/api/auth", {
          action: "register",
          name: "Message QA " + label,
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
    a = await admin.register("platform");
  const tenant = client(),
    peer = client(),
    staffB = client();
  const t = await tenant.register("tenant"),
    p = await peer.register("peer");
  await db.organization.update({
    where: { id: u.organizationId },
    data: { plan: "plus", subscriptionStatus: "ACTIVE" },
  });
  const property = ok(
    await owner.manage("property", {
      name: "Messages QA Residence",
      type: "KOS",
      count: 3,
      rate: 1000000,
    }),
  );
  const foreign = ok(
    await other.manage("property", {
      name: "Foreign message property",
      type: "KOS",
      count: 1,
      rate: 1000000,
    }),
  );
  const rooms = await db.room.findMany({
    where: { propertyId: property.id },
    orderBy: { number: "asc" },
  });
  const stay = ok(
    await owner.manage("stay", {
      propertyId: property.id,
      roomId: rooms[0].id,
      name: "Message Resident",
      phone: "081234567891",
      start: today,
      rate: 1000000,
      billingDay: 15,
    }),
  );
  const stay2 = ok(
    await owner.manage("stay", {
      propertyId: property.id,
      roomId: rooms[1].id,
      name: "Other Resident",
      phone: "081234567892",
      start: today,
      rate: 1000000,
      billingDay: 15,
    }),
  );
  async function invite(c, user, stayId) {
    const i = ok(
      await owner.call("/api/invitations", {
        action: "create",
        kind: "TENANT",
        email: user.email,
        propertyIds: [property.id],
        stayId,
      }),
    );
    ok(await c.call("/api/invitations", { action: "accept", id: i.id }));
    const ctx = ok(await c.call("/api/account")).contexts.find(
      (r) => r.type === "STAY",
    );
    ok(
      await c.call("/api/account", {
        action: "switch",
        type: "STAY",
        id: ctx.id,
      }),
    );
    return ctx;
  }
  const tenantContext = await invite(tenant, t, stay.id),
    peerContext = await invite(peer, p, stay2.id);
  const staffEmail = `message-staff-${suffix}@example.test`,
    staffBEmail = `message-staff-b-${suffix}@example.test`;
  for (const [c, email, name] of [
    [staff, staffEmail, "Message Staff"],
    [staffB, staffBEmail, "Second Message Staff"],
  ]) {
    ok(
      await staffFixture(db, base, owner.cookie, {
        email,
        password,
        name,
        phone: "081234567893",
        propertyIds: [property.id],
      }),
    );
    ok(await c.call("/api/auth", { action: "login", email, password }));
  }
  const member = await db.orgMembership.findFirstOrThrow({
    where: { organizationId: u.organizationId, user: { email: staffEmail } },
  });
  const memberB = await db.orgMembership.findFirstOrThrow({
    where: { organizationId: u.organizationId, user: { email: staffBEmail } },
  });
  await db.user.update({ where: { id: a.id }, data: { platformAdmin: true } });
  ok(await admin.call("/api/account", { action: "switch", type: "PLATFORM" }));
  const path = `/api/messages?propertyId=${property.id}`;
  const write = (c, action, data = {}) =>
    c.call("/api/messages", {
      action,
      message: "Synthetic QA message",
      confirmed: true,
      key: randomUUID(),
      ...data,
    });
  const read = async (c, id, page = 1) =>
    ok(await c.call(`/api/messages?threadId=${id}&page=${page}`));
  assert.equal((await client().call(path)).status, 401);
  assert.equal((await admin.call(path)).status, 403);
  assert.equal((await other.call(path)).status, 404);
  assert.equal(
    (await staff.call(`/api/messages?propertyId=${foreign.id}`)).status,
    404,
  );
  assert.equal((await staff.call(path + "&recipients=1")).status, 403);
  assert.equal((await tenant.call(path + "&recipients=1")).status, 403);
  assert.equal((await owner.call(path + "&page=0")).status, 400);
  assert.equal(
    (await owner.call("/api/messages", {}, "https://untrusted.example.test"))
      .status,
    403,
  );
  assert.equal(ok(await owner.call(path + "&recipients=1")).total, 2);
  pass(
    "anonymous/platform/organization/property boundaries, private recipients and origin enforcement",
  );
  const outboxBefore = await db.emailOutbox.count();
  const first = {
    action: "start",
    key: randomUUID(),
    message: "Synthetic private text <script>alert(1)</script>",
    confirmed: true,
    stayId: stay2.id,
    residentUserId: p.id,
  };
  const sent = ok(await tenant.call("/api/messages", first)),
    id = sent.threadId;
  assert.equal(ok(await tenant.call("/api/messages", first)).threadId, id);
  assert.equal(
    (await tenant.call("/api/messages", { ...first, message: "Changed retry" }))
      .status,
    400,
  );
  const raw = await db.messageThread.findUniqueOrThrow({ where: { id } });
  assert.equal(raw.stayId, stay.id);
  assert.equal(raw.residentUserId, t.id);
  assert.equal((await peer.call(`/api/messages?threadId=${id}`)).status, 404);
  assert.equal((await staff.call(`/api/messages?threadId=${id}`)).status, 404);
  assert.equal(ok(await staff.call(path)).total, 0);
  assert.equal(
    (await write(tenant, "send", { threadId: id, confirmed: false })).status,
    400,
  );
  const original = await db.messageEntry.findFirstOrThrow({
    where: { threadId: id },
  });
  assert.ok(original.encryptedBody.startsWith("v1."));
  assert.ok(!original.encryptedBody.includes("Synthetic"));
  assert.equal((await read(owner, id)).entries[0].message, first.message);
  assert.ok(!JSON.stringify(await read(owner, id)).includes('actorId"'));
  pass(
    "tenant identity overrides forged recipient, per-stay account privacy, encrypted text and exact retry",
  );
  let d = await read(owner, id);
  ok(
    await write(owner, "assign", {
      threadId: id,
      revision: d.thread.revision,
      assigneeId: member.id,
      message: "Assign the property staff for review",
    }),
  );
  assert.equal(ok(await staff.call(path)).total, 1);
  ok(
    await write(staff, "send", {
      threadId: id,
      message: "Assigned staff reply for the resident",
    }),
  );
  assert.ok(
    (await read(tenant, id)).entries.some(
      (e) => e.message === "Assigned staff reply for the resident",
    ),
  );
  assert.equal(
    (
      await write(staff, "assign", {
        threadId: id,
        revision: (await read(staff, id)).thread.revision,
        assigneeId: memberB.id,
      })
    ).status,
    400,
  );
  d = await read(owner, id);
  ok(
    await write(owner, "assign", {
      threadId: id,
      revision: d.thread.revision,
      assigneeId: memberB.id,
    }),
  );
  assert.equal((await staff.call(`/api/messages?threadId=${id}`)).status, 404);
  assert.equal((await write(staff, "send", { threadId: id })).status, 400);
  assert.equal((await staffB.call(`/api/messages?threadId=${id}`)).status, 200);
  await db.orgMembership.update({
    where: { id: memberB.id },
    data: { propertyIds: [] },
  });
  assert.equal((await staffB.call(path)).status, 404);
  assert.equal((await write(staffB, "send", { threadId: id })).status, 400);
  await db.orgMembership.update({
    where: { id: memberB.id },
    data: { propertyIds: [property.id] },
  });
  pass(
    "owner assignment and reassignment immediately scope staff history/replies and revoked property access",
  );
  const replies = await Promise.all([
    write(owner, "send", {
      threadId: id,
      message: "Concurrent owner reply one",
    }),
    write(tenant, "send", {
      threadId: id,
      message: "Concurrent resident reply two",
    }),
  ]);
  assert.ok(replies.every((r) => r.status === 200));
  d = await read(owner, id);
  const beforeRevision = d.thread.revision;
  const collision = await Promise.all([
    write(owner, "close", { threadId: id, revision: beforeRevision }),
    write(owner, "assign", {
      threadId: id,
      revision: beforeRevision,
      assigneeId: member.id,
    }),
  ]);
  assert.deepEqual(collision.map((r) => r.status).sort(), [200, 400]);
  d = await read(owner, id);
  if (d.thread.status !== "CLOSED")
    ok(
      await write(owner, "close", {
        threadId: id,
        revision: d.thread.revision,
      }),
    );
  assert.equal((await write(tenant, "send", { threadId: id })).status, 400);
  d = await read(tenant, id);
  ok(
    await write(tenant, "reopen", {
      threadId: id,
      revision: d.thread.revision,
    }),
  );
  assert.equal((await read(owner, id)).thread.status, "OPEN");
  pass(
    "concurrent replies both retained while conflicting assignment/status updates reject stale revisions",
  );
  await assert.rejects(
    db.messageEntry.update({
      where: { id: original.id },
      data: { encryptedBody: "tampered" },
    }),
  );
  await assert.rejects(db.messageEntry.delete({ where: { id: original.id } }));
  await assert.rejects(
    db.messageThread.update({
      where: { id },
      data: { residentUserId: p.id, revision: { increment: 1 } },
    }),
  );
  await assert.rejects(db.messageThread.delete({ where: { id } }));
  const audit = await db.audit.findMany({
    where: { targetId: id, action: { startsWith: "MESSAGE_" } },
  });
  assert.equal(audit.length, (await read(owner, id)).thread.revision);
  assert.ok(
    !JSON.stringify(audit.map((r) => r.metadata)).includes("Synthetic"),
  );
  assert.equal(await db.emailOutbox.count(), outboxBefore);
  const forged = await write(owner, "start", {
    stayId: stay2.id,
    residentUserId: t.id,
  });
  assert.equal(forged.status, 400);
  pass(
    "immutable encrypted timeline/source, valid resident grants and metadata-only audit without notifications",
  );
  const peerThread = ok(
    await write(peer, "start", { message: "Private message from second room" }),
  ).threadId;
  assert.equal(
    ok(
      await write(owner, "start", {
        stayId: stay2.id,
        residentUserId: p.id,
        message: "Owner starts a valid existing room conversation",
      }),
    ).threadId,
    peerThread,
  );
  assert.equal(ok(await peer.call("/api/messages")).total, 1);
  assert.equal(
    (await tenant.call(`/api/messages?threadId=${peerThread}`)).status,
    404,
  );
  const grant = await db.occupantAccess.findFirstOrThrow({
    where: { userId: t.id, stayId: stay.id },
  });
  await db.occupantAccess.update({
    where: { id: grant.id },
    data: { status: "REVOKED", revokedAt: new Date() },
  });
  assert.equal((await tenant.call(`/api/messages?threadId=${id}`)).status, 403);
  assert.equal((await write(tenant, "send", { threadId: id })).status, 400);
  await db.occupantAccess.update({
    where: { id: grant.id },
    data: { status: "ACTIVE", revokedAt: null },
  });
  for (let i = 0; i < 32; i++)
    ok(
      await write(owner, "send", {
        threadId: id,
        message: `Pagination retained message ${i}`,
      }),
    );
  d = await read(owner, id);
  assert.equal(d.entries.length, 30);
  assert.ok(d.total > 30);
  assert.ok((await read(owner, id, 2)).entries.length > 0);
  assert.equal(ok(await owner.call(path)).total, 2);
  pass(
    "room-to-room privacy, revoked resident grants and all-history paginated message totals",
  );
  const invoice = ok(
    await owner.manage("invoice", {
      propertyId: property.id,
      stayId: stay.id,
      date: today,
      due: today,
      items: [{ label: "Preservation QA rent", amount: 1000000 }],
    }),
  );
  const beforeInvoice = hash(
    await db.invoice.findUniqueOrThrow({
      where: { id: invoice.id },
      include: { payments: true },
    }),
  );
  ok(
    await write(owner, "send", {
      threadId: id,
      message: "A message must not change resident billing",
    }),
  );
  assert.equal(
    hash(
      await db.invoice.findUniqueOrThrow({
        where: { id: invoice.id },
        include: { payments: true },
      }),
    ),
    beforeInvoice,
  );
  ok(
    await owner.manage("transition", {
      propertyId: property.id,
      stayId: stay.id,
      status: "CHECKED_OUT",
    }),
  );
  assert.equal((await read(tenant, id)).active, false);
  assert.equal((await write(tenant, "send", { threadId: id })).status, 400);
  assert.equal((await write(owner, "send", { threadId: id })).status, 400);
  assert.ok((await read(owner, id)).entries.length > 0);
  assert.equal((await write(tenant, "start")).status, 400);
  const frozen = await read(owner, id);
  ok(
    await write(owner, "close", {
      threadId: id,
      revision: frozen.thread.revision,
    }),
  );
  assert.equal(
    (
      await write(tenant, "reopen", {
        threadId: id,
        revision: (await read(tenant, id)).thread.revision,
      })
    ).status,
    400,
  );
  pass(
    "messages preserve real synthetic invoices and checkout freezes sending while retaining authorized history",
  );
  // Leave the second active resident conversation for browser acceptance.
  d = await read(owner, peerThread);
  ok(
    await write(owner, "assign", {
      threadId: peerThread,
      revision: d.thread.revision,
      assigneeId: member.id,
      message: "Assign active QA room for browser review",
    }),
  );
  assert.equal(
    (await client().call(`/api/messages?threadId=${peerThread}`)).status,
    401,
  );
  const plain = JSON.stringify(await read(peer, peerThread));
  assert.ok(!plain.includes("encryptedBody"));
  assert.ok(!plain.includes('actorId"'));
  assert.ok(!plain.includes(t.email));
  pass(
    "temporary or anonymous links cannot become conversation access and response projections omit private identities",
  );
  await mkdir(".local-secrets", { recursive: true });
  await writeFile(
    ".local-secrets/phase4f-browser.json",
    JSON.stringify({
      base,
      owner: u.email,
      tenant: p.email,
      staff: staffEmail,
      password,
      propertyId: property.id,
      threadId: peerThread,
      tenantContext: peerContext.id,
      endedTenant: t.email,
      endedTenantContext: tenantContext.id,
    }),
  );
  await mkdir("artifacts/phase4f", { recursive: true });
  await writeFile(
    "artifacts/phase4f/messages-tests.json",
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
