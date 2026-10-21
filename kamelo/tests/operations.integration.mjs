import {verifiedFixture,staffFixture} from "./helpers/identity.mjs";
import assert from "node:assert/strict";
import { randomBytes, createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { PrismaClient } from "../generated/prisma/index.js";
const db = new PrismaClient(),
  base = process.env.TEST_URL || "http://127.0.0.1:3000";
const today = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Jakarta",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());
const shift = (d) =>
  new Date(Date.parse(today + "T00:00:00Z") + d * 86400000)
    .toISOString()
    .slice(0, 10);
const suffix = Date.now();
function client() {
  let cookie = "";
  return {
    get cookie(){return cookie},
    async call(path, body) {
      const r = await fetch(base + path, {
        method: body ? "POST" : "GET",
        headers: {
          Origin: base,
          Cookie: cookie,
          "Content-Type": "application/json",
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      const c = r.headers.get("set-cookie");
      if (c) cookie = c.split(";")[0];
      const result={ status: r.status, ...(await r.json()) };
      if(path==="/api/auth"&&body?.action==="register"&&r.status===200)await verifiedFixture(db,base,cookie,body.email);
      return result;
    },
    async write(action, body) {
      if(action==="teamAdd")return staffFixture(db,base,cookie,body);
      return this.call("/api/manage", { action, ...body });
    },
  };
}
const owner = client(),
  staff = client(),
  other = client();
async function good(p) {
  const b = await p;
  assert.equal(b.status, 200, JSON.stringify(b));
  return b.result;
}
async function portal(token, body) {
  const r = await fetch(base + "/api/stay/" + token, {
    method: body ? "POST" : "GET",
    headers: { Origin: base, "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: r.status, ...(await r.json()) };
}
const tokenOf = (url) => new URL(url).pathname.split("/").pop();
try {
  for (const [c, label] of [
    [owner, "owner"],
    [other, "other"],
  ])
    assert.equal(
      (
        await c.call("/api/auth", {
          action: "register",
          name: "Operations QA " + label,
          email: `operations-${label}-${suffix}@example.test`,
          phone: "081234567890",
          password: "Local-test-password-123",
        })
      ).status,
      200,
    );
  const property = await good(
    owner.write("property", {
      name: "Operations QA Kos",
      type: "KOS",
      count: 3,
      rate: 1500000,
    }),
  );
  const propertyId = property.id;
  const orgId = (await db.property.findUnique({ where: { id: propertyId } }))
    .organizationId;
  await db.organization.update({
    where: { id: orgId },
    data: { plan: "plus" },
  });
  const state = await owner.call("/api/manage"),
    rooms = state.properties[0].rooms,
    ownerId = state.user.id;
  const stay = await good(
    owner.write("stay", {
      propertyId,
      roomId: rooms[0].id,
      name: "Operations Tenant A",
      phone: "081234567890",
      start: shift(-40),
      rate: 1500000,
      billingDay: 1,
    }),
  );
  const stayB = await good(
    owner.write("stay", {
      propertyId,
      roomId: rooms[1].id,
      name: "Operations Tenant B",
      phone: "081234567891",
      start: shift(-40),
      rate: 1500000,
      billingDay: 31,
    }),
  );
  const staffRecord = await good(
    owner.write("teamAdd", {
      name: "Operations Staff",
      email: `operations-staff-${suffix}@example.test`,
      phone: "081234567892",
      password: "Local-test-password-123",
      propertyIds: [propertyId],
    }),
  );
  assert.equal(
    (
      await staff.call("/api/auth", {
        action: "login",
        email: `operations-staff-${suffix}@example.test`,
        password: "Local-test-password-123",
      })
    ).status,
    200,
  );
  await good(
    owner.write("guestSettings", {
      propertyId,
      wifiSsid: "QA;Network",
      wifiPassword: "QA;Secret:123",
      guestInstructions: "Synthetic room guide",
      supportPhone: "6281234567890",
    }),
  );
  let settings = (await owner.call("/api/manage")).properties[0];
  assert.equal(settings.hasWifiPassword, true);
  assert.ok(!("encryptedWifiPassword" in settings));
  assert.ok(!JSON.stringify(settings).includes("QA;Secret:123"));
  assert.ok(
    (
      await db.property.findUnique({ where: { id: propertyId } })
    ).encryptedWifiPassword.startsWith("v1."),
  );
  assert.equal(
    (
      await staff.write("guestSettings", {
        propertyId,
        wifiSsid: "bad",
        guestInstructions: "bad",
        supportPhone: "",
      })
    ).status,
    400,
  );
  let link = await good(
      owner.write("stayLink", { propertyId, stayId: stay.id }),
    ),
    token = tokenOf(link.url);
  let guest = await portal(token);
  assert.equal(guest.status, 200);
  assert.equal(guest.wifiPassword, "QA;Secret:123");
  assert.ok(guest.wifiQr.startsWith("data:image/png;base64,"));
  assert.equal(guest.room, rooms[0].number);
  assert.ok(!JSON.stringify(guest).includes(stayB.id));
  const rotated = await good(
    owner.write("stayLink", { propertyId, stayId: stay.id }),
  );
  assert.equal((await portal(token)).status, 404);
  token = tokenOf(rotated.url);
  assert.equal(await db.stayLink.count({ where: { tokenHash: token } }), 0);
  await db.stayLink.updateMany({
    where: { stayId: stay.id, revokedAt: null },
    data: { expiresAt: new Date(Date.now() - 1) },
  });
  assert.equal((await portal(token)).status, 404);
  token = tokenOf(
    (await good(owner.write("stayLink", { propertyId, stayId: stay.id }))).url,
  );
  assert.equal(
    (await other.write("stayLink", { propertyId, stayId: stay.id })).status,
    400,
  );
  console.log(
    "PASS stay links: scoped, hashed, rotating, expiring / private encrypted Wi-Fi / QR / owner settings permission",
  );
  assert.equal(
    (
      await portal(token, {
        action: "ticket",
        title: "AC needs service",
        description: "Synthetic complaint only",
        category: "MAINTENANCE",
        priority: "URGENT",
        assigneeId: ownerId,
        status: "RESOLVED",
      })
    ).status,
    200,
  );
  let tickets = (await owner.call("/api/manage")).properties[0].tickets,
    ticket = tickets[0];
  assert.equal(ticket.status, "OPEN");
  assert.equal(ticket.assigneeId, null);
  await good(
    owner.write("ticketUpdate", {
      propertyId,
      ticketId: ticket.id,
      status: "IN_PROGRESS",
      assigneeId: staffRecord.id,
      note: "Technician assigned",
    }),
  );
  assert.equal(
    (
      await staff.write("ticketUpdate", {
        propertyId,
        ticketId: ticket.id,
        status: "RESOLVED",
        assigneeId: ownerId,
        note: "Staff completed service",
      })
    ).status,
    200,
  );
  guest = await portal(token);
  assert.equal(guest.tickets[0].status, "RESOLVED");
  assert.equal(guest.tickets[0].updates.length, 3);
  await good(
    owner.write("ticketCreate", {
      propertyId,
      title: "Owner assigned job",
      description: "Private assignment test",
      category: "OTHER",
      assigneeId: ownerId,
    }),
  );
  tickets = (await owner.call("/api/manage")).properties[0].tickets;
  const ownerTicket = tickets.find((t) => t.title === "Owner assigned job");
  assert.equal(
    (
      await staff.write("ticketUpdate", {
        propertyId,
        ticketId: ownerTicket.id,
        status: "RESOLVED",
        note: "Cannot steal task",
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await other.write("ticketUpdate", {
        propertyId,
        ticketId: ticket.id,
        status: "OPEN",
        note: "Forbidden",
      })
    ).status,
    400,
  );
  const btoken = tokenOf(
    (await good(owner.write("stayLink", { propertyId, stayId: stayB.id }))).url,
  );
  assert.equal((await portal(btoken)).tickets.length, 0);
  console.log(
    "PASS guest complaint → assignment → staff progress → guest history / cross-property and cross-stay isolation",
  );
  const device = await good(owner.write("mockDevice", { propertyId }));
  await good(
    owner.write("mapDevice", {
      propertyId,
      deviceId: device.id,
      roomId: rooms[0].id,
    }),
  );
  assert.equal((await portal(token)).devices.length, 0);
  await good(
    owner.write("guestDeviceConfig", {
      propertyId,
      deviceId: device.id,
      enabled: true,
    }),
  );
  assert.equal((await portal(token)).devices.length, 1);
  assert.equal((await portal(btoken)).devices.length, 0);
  assert.equal(
    (
      await portal(token, {
        action: "device",
        deviceId: device.id,
        code: "power",
        value: true,
      })
    ).status,
    200,
  );
  assert.equal(
    (await db.device.findUnique({ where: { id: device.id } })).state.power,
    true,
  );
  assert.equal(
    (
      await portal(btoken, {
        action: "device",
        deviceId: device.id,
        code: "power",
        value: false,
      })
    ).status,
    400,
  );
  await db.device.update({ where: { id: device.id }, data: { online: false } });
  assert.equal(
    (
      await portal(token, {
        action: "device",
        deviceId: device.id,
        code: "power",
        value: false,
      })
    ).status,
    400,
  );
  assert.equal(
    (await db.device.findUnique({ where: { id: device.id } })).state.power,
    true,
  );
  await db.device.update({ where: { id: device.id }, data: { online: true } });
  await good(
    owner.write("guestDeviceConfig", {
      propertyId,
      deviceId: device.id,
      enabled: false,
    }),
  );
  assert.equal(
    (
      await portal(token, {
        action: "device",
        deviceId: device.id,
        code: "power",
        value: false,
      })
    ).status,
    400,
  );
  console.log(
    "PASS guest device controls: explicit owner consent / room boundaries / offline confirmation / revocation",
  );
  await good(owner.write("operationsRun", { propertyId }));
  assert.equal(await db.invoice.count({ where: { propertyId } }), 0);
  await good(owner.write("operationsConfig", { propertyId, enabled: true }));
  await Promise.all([
    good(owner.write("operationsRun", { propertyId })),
    good(owner.write("operationsRun", { propertyId })),
  ]);
  assert.equal(
    await db.invoice.count({
      where: { stayId: stay.id, period: today.slice(0, 7) },
    }),
    1,
  );
  if (
    Number(today.slice(-2)) <
    Math.min(
      31,
      new Date(
        Number(today.slice(0, 4)),
        Number(today.slice(5, 7)),
        0,
      ).getDate(),
    )
  )
    assert.equal(
      await db.invoice.count({
        where: { stayId: stayB.id, period: today.slice(0, 7) },
      }),
      0,
    );
  assert.equal(
    (await staff.write("operationsConfig", { propertyId, enabled: false }))
      .status,
    400,
  );
  await db.organization.update({
    where: { id: orgId },
    data: { subscriptionStatus: "EXPIRED" },
  });
  await good(owner.write("operationsRun", { propertyId }));
  assert.equal(
    (await owner.write("operationsConfig", { propertyId, enabled: true }))
      .status,
    400,
  );
  await db.organization.update({
    where: { id: orgId },
    data: { subscriptionStatus: "ACTIVE" },
  });
  assert.equal(
    (await fetch(base + "/api/jobs", { method: "POST" })).status,
    401,
  );
  if (process.env.OPERATIONS_JOB_KEY)
    assert.equal(
      (
        await fetch(base + "/api/jobs", {
          method: "POST",
          headers: {
            Authorization: "Bearer " + process.env.OPERATIONS_JOB_KEY,
          },
        })
      ).status,
      200,
    );
  console.log(
    "PASS opt-in recurring automation / individual due dates / concurrent idempotency / plan expiry / protected job endpoint",
  );
  for (const topic of ["briefing", "overdue", "rooms", "income", "tasks"]) {
    const leo = await owner.call("/api/leo", { propertyId, topic });
    assert.equal(leo.status, 200);
    assert.equal(leo.mode, "RULE_BASED");
    assert.ok(leo.summary);
  }
  assert.equal(
    (await other.call("/api/leo", { propertyId, topic: "briefing" })).status,
    403,
  );
  assert.equal(
    (await owner.call("/api/leo", { propertyId, topic: "arbitrary" })).status,
    400,
  );
  const badOrigin = await fetch(base + "/api/stay/" + token, {
    method: "POST",
    headers: {
      Origin: "https://invalid.example",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      action: "ticket",
      title: "bad",
      description: "bad",
      category: "OTHER",
    }),
  });
  assert.equal(badOrigin.status, 403);
  await good(
    owner.write("transition", {
      propertyId,
      stayId: stay.id,
      status: "CHECKED_OUT",
    }),
  );
  assert.equal((await portal(token)).status, 404);
  assert.equal(
    (
      await portal(token, {
        action: "ticket",
        title: "After checkout",
        description: "Must be refused",
        category: "OTHER",
      })
    ).status,
    404,
  );
  console.log(
    "PASS LEO scoped live-data rules / origin enforcement / checkout revokes guest services",
  );
  const hotel = await good(
    owner.write("property", {
      name: "Operations QA Hotel",
      type: "HOTEL",
      count: 1,
      rate: 300000,
    }),
  );
  const hotelRoom = await db.room.findFirst({
    where: { propertyId: hotel.id },
  });
  const booking = await good(
    owner.write("stay", {
      propertyId: hotel.id,
      roomId: hotelRoom.id,
      name: "Hotel Guest QA",
      phone: "081234567890",
      start: today,
      end: shift(2),
      rate: 300000,
      billingDay: 1,
    }),
  );
  assert.equal(
    (
      await owner.write("stayLink", {
        propertyId: hotel.id,
        stayId: booking.id,
      })
    ).status,
    400,
  );
  await good(
    owner.write("transition", {
      propertyId: hotel.id,
      stayId: booking.id,
      status: "CHECKED_IN",
    }),
  );
  const hotelToken = tokenOf(
    (
      await good(
        owner.write("stayLink", { propertyId: hotel.id, stayId: booking.id }),
      )
    ).url,
  );
  assert.equal((await portal(hotelToken)).status, 200);
  await good(
    owner.write("transition", {
      propertyId: hotel.id,
      stayId: booking.id,
      status: "CHECKED_OUT",
    }),
  );
  assert.equal((await portal(hotelToken)).status, 404);
  assert.equal(
    await db.ticket.count({
      where: { stayId: booking.id, category: "CLEANING" },
    }),
    1,
  );
  assert.equal(
    (await db.room.findUnique({ where: { id: hotelRoom.id } })).operational,
    "CLEANING",
  );
  assert.equal(
    (
      await owner.write("transition", {
        propertyId: hotel.id,
        stayId: booking.id,
        status: "CHECKED_OUT",
      })
    ).status,
    400,
  );
  assert.equal(
    await db.ticket.count({
      where: { stayId: booking.id, category: "CLEANING" },
    }),
    1,
  );
  console.log(
    "PASS hotel active-stay gate / checkout creates one cleaning task / checkout link revocation",
  );
  const future = await good(
    owner.write("stay", {
      propertyId,
      roomId: rooms[2].id,
      name: "Future tenant QA",
      phone: "081234567890",
      start: shift(5),
      rate: 1000000,
      billingDay: 1,
    }),
  );
  assert.equal(
    (
      await owner.write("transition", {
        propertyId,
        stayId: future.id,
        status: "CHECKED_OUT",
      })
    ).status,
    400,
  );
  assert.equal(
    (await owner.write("stayLink", { propertyId, stayId: future.id })).status,
    400,
  );
  await good(
    owner.write("transition", {
      propertyId,
      stayId: future.id,
      status: "CANCELLED",
    }),
  );
  assert.equal(
    (await db.stay.findUnique({ where: { id: future.id } })).status,
    "CANCELLED",
  );
  console.log(
    "PASS future kos stay cannot checkout or receive services / future cancellation preserves dates",
  );
  // Keep a synthetic account and link for UI verification; this ignored file contains no customer records.
  await writeFile(
    ".local-secrets/operations-qa.json",
    JSON.stringify({
      email: `operations-owner-${suffix}@example.test`,
      password: "Local-test-password-123",
      propertyId,
      stayId: stayB.id,
      url: base + "/stay/" + btoken,
    }),
  );
  console.log(
    "ALL 7 OPERATIONS SCENARIO GROUPS PASSED. Synthetic records retained.",
  );
} finally {
  await db.$disconnect();
}
