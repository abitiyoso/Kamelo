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
  const path = "/api/financial-documents?propertyId=" + property.id,
    docs = async () => ok(await owner.call(path));
  const post = (action, body = {}) =>
    owner.call("/api/financial-documents", {
      action,
      key: randomUUID(),
      confirmed: true,
      ...body,
    });
  const shift = (n) =>
    new Date(Date.parse(today + "T00:00:00Z") + n * 86400000)
      .toISOString()
      .slice(0, 10);
  const invoice = ok(
    await owner.call("/api/manage", {
      action: "invoice",
      propertyId: property.id,
      stayId: stay.id,
      due: today,
      items: [{ label: "Synthetic receipt rent", amount: 100000 }],
    }),
  );
  ok(
    await owner.call("/api/manage", {
      action: "payment",
      propertyId: property.id,
      invoiceId: invoice.id,
      amount: 100000,
      date: today,
      method: "TRANSFER",
      reference: "STAGE4-INVOICE",
      confirmed: true,
    }),
  );
  const receipt = ok(
    await write("receipt", {
      amount: 500000,
      date: today,
      method: "TRANSFER",
      reference: "STAGE4-OPENING",
      note: "Synthetic verified cash receipt",
    }),
  );
  const staffEmail = `documents-staff-${suffix}@example.test`;
  ok(
    await staffFixture(db, base, owner.cookie, {
      name: "Document Staff",
      email: staffEmail,
      password,
      phone: "081234567800",
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
  assert.equal((await anon.call(path)).status, 401);
  assert.equal((await staff.call(path)).status, 403);
  assert.equal((await other.call(path)).status, 403);
  for (const c of [tenant, staff, other])
    assert.notEqual(
      (
        await c.call("/api/financial-documents", {
          action: "issue",
          source: "OPENING",
          entryId: receipt.id,
          digest: "a".repeat(64),
          key: randomUUID(),
          confirmed: true,
        })
      ).status,
      200,
    );
  assert.equal((await owner.call(path + "&page=0")).status, 403);
  assert.equal(
    (
      await owner.call(
        "/api/financial-documents",
        { action: "issue", key: randomUUID(), confirmed: true },
        "http://evil.test",
      )
    ).status,
    403,
  );
  pass(
    "Owner-only scoped issuance, cross-organization/staff denial, CSRF and page bounds",
  );
  let candidates = (await docs()).candidates;
  assert.equal(candidates.length, 2);
  const candidate = candidates.find((r) => r.source === "OPENING"),
    invoiceCandidate = candidates.find((r) => r.source === "INVOICE");
  const issueBody = {
    action: "issue",
    key: randomUUID(),
    confirmed: true,
    source: candidate.source,
    entryId: candidate.id,
    digest: candidate.digest,
  };
  assert.equal(
    (
      await owner.call("/api/financial-documents", {
        ...issueBody,
        confirmed: false,
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await owner.call("/api/financial-documents", {
        ...issueBody,
        digest: "0".repeat(64),
      })
    ).status,
    400,
  );
  const beforeCash = await cash(),
    beforeCount = await db.openingReceipt.count({
      where: { receivableId: row.id },
    });
  const issued = ok(await owner.call("/api/financial-documents", issueBody));
  assert.deepEqual(
    ok(await owner.call("/api/financial-documents", issueBody)),
    issued,
  );
  assert.equal(
    (
      await owner.call("/api/financial-documents", {
        ...issueBody,
        entryId: invoiceCandidate.id,
      })
    ).status,
    400,
  );
  const twin = await Promise.all([
    post("issue", {
      source: candidate.source,
      entryId: candidate.id,
      digest: candidate.digest,
    }),
    post("issue", {
      source: candidate.source,
      entryId: candidate.id,
      digest: candidate.digest,
    }),
  ]);
  assert(twin.every((x) => ok(x).id === issued.id));
  const invDoc = ok(
    await post("issue", {
      source: invoiceCandidate.source,
      entryId: invoiceCandidate.id,
      digest: invoiceCandidate.digest,
    }),
  );
  assert.equal(await cash(), beforeCash);
  assert.equal(
    await db.openingReceipt.count({ where: { receivableId: row.id } }),
    beforeCount,
  );
  assert.equal(
    await db.financialDocument.count({
      where: { openingReceiptId: receipt.id },
    }),
    1,
  );
  const stored = await db.financialDocument.findUniqueOrThrow({
    where: { id: issued.id },
  });
  assert(!stored.encryptedSnapshot.includes("Opening Proof Resident"));
  pass(
    "Confirmed fresh preview, exact-key retry, single source issuance and encrypted immutable snapshot without ledger changes",
  );
  assert.equal(ok(await tenant.call("/api/financial-documents")).total, 1);
  assert.equal(
    (await tenant.call("/api/financial-documents?id=" + issued.id)).status,
    403,
  );
  assert.equal(
    (await peer.call("/api/financial-documents?id=" + invDoc.id)).status,
    403,
  );
  ok(await write("shareOpening", { grantId: grant.id }));
  assert.equal(ok(await tenant.call("/api/financial-documents")).total, 2);
  const td = ok(await tenant.call("/api/financial-documents?id=" + issued.id));
  assert.equal(td.review, null);
  for (const f of ["encrypted", "actorId", "grantId", "retentionAction"])
    assert(!JSON.stringify(td).includes(f));
  const html = await fetch(
    base + "/api/financial-documents?id=" + issued.id + "&format=html",
    { headers: { Cookie: tenant.cookie } },
  );
  assert.equal(html.status, 200);
  assert.match(
    html.headers.get("content-security-policy"),
    /default-src 'none'/,
  );
  assert.equal(html.headers.get("cache-control"), "private, no-store");
  assert((await html.text()).includes("data:image/png;base64,"));
  const download = await fetch(
    base +
      "/api/financial-documents?id=" +
      issued.id +
      "&format=html&download=1",
    { headers: { Cookie: owner.cookie } },
  );
  assert.match(download.headers.get("content-disposition"), /^attachment/);
  pass(
    "Exact invoice grant/opening share controls private viewing and self-contained HTML download; retention notes stay owner-only",
  );
  await assert.rejects(
    db.financialDocument.update({
      where: { id: issued.id },
      data: { number: "forged" },
    }),
  );
  await assert.rejects(
    db.financialDocument.delete({ where: { id: issued.id } }),
  );
  const reviewRow = await db.financialDocumentReview.findFirstOrThrow({
    where: { documentId: issued.id },
  });
  await assert.rejects(
    db.financialDocumentReview.update({
      where: { id: reviewRow.id },
      data: { action: "REVIEW" },
    }),
  );
  await assert.rejects(
    db.financialDocumentReview.delete({ where: { id: reviewRow.id } }),
  );
  pass(
    "Database protects issued documents and retention history from overwrite/deletion",
  );
  const refundBody = {
    action: "refundReceipt",
    receivableId: row.id,
    entryId: receipt.id,
    amount: 100000,
    date: today,
    method: "TRANSFER",
    reference: "STAGE4-REFUND",
    note: "Synthetic verified returned funds",
    confirmed: true,
    key: randomUUID(),
  };
  assert.equal(
    (
      await owner.call("/api/opening-balances", {
        ...refundBody,
        confirmed: false,
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await owner.call("/api/opening-balances", {
        ...refundBody,
        date: shift(1),
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await owner.call("/api/opening-balances", {
        ...refundBody,
        amount: 500001,
      })
    ).status,
    400,
  );
  const refund = ok(await owner.call("/api/opening-balances", refundBody));
  assert.deepEqual(
    ok(await owner.call("/api/opening-balances", refundBody)),
    refund,
  );
  assert.equal(
    (
      await owner.call("/api/opening-balances", {
        ...refundBody,
        key: randomUUID(),
      })
    ).status,
    400,
  );
  assert.equal(await cash(), beforeCash - 100000);
  const current = ok(
    await owner.call("/api/financial-documents?id=" + issued.id),
  );
  assert.equal(current.snapshot.amount, 500000);
  assert.equal(current.state.refunded, 100000);
  assert.equal(current.state.retained, 400000);
  assert.equal(current.state.status, "PARTIALLY_REFUNDED");
  assert.equal(
    (await db.financialDocument.findUniqueOrThrow({ where: { id: issued.id } }))
      .snapshotHash,
    stored.snapshotHash,
  );
  assert.equal(
    ok(await tenant.call("/api/resident")).billingSummary.opening,
    1100000,
  );
  const movement = ok(
    await owner.call(
      `/api/finance?propertyId=${property.id}&from=${today}&to=${today}&view=movements`,
    ),
  );
  assert(JSON.stringify(movement).includes("OPENING_REFUND"));
  pass(
    "Bounded source refund is idempotent, reopens debt, reduces cash once and updates document status without changing issued snapshot",
  );
  assert.equal(
    (
      await write("reverseReceipt", {
        entryId: receipt.id,
        note: "Synthetic mistaken original reversal",
      })
    ).status,
    400,
  );
  const match = ok(
    await owner.call("/api/lifecycle", {
      action: "financeMatch",
      propertyId: property.id,
      source: "OPENING",
      entryId: refund.id,
      amount: 100000,
      direction: "OUT",
      statementDate: today,
      statementReference: "STAGE4-REFUND-OUT",
      note: "Synthetic bank matching for refund",
      key: randomUUID(),
      confirmed: true,
    }),
  );
  assert.equal(
    (
      await write("reverseReceipt", {
        entryId: refund.id,
        note: "Synthetic refund correction reason",
      })
    ).status,
    400,
  );
  ok(
    await owner.call("/api/lifecycle", {
      action: "financeUnmatch",
      propertyId: property.id,
      matchId: match.matchId,
      note: "Synthetic match correction note",
      key: randomUUID(),
      confirmed: true,
    }),
  );
  ok(
    await write("reverseReceipt", {
      entryId: refund.id,
      note: "Synthetic mistaken refund correction",
    }),
  );
  assert.equal(await cash(), beforeCash);
  assert.equal(
    ok(await owner.call("/api/financial-documents?id=" + issued.id)).state
      .status,
    "ACTIVE",
  );
  pass(
    "Refund bank direction, revoke-before-correct, linked refund guard and original-date correction",
  );
  const races = await Promise.all([
    write("refundReceipt", {
      entryId: receipt.id,
      amount: 300000,
      date: today,
      method: "CASH",
      reference: "RACE-A",
      note: "Synthetic concurrency refund note",
    }),
    write("refundReceipt", {
      entryId: receipt.id,
      amount: 300000,
      date: today,
      method: "CASH",
      reference: "RACE-B",
      note: "Synthetic concurrency refund note",
    }),
  ]);
  assert.deepEqual(races.map((r) => r.status).sort(), [200, 400]);
  const remaining = ok(
    await write("refundReceipt", {
      entryId: receipt.id,
      amount: 200000,
      date: today,
      method: "CASH",
      reference: "REFUND-REST",
      note: "Synthetic remaining refund note",
    }),
  );
  assert.equal(
    ok(await owner.call("/api/financial-documents?id=" + issued.id)).state
      .status,
    "REFUNDED",
  );
  assert.equal(await cash(), 100000);
  const rawRefund = await db.openingReceipt.findUniqueOrThrow({
    where: { id: remaining.id },
  });
  await assert.rejects(
    db.openingReceipt.update({
      where: { id: remaining.id },
      data: { delta: -1 },
    }),
  );
  await assert.rejects(
    db.openingReceipt.delete({ where: { id: remaining.id } }),
  );
  await assert.rejects(
    db.openingReceipt.create({
      data: {
        ...rawRefund,
        id: undefined,
        reference: "FORGED-OVER",
        delta: -1,
      },
    }),
  );
  pass(
    "Concurrent over-refund is rejected; full refund retains document history and database journal integrity",
  );
  const retention = {
    documentId: issued.id,
    revision: 1,
    retentionAction: "HOLD",
    reviewOn: null,
    note: "Synthetic accounting retention hold policy",
  };
  assert.equal(
    (await post("review", { ...retention, revision: 0 })).status,
    400,
  );
  const held = ok(await post("review", retention));
  assert.equal(held.revision, 2);
  assert.equal((await post("review", retention)).status, 400);
  assert.equal(
    (
      await post("review", {
        ...retention,
        revision: 2,
        retentionAction: "REVIEW",
        reviewOn: null,
      })
    ).status,
    400,
  );
  ok(
    await post("review", {
      ...retention,
      revision: 2,
      retentionAction: "REVIEW",
      reviewOn: today,
    }),
  );
  assert.equal(
    await db.financialDocumentReview.count({
      where: { documentId: issued.id },
    }),
    3,
  );
  assert(await db.financialDocument.findUnique({ where: { id: issued.id } }));
  pass(
    "Versioned KEEP/HOLD/review schedule records audit without deleting archives or inventing a retention deadline",
  );
  const share = await db.openingShare.findFirstOrThrow({
    where: { receivableId: row.id, revokedAt: null },
  });
  ok(await write("revokeOpening", { shareId: share.id }));
  assert.equal(
    (
      await tenant.call(
        "/api/financial-documents?id=" + issued.id + "&format=html",
      )
    ).status,
    403,
  );
  await db.occupantAccess.update({
    where: { id: grant.id },
    data: { canViewBilling: false },
  });
  assert.equal(
    (await tenant.call("/api/financial-documents?id=" + invDoc.id)).status,
    403,
  );
  await db.occupantAccess.update({
    where: { id: grant.id },
    data: { canViewBilling: true },
  });
  const member = await db.orgMembership.findUniqueOrThrow({
    where: {
      userId_organizationId: { userId: u.id, organizationId: u.organizationId },
    },
  });
  await db.orgMembership.update({
    where: { id: member.id },
    data: { status: "REVOKED" },
  });
  assert.equal((await owner.call(path)).status, 403);
  await db.orgMembership.update({
    where: { id: member.id },
    data: { status: "ACTIVE" },
  });
  pass(
    "Fresh share/grant/owner revocation applies to downloads and list reads",
  );
  const finalReceipt = ok(
    await write("receipt", {
      amount: 10000,
      date: today,
      method: "CASH",
      reference: "RECEIPT-CORRECT",
      note: "Synthetic later erroneous receipt",
    }),
  );
  const c = (await docs()).candidates.find((c) => c.id === finalReceipt.id),
    correctedDoc = ok(
      await post("issue", {
        source: c.source,
        entryId: c.id,
        digest: c.digest,
      }),
    );
  ok(
    await write("reverseReceipt", {
      entryId: finalReceipt.id,
      note: "Synthetic erroneous receipt correction",
    }),
  );
  assert.equal(
    ok(await owner.call("/api/financial-documents?id=" + correctedDoc.id)).state
      .status,
    "CORRECTED",
  );
  pass(
    "Later receipt correction preserves its issued document and marks it invalid as an active receipt",
  );
  const archiveInvoice = ok(
    await owner.call("/api/manage", {
      action: "invoice",
      propertyId: property.id,
      stayId: stay.id,
      due: today,
      items: [{ label: "Synthetic pagination source", amount: 1000000 }],
    }),
  );
  for (let n = 0; n < 21; n++)
    await db.payment.create({
      data: {
        invoiceId: archiveInvoice.id,
        amount: 1,
        date: today,
        method: "CASH",
        reference: "ARCHIVE-" + n,
        actorId: u.id,
      },
    });
  for (let round = 0; round < 2; round++) {
    for (const c of (await docs()).candidates)
      ok(
        await post("issue", {
          source: c.source,
          entryId: c.id,
          digest: c.digest,
        }),
      );
  }
  const first = await docs(),
    second = ok(await owner.call(path + "&page=2"));
  assert.equal(first.rows.length, 20);
  assert.equal(second.rows.length, 4);
  assert(!second.rows.some((x) => first.rows.some((y) => y.id === x.id)));
  assert.equal(
    ok(await tenant.call("/api/financial-documents?page=2")).rows.length,
    2,
  );
  const latestReview = ok(
    await owner.call("/api/financial-documents?id=" + issued.id),
  );
  assert.equal(latestReview.reviewHistory.total, 3);
  assert.equal(latestReview.reviewHistory.rows[0].revision, 3);
  assert.equal(
    (
      await owner.call(
        "/api/financial-documents?id=" + issued.id + "&reviewPage=0",
      )
    ).status,
    403,
  );
  pass(
    "Owner and tenant archives paginate independently; owner retention audit is bounded and tenant-filtered",
  );
  await mkdir("artifacts/finance-stage4", { recursive: true });
  await writeFile(
    "artifacts/finance-stage4/finance-api.json",
    JSON.stringify(
      {
        groups,
        externalEmail: false,
        actualFundsTransfer: false,
        sourceSnapshotHash: stored.snapshotHash,
        originalValuesPreserved: true,
      },
      null,
      2,
    ),
  );
  await writeFile(
    ".local-secrets/finance-stage4-browser.json",
    JSON.stringify(
      {
        ownerEmail: u.email,
        tenantEmail: t.email,
        password,
        propertyId: property.id,
        documentId: issued.id,
        invoiceDocumentId: invDoc.id,
        receivableId: row.id,
      },
      null,
      2,
    ),
  );
  console.log("Finance stage 4 API groups passed:", groups);
} finally {
  await db.$disconnect();
}
