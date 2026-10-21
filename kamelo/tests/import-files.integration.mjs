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
  password = "Xlsx-Import-QA-password-123";
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
      const email = `xlsx-import-${label}-${suffix}@example.test`;
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
const { xlsxFixture } = await import("./helpers/xlsx.mjs");
const { residentColumns } = await import("../lib/resident-import-csv.mjs");
const owner = client(),
  staff = client(),
  anon = client();
let groups = 0;
const pass = (s) => {
  groups++;
  console.log("PASS", s);
};
const today = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Jakarta",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());
const start = new Date(Date.parse(today + "T00:00:00Z") + 86400000);
const workbook = xlsxFixture(
  [
    {
      name: "Rooms",
      data: [
        ["harga", "nomor"],
        [1500000, "X-01"],
        [1750000, "X-02"],
      ],
    },
    {
      name: "Residents",
      data: [
        ["nomor", "nama", "telepon", "mulai", "akhir", "tarif", "hari"],
        ["X-01", "XLSX Resident A", "081234567881", start, null, 1500000, 12],
        ["X-02", "XLSX Resident B", "081234567882", start, null, 1750000, 25],
      ],
    },
  ],
  { date1904: true },
);
async function upload(
  c,
  action,
  {
    bytes = workbook,
    name = "data.xlsx",
    sheet,
    kind = "rooms",
    mapping,
    origin = base,
  } = {},
) {
  const form = new FormData();
  form.set("action", action);
  form.set("kind", kind);
  form.set("file", new Blob([bytes]), name);
  if (sheet) form.set("sheet", sheet);
  if (mapping) form.set("mapping", JSON.stringify(mapping));
  const r = await fetch(base + "/api/import-files", {
    method: "POST",
    headers: { Origin: origin, Cookie: c.cookie },
    body: form,
  });
  return { status: r.status, ...(await r.json()) };
}
try {
  const u = await owner.register("owner");
  await db.organization.update({
    where: { id: u.organizationId },
    data: { plan: "plus" },
  });
  const property = ok(
    await owner.call("/api/manage", {
      action: "property",
      name: "XLSX Import QA",
      type: "KOS",
      count: 1,
      rate: 1000000,
    }),
  );
  assert.equal((await upload(anon, "inspect")).status, 401);
  assert.equal(
    (await upload(owner, "inspect", { origin: "https://attacker.test" }))
      .status,
    403,
  );
  const staffEmail = `xlsx-staff-${suffix}@example.test`;
  ok(
    await staffFixture(db, base, owner.cookie, {
      email: staffEmail,
      password,
      name: "XLSX staff",
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
  assert.equal((await upload(staff, "inspect")).status, 400);
  pass(
    "owner-only workbook reading, anonymous/staff rejection and same-origin guard",
  );
  const before = {
    rooms: await db.room.count({ where: { propertyId: property.id } }),
    guests: await db.guest.count({ where: { propertyId: property.id } }),
    commands: await db.lifecycleCommand.count({
      where: { organizationId: u.organizationId },
    }),
  };
  const listed = ok(await upload(owner, "inspect"));
  assert.deepEqual(listed.sheets, ["Rooms", "Residents"]);
  assert(!JSON.stringify(listed).includes("XLSX Resident"));
  assert.deepEqual(
    ok(await upload(owner, "headers", { sheet: "Rooms" })).headers,
    ["harga", "nomor"],
  );
  assert.equal(
    (await upload(owner, "headers", { sheet: "absent" })).status,
    400,
  );
  const converted = ok(
    await upload(owner, "convert", {
      sheet: "Rooms",
      mapping: { number: 1, rate: 0 },
    }),
  );
  assert.equal(converted.records, 2);
  assert.deepEqual(
    {
      rooms: await db.room.count({ where: { propertyId: property.id } }),
      guests: await db.guest.count({ where: { propertyId: property.id } }),
      commands: await db.lifecycleCommand.count({
        where: { organizationId: u.organizationId },
      }),
    },
    before,
  );
  pass(
    "explicit sheet selection/reordered mapping yields canonical CSV without business writes",
  );
  const roomInput = {
      propertyId: property.id,
      csv: converted.csv,
      mapping: { number: 0, rate: 1 },
    },
    roomPreview = ok(
      await owner.call("/api/room-imports", {
        action: "preview",
        ...roomInput,
      }),
    );
  assert(roomPreview.valid);
  const roomBatch = ok(
    await owner.call("/api/room-imports", {
      action: "commit",
      ...roomInput,
      digest: roomPreview.digest,
      key: randomUUID(),
      confirmed: true,
    }),
  );
  assert.equal(roomBatch.count, 2);
  assert.equal(await db.room.count({ where: { propertyId: property.id } }), 3);
  pass(
    "XLSX room conversion connects to existing digest/confirmed atomic import",
  );
  const residents = ok(
    await upload(owner, "convert", {
      sheet: "Residents",
      kind: "residents",
      mapping: residentColumns,
    }),
  );
  assert(residents.csv.includes(start.toISOString().slice(0, 10)));
  const residentInput = {
      propertyId: property.id,
      csv: residents.csv,
      mapping: residentColumns,
      choices: {},
    },
    residentPreview = ok(
      await owner.call("/api/resident-imports", {
        action: "preview",
        ...residentInput,
      }),
    );
  assert(residentPreview.valid);
  const residentBatch = ok(
    await owner.call("/api/resident-imports", {
      action: "commit",
      ...residentInput,
      digest: residentPreview.digest,
      key: randomUUID(),
      confirmed: true,
    }),
  );
  assert.equal(residentBatch.count, 2);
  const stays = await db.stay.findMany({
    where: { room: { propertyId: property.id } },
    include: { guest: true },
    orderBy: { billingDay: "asc" },
  });
  assert.deepEqual(
    stays.map((s) => s.billingDay),
    [12, 25],
  );
  assert(
    stays.every(
      (s) =>
        s.start === start.toISOString().slice(0, 10) &&
        s.guest.phone.startsWith("+62"),
    ),
  );
  assert.equal(
    await db.invoice.count({ where: { propertyId: property.id } }),
    0,
  );
  assert.equal(
    await db.occupantAccess.count({
      where: { stay: { room: { propertyId: property.id } } },
    }),
    0,
  );
  pass(
    "1904 Excel dates and text phones survive resident import with independent due days; no fabricated financial/accounts",
  );
  const formula = xlsxFixture([
    {
      name: "R",
      data: [
        ["n", "r"],
        ["01", { formula: "1+1", cached: 2 }],
      ],
    },
  ]);
  assert.equal(
    (await upload(owner, "inspect", { bytes: formula })).status,
    400,
  );
  assert.equal(
    (
      await upload(owner, "inspect", {
        bytes: new TextEncoder().encode("not ZIP"),
      })
    ).status,
    400,
  );
  assert.equal(
    (await upload(owner, "inspect", { name: "legacy.xls" })).status,
    400,
  );
  assert.equal(
    (await upload(owner, "inspect", { bytes: new Uint8Array(1100001) })).status,
    400,
  );
  const numeric = xlsxFixture([
    {
      name: "R",
      data: [
        ["n", "r"],
        [1, 1500000],
      ],
    },
  ]);
  assert.equal(
    (
      await upload(owner, "convert", {
        bytes: numeric,
        sheet: "R",
        mapping: { number: 0, rate: 1 },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await upload(owner, "convert", {
        sheet: "Rooms",
        mapping: { number: 0, rate: 0 },
      })
    ).status,
    400,
  );
  pass(
    "cached formulas, fake/legacy/oversized files, numeric identifiers and invalid mapping are rejected",
  );
  assert.equal(
    (
      await owner.call("/api/room-imports", {
        action: "rollback",
        batchId: roomBatch.id,
        key: randomUUID(),
        confirmed: true,
      })
    ).status,
    400,
  );
  ok(
    await owner.call("/api/resident-imports", {
      action: "rollback",
      batchId: residentBatch.id,
      key: randomUUID(),
      confirmed: true,
    }),
  );
  ok(
    await owner.call("/api/room-imports", {
      action: "rollback",
      batchId: roomBatch.id,
      key: randomUUID(),
      confirmed: true,
    }),
  );
  assert.equal(await db.room.count({ where: { propertyId: property.id } }), 1);
  assert.equal(await db.guest.count({ where: { propertyId: property.id } }), 0);
  pass(
    "converted imports retain downstream guard and can be rolled back in dependency order",
  );
  const m = await db.orgMembership.findFirstOrThrow({
    where: { userId: u.id, organizationId: u.organizationId },
  });
  await db.orgMembership.update({
    where: { id: m.id },
    data: { status: "SUSPENDED" },
  });
  assert.notEqual((await upload(owner, "inspect")).status, 200);
  await db.orgMembership.update({
    where: { id: m.id },
    data: { status: "ACTIVE" },
  });
  pass("existing session cannot read workbook after membership revocation");
  await mkdir("artifacts/phase4j", { recursive: true });
  await writeFile(
    "artifacts/phase4j/import-files-api.json",
    JSON.stringify(
      { groups, mainDatabase: false, externalEmail: false },
      null,
      2,
    ),
  );
  await writeFile(
    ".local-secrets/phase4j-browser.json",
    JSON.stringify(
      { email: u.email, password, propertyId: property.id },
      null,
      2,
    ),
  );
  await writeFile(".local-secrets/phase4j-browser.xlsx", workbook);
  console.log(`PASS ${groups} XLSX import API scenario groups`);
} finally {
  await db.$disconnect();
}
