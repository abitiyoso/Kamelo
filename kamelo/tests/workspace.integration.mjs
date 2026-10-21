import assert from "node:assert/strict";
import { PrismaClient } from "../generated/prisma/index.js";
import { randomBytes, scryptSync, createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
const url = new URL(process.env.DATABASE_URL || "http://invalid");
assert.equal(url.hostname, "127.0.0.1");
assert.equal(url.port, "55432");
assert.equal(url.pathname, "/kamelo_phase2_qa");
const base = process.env.TEST_URL || "http://127.0.0.1:3001";
assert.equal(new URL(base).hostname, "127.0.0.1");
await import("../scripts/seed.mjs");
const db = new PrismaClient(),
  password = "Workspace-qa-only-123",
  propertyId = "demo-property-kos",
  organizationId = "demo-org-kos";
const hash = (v) => createHash("sha256").update(v).digest("hex");
try {
  const property = await db.property.findFirstOrThrow({
    where: { organizationId },
    include: {
      rooms: { include: { stays: true } },
      invoices: { include: { payments: true } },
    },
  });
  const users = {};
  for (const role of ["owner", "staff", "admin"]) {
    const salt = randomBytes(16).toString("hex"),
      email = `phase2-${role}@example.test`;
    users[role] = await db.user.upsert({
      where: { email },
      update: {},
      create: {
        organizationId,
        name:
          role === "staff"
            ? "Agus QA"
            : role === "admin"
              ? "Admin QA"
              : "Budi QA",
        email,
        phone: "081200000000",
        password: salt + ":" + scryptSync(password, salt, 64).toString("hex"),
        role: role === "staff" ? "STAFF" : "OWNER",
        platformAdmin: role === "admin",
        propertyIds: role === "staff" ? [property.id] : [],
      },
    });
  }
  const ticket = await db.ticket.create({
    data: {
      propertyId: property.id,
      title: "Periksa AC kamar 01 — uji QA",
      description: "Data sintetis untuk memeriksa alur pekerjaan.",
      assigneeId: users.staff.id,
      createdBy: users.owner.id,
      stayId: property.rooms.find((r) => r.stays.length)?.stays[0].id,
    },
  });
  const invoice = property.invoices.find(
      (i) => i.total > i.payments.reduce((sum, p) => sum + p.amount, 0),
    ),
    stay = await db.stay.findUniqueOrThrow({ where: { id: invoice.stayId } }),
    token = randomBytes(32).toString("hex"),
    stayToken = randomBytes(32).toString("hex");
  await db.tenantLink.create({
    data: {
      invoiceId: invoice.id,
      tokenHash: hash(token),
      expiresAt: new Date(Date.now() + 86400000),
    },
  });
  await db.stayLink.create({
    data: {
      stayId: stay.id,
      tokenHash: hash(stayToken),
      expiresAt: new Date(Date.now() + 86400000),
    },
  });
  async function login(role) {
    const r = await fetch(base + "/api/auth", {
      method: "POST",
      headers: { Origin: base, "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "login",
        email: users[role].email,
        password,
      }),
    });
    assert.equal(r.status, 200);
    return r.headers.get("set-cookie").split(";")[0];
  }
  const owner = await login("owner"),
    staff = await login("staff"),
    admin = await login("admin");
  async function get(path, cookie) {
    return fetch(base + path, { headers: { Cookie: cookie || "" } });
  }
  const state = await (await get("/api/manage", staff)).json(),
    p = state.properties[0];
  assert.deepEqual(p.invoices, []);
  assert.deepEqual(p.pendingProofInvoices, []);
  assert.deepEqual(p.guests, []);
  assert.deepEqual(p.devices, []);
  assert.equal(p.summary, undefined);
  assert.equal(p.rooms[0].rate, 0);
  assert.ok(p.tickets.every((t) => t.assigneeId === users.staff.id));
  assert.deepEqual(state.upgrades, []);
  assert.ok(
    (await (await get("/api/manage", owner)).json()).properties[0].invoices
      .length > 0,
  );
  assert.equal(
    (await get("/api/manage?invoiceId=" + invoice.id, staff)).status,
    403,
  );
  for (const topic of ["briefing", "income", "overdue"]) {
    const r = await fetch(base + "/api/leo", {
      method: "POST",
      headers: {
        Cookie: staff,
        Origin: base,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ propertyId: property.id, topic }),
    });
    assert.equal(r.status, 403);
  }
  assert.equal((await get("/app/billing", staff)).status, 404);
  assert.equal((await get("/app/dashboard", staff)).status, 200);
  assert.equal((await get("/app/residents", owner)).status, 200);
  assert.equal((await get("/admin/organizations", admin)).status, 200);
  assert.ok(
    (await (await get("/admin/organizations", staff)).text()).includes(
      "Akses ditolak",
    ),
  );
  assert.equal(
    (await get("/app/rooms/" + property.rooms[0].id, owner)).status,
    200,
  );
  assert.equal((await get("/app/billing/" + invoice.id, owner)).status, 200);
  await db.orgMembership.updateMany({where:{userId:users.staff.id,organizationId},data:{canRecordPayments:true,canControlDevices:true}});
  try {
    assert.equal((await get("/app/billing/" + invoice.id, staff)).status, 200);
    assert.equal((await get("/app/iot", staff)).status, 200);
  } finally {
    await db.orgMembership.updateMany({where:{userId:users.staff.id,organizationId},data:{canRecordPayments:false,canControlDevices:false}});
  }
  for (const path of ["/api/tenant/" + token, "/api/stay/" + stayToken])
    assert.equal((await get(path)).status, 200);
  await mkdir(".local-secrets", { recursive: true });
  await writeFile(
    ".local-secrets/phase2-browser.json",
    JSON.stringify({
      base,
      owner: users.owner.email,
      staff: users.staff.email,
      admin: users.admin.email,
      password,
      invoiceUrl: "/tenant/" + token,
      stayUrl: "/stay/" + stayToken,
      ticketId: ticket.id,
      propertyId: property.id,
    }),
  );
  console.log(
    "PASS workspace role routes / staff financial redaction / invoice-ID denial / LEO financial guard / assigned tasks / admin guard / tenant link scope. Synthetic browser fixtures saved privately.",
  );
} finally {
  await db.$disconnect();
}
