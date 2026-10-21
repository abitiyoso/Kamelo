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
  password = "Room-Import-QA-password-123";
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
      const email = `room-import-${label}-${suffix}@example.test`;
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
try {
  const u = await owner.register("owner"),
    o = await other.register("other");
  const property = ok(
    await owner.call("/api/manage", {
      action: "property",
      name: "Import QA Residence",
      type: "KOS",
      count: 1,
      rate: 1000000,
    }),
  );
  const data = {
    propertyId: property.id,
    csv: "nomor,tarif\nA01,1200000\nA02,1300000",
    mapping: { number: 0, rate: 1 },
  };
  const post = (action, p = {}) =>
    owner.call("/api/room-imports", { action, ...data, ...p });
  assert.equal(
    (await anon.call("/api/room-imports?propertyId=" + property.id)).status,
    401,
  );
  assert.equal(
    (await other.call("/api/room-imports", { action: "preview", ...data }))
      .status,
    400,
  );
  assert.equal(
    (await other.call("/api/room-imports?propertyId=" + property.id)).status,
    403,
  );
  assert.equal(
    (
      await owner.call(
        "/api/room-imports",
        { action: "preview", ...data },
        "https://untrusted.example",
      )
    ).status,
    403,
  );
  pass("anonymous/cross-organization/origin guards");
  await db.organization.update({
    where: { id: u.organizationId },
    data: { plan: "plus" },
  });
  const staffEmail = `room-import-staff-${suffix}@example.test`;
  ok(
    await staffFixture(db, base, owner.cookie, {
      email: staffEmail,
      password,
      name: "Import staff",
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
  assert.equal(
    (await staff.call("/api/room-imports", { action: "preview", ...data }))
      .status,
    400,
  );
  assert.equal(
    (await staff.call("/api/room-imports?propertyId=" + property.id)).status,
    403,
  );
  pass("staff cannot preview, commit or read owner import history");
  assert.equal(
    (
      await staff.call("/api/room-imports", {
        action: "commit",
        ...data,
        key: randomUUID(),
        digest: "fake",
        confirmed: true,
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await staff.call("/api/room-imports", {
        action: "rollback",
        batchId: "fake",
        key: randomUUID(),
        confirmed: true,
      })
    ).status,
    400,
  );
  const template = await fetch(base + "/templates/kamelo-kamar.csv");
  assert.equal(template.status, 200);
  assert((await template.text()).startsWith("nomor,tarif"));
  const before = await db.room.count({ where: { propertyId: property.id } }),
    preview = ok(await post("preview"));
  assert(preview.valid);
  assert.equal(
    await db.room.count({ where: { propertyId: property.id } }),
    before,
  );
  const key = randomUUID(),
    commit = { key, digest: preview.digest, confirmed: true };
  assert.equal(
    (await post("commit", { ...commit, confirmed: false })).status,
    400,
  );
  assert.equal(
    (await post("commit", { ...commit, digest: "stale" })).status,
    400,
  );
  pass(
    "preview is read-only and commit requires confirmation and unchanged digest",
  );
  const financial = async () =>
    createHash("sha256")
      .update(
        JSON.stringify(
          await Promise.all([
            db.invoice.findMany({ where: { propertyId: property.id } }),
            db.guest.findMany({ where: { propertyId: property.id } }),
            db.stay.findMany({ where: { room: { propertyId: property.id } } }),
          ]),
        ),
      )
      .digest("hex");
  const financialBefore = await financial();
  const committed = ok(await post("commit", commit));
  assert.equal(committed.count, 2);
  assert.deepEqual(ok(await post("commit", commit)), committed);
  assert.equal(
    (await post("commit", { ...commit, csv: "nomor,tarif\nA03,5" })).status,
    400,
  );
  assert.equal(
    await db.room.count({ where: { propertyId: property.id } }),
    before + 2,
  );
  assert.equal(financialBefore, await financial());
  pass(
    "atomic commit, exact retry and actor-bound keys; no guests/stays/invoices created",
  );
  assert(!ok(await post("preview")).valid);
  assert(
    !ok(await post("preview", { csv: "number,rate\nB01,1\nb01,2" })).valid,
  );
  const bad = ok(
    await post("preview", { csv: "number,rate\nB01,1\nB02,1.000" }),
  );
  assert(!bad.valid);
  assert.equal(
    (
      await post("commit", {
        key: randomUUID(),
        digest: bad.digest,
        confirmed: true,
        csv: "number,rate\nB01,1\nB02,1.000",
      })
    ).status,
    400,
  );
  assert.equal(
    await db.room.count({ where: { propertyId: property.id } }),
    before + 2,
  );
  pass("existing/case-insensitive/invalid-row collisions block entire batch");
  await db.organization.update({
    where: { id: u.organizationId },
    data: { plan: "plus", planExpiresAt: new Date(0) },
  });
  const cap = ok(await post("preview", { csv: "n,r\nB1,1\nB2,2\nB3,3" }));
  assert(!cap.valid);
  assert(cap.capacityError.includes("5"));
  await db.organization.update({
    where: { id: u.organizationId },
    data: { planExpiresAt: null },
  });
  const stale = ok(await post("preview", { csv: "n,r\nB1,1" }));
  ok(
    await owner.call("/api/manage", {
      action: "room",
      propertyId: property.id,
      number: "B1",
      rate: 1,
    }),
  );
  assert.equal(
    (
      await post("commit", {
        key: randomUUID(),
        digest: stale.digest,
        confirmed: true,
        csv: "n,r\nB1,1",
      })
    ).status,
    400,
  );
  pass(
    "expired plan uses free limit and intervening writes invalidate preview",
  );
  const rollbackKey = randomUUID();
  const rolled = ok(
    await owner.call("/api/room-imports", {
      action: "rollback",
      batchId: committed.id,
      key: rollbackKey,
      confirmed: true,
    }),
  );
  assert.deepEqual(
    ok(
      await owner.call("/api/room-imports", {
        action: "rollback",
        batchId: committed.id,
        key: rollbackKey,
        confirmed: true,
      }),
    ),
    rolled,
  );
  assert.equal(
    await db.room.count({
      where: { propertyId: property.id, number: { in: ["A01", "A02"] } },
    }),
    0,
  );
  assert.equal(
    (
      await owner.call("/api/room-imports", {
        action: "rollback",
        batchId: committed.id,
        key: randomUUID(),
        confirmed: true,
      })
    ).status,
    400,
  );
  pass(
    "rollback removes only batch rooms, preserves history and supports exact retry",
  );
  const importNew = async (csv) => {
    const p = ok(await post("preview", { csv }));
    assert(p.valid);
    return ok(
      await post("commit", {
        csv,
        key: randomUUID(),
        digest: p.digest,
        confirmed: true,
      }),
    );
  };
  const guarded = await importNew("n,r\nC1,5\nC2,6");
  const c2 = await db.room.findFirstOrThrow({
    where: { propertyId: property.id, number: "C2" },
  });
  ok(
    await owner.call("/api/manage", {
      action: "roomUpdate",
      propertyId: property.id,
      roomId: c2.id,
      number: c2.number,
      rate: 7,
      operational: "READY",
    }),
  );
  assert.equal(
    (
      await owner.call("/api/room-imports", {
        action: "rollback",
        batchId: guarded.id,
        key: randomUUID(),
        confirmed: true,
      })
    ).status,
    400,
  );
  assert.equal(
    await db.room.count({
      where: { propertyId: property.id, number: { in: ["C1", "C2"] } },
    }),
    2,
  );
  pass(
    "edited room blocks rollback atomically, including earlier unchanged rows",
  );
  const used = await importNew("n,r\nD1,1000000"),
    d1 = await db.room.findFirstOrThrow({
      where: { propertyId: property.id, number: "D1" },
    });
  ok(
    await owner.call("/api/manage", {
      action: "stay",
      propertyId: property.id,
      roomId: d1.id,
      name: "Import resident",
      phone: "081234567892",
      start: "2026-10-19",
      rate: 1000000,
      billingDay: 12,
    }),
  );
  const financialUsed = await financial();
  assert.equal(
    (
      await owner.call("/api/room-imports", {
        action: "rollback",
        batchId: used.id,
        key: randomUUID(),
        confirmed: true,
      })
    ).status,
    400,
  );
  assert.equal(financialUsed, await financial());
  assert.equal(
    (
      await other.call("/api/room-imports", {
        action: "rollback",
        batchId: used.id,
        key: randomUUID(),
        confirmed: true,
      })
    ).status,
    400,
  );
  pass(
    "occupied room/cross-organization rollback denied; downstream records preserved",
  );
  const concurrentCsv = "n,r\nE1,1",
    concurrentPreview = ok(await post("preview", { csv: concurrentCsv }));
  const race = await Promise.all(
    [1, 2].map(() =>
      post("commit", {
        csv: concurrentCsv,
        key: randomUUID(),
        digest: concurrentPreview.digest,
        confirmed: true,
      }),
    ),
  );
  assert.deepEqual(race.map((r) => r.status).sort(), [200, 400]);
  assert.equal(
    await db.room.count({ where: { propertyId: property.id, number: "E1" } }),
    1,
  );
  pass("concurrent identical imports serialize; exactly one new room");
  const history = ok(
    await owner.call("/api/room-imports?propertyId=" + property.id),
  );
  assert(
    history.rows.some(
      (b) => b.id === committed.id && b.status === "ROLLED_BACK",
    ),
  );
  assert(
    history.rows.every((b) => !("roomSnapshots" in b) && !("actorId" in b)),
  );
  await assert.rejects(
    db.roomImportBatch.update({
      where: { id: committed.id },
      data: { status: "COMMITTED", rolledBackAt: null, rolledBackBy: null },
    }),
  );
  await assert.rejects(
    db.roomImportBatch.delete({ where: { id: committed.id } }),
  );
  pass(
    "scoped minimal history plus immutable database snapshots and one-way rollback",
  );
  const membership = await db.orgMembership.findFirstOrThrow({
    where: { organizationId: u.organizationId, userId: u.id },
  });
  await db.orgMembership.update({
    where: { id: membership.id },
    data: { status: "SUSPENDED" },
  });
  assert.notEqual((await post("preview")).status, 200);
  await db.orgMembership.update({
    where: { id: membership.id },
    data: { status: "ACTIVE" },
  });
  pass("revoked membership is revalidated for existing sessions");
  await mkdir("artifacts/phase4h", { recursive: true });
  await writeFile(
    "artifacts/phase4h/room-import-api.json",
    JSON.stringify(
      { groups, externalEmail: false, mainDatabase: false },
      null,
      2,
    ),
  );
  await writeFile(
    ".local-secrets/phase4h-browser.json",
    JSON.stringify(
      { email: u.email, password, propertyId: property.id },
      null,
      2,
    ),
  );
  console.log(`PASS ${groups} room import API scenario groups`);
} finally {
  await db.$disconnect();
}
