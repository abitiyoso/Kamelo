import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { PrismaClient } from "../generated/prisma/index.js";
import { verifiedFixture, staffFixture } from "./helpers/identity.mjs";
const database = new URL(process.env.DATABASE_URL || "http://invalid"),
  base = process.env.TEST_URL;
assert.equal(database.hostname, "127.0.0.1");
assert.equal(database.port, "55432");
assert.equal(database.pathname, "/kamelo_phase2_qa");
assert.equal(base, "http://127.0.0.1:3001");
const db = new PrismaClient(),
  suffix = Date.now(),
  password = "Prospects-QA-password-123";
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
      if (r.headers.get("set-cookie"))
        cookie = r.headers.get("set-cookie").split(";")[0];
      return { status: r.status, ...(await r.json()) };
    },
    async register(label) {
      const email = `prospects-${label}-${suffix}@example.test`;
      ok(
        await this.call("/api/auth", {
          action: "register",
          name: "Prospects QA " + label,
          email,
          password,
          phone: "081234567890",
        }),
      );
      await verifiedFixture(db, base, cookie, email);
      return db.user.findUniqueOrThrow({ where: { email } });
    },
    manage(action, data) {
      return this.call("/api/manage", { action, ...data });
    },
  };
}
const owner = client(),
  other = client(),
  staff = client();
let groups = 0;
const pass = (s) => {
  groups++;
  console.log("PASS", s);
};
try {
  const u = await owner.register("owner");
  await other.register("other");
  const property = ok(
    await owner.manage("property", {
      name: "Prospects QA Residence",
      type: "KOS",
      count: 5,
      rate: 1500000,
    }),
  );
  const foreign = ok(
    await other.manage("property", {
      name: "Foreign prospects QA",
      type: "KOS",
      count: 1,
      rate: 900000,
    }),
  );
  await db.organization.update({
    where: { id: u.organizationId },
    data: { plan: "plus", subscriptionStatus: "ACTIVE" },
  });
  const rooms = await db.room.findMany({
    where: { propertyId: property.id },
    orderBy: { number: "asc" },
  });
  const foreignRoom = await db.room.findFirstOrThrow({
    where: { propertyId: foreign.id },
  });
  const staffEmail = `prospect-staff-${suffix}@example.test`;
  ok(
    await staffFixture(db, base, owner.cookie, {
      email: staffEmail,
      password,
      name: "Prospect Staff",
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
  const path = `/api/prospects?propertyId=${property.id}`;
  const write = (action, data = {}, key = randomUUID()) =>
    owner.call("/api/lifecycle", {
      propertyId: property.id,
      action,
      key,
      ...data,
    });
  const get = (id) => owner.call(path + `&prospectId=${id}`);
  const command = async (id, action, data = {}) =>
    write(action, {
      prospectId: id,
      revision: ok(await get(id)).prospect.revision,
      ...data,
    });
  const input = {
    name: "Nadia Prospek",
    phone: "081234567893",
    email: "nadia@example.test",
    source: "WHATSAPP",
    interest: "Kamar tenang dekat kantor",
    roomId: rooms[0].id,
    requestedStart: today,
    budget: 1500000,
    followUpAt: new Date(Date.now() - 3600000).toISOString(),
    consentReference: "Synthetic WhatsApp inquiry",
    confirmed: true,
    notes: "Minta jadwal survei sore.",
  };
  assert.equal((await client().call(path)).status, 401);
  assert.equal((await staff.call(path)).status, 403);
  assert.equal((await other.call(path)).status, 404);
  assert.equal(
    (
      await staff.call("/api/lifecycle", {
        propertyId: property.id,
        action: "prospectCreate",
        key: randomUUID(),
        ...input,
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await owner.call(
        "/api/lifecycle",
        {
          propertyId: property.id,
          action: "prospectCreate",
          key: randomUUID(),
          ...input,
        },
        "https://foreign.invalid",
      )
    ).status,
    403,
  );
  pass("owner/unauthenticated/staff/organization/CSRF boundaries");

  assert.equal(
    (await write("prospectCreate", { ...input, confirmed: false })).status,
    400,
  );
  assert.equal(
    (await write("prospectCreate", { ...input, roomId: foreignRoom.id }))
      .status,
    400,
  );
  assert.equal(
    (await write("prospectCreate", { ...input, requestedEnd: shift(-1) }))
      .status,
    400,
  );
  assert.equal(
    (await write("prospectCreate", { ...input, requestedStart: "2026-02-30" }))
      .status,
    400,
  );
  const key = randomUUID(),
    a = ok(await write("prospectCreate", input, key));
  assert.deepEqual(ok(await write("prospectCreate", input, key)), a);
  assert.equal(
    (await write("prospectCreate", { ...input, name: "Different" }, key))
      .status,
    400,
  );
  assert.equal(
    await db.prospect.count({ where: { propertyId: property.id } }),
    1,
  );
  assert.equal(await db.guest.count({ where: { propertyId: property.id } }), 0);
  assert.equal(
    (await other.call(path + `&prospectId=${a.prospectId}`)).status,
    404,
  );
  pass(
    "consent/date/property validation; idempotent lead capture without identities or stays",
  );

  assert.equal(
    (await command(a.prospectId, "prospectStage", { stage: "CONVERTED" }))
      .status,
    400,
  );
  assert.equal(
    (await command(a.prospectId, "prospectStage", { stage: "SURVEY" })).status,
    400,
  );
  assert.equal(
    (
      await command(a.prospectId, "prospectStage", {
        stage: "SURVEY",
        surveyAt: new Date(Date.now() - 3600000).toISOString(),
      })
    ).status,
    400,
  );
  ok(
    await command(a.prospectId, "prospectStage", {
      stage: "SURVEY",
      surveyAt: new Date(Date.now() + 86400000).toISOString(),
    }),
  );
  const survey = ok(await owner.call(path));
  assert.equal(survey.surveys, 1);
  assert.equal(survey.due, 1);
  assert.equal(survey.available, 5);
  assert.equal(
    (
      await command(a.prospectId, "prospectStage", {
        stage: "OFFER",
        offerRent: 1500000,
      })
    ).status,
    400,
  );
  ok(
    await command(a.prospectId, "prospectStage", {
      stage: "OFFER",
      offerRent: 1500000,
      offerTerms: "Sewa bulanan, deposit dibahas dalam kontrak.",
    }),
  );
  ok(
    await command(a.prospectId, "prospectStage", {
      stage: "OFFER",
      offerRent: 1450000,
      offerTerms: "Tarif revisi disetujui dalam penawaran terpisah.",
    }),
  );
  const before = ok(await get(a.prospectId)).prospect;
  ok(
    await command(a.prospectId, "prospectNote", {
      note: "Calon penghuni sudah meninjau kamar.",
      followUpAt: null,
    }),
  );
  assert.equal(
    (
      await write("prospectUpdate", {
        ...input,
        prospectId: a.prospectId,
        revision: before.revision,
      })
    ).status,
    400,
  );
  assert.equal(ok(await get(a.prospectId)).activities[0].kind, "FOLLOW_UP");
  assert.equal(
    await db.prospectActivity.count({ where: { prospectId: a.prospectId } }),
    5,
  );
  pass(
    "scheduled survey, complete/revised quote, follow-up activity and optimistic revision checks",
  );

  const lost = ok(
    await write("prospectCreate", {
      ...input,
      name: "Loss workflow",
      roomId: null,
    }),
  );
  assert.equal(
    (
      await command(lost.prospectId, "prospectStage", {
        stage: "LOST",
        lossReason: "x",
      })
    ).status,
    400,
  );
  ok(
    await command(lost.prospectId, "prospectStage", {
      stage: "LOST",
      lossReason: "Memilih lokasi lebih dekat kantor.",
    }),
  );
  assert.equal(ok(await get(lost.prospectId)).prospect.followUpAt, null);
  assert.equal(
    (
      await command(lost.prospectId, "prospectStage", {
        stage: "OFFER",
        offerRent: 100,
        offerTerms: "Tidak boleh lompat dari closed.",
      })
    ).status,
    400,
  );
  ok(await command(lost.prospectId, "prospectStage", { stage: "NEW" }));
  assert.equal(ok(await get(lost.prospectId)).prospect.lossReason, "");
  assert.ok(
    ok(await get(lost.prospectId)).activities.some(
      (x) => x.metadata.lossReason,
    ),
  );
  pass(
    "loss reasons, closed follow-up clearing and explicit reopen preserve history",
  );

  const convert = {
    roomId: rooms[0].id,
    start: today,
    rate: 1450000,
    billingDay: 17,
    confirmed: true,
  };
  const guestCount = await db.guest.count({
    where: { propertyId: property.id },
  });
  assert.equal(
    (
      await command(a.prospectId, "prospectConvert", {
        ...convert,
        rate: 1500000,
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await command(a.prospectId, "prospectConvert", {
        ...convert,
        confirmed: false,
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await command(a.prospectId, "prospectConvert", {
        ...convert,
        roomId: foreignRoom.id,
      })
    ).status,
    400,
  );
  await db.room.update({
    where: { id: rooms[0].id },
    data: { operational: "MAINTENANCE" },
  });
  assert.equal(
    (await command(a.prospectId, "prospectConvert", convert)).status,
    400,
  );
  assert.equal(
    await db.guest.count({ where: { propertyId: property.id } }),
    guestCount,
  );
  await db.room.update({
    where: { id: rooms[0].id },
    data: { operational: "READY" },
  });
  const rev = ok(await get(a.prospectId)).prospect.revision,
    convertKey = randomUUID();
  const conversions = await Promise.all([
    write(
      "prospectConvert",
      { ...convert, prospectId: a.prospectId, revision: rev },
      convertKey,
    ),
    write(
      "prospectConvert",
      { ...convert, prospectId: a.prospectId, revision: rev },
      convertKey,
    ),
  ]);
  const converted = ok(conversions[0]);
  assert.deepEqual(ok(conversions[1]), converted);
  assert.equal(
    await db.stay.count({ where: { guestId: converted.guestId } }),
    1,
  );
  assert.equal(
    await db.guest.count({ where: { propertyId: property.id } }),
    guestCount + 1,
  );
  assert.equal(
    await db.invoice.count({ where: { propertyId: property.id } }),
    0,
  );
  assert.equal(
    await db.occupantAccess.count({ where: { stayId: converted.stayId } }),
    0,
  );
  assert.equal(
    await db.contract.count({ where: { stayId: converted.stayId } }),
    0,
  );
  assert.equal(ok(await get(a.prospectId)).prospect.stage, "CONVERTED");
  assert.equal(
    (await command(a.prospectId, "prospectUpdate", input)).status,
    400,
  );
  assert.equal(
    (await command(a.prospectId, "prospectConvert", convert)).status,
    400,
  );
  pass(
    "atomic conversion/rollback, agreed quote, duplicate retry and no implicit billing/grant/contract",
  );

  async function offered(name, roomId) {
    const p = ok(await write("prospectCreate", { ...input, name, roomId }));
    ok(
      await command(p.prospectId, "prospectStage", {
        stage: "OFFER",
        offerRent: 1500000,
        offerTerms: "Sewa bulanan sesuai kesepakatan calon penghuni.",
      }),
    );
    return p.prospectId;
  }
  const c1 = await offered("Competing one", rooms[1].id),
    c2 = await offered("Competing two", rooms[1].id);
  const bids = await Promise.all([
    command(c1, "prospectConvert", {
      ...convert,
      rate: 1500000,
      roomId: rooms[1].id,
    }),
    command(c2, "prospectConvert", {
      ...convert,
      rate: 1500000,
      roomId: rooms[1].id,
    }),
  ]);
  assert.deepEqual(bids.map((r) => r.status).sort(), [200, 400]);
  assert.equal(await db.stay.count({ where: { roomId: rooms[1].id } }), 1);
  assert.equal(
    await db.guest.count({ where: { propertyId: property.id } }),
    guestCount + 2,
  );
  pass(
    "competing prospects cannot occupy the same interval; losing transaction leaves no orphan profile",
  );

  const old = ok(
    await owner.manage("stay", {
      propertyId: property.id,
      roomId: rooms[2].id,
      name: "Returning resident",
      phone: input.phone,
      start: shift(-20),
      rate: 1000000,
      billingDay: 5,
    }),
  );
  const oldStay = await db.stay.findUniqueOrThrow({ where: { id: old.id } });
  const oldInvoice = ok(
    await owner.manage("invoice", {
      propertyId: property.id,
      stayId: old.id,
      due: today,
      items: [{ label: "Existing unpaid rent", amount: 1000000 }],
    }),
  );
  const originalInvoice = await db.invoice.findUniqueOrThrow({
    where: { id: oldInvoice.id },
    include: { payments: true },
  });
  ok(
    await owner.manage("transition", {
      propertyId: property.id,
      stayId: old.id,
      status: "CHECKED_OUT",
    }),
  );
  const returnLead = await offered(
    "Contact differs but explicitly checked",
    rooms[3].id,
  );
  const oldGuest = await db.guest.findUniqueOrThrow({
    where: { id: oldStay.guestId },
  });
  const returned = ok(
    await command(returnLead, "prospectConvert", {
      ...convert,
      rate: 1500000,
      roomId: rooms[3].id,
      guestId: oldStay.guestId,
    }),
  );
  assert.equal(returned.guestId, oldStay.guestId);
  assert.deepEqual(
    await db.guest.findUniqueOrThrow({ where: { id: oldStay.guestId } }),
    oldGuest,
  );
  assert.equal(await db.stay.count({ where: { guestId: oldStay.guestId } }), 2);
  assert.deepEqual(
    await db.invoice.findUniqueOrThrow({
      where: { id: oldInvoice.id },
      include: { payments: true },
    }),
    originalInvoice,
  );
  const invalid = await offered("Invalid guest scope", rooms[4].id);
  const foreignGuest = await db.guest.create({
    data: {
      propertyId: foreign.id,
      name: "Other property",
      phone: input.phone,
    },
  });
  assert.equal(
    (
      await command(invalid, "prospectConvert", {
        ...convert,
        rate: 1500000,
        roomId: rooms[4].id,
        guestId: foreignGuest.id,
      })
    ).status,
    400,
  );
  pass(
    "explicit returning profile reuse preserves person/history and rejects cross-property claims",
  );

  const hotel = ok(
    await owner.manage("property", {
      name: "Prospects QA Guest House",
      type: "HOTEL",
      count: 1,
      rate: 350000,
    }),
  );
  const hotelRoom = await db.room.findFirstOrThrow({
    where: { propertyId: hotel.id },
  });
  const hotelWrite = (action, data) =>
    owner.call("/api/lifecycle", {
      propertyId: hotel.id,
      action,
      key: randomUUID(),
      ...data,
    });
  const hp = ok(
    await hotelWrite("prospectCreate", {
      ...input,
      name: "Hotel prospect",
      roomId: hotelRoom.id,
      requestedStart: shift(2),
      requestedEnd: shift(4),
    }),
  );
  ok(
    await hotelWrite("prospectStage", {
      prospectId: hp.prospectId,
      revision: 1,
      stage: "OFFER",
      offerRent: 350000,
      offerTerms: "Menginap dua malam sesuai reservasi.",
    }),
  );
  const hb = {
    prospectId: hp.prospectId,
    revision: 2,
    roomId: hotelRoom.id,
    start: shift(2),
    rate: 350000,
    billingDay: 1,
    confirmed: true,
  };
  assert.equal((await hotelWrite("prospectConvert", hb)).status, 400);
  const hs = ok(await hotelWrite("prospectConvert", { ...hb, end: shift(4) }));
  assert.equal(
    (await db.stay.findUniqueOrThrow({ where: { id: hs.stayId } })).status,
    "CONFIRMED",
  );
  pass(
    "hotel conversion requires checkout date and creates a reservation without early check-in",
  );

  const detail = ok(await get(a.prospectId));
  await assert.rejects(
    db.$executeRaw`UPDATE "ProspectActivity" SET "note" = 'rewrite' WHERE "id" = ${detail.activities[0].id}`,
  );
  await assert.rejects(
    db.$executeRaw`DELETE FROM "ProspectActivity" WHERE "id" = ${detail.activities[0].id}`,
  );
  for (let i = 0; i < 32; i++)
    await db.prospectActivity.create({
      data: {
        prospectId: lost.prospectId,
        revision: 100 + i,
        kind: "FOLLOW_UP",
        note: "Synthetic pagination note " + i,
        actorId: u.id,
        metadata: {},
      },
    });
  const paged = ok(
    await owner.call(path + `&prospectId=${lost.prospectId}&activityPage=2`),
  );
  assert.equal(paged.activities.length, 5);
  assert.equal(paged.activityTotal, 35);
  await db.prospect.createMany({
    data: Array.from({ length: 51 }, (_, i) => ({
      propertyId: property.id,
      name: "Pagination prospect " + i,
      phone: input.phone,
      source: "OTHER",
      consentReference: "Synthetic QA consent",
      createdBy: u.id,
    })),
  });
  const list = ok(await owner.call(path + "&q=Pagination"));
  assert.equal(list.rows.length, 50);
  assert.equal(list.total, 51);
  assert.equal(
    ok(await owner.call(path + "&q=Pagination&page=2")).rows.length,
    1,
  );
  assert.equal(ok(await owner.call(path + "&stage=CONVERTED")).total, 3);
  assert.equal((await owner.call(path + "&stage=invalid")).status, 400);
  assert.equal((await owner.call(path + "&page=1.5")).status, 400);
  assert.equal(
    (await owner.call(path + `&prospectId=${a.prospectId}&activityPage=1.5`))
      .status,
    400,
  );
  const json = JSON.stringify(ok(await owner.call(path)));
  assert.ok(!json.includes(foreign.id));
  assert.ok(!json.includes('"password"'));
  pass(
    "append-only activity, bounded history/list pagination, scoped search/filter and truthful counts",
  );

  const hash = (rows) =>
    createHash("sha256").update(JSON.stringify(rows)).digest("hex");
  const financialBefore = hash(
    await db.invoice.findMany({
      where: { propertyId: property.id },
      include: { payments: true },
      orderBy: { id: "asc" },
    }),
  );
  ok(
    await command(invalid, "prospectUpdate", {
      ...input,
      name: "Edited interest",
      roomId: rooms[4].id,
    }),
  );
  assert.equal(
    hash(
      await db.invoice.findMany({
        where: { propertyId: property.id },
        include: { payments: true },
        orderBy: { id: "asc" },
      }),
    ),
    financialBefore,
  );
  await mkdir("artifacts/phase4b", { recursive: true });
  await mkdir(".local-secrets", { recursive: true });
  await writeFile(
    "artifacts/phase4b/prospects-tests.json",
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
  await writeFile(
    ".local-secrets/phase4b-browser.json",
    JSON.stringify({
      base,
      owner: u.email,
      password,
      propertyId: property.id,
      prospectId: invalid,
    }),
  );
} finally {
  await db.$disconnect();
}
