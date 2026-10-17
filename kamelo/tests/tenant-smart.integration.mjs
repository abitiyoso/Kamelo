import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { PrismaClient } from "../generated/prisma/index.js";
const db = new PrismaClient(),
  base = process.env.TEST_URL || "http://127.0.0.1:3000";
const today = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Jakarta",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());
const shift = (days) =>
  new Date(Date.parse(today + "T00:00:00Z") + days * 86400000)
    .toISOString()
    .slice(0, 10);
const suffix = Date.now();
function client() {
  let cookie = "";
  return {
    get cookie() {
      return cookie;
    },
    async auth(action, data) {
      const r = await fetch(base + "/api/auth", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: base,
          Cookie: cookie,
        },
        body: JSON.stringify({ action, ...data }),
      });
      const c = r.headers.get("set-cookie");
      if (c) cookie = c.split(";")[0];
      return { status: r.status, ...(await r.json()) };
    },
    async write(action, data = {}) {
      const r = await fetch(base + "/api/manage", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: base,
          Cookie: cookie,
        },
        body: JSON.stringify({ action, ...data }),
      });
      return { status: r.status, ...(await r.json()) };
    },
    async get(query = "") {
      const r = await fetch(base + "/api/manage" + query, {
        headers: { Cookie: cookie },
      });
      return { status: r.status, ...(await r.json()) };
    },
  };
}
const owner = client(),
  other = client(),
  staff = client();
async function good(promise) {
  const result = await promise;
  assert.equal(result.status, 200, JSON.stringify(result));
  return result.result;
}
const tokenOf = (url) => new URL(url).pathname.split("/").pop();
async function portal(token) {
  const r = await fetch(base + "/api/tenant/" + token);
  return { status: r.status, ...(await r.json()) };
}
async function upload(
  token,
  amount = 400000,
  bytes = Buffer.from("%PDF-1.7\nSynthetic payment proof\n%%EOF"),
  mime = "application/pdf",
) {
  const form = new FormData();
  form.set("file", new Blob([bytes], { type: mime }), "synthetic-proof.pdf");
  form.set("amount", String(amount));
  form.set("date", today);
  form.set("method", "TRANSFER");
  form.set("reference", "Synthetic test only");
  const r = await fetch(base + "/api/tenant/" + token + "/proof", {
    method: "POST",
    headers: { Origin: base },
    body: form,
  });
  return { status: r.status, ...(await r.json()) };
}
try {
  for (const [c, label] of [
    [owner, "owner"],
    [other, "other"],
  ])
    assert.equal(
      (
        await c.auth("register", {
          email: `kamelo-${label}-${suffix}@example.test`,
          password: "Local-test-password-123",
          name: "Kamelo QA " + label,
          phone: "081234567890",
        })
      ).status,
      200,
    );
  const property = await good(
      owner.write("property", {
        name: "Kamelo QA Kos",
        type: "KOS",
        count: 3,
        rate: 1500000,
      }),
    ),
    propertyId = property.id;
  let state = await owner.get();
  const rooms = state.properties[0].rooms;
  const stay = await good(
    owner.write("stay", {
      propertyId,
      roomId: rooms[0].id,
      name: "Tenant QA A",
      phone: "081234567890",
      start: shift(-60),
      rate: 1500000,
      billingDay: 5,
    }),
  );
  const second = await good(
    owner.write("stay", {
      propertyId,
      roomId: rooms[1].id,
      name: "Tenant QA B",
      phone: "081234567891",
      start: shift(-60),
      rate: 1200000,
      billingDay: 20,
    }),
  );
  const invoice = await good(
    owner.write("invoice", {
      propertyId,
      stayId: stay.id,
      due: shift(-2),
      items: [{ label: "Sewa uji", amount: 1500000 }],
    }),
  );
  const invoiceB = await good(
    owner.write("invoice", {
      propertyId,
      stayId: second.id,
      due: shift(5),
      items: [{ label: "Sewa uji B", amount: 1200000 }],
    }),
  );
  await good(
    owner.write("tenantSettings", {
      propertyId,
      stayId: stay.id,
      name: "Tenant QA A",
      phone: "081234567890",
      rate: 1600000,
      billingDay: 31,
    }),
  );
  assert.equal(
    (await db.invoice.findUnique({ where: { id: invoice.id } })).due,
    shift(-2),
  );
  assert.equal(
    (await db.stay.findUnique({ where: { id: stay.id } })).billingDay,
    31,
  );
  const orgId = (await db.property.findUnique({ where: { id: propertyId } }))
    .organizationId;
  await db.organization.update({
    where: { id: orgId },
    data: { plan: "plus", subscriptionStatus: "ACTIVE" },
  });
  const nextMonth = new Date(
    Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)), 1),
  )
    .toISOString()
    .slice(0, 7);
  const recurring = await good(
    owner.write("recurring", {
      propertyId,
      stayId: stay.id,
      period: nextMonth,
      due: today,
      items: [{ label: "ignored", amount: 1 }],
    }),
  );
  const lastDay = new Date(
    Date.UTC(Number(nextMonth.slice(0, 4)), Number(nextMonth.slice(5, 7)), 0),
  ).getUTCDate();
  assert.equal(
    recurring.due,
    nextMonth + "-" + String(lastDay).padStart(2, "0"),
  );
  assert.equal(recurring.total, 1600000);
  console.log(
    "PASS tenant-specific due dates / edited future recurring invoices / issued invoices preserved",
  );
  let link = await good(
      owner.write("tenantLink", { propertyId, invoiceId: invoice.id }),
    ),
    token = tokenOf(link.url);
  const stored = await db.tenantLink.findFirst({
    where: { invoiceId: invoice.id, revokedAt: null },
  });
  assert.equal(
    stored.tokenHash,
    createHash("sha256").update(token).digest("hex"),
  );
  assert.notEqual(stored.tokenHash, token);
  assert.equal((await portal("a".repeat(64))).status, 403);
  assert.equal((await portal(token)).invoice.balance, 1500000);
  assert.equal(
    (await other.write("tenantLink", { propertyId, invoiceId: invoice.id }))
      .status,
    400,
  );
  await db.tenantLink.update({
    where: { id: stored.id },
    data: { expiresAt: new Date(0) },
  });
  assert.equal((await portal(token)).status, 403);
  link = await good(
    owner.write("tenantLink", { propertyId, invoiceId: invoice.id }),
  );
  token = tokenOf(link.url);
  const malicious = await upload(
    token,
    1,
    Buffer.from("<script>alert(1)</script>"),
    "application/pdf",
  );
  assert.equal(malicious.status, 400);
  assert.equal(
    (await upload(token, 1, Buffer.alloc(5 * 1024 * 1024 + 1), "image/png"))
      .status,
    400,
  );
  const uploaded = await upload(token);
  assert.equal(uploaded.status, 200, JSON.stringify(uploaded));
  const proofId = uploaded.result?.id || uploaded.id;
  assert.ok(proofId);
  assert.equal((await portal(token)).invoice.balance, 1500000);
  assert.equal((await upload(token)).status, 400);
  state = await owner.get();
  assert.equal(
    state.properties[0].pendingProofInvoices[0].proofs[0].status,
    "PENDING",
  );
  assert.ok(!JSON.stringify(state).includes("storageKey"));
  assert.ok(!JSON.stringify(state).includes("tokenHash"));
  assert.equal((await fetch(base + "/api/proofs/" + proofId)).status, 403);
  assert.equal(
    (await fetch(base + "/api/proofs/" + proofId + "?token=" + token)).status,
    200,
  );
  assert.equal(
    (
      await fetch(base + "/api/proofs/" + proofId, {
        headers: { Cookie: other.cookie },
      })
    ).status,
    403,
  );
  const tokenB = tokenOf(
    (
      await good(
        owner.write("tenantLink", { propertyId, invoiceId: invoiceB.id }),
      )
    ).url,
  );
  assert.equal(
    (await fetch(base + "/api/proofs/" + proofId + "?token=" + tokenB)).status,
    403,
  );
  assert.equal(
    (
      await owner.write("reviewProof", {
        propertyId,
        proofId,
        decision: "APPROVE",
      })
    ).status,
    400,
  );
  await good(
    owner.write("teamAdd", {
      name: "QA staff",
      email: `kamelo-staff-${suffix}@example.test`,
      phone: "081234567893",
      password: "Local-test-password-123",
      propertyIds: [propertyId],
      canRecordPayments: false,
      canControlDevices: false,
    }),
  );
  assert.equal(
    (
      await staff.auth("login", {
        email: `kamelo-staff-${suffix}@example.test`,
        password: "Local-test-password-123",
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await staff.write("reviewProof", {
        propertyId,
        proofId,
        decision: "APPROVE",
        confirmed: true,
      })
    ).status,
    400,
  );
  await good(
    owner.write("reviewProof", {
      propertyId,
      proofId,
      decision: "APPROVE",
      confirmed: true,
    }),
  );
  await good(
    owner.write("reviewProof", {
      propertyId,
      proofId,
      decision: "APPROVE",
      confirmed: true,
    }),
  );
  assert.equal(await db.payment.count({ where: { invoiceId: invoice.id } }), 1);
  assert.equal((await portal(token)).invoice.balance, 1100000);
  const rejected = await upload(
    token,
    100000,
    Buffer.from("%PDF-1.7\nRejected proof fixture\n%%EOF"),
  );
  assert.equal(rejected.status, 200);
  const rejectedId = rejected.result?.id || rejected.id;
  await good(
    owner.write("reviewProof", {
      propertyId,
      proofId: rejectedId,
      decision: "REJECT",
      reviewNote: "Nominal belum diterima",
    }),
  );
  assert.equal((await portal(token)).invoice.balance, 1100000);
  assert.equal(
    (
      await upload(
        token,
        100000,
        Buffer.from("%PDF-1.7\nRejected proof fixture\n%%EOF"),
      )
    ).status,
    200,
  );
  const old = token;
  token = tokenOf(
    (
      await good(
        owner.write("tenantLink", { propertyId, invoiceId: invoice.id }),
      )
    ).url,
  );
  assert.equal((await portal(old)).status, 403);
  console.log(
    "PASS private hashed/expiring/rotating links / scoped private files / proof validation / manual approval / no duplicate payment",
  );
  const lock = await good(
    owner.write("mockLock", {
      propertyId,
      roomId: rooms[0].id,
      name: "Kunci QA simulasi",
    }),
  );
  const active = await portal(token);
  assert.equal(active.access.status, "ACTIVE");
  assert.match(active.access.pin, /^\d{6}$/);
  const encrypted = (
    await db.smartAccess.findFirst({ where: { deviceId: lock.id } })
  ).encryptedPin;
  assert.notEqual(encrypted, active.access.pin);
  assert.ok(!encrypted.includes(active.access.pin));
  state = await owner.get();
  assert.ok(!JSON.stringify(state).includes("encryptedPin"));
  assert.ok(!JSON.stringify(state).includes('"pin"'));
  const staffToken = tokenOf(
    (
      await good(
        staff.write("tenantLink", { propertyId, invoiceId: invoice.id }),
      )
    ).url,
  );
  assert.equal((await portal(staffToken)).access, null);
  token = tokenOf(
    (
      await good(
        owner.write("tenantLink", { propertyId, invoiceId: invoice.id }),
      )
    ).url,
  );
  assert.equal(
    (
      await owner.write("device", {
        propertyId,
        deviceId: lock.id,
        command: { code: "access_active", value: false },
      })
    ).status,
    400,
  );
  await db.device.update({ where: { id: lock.id }, data: { online: false } });
  await good(owner.write("syncAccess", { propertyId, deviceId: lock.id }));
  const offline = await portal(token);
  assert.equal(offline.access.status, "PENDING");
  assert.equal(offline.access.pin, undefined);
  await db.device.update({ where: { id: lock.id }, data: { online: true } });
  await good(owner.write("syncAccess", { propertyId, deviceId: lock.id }));
  assert.equal((await portal(token)).access.status, "ACTIVE");
  await good(
    owner.write("automation", {
      propertyId,
      deviceId: lock.id,
      enabled: false,
    }),
  );
  assert.equal((await portal(token)).access.status, "REVOKED");
  await good(
    owner.write("automation", { propertyId, deviceId: lock.id, enabled: true }),
  );
  assert.equal((await portal(token)).access.status, "ACTIVE");
  assert.equal((await portal(token)).invoice.balance, 1100000); // Unpaid balance never disables access.
  await good(
    owner.write("mapDevice", {
      propertyId,
      deviceId: lock.id,
      roomId: rooms[1].id,
    }),
  );
  assert.equal((await portal(token)).access.pin, undefined);
  assert.equal((await portal(tokenB)).access.status, "ACTIVE");
  await good(
    owner.write("transition", {
      propertyId,
      stayId: second.id,
      status: "CHECKED_OUT",
    }),
  );
  assert.equal((await portal(tokenB)).access.status, "REVOKED");
  const future = await good(
    owner.write("stay", {
      propertyId,
      roomId: rooms[2].id,
      name: "Tenant future",
      phone: "081234567892",
      start: shift(5),
      rate: 900000,
      billingDay: 10,
    }),
  );
  const futureLock = await good(
    owner.write("mockLock", {
      propertyId,
      roomId: rooms[2].id,
      name: "Kunci future simulasi",
    }),
  );
  assert.equal(
    (
      await db.smartAccess.findFirst({
        where: { deviceId: futureLock.id, stayId: future.id },
      })
    ).status,
    "SCHEDULED",
  );
  const audits = JSON.stringify(
    await db.audit.findMany({ where: { organizationId: orgId } }),
  );
  assert.ok(!audits.includes(active.access.pin));
  console.log(
    "PASS automatic simulated access / encrypted PIN / date gate / offline pending / permissions / disable / remap / checkout / unpaid balance independent",
  );
  const previousStart = new Date(
    Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 2, 1),
  )
    .toISOString()
    .slice(0, 10);
  const previousPayment = await db.payment.create({
    data: {
      invoiceId: invoiceB.id,
      amount: 200000,
      date: previousStart,
      method: "TRANSFER",
      actorId: "qa-fixture",
    },
  });
  const oldInvoice = await db.invoice.create({
    data: {
      propertyId,
      roomId: rooms[0].id,
      guestId: stay.guestId,
      stayId: stay.id,
      number: "OLD-QA-" + suffix,
      date: shift(-70),
      due: shift(-60),
      total: 300000,
      items: [{ label: "Old invoice", amount: 300000 }],
    },
  });
  const fillers = Array.from({ length: 52 }, (_, i) => ({
    propertyId,
    roomId: rooms[0].id,
    guestId: stay.guestId,
    stayId: stay.id,
    number: `PAGE-QA-${suffix}-${i}`,
    date: today,
    due: shift(10),
    total: 1000,
    status: "DRAFT",
    items: [{ label: "QA draft", amount: 1000 }],
  }));
  await db.invoice.createMany({ data: fillers });
  state = await owner.get();
  const metrics = state.properties[0].summary;
  assert.equal(metrics.previousMonthIncome, 200000);
  assert.equal(metrics.income, 400000);
  assert.equal(metrics.incomeChangePercent, 100);
  assert.equal(metrics.overdueBalance, 1400000);
  assert.equal(metrics.overdueCount, 2);
  const overdue = await owner.get("?filter=OVERDUE");
  assert.equal(overdue.properties[0].summary.invoiceCount, 2);
  assert.ok(overdue.properties[0].invoices.some((i) => i.id === oldInvoice.id));
  assert.ok(
    state.properties[0].pendingProofInvoices.some((i) => i.id === invoice.id),
  );
  assert.equal(state.properties[0].invoices.length, 50);
  await db.payment.update({
    where: { id: previousPayment.id },
    data: { amount: 800000 },
  });
  const falling = (await owner.get()).properties[0].summary;
  assert.equal(falling.incomeDirection, "down");
  assert.equal(falling.incomeChangePercent, -50);
  await db.payment.update({
    where: { id: previousPayment.id },
    data: { amount: 200000, date: "2000-01-01" },
  });
  const zeroBase = (await owner.get()).properties[0].summary;
  assert.equal(zeroBase.incomeDirection, "up");
  assert.equal(zeroBase.incomeChangePercent, null);
  await db.payment.update({
    where: { id: previousPayment.id },
    data: { date: previousStart },
  });
  console.log(
    "PASS same-period trend / all-history overdue totals / old overdue filter / pending proof queue beyond first page",
  );
  const concurrentA = await upload(
    tokenB,
    700000,
    Buffer.from("%PDF-1.7\nConcurrent proof A\n%%EOF"),
  );
  const concurrentB = await upload(
    tokenB,
    700000,
    Buffer.from("%PDF-1.7\nConcurrent proof B\n%%EOF"),
  );
  assert.equal(concurrentA.status, 200);
  assert.equal(concurrentB.status, 200);
  const decisions = await Promise.all(
    [concurrentA, concurrentB].map((p) =>
      owner.write("reviewProof", {
        propertyId,
        proofId: p.result?.id || p.id,
        decision: "APPROVE",
        confirmed: true,
      }),
    ),
  );
  assert.deepEqual(decisions.map((d) => d.status).sort(), [200, 400]);
  assert.equal((await portal(tokenB)).invoice.balance, 300000);
  console.log("PASS concurrent proof approval prevents overpayment");
  const hotel = await good(
    other.write("property", {
      name: "Kamelo QA Hotel",
      type: "HOTEL",
      count: 2,
      rate: 350000,
    }),
  );
  const hotelState = await other.get(),
    hotelRoom = hotelState.properties[0].rooms[0];
  assert.equal(hotelState.properties[0].summary.incomeDirection, "flat");
  assert.equal(hotelState.properties[0].summary.incomeChangePercent, 0);
  const booking = await good(
    other.write("stay", {
      propertyId: hotel.id,
      roomId: hotelRoom.id,
      name: "Hotel QA Guest",
      phone: "081234567894",
      start: today,
      end: shift(2),
      rate: 350000,
    }),
  );
  const hotelInvoice = await good(
    other.write("invoice", {
      propertyId: hotel.id,
      stayId: booking.id,
      due: today,
      items: [{ label: "Dua malam uji", amount: 700000 }],
    }),
  );
  const hotelToken = tokenOf(
    (
      await good(
        other.write("tenantLink", {
          propertyId: hotel.id,
          invoiceId: hotelInvoice.id,
        }),
      )
    ).url,
  );
  const hotelLock = await good(
    other.write("mockLock", {
      propertyId: hotel.id,
      roomId: hotelRoom.id,
      name: "Kunci hotel QA",
    }),
  );
  assert.equal(
    (await db.smartAccess.findFirst({ where: { deviceId: hotelLock.id } }))
      .status,
    "SCHEDULED",
  );
  assert.equal((await portal(hotelToken)).access.pin, undefined);
  await good(
    other.write("transition", {
      propertyId: hotel.id,
      stayId: booking.id,
      status: "CHECKED_IN",
    }),
  );
  assert.equal((await portal(hotelToken)).access.status, "ACTIVE");
  await db.device.update({
    where: { id: hotelLock.id },
    data: { online: false },
  });
  await good(
    other.write("transition", {
      propertyId: hotel.id,
      stayId: booking.id,
      status: "CHECKED_OUT",
    }),
  );
  const pendingRevocation = await portal(hotelToken);
  assert.equal(pendingRevocation.access.status, "PENDING");
  assert.equal(pendingRevocation.access.pin, undefined);
  assert.ok(
    (await db.smartAccess.findFirst({ where: { deviceId: hotelLock.id } }))
      .revokedAt,
  );
  await db.device.update({
    where: { id: hotelLock.id },
    data: { online: true },
  });
  await good(
    other.write("syncAccess", { propertyId: hotel.id, deviceId: hotelLock.id }),
  );
  assert.equal((await portal(hotelToken)).access.status, "REVOKED");
  console.log(
    "PASS hotel access requires check-in / offline checkout hides PIN until revocation confirmed",
  );
  await writeFile(
    "artifacts/tenant-smart-verification.json",
    JSON.stringify(
      {
        verifiedAt: new Date().toISOString(),
        status: "PASS",
        groups: 6,
        invoiceId: invoice.id,
        propertyId,
        simulation: true,
      },
      null,
      2,
    ),
  );
} finally {
  await db.$disconnect();
}
