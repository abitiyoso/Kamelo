import assert from "node:assert/strict";
import {
  randomUUID,
  createHash,
  createCipheriv,
  randomBytes,
} from "node:crypto";
import {
  mkdir,
  writeFile,
  readFile,
  readdir,
  copyFile,
} from "node:fs/promises";
import { resolve, join } from "node:path";
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
  password = "Opening-Proof-QA-password-123";
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
      const email = `opening-proof-${label}-${suffix}@example.test`;
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
    o = await other.register("other"),
    tenant = client(),
    peer = client(),
    replacement = client();
  const t = await tenant.register("tenant"),
    p = await peer.register("peer"),
    rep = await replacement.register("replacement");
  await db.organization.update({
    where: { id: u.organizationId },
    data: { plan: "plus", subscriptionStatus: "ACTIVE" },
  });
  const property = ok(
    await owner.call("/api/manage", {
      action: "property",
      name: "Opening Tenant Proof QA",
      type: "KOS",
      count: 2,
      rate: 1500000,
    }),
  );
  const rooms = await db.room.findMany({
    where: { propertyId: property.id },
    orderBy: { number: "asc" },
  });
  const stay = ok(
    await owner.call("/api/manage", {
      action: "stay",
      propertyId: property.id,
      roomId: rooms[0].id,
      name: "Opening Proof Resident",
      phone: "081234567881",
      start: today,
      end: new Date(Date.parse(today + "T00:00:00Z") + 14 * 86400000)
        .toISOString()
        .slice(0, 10),
      rate: 1500000,
      billingDay: 15,
    }),
  );
  const otherStay = ok(
    await owner.call("/api/manage", {
      action: "stay",
      propertyId: property.id,
      roomId: rooms[1].id,
      name: "Other Proof Resident",
      phone: "081234567882",
      start: today,
      rate: 1500000,
      billingDay: 15,
    }),
  );
  async function invite(c, user, id) {
    const inv = ok(
      await owner.call("/api/invitations", {
        action: "create",
        kind: "TENANT",
        email: user.email,
        propertyIds: [property.id],
        stayId: id,
      }),
    );
    ok(await c.call("/api/invitations", { action: "accept", id: inv.id }));
    const ctx = ok(await c.call("/api/account")).contexts.find(
      (x) => x.type === "STAY",
    );
    ok(
      await c.call("/api/account", {
        action: "switch",
        type: "STAY",
        id: ctx.id,
      }),
    );
    return ctx;
  }
  const actualStay = await db.stay.findUniqueOrThrow({
    where: { id: stay.id },
  });
  const futureStay = await db.stay.create({
    data: {
      guestId: actualStay.guestId,
      roomId: rooms[0].id,
      status: "RESERVED",
      start: new Date(Date.parse(today + "T00:00:00Z") + 16 * 86400000)
        .toISOString()
        .slice(0, 10),
      end: new Date(Date.parse(today + "T00:00:00Z") + 30 * 86400000)
        .toISOString()
        .slice(0, 10),
      rate: 1500000,
      billingDay: 15,
    },
  });
  await invite(tenant, t, stay.id);
  await invite(peer, p, otherStay.id);
  await invite(replacement, rep, futureStay.id);
  const grant = await db.occupantAccess.findUniqueOrThrow({
      where: { userId_stayId: { userId: t.id, stayId: stay.id } },
    }),
    peerGrant = await db.occupantAccess.findUniqueOrThrow({
      where: { userId_stayId: { userId: p.id, stayId: otherStay.id } },
    }),
    replacementGrant = await db.occupantAccess.findUniqueOrThrow({
      where: { userId_stayId: { userId: rep.id, stayId: futureStay.id } },
    });
  const source = {
    propertyId: property.id,
    csv:
      header +
      "Opening Proof Resident,081234567881,TENANT-OPEN-001,1500000,2026-09-15",
    mapping,
    choices: { 2: actualStay.guestId },
    asOf: today,
    sourceNote: "Private internal source ledger not for tenant",
  };
  const pr = ok(
    await owner.call("/api/opening-balances", { action: "preview", ...source }),
  );
  assert(pr.valid);
  const batch = ok(
    await owner.call("/api/opening-balances", {
      action: "commit",
      ...source,
      digest: pr.digest,
      confirmed: true,
      key: randomUUID(),
    }),
  );
  const row = await db.openingReceivable.findFirstOrThrow({
    where: { batchId: batch.id },
  });
  const write = (action, b = {}) =>
    owner.call("/api/opening-balances", {
      action,
      receivableId: row.id,
      key: randomUUID(),
      confirmed: true,
      ...b,
    });
  const detail = async () =>
    ok(await tenant.call("/api/opening-tenant?receivableId=" + row.id)).detail;
  const cash = async () =>
    ok(
      await owner.call(
        `/api/finance?propertyId=${property.id}&from=${today}&to=${today}`,
      ),
    ).summary.rentReceived;
  const evidence = (proofId = "") =>
    owner.call(
      `/api/opening-balances?propertyId=${property.id}&receivableId=${row.id}&evidence=1${proofId ? "&proofId=" + proofId : ""}`,
    );
  const list = (q = "") =>
    owner.call("/api/proof-queue?propertyId=" + property.id + q);
  const inspect = async (source, id) =>
    ok(await owner.call(`/api/proof-queue?source=${source}&proofId=${id}`))
      .detail;
  const review = async (source, id, extra = {}) =>
    owner.call("/api/proof-queue", {
      source,
      proofId: id,
      digest: (await inspect(source, id)).digest,
      decision: "APPROVED",
      note: "Synthetic QA matched funds and ledger",
      confirmed: true,
      key: randomUUID(),
      ...extra,
    });
  assert.equal((await anon.call("/api/proof-queue")).status, 401);
  assert.equal((await tenant.call("/api/proof-queue")).status, 403);
  assert.equal(
    (await other.call("/api/proof-queue?propertyId=" + property.id)).status,
    403,
  );
  const staffEmail = `proof-queue-staff-${suffix}@example.test`;
  ok(
    await staffFixture(db, base, owner.cookie, {
      name: "Queue Staff",
      email: staffEmail,
      password,
      phone: "081234567888",
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
  assert.equal((await staff.call("/api/proof-queue")).status, 403);
  pass(
    "Only owner workspace can read consolidated queue; tenant/staff/cross-owner denied",
  );
  for (const q of [
    "&page=0",
    "&page=1.1",
    "&page=100001",
    "&source=OTHER",
    "&status=OTHER",
    "&order=OTHER",
    "&q=" + "x".repeat(101),
  ])
    assert.equal((await list(q)).status, 403);
  assert.equal(
    (await owner.call("/api/proof-queue?proofId=missing&source=INVOICE"))
      .status,
    403,
  );
  assert.equal(
    (await list("&q=" + encodeURIComponent("%_' OR 1=1 --"))).rows?.length || 0,
    0,
  );
  pass(
    "Filter bounds and literal search resist malformed or injected parameters",
  );
  const invoice = ok(
    await owner.call("/api/manage", {
      action: "invoice",
      propertyId: property.id,
      stayId: stay.id,
      due: today,
      items: [{ label: "Synthetic queue rent", amount: 1000000 }],
    }),
  );
  const link = ok(
    await owner.call("/api/manage", {
      action: "tenantLink",
      propertyId: property.id,
      invoiceId: invoice.id,
    }),
  );
  const token = new URL(link.url).pathname.split("/").pop();
  async function invoiceUpload(reference, amount = 200000, invToken = token) {
    const form = new FormData();
    form.set(
      "file",
      new Blob(
        [Buffer.from("%PDF-1.7\nSynthetic queue " + reference + "\n%%EOF")],
        { type: "application/pdf" },
      ),
      "qa.pdf",
    );
    for (const [k, v] of Object.entries({
      amount: String(amount),
      date: today,
      method: "TRANSFER",
      reference,
    }))
      form.set(k, v);
    const r = await fetch(base + "/api/tenant/" + invToken + "/proof", {
      method: "POST",
      headers: { Origin: base },
      body: form,
    });
    return { status: r.status, ...(await r.json()) };
  }
  const ip = ok(await invoiceUpload("QUEUE-INVOICE-A"));
  ok(await write("shareOpening", { grantId: grant.id }));
  async function openingUpload(reference, amount = 100000) {
    const form = new FormData();
    for (const [k, v] of Object.entries({
      receivableId: row.id,
      key: randomUUID(),
      amount: String(amount),
      date: today,
      method: "TRANSFER",
      reference,
      note: "Private synthetic tenant explanation",
    }))
      form.set(k, v);
    form.set(
      "file",
      new Blob(
        [
          Buffer.from(
            "%PDF-1.7\nSynthetic opening queue " + reference + "\n%%EOF",
          ),
        ],
        { type: "application/pdf" },
      ),
      "qa.pdf",
    );
    const r = await fetch(base + "/api/opening-tenant", {
      method: "POST",
      headers: { Origin: base, Cookie: tenant.cookie },
      body: form,
    });
    return { status: r.status, ...(await r.json()) };
  }
  const op = ok(await openingUpload("QUEUE-OPENING-A"));
  const pending = ok(await list());
  assert.equal(pending.total, 2);
  assert.equal(pending.summary.pendingInvoice, 1);
  assert.equal(pending.summary.pendingOpening, 1);
  assert.deepEqual(
    new Set(pending.rows.map((r) => r.source)),
    new Set(["INVOICE", "OPENING"]),
  );
  const serialized = JSON.stringify(pending);
  for (const field of [
    "storageKey",
    "contentHash",
    "encrypted",
    "tokenHash",
    "password",
    "reviewedBy",
  ])
    assert(!serialized.includes(field));
  assert.equal(ok(await list("&source=INVOICE")).total, 1);
  assert.equal(ok(await list("&q=QUEUE-OPENING-A")).total, 1);
  assert.equal(
    ok(await list("&q=" + encodeURIComponent("%_' OR 1=1 --"))).total,
    0,
  );
  pass(
    "Mixed queue shows independent source counts, scoped filters and safe metadata",
  );
  const id = await inspect("INVOICE", ip.id),
    od = await inspect("OPENING", op.id);
  assert.equal(id.parent.id, invoice.id);
  assert.equal(od.parent.id, row.id);
  assert.equal(od.proof.tenantNote, "Private synthetic tenant explanation");
  assert.equal(
    (await other.call(`/api/proof-queue?source=INVOICE&proofId=${ip.id}`))
      .status,
    403,
  );
  assert.equal(
    (await owner.call(`/api/proof-queue?source=OPENING&proofId=${ip.id}`))
      .status,
    403,
  );
  assert.equal(
    (await tenant.call(`/api/proof-queue?source=OPENING&proofId=${op.id}`))
      .status,
    403,
  );
  for (const [source, p] of [
    ["INVOICE", ip],
    ["OPENING", op],
  ]) {
    const path = source === "INVOICE" ? "/api/proofs/" : "/api/opening-proofs/";
    const r = await fetch(base + path + p.id, {
      headers: { Cookie: owner.cookie },
    });
    assert.equal(r.status, 200);
    assert.equal(r.headers.get("cache-control"), "private, no-store");
    assert.match(r.headers.get("content-disposition"), /^attachment/);
    const denied = await fetch(base + path + p.id);
    assert.notEqual(denied.status, 200);
  }
  pass(
    "Scoped details and existing private downloads preserve source and identity boundaries",
  );
  assert.equal(await db.payment.count({ where: { invoiceId: invoice.id } }), 0);
  assert.equal(
    await db.openingReceipt.count({ where: { receivableId: row.id } }),
    0,
  );
  assert.equal(
    (await db.paymentProof.findUniqueOrThrow({ where: { id: ip.id } })).status,
    "PENDING",
  );
  assert.equal(
    (await db.openingProof.findUniqueOrThrow({ where: { id: op.id } })).status,
    "PENDING",
  );
  pass(
    "Browsing queue, scoped details and private downloads changes neither ledger nor proof decisions",
  );
  const body = {
    source: "INVOICE",
    proofId: ip.id,
    digest: id.digest,
    decision: "APPROVED",
    note: "Synthetic owner matched actual QA funds",
    confirmed: true,
    key: randomUUID(),
  };
  assert.equal(
    (await owner.call("/api/proof-queue", { ...body, confirmed: false }))
      .status,
    400,
  );
  assert.equal(
    (await owner.call("/api/proof-queue", { ...body, note: "no" })).status,
    400,
  );
  assert.equal(
    (await owner.call("/api/proof-queue", body, "http://evil.invalid")).status,
    403,
  );
  assert.equal((await other.call("/api/proof-queue", body)).status, 400);
  assert.equal((await staff.call("/api/proof-queue", body)).status, 400);
  assert.equal(
    (await owner.call("/api/proof-queue", { ...body, digest: "0".repeat(64) }))
      .status,
    400,
  );
  pass(
    "Write requires fresh owner, origin, explicit confirmation, note and preview digest",
  );
  const approved = ok(await owner.call("/api/proof-queue", body));
  assert.deepEqual(ok(await owner.call("/api/proof-queue", body)), approved);
  assert.equal(
    (
      await owner.call("/api/proof-queue", {
        ...body,
        note: "Different payload for existing key",
      })
    ).status,
    400,
  );
  assert.equal(await db.payment.count({ where: { invoiceId: invoice.id } }), 1);
  assert.equal((await inspect("INVOICE", ip.id)).proof.status, "APPROVED");
  assert.equal(
    (await review("INVOICE", ip.id, { decision: "REJECTED" })).status,
    400,
  );
  assert.equal(ok(await list()).total, 1);
  assert.equal(ok(await list("&status=APPROVED")).total, 1);
  pass(
    "Invoice approval records exactly one canonical payment and retries preserve decision history",
  );
  const before = await cash();
  ok(await review("OPENING", op.id));
  assert.equal(await cash(), before + 100000);
  assert.equal((await detail()).remaining, 1400000);
  assert.equal(
    await db.openingReceipt.count({ where: { receivableId: row.id } }),
    1,
  );
  assert.equal(ok(await list()).total, 0);
  pass(
    "Opening approval records only opening receipt and updates finance once",
  );
  const op2 = ok(await openingUpload("QUEUE-OPENING-EXISTING", 150000));
  const manual = ok(
    await write("receipt", {
      amount: 150000,
      date: today,
      method: "TRANSFER",
      reference: "QUEUE-OPENING-EXISTING",
      note: "Synthetic bank funds already recorded",
    }),
  );
  const md = await inspect("OPENING", op2.id);
  assert(md.matchingReceipts.some((r) => r.id === manual.id));
  const cashLinked = await cash();
  ok(await review("OPENING", op2.id, { existingReceiptId: manual.id }));
  assert.equal(await cash(), cashLinked);
  pass("Exact existing opening receipt links without duplicate cash");
  const ip2 = ok(await invoiceUpload("QUEUE-INVOICE-REJECT", 100000));
  const rejectBefore = await cash();
  ok(await review("INVOICE", ip2.id, { decision: "REJECTED" }));
  assert.equal(await cash(), rejectBefore);
  assert.equal(ok(await list("&status=REJECTED")).total, 1);
  const op3 = ok(await openingUpload("QUEUE-OPENING-REJECT", 50000));
  ok(await review("OPENING", op3.id, { decision: "REJECTED" }));
  assert.equal(await cash(), rejectBefore);
  assert.equal(ok(await list("&status=REJECTED")).total, 2);
  pass(
    "Rejections preserve both ledgers and are searchable in decision history",
  );
  const ip3 = ok(await invoiceUpload("QUEUE-INVOICE-STALE", 100000)),
    stale = await inspect("INVOICE", ip3.id);
  ok(
    await owner.call("/api/manage", {
      action: "payment",
      propertyId: property.id,
      invoiceId: invoice.id,
      amount: 100000,
      date: today,
      method: "TRANSFER",
      reference: "QA concurrent manual payment",
      confirmed: true,
    }),
  );
  assert.equal(
    (await review("INVOICE", ip3.id, { digest: stale.digest })).status,
    400,
  );
  const freshInvoice = await inspect("INVOICE", ip3.id);
  const command = {
    source: "INVOICE",
    proofId: ip3.id,
    digest: freshInvoice.digest,
    decision: "APPROVED",
    note: "Synthetic concurrent proof approval check",
    confirmed: true,
  };
  const race = await Promise.all([
    owner.call("/api/proof-queue", { ...command, key: randomUUID() }),
    owner.call("/api/proof-queue", { ...command, key: randomUUID() }),
  ]);
  assert.deepEqual(race.map((x) => x.status).sort(), [200, 400]);
  assert.equal(await db.payment.count({ where: { proof: { id: ip3.id } } }), 1);
  pass(
    "Stale balances cannot be approved and concurrent same-proof decisions record once",
  );
  const props2 = ok(
    await owner.call("/api/manage", {
      action: "property",
      name: "Queue Second Property",
      type: "KOS",
      count: 1,
      rate: 1000000,
    }),
  );
  assert.equal(
    ok(await owner.call("/api/proof-queue?propertyId=" + props2.id)).total,
    0,
  );
  const whole = ok(
    await owner.call("/api/proof-queue?propertyId=all&status=ALL"),
  );
  assert.equal(whole.properties.length, 2);
  assert.equal(whole.total, 6);
  const browserInvoice = ok(
    await invoiceUpload("QUEUE-BROWSER-INVOICE", 50000),
  );
  const browserOpening = ok(
    await openingUpload("QUEUE-BROWSER-OPENING", 50000),
  );
  const samples = await db.paymentProof.findUniqueOrThrow({
    where: { id: ip.id },
  });
  await db.paymentProof.createMany({
    data: Array.from({ length: 23 }, (_, i) => ({
      invoiceId: invoice.id,
      amount: 1,
      date: today,
      method: "TRANSFER",
      reference: "QUEUE-HISTORY-" + String(i).padStart(2, "0"),
      storageKey: randomUUID(),
      mimeType: samples.mimeType,
      fileSize: samples.fileSize,
      contentHash: randomUUID(),
      uploadedAt: new Date(Date.now() + 1000),
    })),
  });
  const one = ok(await list("&status=ALL")),
    two = ok(await list("&status=ALL&page=2"));
  assert.equal(one.rows.length, 20);
  assert.equal(two.rows.length, 11);
  assert.equal(
    new Set([...one.rows, ...two.rows].map((r) => r.source + r.id)).size,
    31,
  );
  const latest = ok(await list("&status=ALL&order=NEWEST"));
  assert(latest.rows[0].reference.startsWith("QUEUE-HISTORY-"));
  pass(
    "All-property queue and stable mixed-source pagination cover full database records",
  );
  const membership = await db.orgMembership.findUniqueOrThrow({
    where: {
      userId_organizationId: { userId: u.id, organizationId: u.organizationId },
    },
  });
  await db.orgMembership.update({
    where: { id: membership.id },
    data: { status: "REVOKED" },
  });
  assert.equal((await list()).status, 403);
  assert.equal((await owner.call("/api/proof-queue", body)).status, 400);
  await db.orgMembership.update({
    where: { id: membership.id },
    data: { status: "ACTIVE" },
  });
  pass("Membership revocation also blocks exact-retry commands before replay");
  await mkdir("artifacts/phase4o", { recursive: true });
  await writeFile(
    "artifacts/phase4o/proof-queue-api.json",
    JSON.stringify(
      { groups, mainDatabase: false, externalEmail: false },
      null,
      2,
    ),
  );
  await writeFile(
    ".local-secrets/phase4o-browser.json",
    JSON.stringify(
      {
        ownerEmail: u.email,
        password,
        propertyId: property.id,
        invoiceProofId: browserInvoice.id,
        openingProofId: browserOpening.id,
        invoiceNumber: invoice.number,
      },
      null,
      2,
    ),
  );
  console.log("Unified proof queue groups passed:", groups);
} finally {
  await db.$disconnect();
}
