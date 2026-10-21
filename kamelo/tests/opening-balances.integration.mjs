import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { PrismaClient } from "../generated/prisma/index.js";
import { verifiedFixture, staffFixture } from "./helpers/identity.mjs";
import { openingColumns as mapping } from "../lib/opening-balances-csv.mjs";
import { xlsxFixture } from "./helpers/xlsx.mjs";
const url = new URL(process.env.DATABASE_URL || "http://invalid"),
  base = process.env.TEST_URL;
assert.equal(url.hostname, "127.0.0.1");
assert.equal(url.port, "55432");
assert.equal(url.pathname, "/kamelo_phase2_qa");
assert.equal(base, "http://127.0.0.1:3001");
const db = new PrismaClient(),
  suffix = Date.now(),
  password = "Opening-AR-QA-password-123";
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
      const email = `opening-${label}-${suffix}@example.test`;
      ok(
        await this.call("/api/auth", {
          action: "register",
          name: "Opening QA " + label,
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
const today = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Jakarta",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());
const header = "nama,telepon,referensi,nominal,jatuh_tempo\n";
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
      name: "Opening Receivables QA",
      type: "KOS",
      count: 3,
      rate: 1500000,
    }),
  );
  const guest = await db.guest.create({
      data: {
        propertyId: property.id,
        name: "Opening Resident QA",
        phone: "081234567881",
      },
    }),
    foreign = ok(
      await other.call("/api/manage", {
        action: "property",
        name: "Foreign Opening QA",
        type: "KOS",
        count: 1,
        rate: 1500000,
      }),
    );
  const data = {
    propertyId: property.id,
    csv:
      header + "Opening Resident QA,081234567881,LEGACY-001,1500000,2026-09-15",
    mapping,
    asOf: today,
    sourceNote: "Synthetic legacy ledger checked by QA owner",
    choices: { 2: guest.id },
  };
  const post = (action, p = {}) =>
    owner.call("/api/opening-balances", { action, ...data, ...p });
  const get = (extra = "") =>
    owner.call("/api/opening-balances?propertyId=" + property.id + extra);
  const commit = async (p = {}) => {
    const preview = ok(await post("preview", p));
    assert(preview.valid, JSON.stringify(preview));
    return ok(
      await post("commit", {
        ...p,
        digest: preview.digest,
        confirmed: true,
        key: randomUUID(),
      }),
    );
  };
  const voidBatch = (id, p = {}) =>
    post("void", {
      batchId: id,
      reason: "Synthetic source reconciliation correction",
      confirmed: true,
      key: randomUUID(),
      ...p,
    });
  assert.equal(
    (await anon.call("/api/opening-balances?propertyId=all")).status,
    401,
  );
  assert.equal(
    (await other.call("/api/opening-balances?propertyId=" + property.id))
      .status,
    403,
  );
  assert.equal(
    (await other.call("/api/opening-balances", { action: "preview", ...data }))
      .status,
    400,
  );
  assert.equal(
    (
      await owner.call(
        "/api/opening-balances",
        { action: "preview", ...data },
        "https://untrusted.example",
      )
    ).status,
    403,
  );
  const staffEmail = `opening-staff-${suffix}@example.test`;
  ok(
    await staffFixture(db, base, owner.cookie, {
      name: "Opening QA Staff",
      email: staffEmail,
      password,
      phone: "081234567882",
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
    (await staff.call("/api/opening-balances?propertyId=all")).status,
    403,
  );
  assert.equal(
    (await staff.call("/api/opening-balances", { action: "preview", ...data }))
      .status,
    400,
  );
  pass("anonymous, cross-owner, staff and hostile-origin access denied");
  const counts = async () => ({
    guests: await db.guest.count({ where: { propertyId: property.id } }),
    batches: await db.openingBalanceBatch.count({
      where: { propertyId: property.id },
    }),
  });
  const beforeCounts = await counts(),
    p = ok(await post("preview", { choices: {} }));
  assert(!p.valid);
  assert.equal(p.rows[0].candidates[0].id, guest.id);
  assert.equal(p.rows[0].candidates[0].phone, "…7881");
  assert.deepEqual(await counts(), beforeCounts);
  assert(!ok(await post("preview", { choices: { 2: "foreign-guest" } })).valid);
  assert(
    !ok(await post("preview", { csv: data.csv.replace("1500000", "0") })).valid,
  );
  assert(
    !ok(
      await post("preview", {
        csv:
          data.csv +
          "\nOpening Resident QA,081234567881,legacy-001,500,2026-09-15",
      }),
    ).valid,
  );
  assert.equal((await post("preview", { asOf: "2099-01-01" })).status, 400);
  pass(
    "preview is read-only, requires explicit scoped profile and rejects invalid or duplicate debt",
  );
  const financialSnapshot = async () => {
    const out = {};
    for (const table of [
      "Invoice",
      "Payment",
      "DepositAccount",
      "DepositEntry",
      "Expense",
      "FinanceMatch",
    ])
      out[table] = createHash("sha256")
        .update(
          JSON.stringify(
            await db.$queryRawUnsafe(`SELECT * FROM "${table}" ORDER BY id`),
          ),
        )
        .digest("hex");
    return out;
  };
  const financialBefore = await financialSnapshot();
  const preview = ok(await post("preview"));
  assert(preview.valid);
  assert.equal(preview.total, 1500000);
  assert.equal(
    (await post("commit", { digest: preview.digest, key: randomUUID() }))
      .status,
    400,
  );
  assert.equal(
    (
      await post("commit", {
        digest: preview.digest,
        key: randomUUID(),
        confirmed: true,
        sourceNote: "Changed source notes invalidate approval",
      })
    ).status,
    400,
  );
  const command = {
      digest: preview.digest,
      confirmed: true,
      key: randomUUID(),
    },
    record = ok(await post("commit", command));
  assert.deepEqual(ok(await post("commit", command)), record);
  assert.equal(
    (
      await post("commit", {
        ...command,
        sourceNote: "Changed idempotency payload denied",
      })
    ).status,
    400,
  );
  assert.equal(
    await db.openingReceivable.count({ where: { batchId: record.id } }),
    1,
  );
  assert.deepEqual(await financialSnapshot(), financialBefore);
  pass(
    "explicit confirmation, digest binding and exact retries produce one batch without cash or invoice writes",
  );
  const summary = ok(await get("&batchId=" + record.id));
  assert.equal(summary.summary.total, 1500000);
  assert.equal(summary.summary.overdue, 1500000);
  assert.equal(summary.detail.sourceNote, data.sourceNote);
  assert(!JSON.stringify(summary).includes("encryptedSourceNote"));
  const encrypted = await db.openingBalanceBatch.findUniqueOrThrow({
    where: { id: record.id },
  });
  assert.notEqual(encrypted.encryptedSourceNote, data.sourceNote);
  const audits = await db.audit.findMany({ where: { targetId: record.id } });
  assert(!JSON.stringify(audits).includes(data.sourceNote));
  assert.equal(
    (
      await owner.call(
        "/api/opening-balances?propertyId=" +
          foreign.id +
          "&batchId=" +
          record.id,
      )
    ).status,
    403,
  );
  assert(!ok(await post("preview")).valid);
  pass(
    "separate overdue totals, scoped detail, encrypted source notes and duplicate-source blocking",
  );
  const row = await db.openingReceivable.findFirstOrThrow({
    where: { batchId: record.id },
  });
  await assert.rejects(
    db.openingReceivable.update({ where: { id: row.id }, data: { amount: 1 } }),
  );
  await assert.rejects(db.openingReceivable.delete({ where: { id: row.id } }));
  await assert.rejects(
    db.openingReceivable.update({
      where: { id: row.id },
      data: { status: "VOID" },
    }),
  );
  await assert.rejects(
    db.openingBalanceBatch.update({
      where: { id: record.id },
      data: { recordCount: 2 },
    }),
  );
  await assert.rejects(
    db.openingBalanceBatch.create({
      data: {
        propertyId: property.id,
        asOf: today,
        recordCount: 1,
        encryptedSourceNote: "test",
        actorId: u.id,
      },
    }),
  );
  const foreignGuest = await db.guest.create({
    data: { propertyId: foreign.id, name: "Foreign QA", phone: "081234567889" },
  });
  await assert.rejects(
    db.$transaction(async (tx) => {
      const b = await tx.openingBalanceBatch.create({
        data: {
          propertyId: property.id,
          asOf: today,
          recordCount: 1,
          encryptedSourceNote: "test",
          actorId: u.id,
        },
      });
      await tx.openingReceivable.create({
        data: {
          batchId: b.id,
          propertyId: property.id,
          guestId: foreignGuest.id,
          reference: "CROSS-SCOPE",
          sourceKey: "CROSS-SCOPE",
          amount: 1,
          due: today,
        },
      });
    }),
  );
  assert.equal((await get()).summary.total, 1500000);
  pass(
    "database blocks edits, deletion, partial void, incomplete batches and cross-property row linkage",
  );
  assert.equal((await voidBatch(record.id, { confirmed: false })).status, 400);
  const voidCommand = {
    batchId: record.id,
    reason: "Synthetic source reconciliation correction",
    confirmed: true,
    key: randomUUID(),
  };
  const voided = ok(await post("void", voidCommand));
  assert.deepEqual(ok(await post("void", voidCommand)), voided);
  const detail = ok(await get("&batchId=" + record.id));
  assert.equal(detail.summary.total, 0);
  assert.equal(detail.detail.status, "VOID");
  assert.equal(detail.detail.rows[0].amount, 1500000);
  assert.equal(detail.detail.rows[0].status, "VOID");
  assert.equal(detail.detail.voidReason, voidCommand.reason);
  await assert.rejects(db.guest.delete({ where: { id: guest.id } }));
  assert.deepEqual(await financialSnapshot(), financialBefore);
  await commit();
  pass(
    "whole-batch void retains source history, blocks profile deletion and allows corrected source re-entry",
  );
  const concurrentData = { csv: data.csv.replace("LEGACY-001", "RACE-001") },
    race = ok(await post("preview", concurrentData));
  const results = await Promise.all(
    [1, 2].map(() =>
      post("commit", {
        ...concurrentData,
        digest: race.digest,
        confirmed: true,
        key: randomUUID(),
      }),
    ),
  );
  assert.equal(results.filter((r) => r.status === 200).length, 1);
  pass("concurrent duplicate references commit once");
  const largeCsv =
    header +
    Array.from(
      { length: 4 },
      (_, i) =>
        `Opening Resident QA,081234567881,BIG-${i},1000000000,2026-09-15`,
    ).join("\n");
  const large = await commit({
    csv: largeCsv,
    choices: { 2: guest.id, 3: guest.id, 4: guest.id, 5: guest.id },
  });
  assert.equal(ok(await get()).summary.total, 4003000000);
  ok(await voidBatch(large.id));
  pass(
    "aggregate totals above PostgreSQL integer range retain exact rupiah values",
  );
  const workbook = xlsxFixture([
    {
      name: "Opening",
      data: [
        ["nama", "telepon", "referensi", "nominal", "jatuh_tempo"],
        [
          "Opening Resident QA",
          "081234567881",
          "XLSX-OPEN-001",
          250000,
          new Date("2026-09-15T00:00:00Z"),
        ],
      ],
    },
  ]);
  const form = new FormData();
  form.set("action", "convert");
  form.set("kind", "balances");
  form.set("sheet", "Opening");
  form.set("mapping", JSON.stringify(mapping));
  form.set("file", new Blob([workbook]), "opening.xlsx");
  const convertedResponse = await fetch(base + "/api/import-files", {
    method: "POST",
    headers: { Origin: base, Cookie: owner.cookie },
    body: form,
  });
  assert.equal(convertedResponse.status, 200);
  const converted = await convertedResponse.json();
  await commit({ csv: converted.csv });
  for (const ext of ["csv", "xlsx"]) {
    const r = await fetch(base + "/templates/kamelo-saldo-awal." + ext);
    assert.equal(r.status, 200);
    assert((await r.arrayBuffer()).byteLength > 50);
  }
  pass(
    "real XLSX upload converts native dates and commits through unchanged preview; both templates downloadable",
  );
  // Newly imported profiles must remain even after their opening balance is voided.
  const room = await db.room.findFirstOrThrow({
    where: { propertyId: property.id },
    orderBy: { number: "asc" },
  });
  const residentData = {
    propertyId: property.id,
    csv:
      "room,name,phone,start,end,rate,day\n" +
      `${room.number},Opening Imported Resident,081234567883,${today},,1500000,15`,
    mapping: {
      number: 0,
      name: 1,
      phone: 2,
      start: 3,
      end: 4,
      rate: 5,
      billingDay: 6,
    },
    choices: {},
  };
  const rp = ok(
    await owner.call("/api/resident-imports", {
      action: "preview",
      ...residentData,
    }),
  );
  assert(rp.valid, JSON.stringify(rp));
  const rb = ok(
    await owner.call("/api/resident-imports", {
      action: "commit",
      ...residentData,
      digest: rp.digest,
      confirmed: true,
      key: randomUUID(),
    }),
  );
  const rg = await db.guest.findFirstOrThrow({
    where: { propertyId: property.id, name: "Opening Imported Resident" },
  });
  const imported = await commit({
    csv:
      header +
      "Opening Imported Resident,081234567883,IMPORT-PROFILE-001,1000,2026-09-15",
    choices: { 2: rg.id },
  });
  ok(await voidBatch(imported.id));
  assert.equal(
    (
      await owner.call("/api/resident-imports", {
        action: "rollback",
        batchId: rb.id,
        confirmed: true,
        key: randomUUID(),
      })
    ).status,
    400,
  );
  pass(
    "resident rollback preserves newly imported profiles linked to even voided financial history",
  );
  const importedStay = await db.stay.findFirstOrThrow({
    where: { guestId: rg.id },
  });
  const invoice = await db.invoice.create({
    data: {
      propertyId: property.id,
      roomId: room.id,
      guestId: rg.id,
      stayId: importedStay.id,
      number: "KAMELO-EXISTING-" + suffix,
      date: today,
      due: today,
      status: "VOID",
      total: 10,
      items: [],
    },
  });
  assert(
    !ok(
      await post("preview", {
        csv:
          header +
          `Opening Resident QA,081234567881,${invoice.number},10,2026-09-15`,
      }),
    ).valid,
  );
  pass(
    "existing Kamelo invoice references cannot be reintroduced as opening debt",
  );
  for (let i = 0; i < 21; i++)
    await db.$transaction(async (tx) => {
      const b = await tx.openingBalanceBatch.create({
        data: {
          propertyId: property.id,
          asOf: today,
          recordCount: 1,
          encryptedSourceNote: encrypted.encryptedSourceNote,
          actorId: u.id,
        },
      });
      await tx.openingReceivable.create({
        data: {
          batchId: b.id,
          propertyId: property.id,
          guestId: guest.id,
          reference: "PAGED-" + i,
          sourceKey: "PAGED-" + i,
          amount: 1,
          due: today,
        },
      });
    });
  const page1 = ok(await get()),
    page2 = ok(await get("&page=2"));
  assert.equal(page1.batches.length, 20);
  assert(page2.batches.length > 0);
  assert(!page2.batches.some((b) => page1.batches.some((a) => a.id === b.id)));
  assert.deepEqual(
    ok(await owner.call("/api/opening-balances?propertyId=all")).summary,
    page1.summary,
  );
  assert.equal((await get("&page=0")).status, 403);
  pass(
    "bounded history pagination and all-property totals preserve owner scope",
  );
  const membership = await db.orgMembership.findFirstOrThrow({
    where: { userId: u.id, organizationId: u.organizationId },
  });
  await db.orgMembership.update({
    where: { id: membership.id },
    data: { status: "SUSPENDED" },
  });
  assert.equal((await get()).status, 403);
  assert.equal((await post("preview")).status, 400);
  await db.orgMembership.update({
    where: { id: membership.id },
    data: { status: "ACTIVE" },
  });
  pass("fresh membership revocation prevents reads and writes");
  await mkdir("artifacts/phase4k", { recursive: true });
  await writeFile(
    "artifacts/phase4k/opening-balances-api.json",
    JSON.stringify(
      { groups, externalEmail: false, mainDatabase: false },
      null,
      2,
    ),
  );
  await writeFile(
    ".local-secrets/phase4k-browser.json",
    JSON.stringify(
      { email: u.email, password, propertyId: property.id, guestId: guest.id },
      null,
      2,
    ),
  );
  await writeFile(
    ".local-secrets/phase4k-browser.xlsx",
    xlsxFixture([
      {
        name: "Saldo awal",
        data: [
          ["nama", "telepon", "referensi", "nominal", "jatuh_tempo"],
          [
            "Opening Resident QA",
            "081234567881",
            "BROWSER-OPEN-001",
            750000,
            new Date("2026-09-15T00:00:00Z"),
          ],
        ],
      },
    ]),
  );
  console.log(`PASS ${groups} opening balance API scenario groups`);
} finally {
  await db.$disconnect();
}
