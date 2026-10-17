import assert from "node:assert/strict";
import { PrismaClient } from "../generated/prisma/index.js";
const db = new PrismaClient();
const base = process.env.TEST_URL ?? "http://127.0.0.1:3000";
const suffix = Date.now();
const today = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Jakarta",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());
function client() {
  let cookie = "";
  return {
    async auth(action, data = {}) {
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
    async get(query = "") {
      const r = await fetch(base + "/api/manage" + query, {
        headers: { Cookie: cookie },
      });
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
    get cookie() {
      return cookie;
    },
  };
}
const a = client(),
  b = client(),
  staff = client(),
  email = `integration-${suffix}@example.test`,
  emailB = `integration-b-${suffix}@example.test`,
  emailStaff = `integration-staff-${suffix}@example.test`;
try {
  assert.equal((await fetch(base + "/")).status, 200);
  assert.equal((await fetch(base + "/demo")).status, 200);
  assert.equal((await client().get()).status, 401);
  console.log("PASS public pages / unauthorized API");
  assert.equal(
    (
      await a.auth("register", {
        email,
        password: "Local-test-password-123",
        name: "Test Kos Owner",
        phone: "081234567890",
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await b.auth("register", {
        email: emailB,
        password: "Local-test-password-123",
        name: "Test Hotel Owner",
        phone: "081234567891",
      })
    ).status,
    200,
  );
  const bad = await a.write("property", {
    name: "Too many rooms",
    type: "KOS",
    count: 6,
    rate: 1500000,
  });
  assert.equal(bad.status, 400);
  assert.equal((await a.get()).properties.length, 0);
  const p = await a.write("property", {
    name: "Integration Kos",
    type: "KOS",
    count: 5,
    rate: 1500000,
  });
  assert.equal(p.status, 200);
  const propertyId = p.result.id;
  let state = await a.get();
  assert.equal(state.properties[0].rooms.length, 5);
  const roomId = state.properties[0].rooms[0].id;
  console.log("PASS registration / atomic free-plan onboarding");
  assert.equal(
    (await a.write("room", { propertyId, number: "06", rate: 1500000 })).status,
    400,
  );
  assert.equal(
    (
      await b.write("roomUpdate", {
        propertyId,
        roomId,
        number: "hack",
        rate: 1,
        operational: "READY",
      })
    ).status,
    400,
  );
  console.log("PASS room limits / organization isolation");
  const stay = await a.write("stay", {
    propertyId,
    roomId,
    name: "Penghuni Simulasi",
    phone: "081234567890",
    start: today,
    rate: 1500000,
    billingDay: 31,
  });
  assert.equal(stay.status, 200);
  assert.equal(
    (
      await a.write("stay", {
        propertyId,
        roomId,
        name: "Bentrok",
        phone: "081234567890",
        start: today,
        rate: 1500000,
      })
    ).status,
    400,
  );
  const stayId = stay.result.id;
  const invoice = await a.write("invoice", {
    propertyId,
    stayId,
    due: today,
    items: [
      { label: "Sewa", amount: 1500000 },
      { label: "Diskon", amount: -50000 },
    ],
  });
  assert.equal(invoice.status, 200);
  assert.equal(invoice.result.total, 1450000);
  const invoiceId = invoice.result.id;
  assert.equal(
    (
      await a.write("payment", {
        propertyId,
        invoiceId,
        amount: 500000,
        date: today,
        method: "TRANSFER",
        confirmed: false,
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await a.write("payment", {
        propertyId,
        invoiceId,
        amount: 500000,
        date: today,
        method: "TRANSFER",
        confirmed: true,
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await a.write("payment", {
        propertyId,
        invoiceId,
        amount: 1000000,
        date: today,
        method: "CASH",
        confirmed: true,
      })
    ).status,
    400,
  );
  const concurrent = await Promise.all([
    a.write("payment", {
      propertyId,
      invoiceId,
      amount: 950000,
      date: today,
      method: "CASH",
      confirmed: true,
    }),
    a.write("payment", {
      propertyId,
      invoiceId,
      amount: 950000,
      date: today,
      method: "CASH",
      confirmed: true,
    }),
  ]);
  assert.equal(concurrent.filter((r) => r.status === 200).length, 1);
  state = await a.get();
  assert.equal(
    state.properties[0].invoices
      .find((i) => i.id === invoiceId)
      .payments.reduce((s, p) => s + p.amount, 0),
    1450000,
  );
  assert.equal(state.properties[0].summary.income, 1450000);
  assert.equal(state.properties[0].summary.outstanding, 0);
  console.log(
    "PASS occupancy / invoice discounts / partial payment / concurrent overpayment / dashboard aggregation",
  );
  const draft = await a.write("invoice", {
    propertyId,
    stayId,
    due: today,
    draft: true,
    items: [{ label: "Draft charge", amount: 100 }],
  });
  assert.equal(draft.status, 200);
  assert.equal((await a.get()).properties[0].summary.outstanding, 0);
  assert.equal(
    (
      await a.write("payment", {
        propertyId,
        invoiceId: draft.result.id,
        amount: 100,
        date: today,
        method: "CASH",
        confirmed: true,
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await a.write("draftEdit", {
        propertyId,
        invoiceId: draft.result.id,
        due: today,
        items: [{ label: "Revised charge", amount: 200 }],
      })
    ).status,
    200,
  );
  assert.equal(
    (await a.write("issue", { propertyId, invoiceId: draft.result.id })).status,
    200,
  );
  assert.equal(
    (
      await a.write("draftEdit", {
        propertyId,
        invoiceId: draft.result.id,
        due: today,
        items: [{ label: "Illegal edit", amount: 1 }],
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await a.write("void", {
        propertyId,
        invoiceId: draft.result.id,
        reason: "Test correction",
      })
    ).status,
    200,
  );
  assert.equal((await a.get()).properties[0].summary.outstanding, 0);
  console.log("PASS draft / issue / issued immutability / audited void");
  assert.equal(
    (
      await a.write("recurring", {
        propertyId,
        stayId,
        due: today,
        period: today.slice(0, 7),
        items: [{ label: "Sewa", amount: 1 }],
      })
    ).status,
    400,
  );
  const upgrade = await a.write("upgrade", { plan: "starter" });
  assert.equal(upgrade.status, 200);
  assert.equal(
    (await a.write("activate", { requestId: upgrade.result.id })).status,
    400,
  );
  await db.user.update({
    where: { email: emailB },
    data: { platformAdmin: true },
  });
  assert.equal(
    (await b.write("activate", { requestId: upgrade.result.id })).status,
    200,
  );
  for (let i = 6; i <= 20; i++)
    assert.equal(
      (
        await a.write("room", {
          propertyId,
          number: String(i).padStart(2, "0"),
          rate: 1500000,
        })
      ).status,
      200,
    );
  assert.equal(
    (await a.write("room", { propertyId, number: "21", rate: 1500000 })).status,
    400,
  );
  const recurringData = {
    propertyId,
    stayId,
    due: today,
    period: today.slice(0, 7),
    items: [{ label: "Sewa", amount: 1 }],
  };
  const recurring = await Promise.all([
    a.write("recurring", recurringData),
    a.write("recurring", recurringData),
  ]);
  assert.equal(recurring[0].status, 200);
  assert.equal(recurring[1].status, 200);
  assert.equal(recurring[0].result.id, recurring[1].result.id);
  console.log(
    "PASS upgrade authorization / Starter 20-room limit / recurring idempotency",
  );
  const hp = await b.write("property", {
    name: "Integration Hotel",
    type: "HOTEL",
    count: 3,
    rate: 350000,
  });
  assert.equal(hp.status, 200);
  const hotelId = hp.result.id;
  const hotelRoom = (await b.get()).properties[0].rooms[0].id;
  const next = new Date(today + "T00:00:00Z");
  next.setUTCDate(next.getUTCDate() + 2);
  const end = next.toISOString().slice(0, 10);
  const bookingData = {
    propertyId: hotelId,
    roomId: hotelRoom,
    name: "Tamu Simulasi",
    phone: "081234567891",
    start: today,
    end,
    rate: 350000,
  };
  const bookings = await Promise.all([
    b.write("stay", bookingData),
    b.write("stay", bookingData),
  ]);
  assert.equal(bookings.filter((r) => r.status === 200).length, 1);
  const booking = bookings.find((r) => r.status === 200);
  assert.equal(
    (
      await b.write("transition", {
        propertyId: hotelId,
        stayId: booking.result.id,
        status: "CHECKED_IN",
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await b.write("transition", {
        propertyId: hotelId,
        stayId: booking.result.id,
        status: "CHECKED_OUT",
      })
    ).status,
    200,
  );
  assert.equal(
    (await b.get()).properties[0].rooms.find((r) => r.id === hotelRoom)
      .operational,
    "CLEANING",
  );
  console.log(
    "PASS concurrent hotel conflicts / check-in / checkout readiness",
  );
  const device = await a.write("mockDevice", { propertyId });
  assert.equal(device.status, 200);
  const deviceId = device.result.id;
  assert.equal(
    (await a.write("mapDevice", { propertyId, deviceId, roomId: hotelRoom }))
      .status,
    400,
  );
  assert.equal(
    (await a.write("mapDevice", { propertyId, deviceId, roomId })).status,
    200,
  );
  assert.equal(
    (
      await a.write("device", {
        propertyId,
        deviceId,
        command: { code: "unlock", value: true },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await a.write("device", {
        propertyId,
        deviceId,
        command: { code: "power", value: true },
      })
    ).status,
    200,
  );
  const owner = await db.user.findUniqueOrThrow({ where: { email } });
  assert.equal(
    await db.audit.count({
      where: {
        organizationId: owner.organizationId,
        action: "MOCK_COMMAND_CONFIRMED",
      },
    }),
    1,
  );
  console.log(
    "PASS mock capabilities / mapping isolation / command confirmation audit",
  );
  const staffResult = await a.write("teamAdd", {
    name: "Test Staff",
    email: emailStaff,
    phone: "081234567892",
    password: "Local-test-password-123",
    propertyIds: [propertyId],
  });
  assert.equal(staffResult.status, 200);
  assert.equal(
    (
      await a.write("teamAdd", {
        name: "Over limit",
        email: "excess-" + emailStaff,
        phone: "081234567893",
        password: "Local-test-password-123",
        propertyIds: [propertyId],
      })
    ).status,
    400,
  );
  await staff.auth("login", {
    email: emailStaff,
    password: "Local-test-password-123",
  });
  assert.equal((await staff.get()).properties.length, 1);
  assert.equal(
    (await staff.write("room", { propertyId, number: "21", rate: 1 })).status,
    400,
  );
  assert.equal(
    (
      await staff.write("device", {
        propertyId,
        deviceId,
        command: { code: "power", value: false },
      })
    ).status,
    400,
  );
  const plus = await a.write("upgrade", { plan: "plus" });
  assert.equal(
    (await b.write("activate", { requestId: plus.result.id })).status,
    200,
  );
  const secondProperty = await a.write("property", {
    name: "Second Assigned Property",
    type: "KOS",
    count: 1,
    rate: 100,
  });
  assert.equal(secondProperty.status, 200);
  const secondId = secondProperty.result.id;
  const secondRoom = (await a.get()).properties.find((p) => p.id === secondId)
    .rooms[0].id;
  await a.write("teamAssign", {
    userId: staffResult.result.id,
    propertyIds: [propertyId, secondId],
  });
  await staff.auth("login", {
    email: emailStaff,
    password: "Local-test-password-123",
  });
  assert.equal(
    (
      await staff.write("roomReadiness", {
        propertyId: secondId,
        roomId: secondRoom,
        operational: "CLEANING",
        rate: 1,
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await staff.write("roomReadiness", {
        propertyId: secondId,
        roomId: secondRoom,
        operational: "READY",
      })
    ).status,
    200,
  );
  assert.equal(
    (await staff.get()).properties.find((p) => p.id === secondId).rooms[0].rate,
    100,
  );
  assert.equal(
    (
      await staff.write("roomReadiness", {
        propertyId: hotelId,
        roomId: hotelRoom,
        operational: "READY",
      })
    ).status,
    400,
  );
  console.log(
    "PASS assigned staff room readiness preserves rates and property boundaries",
  );
  const staffStay = await staff.write("stay", {
    propertyId: secondId,
    roomId: secondRoom,
    name: "Second Property Guest",
    phone: "081234567893",
    start: today,
    rate: 100,
  });
  assert.equal(staffStay.status, 200);
  const staffInvoice = await staff.write("invoice", {
    propertyId: secondId,
    stayId: staffStay.result.id,
    due: today,
    items: [{ label: "Test rent", amount: 100 }],
  });
  assert.equal(staffInvoice.status, 200);
  const staffPay = {
    propertyId: secondId,
    invoiceId: staffInvoice.result.id,
    amount: 100,
    date: today,
    method: "CASH",
    confirmed: true,
  };
  assert.equal((await staff.write("payment", staffPay)).status, 400);
  await a.write("teamAssign", {
    userId: staffResult.result.id,
    propertyIds: [propertyId, secondId],
    canRecordPayments: true,
    canControlDevices: true,
  });
  await staff.auth("login", {
    email: emailStaff,
    password: "Local-test-password-123",
  });
  assert.equal((await staff.write("payment", staffPay)).status, 200);
  assert.equal(
    (
      await staff.write("device", {
        propertyId,
        deviceId,
        command: { code: "power", value: true },
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await a.write("teamAssign", {
        userId: staffResult.result.id,
        propertyIds: [],
      })
    ).status,
    200,
  );
  assert.equal((await staff.get()).status, 401);
  await staff.auth("login", {
    email: emailStaff,
    password: "Local-test-password-123",
  });
  assert.equal((await staff.get()).properties.length, 0);
  console.log(
    "PASS staff creation / user limit / multiple properties / explicit payment and device grants / revocation",
  );
  await db.device.update({ where: { id: deviceId }, data: { online: false } });
  assert.equal(
    (
      await a.write("device", {
        propertyId,
        deviceId,
        command: { code: "power", value: false },
      })
    ).status,
    400,
  );
  assert.equal(
    (await db.device.findUniqueOrThrow({ where: { id: deviceId } })).state
      .power,
    true,
  );
  console.log("PASS offline command rejection preserves confirmed state");
  await db.organization.update({
    where: { id: owner.organizationId },
    data: { planExpiresAt: new Date(Date.now() - 1000) },
  });
  assert.equal((await a.get()).plan, "free");
  assert.equal((await a.write("recurring", recurringData)).status, 400);
  console.log(
    "PASS expired plan restricts paid features without deleting data",
  );
  await db.organization.update({
    where: { id: owner.organizationId },
    data: { plan: "free" },
  });
  state = await a.get();
  assert.equal(
    state.properties.find((p) => p.id === propertyId).rooms.length,
    20,
  );
  assert.ok(
    state.properties.find((p) => p.id === propertyId).invoices.length >= 2,
  );
  assert.equal(
    (await a.write("room", { propertyId, number: "21", rate: 1 })).status,
    400,
  );
  console.log("PASS downgrade retains history and restricts growth");
  assert.equal((await b.get("?invoiceId=" + invoiceId)).status, 403);
  assert.equal(
    (await a.get("?page=999&invoiceId=" + invoiceId)).selectedInvoice.id,
    invoiceId,
  );
  const beforePaging = (await a.get()).properties.find(
    (p) => p.id === propertyId,
  ).summary;
  await db.invoice.createMany({
    data: Array.from({ length: 51 }, (_, i) => ({
      propertyId,
      roomId,
      guestId: stay.result.guestId,
      stayId,
      number: `PAGE-${suffix}-${i}`,
      date: today,
      due: today,
      status: "DRAFT",
      total: 100,
      items: [{ label: "Pagination fixture", amount: 100 }],
    })),
  });
  const first = (await a.get()).properties.find((p) => p.id === propertyId);
  const second = (await a.get("?page=1")).properties.find(
    (p) => p.id === propertyId,
  );
  assert.equal(first.invoices.length, 50);
  assert.ok(second.invoices.length > 0);
  assert.equal(first.summary.total, beforePaging.total);
  assert.equal(first.summary.income, beforePaging.income);
  console.log(
    "PASS invoice pagination / all-history totals / direct invoice isolation",
  );
  const csrf = await fetch(base + "/api/manage", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://wrong.example",
      Cookie: a.cookie,
    },
    body: JSON.stringify({ action: "upgrade", plan: "plus" }),
  });
  assert.equal(csrf.status, 403);
  console.log("PASS CSRF origin enforcement");
  console.log(
    "ALL INTEGRATION SCENARIOS PASSED. Test-only records retained for inspection.",
  );
} finally {
  await db.$disconnect();
}
