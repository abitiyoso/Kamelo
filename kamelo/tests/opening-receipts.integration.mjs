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
  password = "Receipt-QA-password-123";
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
      const email = `receipt-${label}-${suffix}@example.test`;
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
      name: "Opening Receipt QA",
      type: "KOS",
      count: 1,
      rate: 1500000,
    }),
  );
  const guest = await db.guest.create({
    data: {
      propertyId: property.id,
      name: "Receipt Resident QA",
      phone: "081234567881",
    },
  });
  const source = {
    propertyId: property.id,
    csv:
      header + "Receipt Resident QA,081234567881,SETTLE-001,1500000,2026-09-15",
    mapping,
    choices: { 2: guest.id },
    asOf: today,
    sourceNote: "Synthetic original ledger reviewed before settlement",
  };
  const preview = ok(
    await owner.call("/api/opening-balances", { action: "preview", ...source }),
  );
  assert(preview.valid);
  const batch = ok(
    await owner.call("/api/opening-balances", {
      action: "commit",
      ...source,
      confirmed: true,
      key: randomUUID(),
      digest: preview.digest,
    }),
  );
  const row = await db.openingReceivable.findFirstOrThrow({
    where: { batchId: batch.id },
  });
  const post = (action, p = {}) =>
    owner.call("/api/opening-balances", {
      action,
      receivableId: row.id,
      confirmed: true,
      key: randomUUID(),
      note: "Synthetic receipt independently reviewed",
      ...p,
    });
  const report = () =>
    owner.call(
      `/api/finance?propertyId=${property.id}&from=${today}&to=${today}&view=movements`,
    );
  const detail = async (page = 1) =>
    ok(
      await owner.call(
        `/api/opening-balances?propertyId=${property.id}&receivableId=${row.id}&page=${page}`,
      ),
    ).receipt;
  const totals = async () =>
    ok(await owner.call(`/api/opening-balances?propertyId=${property.id}`))
      .summary;
  const receipt = {
    amount: 500000,
    date: today,
    method: "TRANSFER",
    reference: "BANK-RECEIPT-001",
  };
  assert.equal(
    (
      await anon.call("/api/opening-balances", {
        action: "receipt",
        ...receipt,
        receivableId: row.id,
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await other.call("/api/opening-balances", {
        action: "receipt",
        ...receipt,
        receivableId: row.id,
        confirmed: true,
        key: randomUUID(),
        note: "Other owner denied receipt",
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await other.call(
        `/api/opening-balances?propertyId=all&receivableId=${row.id}`,
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await owner.call(
        "/api/opening-balances",
        { action: "receipt", ...receipt, receivableId: row.id },
        "https://untrusted.example",
      )
    ).status,
    403,
  );
  const staffEmail = `receipt-staff-${suffix}@example.test`;
  ok(
    await staffFixture(db, base, owner.cookie, {
      name: "Receipt QA Staff",
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
    (
      await staff.call("/api/opening-balances", {
        action: "receipt",
        ...receipt,
        receivableId: row.id,
        confirmed: true,
        key: randomUUID(),
        note: "Staff cannot record opening debt",
      })
    ).status,
    400,
  );
  pass(
    "fresh owner-only receipt access, cross-owner isolation, anonymous/staff and hostile-origin denial",
  );
  const counts = async () => ({
    invoices: await db.invoice.count({ where: { propertyId: property.id } }),
    payments: await db.payment.count({
      where: { invoice: { propertyId: property.id } },
    }),
    deposits: await db.depositEntry.count({
      where: { account: { stay: { room: { propertyId: property.id } } } },
    }),
  });
  const before = await counts();
  for (const p of [
    { confirmed: false },
    { amount: 0 },
    { amount: 1500001 },
    { amount: 1.5 },
    { date: "2099-01-01" },
    { date: "1900-01-01" },
    { date: "2026-02-30" },
    { reference: "x" },
    { note: "short" },
  ])
    assert.equal((await post("receipt", { ...receipt, ...p })).status, 400);
  assert.equal((await detail()).remaining, 1500000);
  assert.equal(ok(await report()).summary.rentReceived, 0);
  pass(
    "confirmation, real dates since cutover, integer amounts, source balance and review details are enforced",
  );
  const command = { ...receipt, key: randomUUID() },
    first = ok(await post("receipt", command));
  assert.deepEqual(ok(await post("receipt", command)), first);
  assert.equal((await post("receipt", { ...command, amount: 1 })).status, 400);
  assert.equal(
    (await post("receipt", { ...receipt, reference: "bank-receipt-001" }))
      .status,
    400,
  );
  let d = await detail();
  assert.equal(d.paid, 500000);
  assert.equal(d.remaining, 1000000);
  assert.equal((await totals()).total, 1000000);
  const cash = ok(await report());
  assert.equal(cash.summary.rentReceived, 500000);
  assert.equal(cash.summary.surplus, 500000);
  assert.equal(cash.rows.length, 1);
  assert.equal(cash.rows[0].source, "OPENING");
  assert.equal(cash.summary.unmatched, 1);
  assert.equal(cash.summary.chart[0].income, 500000);
  assert.deepEqual(await counts(), before);
  const raw = await db.openingReceipt.findUniqueOrThrow({
    where: { id: first.id },
  });
  assert(!raw.encryptedNote.includes("independently"));
  const audits = await db.audit.findMany({ where: { targetId: first.id } });
  assert(!JSON.stringify(audits).includes("independently"));
  assert(!JSON.stringify(d).includes("encryptedNote"));
  pass(
    "partial receipt is idempotent, encrypted and reduces debt while entering cash/chart once without fake invoices",
  );
  const second = ok(
    await post("receipt", {
      ...receipt,
      amount: 1000000,
      reference: "BANK-RECEIPT-002",
    }),
  );
  assert.equal((await detail()).remaining, 0);
  assert.equal((await totals()).count, 0);
  assert.equal(
    (await post("receipt", { ...receipt, amount: 1, reference: "OVER-001" }))
      .status,
    400,
  );
  pass("full settlement closes outstanding count and prevents overcollection");
  const finance = (action, p) =>
    owner.call("/api/lifecycle", {
      action,
      propertyId: property.id,
      key: randomUUID(),
      confirmed: true,
      ...p,
    });
  assert.equal(
    (
      await finance("financeMatch", {
        source: "OPENING",
        entryId: first.id,
        amount: 1,
        direction: "IN",
        statementDate: today,
        statementReference: "STMT-001",
        note: "Statement reviewed for synthetic QA",
      })
    ).status,
    400,
  );
  const match = ok(
    await finance("financeMatch", {
      source: "OPENING",
      entryId: first.id,
      amount: 500000,
      direction: "IN",
      statementDate: today,
      statementReference: "STMT-001",
      note: "Statement reviewed for synthetic QA",
    }),
  );
  assert.equal(
    (await post("reverseReceipt", { entryId: first.id })).status,
    400,
  );
  assert.equal(ok(await report()).summary.matched, 1);
  const md = ok(
    await owner.call(
      `/api/finance?propertyId=${property.id}&from=${today}&to=${today}&entryId=${first.id}&source=OPENING`,
    ),
  );
  assert.equal(md.activeMatch.id, match.matchId);
  await assert.rejects(
    db.financeMatch.update({
      where: { id: match.matchId },
      data: { openingReceiptId: second.id },
    }),
  );
  ok(
    await finance("financeUnmatch", {
      matchId: match.matchId,
      note: "Synthetic statement matching correction",
    }),
  );
  pass(
    "opening receipts reuse scoped bank matching and prevent correction while matched; source stays immutable",
  );
  const reversalCommand = {
    entryId: first.id,
    key: randomUUID(),
    note: "Original receipt was duplicate data entry",
  };
  const reversal = ok(await post("reverseReceipt", reversalCommand));
  assert.deepEqual(ok(await post("reverseReceipt", reversalCommand)), reversal);
  assert.equal(
    (await post("reverseReceipt", { entryId: first.id })).status,
    400,
  );
  assert.equal((await detail()).remaining, 500000);
  assert.equal(ok(await report()).summary.rentReceived, 1000000);
  const rev = await db.openingReceipt.findUniqueOrThrow({
    where: { id: reversal.id },
  });
  assert.equal(rev.date, raw.date);
  assert.equal(rev.delta, -raw.delta);
  assert.equal(rev.reference, raw.reference);
  assert.equal(
    (
      await post("void", {
        batchId: batch.id,
        reason: "Source cannot be removed after receipt history",
      })
    ).status,
    400,
  );
  assert.equal((await post("receipt", receipt)).status, 400);
  pass(
    "exact reversal reopens debt and corrects original-period cash while retaining source and reserved references",
  );
  await assert.rejects(
    db.openingReceipt.update({ where: { id: second.id }, data: { delta: 1 } }),
  );
  await assert.rejects(db.openingReceipt.delete({ where: { id: second.id } }));
  await assert.rejects(
    db.openingReceivable.update({
      where: { id: row.id },
      data: { status: "VOID" },
    }),
  );
  await assert.rejects(
    db.openingReceipt.create({
      data: {
        receivableId: row.id,
        kind: "REVERSAL",
        delta: -1,
        date: today,
        method: "TRANSFER",
        reference: "BAD-REV",
        actorId: u.id,
        encryptedNote: "test",
        reversesId: second.id,
      },
    }),
  );
  await assert.rejects(
    db.openingReceipt.create({
      data: {
        receivableId: row.id,
        kind: "RECEIPT",
        delta: 500001,
        date: today,
        method: "TRANSFER",
        reference: "BAD-OVER",
        actorId: u.id,
        encryptedNote: "test",
      },
    }),
  );
  pass(
    "database independently blocks source void, receipt edits/deletion, malformed offsets and excess collection",
  );
  const concurrent = await Promise.all(
    ["RACE-A", "RACE-B"].map((reference) =>
      post("receipt", { ...receipt, reference }),
    ),
  );
  assert.equal(concurrent.filter((r) => r.status === 200).length, 1);
  assert.equal((await detail()).remaining, 0);
  assert.equal(ok(await report()).summary.rentReceived, 1500000);
  const csv = await fetch(
    base +
      `/api/finance?propertyId=${property.id}&from=${today}&to=${today}&view=movements&format=csv`,
    { headers: { Cookie: owner.cookie } },
  );
  assert.equal(csv.status, 200);
  assert((await csv.text()).includes("OPENING_RECEIPT"));
  pass(
    "simultaneous receipts cannot overcollect and cash CSV includes original plus correction records",
  );
  // More than one page of immutable receipt history; amounts remain within source limit.
  const active = await db.openingReceipt.findFirstOrThrow({
    where: { receivableId: row.id, reference: { in: ["RACE-A", "RACE-B"] } },
  });
  ok(await post("reverseReceipt", { entryId: active.id }));
  for (let i = 0; i < 20; i++)
    await db.openingReceipt.create({
      data: {
        receivableId: row.id,
        kind: "RECEIPT",
        delta: 1,
        date: today,
        method: "CASH",
        reference: "PAGE-" + i,
        actorId: u.id,
        encryptedNote: raw.encryptedNote,
      },
    });
  const p1 = await detail(),
    p2 = await detail(2);
  assert.equal(p1.entries.length, 20);
  assert(p2.entries.length > 0);
  assert(!p2.entries.some((e) => p1.entries.some((f) => f.id === e.id)));
  const rawRace = await Promise.allSettled(
    [0, 1].map((i) =>
      db.openingReceipt.create({
        data: {
          receivableId: row.id,
          kind: "RECEIPT",
          delta: p1.remaining,
          date: today,
          method: "TRANSFER",
          reference: "RAW-RACE-" + i,
          actorId: u.id,
          encryptedNote: raw.encryptedNote,
        },
      }),
    ),
  );
  assert.equal(rawRace.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal((await detail()).remaining, 0);
  const rawWinner = rawRace.find((r) => r.status === "fulfilled").value;
  ok(await post("reverseReceipt", { entryId: rawWinner.id }));
  pass(
    "database row locking prevents overcollection even through concurrent direct inserts",
  );
  const past = new Date(Date.parse(today + "T00:00:00Z") - 2 * 86400000)
      .toISOString()
      .slice(0, 10),
    olderSource = {
      ...source,
      asOf: past,
      csv: source.csv.replace("SETTLE-001", "SETTLE-OLDER-001"),
    };
  const op = ok(
    await owner.call("/api/opening-balances", {
      action: "preview",
      ...olderSource,
    }),
  );
  const ob = ok(
    await owner.call("/api/opening-balances", {
      action: "commit",
      ...olderSource,
      confirmed: true,
      key: randomUUID(),
      digest: op.digest,
    }),
  );
  const older = await db.openingReceivable.findFirstOrThrow({
    where: { batchId: ob.id },
  });
  const oldReceipt = ok(
    await post("receipt", {
      ...receipt,
      receivableId: older.id,
      date: past,
      amount: 50000,
      reference: "OLDER-RECEIPT-001",
    }),
  );
  const oldReport = () =>
    owner.call(
      `/api/finance?propertyId=${property.id}&from=${past}&to=${past}&view=movements`,
    );
  assert.equal(ok(await oldReport()).summary.rentReceived, 50000);
  const currentCash = ok(await report()).summary.rentReceived;
  ok(
    await post("reverseReceipt", {
      receivableId: older.id,
      entryId: oldReceipt.id,
    }),
  );
  assert.equal(ok(await oldReport()).summary.rentReceived, 0);
  assert.equal(ok(await report()).summary.rentReceived, currentCash);
  pass(
    "historical receipt corrections update their original reporting date without fabricated current cash",
  );
  const m = await db.orgMembership.findFirstOrThrow({
    where: { userId: u.id, organizationId: u.organizationId },
  });
  await db.orgMembership.update({
    where: { id: m.id },
    data: { status: "SUSPENDED" },
  });
  assert.equal(
    (
      await owner.call(
        `/api/opening-balances?propertyId=${property.id}&receivableId=${row.id}`,
      )
    ).status,
    403,
  );
  assert.equal((await post("receipt", receipt)).status, 400);
  await db.orgMembership.update({
    where: { id: m.id },
    data: { status: "ACTIVE" },
  });
  pass(
    "bounded receipt pages and membership revocation apply to financial history",
  );
  await mkdir("artifacts/phase4l", { recursive: true });
  await writeFile(
    "artifacts/phase4l/opening-receipts-api.json",
    JSON.stringify(
      { groups, mainDatabase: false, externalEmail: false },
      null,
      2,
    ),
  );
  await writeFile(
    ".local-secrets/phase4l-browser.json",
    JSON.stringify(
      {
        email: u.email,
        password,
        propertyId: property.id,
        batchId: batch.id,
        receivableId: row.id,
      },
      null,
      2,
    ),
  );
  console.log(`PASS ${groups} opening receipt API scenario groups`);
} finally {
  await db.$disconnect();
}
