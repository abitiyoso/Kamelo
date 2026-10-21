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
  password = "Resident-Import-QA-password-123";
const ok = (r) => {
  assert.equal(r.status, 200, JSON.stringify(r));
  return r.result || r;
};
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
      if (r.headers.get("set-cookie"))
        cookie = r.headers.get("set-cookie").split(";")[0];
      return { status: r.status, ...(await r.json()) };
    },
    async register(label) {
      const email = `resident-import-${label}-${suffix}@example.test`;
      ok(
        await this.call("/api/auth", {
          action: "register",
          name: "Import QA " + label,
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
const owner = client(),
  other = client(),
  staff = client(),
  anon = client();
let groups = 0;
const pass = (s) => {
  groups++;
  console.log("PASS", s);
};
const mapping = {
    number: 0,
    name: 1,
    phone: 2,
    start: 3,
    end: 4,
    rate: 5,
    billingDay: 6,
  },
  header = "number,name,phone,start,end,rate,day\n";
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
const line = (room, i, start = shift(1), end = "") =>
  `${room},Resident QA ${i},081230000${String(i).padStart(3, "0")},${start},${end},1500000,${(i % 31) + 1}`;
try {
  const u = await owner.register("owner"),
    o = await other.register("other");
  await db.organization.update({
    where: { id: u.organizationId },
    data: { plan: "plus" },
  });
  const property = ok(
    await owner.call("/api/manage", {
      action: "property",
      name: "Resident Import QA",
      type: "KOS",
      count: 15,
      rate: 1500000,
    }),
  );
  const data = {
    propertyId: property.id,
    csv: header + line("01", 1) + "\n" + line("02", 2),
    mapping,
    choices: {},
  };
  const post = (action, p = {}) =>
    owner.call("/api/resident-imports", { action, ...data, ...p });
  const rollback = (id) =>
    owner.call("/api/resident-imports", {
      action: "rollback",
      batchId: id,
      key: randomUUID(),
      confirmed: true,
    });
  const commitCsv = async (csv, extra = {}) => {
    const p = ok(await post("preview", { csv, ...extra }));
    assert(p.valid, JSON.stringify(p.rows.map((r) => r.errors)));
    return ok(
      await post("commit", {
        csv,
        ...extra,
        digest: p.digest,
        key: randomUUID(),
        confirmed: true,
      }),
    );
  };
  assert.equal(
    (await anon.call("/api/resident-imports?propertyId=" + property.id)).status,
    401,
  );
  assert.equal(
    (await other.call("/api/resident-imports", { action: "preview", ...data }))
      .status,
    400,
  );
  assert.equal(
    (await other.call("/api/resident-imports?propertyId=" + property.id))
      .status,
    403,
  );
  assert.equal(
    (
      await owner.call(
        "/api/resident-imports",
        { action: "preview", ...data },
        "https://attacker.test",
      )
    ).status,
    403,
  );
  const staffEmail = `resident-import-staff-${suffix}@example.test`;
  ok(
    await staffFixture(db, base, owner.cookie, {
      email: staffEmail,
      password,
      name: "Resident import staff",
      phone: "081234567891",
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
  for (const action of ["preview", "commit", "rollback"])
    assert.equal(
      (
        await staff.call("/api/resident-imports", {
          action,
          ...data,
          key: randomUUID(),
          confirmed: true,
          batchId: "foreign",
        })
      ).status,
      400,
    );
  pass("anonymous, cross-organization, staff and origin isolation");
  const p = ok(await post("preview"));
  assert(p.valid);
  assert.equal(await db.guest.count({ where: { propertyId: property.id } }), 0);
  assert.equal(
    await db.stay.count({ where: { room: { propertyId: property.id } } }),
    0,
  );
  assert.equal(
    (
      await post("commit", {
        key: randomUUID(),
        digest: p.digest,
        confirmed: false,
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await post("commit", {
        key: randomUUID(),
        digest: "stale",
        confirmed: true,
      })
    ).status,
    400,
  );
  assert(
    !ok(
      await post("preview", {
        csv: header + line("01", 3) + "\n" + line("01", 4),
      }),
    ).valid,
  );
  assert(
    !ok(
      await post("preview", {
        csv: header + line("01", 3) + "\n" + line("02", 3),
      }),
    ).valid,
  );
  pass(
    "read-only preview, confirmation/digest and intra-file room/identity collision guards",
  );
  const beforeMail = await db.emailOutbox.count(),
    key = randomUUID(),
    cmd = { key, digest: p.digest, confirmed: true };
  const batch = ok(await post("commit", cmd));
  assert.equal(batch.count, 2);
  assert.deepEqual(ok(await post("commit", cmd)), batch);
  assert.equal(
    (await post("commit", { ...cmd, csv: header + line("03", 3) })).status,
    400,
  );
  const stays = await db.stay.findMany({
    where: { room: { propertyId: property.id } },
    include: { guest: true, room: true },
    orderBy: { billingDay: "asc" },
  });
  assert.equal(stays.length, 2);
  assert.equal(stays[0].status, "ACTIVE");
  assert.equal(stays[0].billingDay, 2);
  assert.equal(stays[1].billingDay, 3);
  assert(stays.every((s) => s.guest.phone.startsWith("+62")));
  assert.equal(
    await db.invoice.count({ where: { propertyId: property.id } }),
    0,
  );
  assert.equal(
    await db.contract.count({
      where: { stay: { room: { propertyId: property.id } } },
    }),
    0,
  );
  assert.equal(
    await db.occupantAccess.count({
      where: { stay: { room: { propertyId: property.id } } },
    }),
    0,
  );
  assert.equal(beforeMail, await db.emailOutbox.count());
  pass(
    "atomic guest/stay creation, individual due days, exact retries and no unsolicited invoices/accounts/emails",
  );
  const encrypted = await db.residentImportBatch.findUniqueOrThrow({
    where: { id: batch.id },
  });
  assert(!encrypted.encryptedSnapshots.includes("Resident QA"));
  assert(!encrypted.encryptedSnapshots.includes("081230"));
  const history = ok(
    await owner.call("/api/resident-imports?propertyId=" + property.id),
  );
  assert(
    history.rows.every(
      (b) => !("encryptedSnapshots" in b) && !("actorId" in b),
    ),
  );
  await assert.rejects(
    db.residentImportBatch.update({
      where: { id: batch.id },
      data: { recordCount: 9 },
    }),
  );
  await assert.rejects(
    db.residentImportBatch.delete({ where: { id: batch.id } }),
  );
  pass("encrypted immutable import snapshots and scoped minimal history");
  const retryKey = randomUUID(),
    rb = {
      action: "rollback",
      key: retryKey,
      batchId: batch.id,
      confirmed: true,
    };
  ok(await owner.call("/api/resident-imports", rb));
  ok(await owner.call("/api/resident-imports", rb));
  assert.equal(await db.guest.count({ where: { propertyId: property.id } }), 0);
  assert.equal(
    await db.stay.count({ where: { room: { propertyId: property.id } } }),
    0,
  );
  assert.equal((await rollback(batch.id)).status, 400);
  pass(
    "whole-batch rollback removes only untouched new guests/stays and retains immutable history",
  );
  const seed = ok(
    await owner.call("/api/manage", {
      action: "stay",
      propertyId: property.id,
      roomId: stays[0].roomId,
      name: "Legacy Resident",
      phone: "081230000050",
      start: shift(-60),
      end: shift(-30),
      rate: 1000000,
      billingDay: 15,
    }),
  );
  await db.stay.update({
    where: { id: seed.id },
    data: { status: "CHECKED_OUT" },
  });
  const oldGuest = await db.guest.findUniqueOrThrow({
      where: { id: seed.guestId },
    }),
    csv = header + line("03", 50);
  const collision = ok(await post("preview", { csv }));
  assert(!collision.valid);
  assert.equal(collision.rows[0].candidates[0].id, oldGuest.id);
  assert(
    !ok(await post("preview", { csv, choices: { 2: "foreign-id" } })).valid,
  );
  const reuse = await commitCsv(csv, { choices: { 2: oldGuest.id } });
  assert.deepEqual(
    await db.guest.findUniqueOrThrow({ where: { id: oldGuest.id } }),
    oldGuest,
  );
  const overlapping = ok(
    await post("preview", {
      csv: header + line("04", 50),
      choices: { 2: oldGuest.id },
    }),
  );
  assert(!overlapping.valid);
  ok(await rollback(reuse.id));
  assert.deepEqual(
    await db.guest.findUniqueOrThrow({ where: { id: oldGuest.id } }),
    oldGuest,
  );
  assert(await db.stay.findUnique({ where: { id: seed.id } }));
  pass(
    "phone variants require explicit legacy profile selection; no overwrites, overlap denied and reused profile preserved on rollback",
  );
  const guarded = await commitCsv(
      header + line("04", 4) + "\n" + line("05", 5),
    ),
    gs = await db.stay.findFirstOrThrow({
      where: { room: { propertyId: property.id, number: "05" } },
    });
  await db.stay.update({ where: { id: gs.id }, data: { billingDay: 30 } });
  assert.equal((await rollback(guarded.id)).status, 400);
  assert.equal(
    await db.stay.count({
      where: {
        room: { propertyId: property.id, number: { in: ["04", "05"] } },
      },
    }),
    2,
  );
  pass(
    "a changed stay rejects entire rollback without deleting earlier batch rows",
  );
  const invoiced = await commitCsv(header + line("06", 6)),
    invStay = await db.stay.findFirstOrThrow({
      where: { room: { propertyId: property.id, number: "06" } },
    });
  const invoice = ok(
    await owner.call("/api/manage", {
      action: "invoice",
      propertyId: property.id,
      stayId: invStay.id,
      due: shift(5),
      items: [{ label: "QA rent", amount: 1500000 }],
    }),
  );
  assert.equal((await rollback(invoiced.id)).status, 400);
  assert(await db.invoice.findUnique({ where: { id: invoice.id } }));
  assert(await db.stay.findUnique({ where: { id: invStay.id } }));
  pass(
    "even a draft invoice blocks rollback; all financial history stays intact",
  );
  const contracted = await commitCsv(header + line("07", 7)),
    cs = await db.stay.findFirstOrThrow({
      where: { room: { propertyId: property.id, number: "07" } },
    });
  ok(
    await owner.call("/api/lifecycle", {
      action: "contractCreate",
      key: randomUUID(),
      propertyId: property.id,
      stayId: cs.id,
      end: shift(60),
      depositRequired: 100000,
      terms: "Synthetic QA contract draft only",
    }),
  );
  assert.equal((await rollback(contracted.id)).status, 400);
  pass("contract/deposit relationships block rollback");
  const invited = await commitCsv(header + line("08", 8)),
    is = await db.stay.findFirstOrThrow({
      where: { room: { propertyId: property.id, number: "08" } },
    });
  ok(
    await owner.call("/api/invitations", {
      action: "create",
      kind: "TENANT",
      email: `resident-import-invite-${suffix}@example.test`,
      propertyIds: [property.id],
      stayId: is.id,
    }),
  );
  assert.equal((await rollback(invited.id)).status, 400);
  pass(
    "pending invitation without a foreign key still blocks deletion of its stay",
  );
  const hotel = ok(
    await owner.call("/api/manage", {
      action: "property",
      name: "Resident Import Hotel QA",
      type: "HOTEL",
      count: 1,
      rate: 500000,
    }),
  );
  assert(
    !ok(
      await post("preview", {
        propertyId: hotel.id,
        csv: header + line("01", 11),
      }),
    ).valid,
  );
  const hotelBatch = await commitCsv(
    header + line("01", 11, shift(1), shift(3)),
    { propertyId: hotel.id },
  );
  assert.equal(
    (
      await db.stay.findFirstOrThrow({
        where: { room: { propertyId: hotel.id } },
      })
    ).status,
    "CONFIRMED",
  );
  ok(await rollback(hotelBatch.id));
  const room09 = await db.room.findFirstOrThrow({
    where: { propertyId: property.id, number: "09" },
  });
  ok(
    await owner.call("/api/manage", {
      action: "roomReadiness",
      propertyId: property.id,
      roomId: room09.id,
      operational: "MAINTENANCE",
    }),
  );
  assert(!ok(await post("preview", { csv: header + line("09", 9) })).valid);
  pass(
    "hotel end date/status and room readiness preserve canonical business rules",
  );
  const raceCsv = header + line("10", 10),
    racePreview = ok(await post("preview", { csv: raceCsv }));
  assert(racePreview.valid);
  const race = await Promise.all(
    [1, 2].map(() =>
      post("commit", {
        csv: raceCsv,
        digest: racePreview.digest,
        key: randomUUID(),
        confirmed: true,
      }),
    ),
  );
  assert.deepEqual(race.map((r) => r.status).sort(), [200, 400]);
  assert.equal(
    await db.guest.count({
      where: { propertyId: property.id, phone: "+6281230000010" },
    }),
    1,
  );
  pass("concurrent commits serialize without duplicate guests/stays");
  const autoRoom = await db.room.findFirstOrThrow({
    where: { propertyId: property.id, number: "11" },
  });
  ok(
    await owner.call("/api/manage", {
      action: "mockLock",
      propertyId: property.id,
      roomId: autoRoom.id,
      name: "Import QA lock",
    }),
  );
  const autoCsv = header + line("11", 12, today),
    autoPreview = ok(await post("preview", { csv: autoCsv }));
  assert(autoPreview.automation.locks);
  const autoBatch = await commitCsv(autoCsv);
  assert.equal((await rollback(autoBatch.id)).status, 400);
  assert(
    await db.smartAccess.count({ where: { stay: { roomId: autoRoom.id } } }),
  );
  pass(
    "automated lock is disclosed and canonical access creation prevents destructive rollback",
  );
  const m = await db.orgMembership.findFirstOrThrow({
    where: { userId: u.id, organizationId: u.organizationId },
  });
  await db.orgMembership.update({
    where: { id: m.id },
    data: { status: "SUSPENDED" },
  });
  assert.notEqual((await post("preview")).status, 200);
  await db.orgMembership.update({
    where: { id: m.id },
    data: { status: "ACTIVE" },
  });
  const template = await fetch(base + "/templates/kamelo-penghuni.csv");
  assert.equal(template.status, 200);
  assert((await template.text()).startsWith("nomor,nama,telepon"));
  pass("fresh membership and real downloadable resident template");
  await mkdir("artifacts/phase4i", { recursive: true });
  await writeFile(
    "artifacts/phase4i/resident-import-api.json",
    JSON.stringify(
      { groups, externalEmail: false, mainDatabase: false },
      null,
      2,
    ),
  );
  await writeFile(
    ".local-secrets/phase4i-browser.json",
    JSON.stringify(
      {
        email: u.email,
        password,
        propertyId: property.id,
        oldGuestId: oldGuest.id,
      },
      null,
      2,
    ),
  );
  console.log(`PASS ${groups} resident import API scenario groups`);
} finally {
  await db.$disconnect();
}
