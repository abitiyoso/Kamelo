import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
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
  assert.equal((await anon.call("/api/opening-tenant")).status, 401);
  assert.equal((await owner.call("/api/opening-tenant")).status, 403);
  assert.equal(ok(await tenant.call("/api/opening-tenant")).rows.length, 0);
  assert.equal(
    (await tenant.call("/api/opening-tenant?receivableId=" + row.id)).status,
    403,
  );
  assert.equal(
    (await write("shareOpening", { grantId: grant.id, confirmed: false }))
      .status,
    400,
  );
  assert.equal(
    (await write("shareOpening", { grantId: peerGrant.id })).status,
    400,
  );
  assert.equal(
    (
      await other.call("/api/opening-balances", {
        action: "shareOpening",
        receivableId: row.id,
        grantId: grant.id,
        confirmed: true,
        key: randomUUID(),
      })
    ).status,
    400,
  );
  const shareCommand = { grantId: grant.id, key: randomUUID() },
    shared = ok(await write("shareOpening", shareCommand));
  assert.deepEqual(ok(await write("shareOpening", shareCommand)), shared);
  assert.equal(
    (await write("shareOpening", { grantId: replacementGrant.id })).status,
    400,
  );
  assert.equal(ok(await tenant.call("/api/opening-tenant")).rows.length, 1);
  assert.equal(ok(await peer.call("/api/opening-tenant")).rows.length, 0);
  assert.equal(
    ok(await replacement.call("/api/opening-tenant")).rows.length,
    0,
  );
  assert.equal((await detail()).remaining, 1500000);
  assert(!JSON.stringify(await detail()).includes(source.sourceNote));
  pass(
    "explicit idempotent owner sharing binds exact account/grant/stay and never exposes debt by guest identity alone",
  );
  const staffEmail = `opening-proof-staff-${suffix}@example.test`;
  ok(
    await staffFixture(db, base, owner.cookie, {
      name: "Proof Staff",
      email: staffEmail,
      password,
      phone: "081234567883",
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
      await staff.call(
        `/api/opening-balances?propertyId=${property.id}&receivableId=${row.id}&evidence=1`,
      )
    ).status,
    403,
  );
  const bytes = (n) =>
    Buffer.from("%PDF-1.7\nSynthetic opening proof " + n + "\n%%EOF");
  async function upload(
    c = tenant,
    b = {},
    content = bytes("A"),
    mime = "application/pdf",
    origin = base,
  ) {
    const form = new FormData();
    for (const [k, v] of Object.entries({
      receivableId: row.id,
      key: randomUUID(),
      amount: "200000",
      date: today,
      method: "TRANSFER",
      reference: "TENANT-TRANSFER-001",
      note: "Private tenant proof explanation",
      ...b,
    }))
      form.set(k, String(v));
    form.set(
      "file",
      new Blob([content], { type: mime }),
      "synthetic-proof.pdf",
    );
    const r = await fetch(base + "/api/opening-tenant", {
      method: "POST",
      headers: { Origin: origin, Cookie: c.cookie },
      body: form,
    });
    return { status: r.status, ...(await r.json()) };
  }
  const resetRate = () =>
    db.rateLimit.deleteMany({ where: { key: "opening-proof:" + t.id } });
  assert.equal((await upload(peer)).status, 400);
  assert.equal((await upload(anon)).status, 401);
  assert.equal(
    (
      await upload(
        tenant,
        {},
        bytes("A"),
        "application/pdf",
        "https://untrusted.example",
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await upload(
        tenant,
        {},
        Buffer.from("<script>bad()</script>"),
        "text/html",
      )
    ).status,
    400,
  );
  assert.equal((await upload(tenant, {}, bytes("A"), "image/png")).status, 400);
  assert.equal(
    (
      await upload(
        tenant,
        {},
        Buffer.alloc(5 * 1024 * 1024 + 1),
        "application/pdf",
      )
    ).status,
    400,
  );
  for (const b of [
    { amount: 0 },
    { amount: 1500001 },
    { date: "2099-01-01" },
    { date: "1900-01-01" },
  ])
    assert.equal((await upload(tenant, b)).status, 400);
  await resetRate();
  assert.equal(
    await db.openingProof.count({ where: { receivableId: row.id } }),
    0,
  );
  pass(
    "owner-only queue, tenant isolation, same-origin checks, bounded file signatures/MIME and scalar validation",
  );
  const proofDir = resolve(
    process.env.PROOF_STORAGE_DIR || "storage/payment-proofs",
  );
  const filesBefore = await readdir(proofDir).catch(() => []);
  const command = { key: randomUUID() },
    proof = ok(await upload(tenant, command));
  assert.deepEqual(ok(await upload(tenant, command)), proof);
  assert.equal((await upload(tenant, { ...command, amount: 1 })).status, 400);
  assert.equal((await upload()).status, 400);
  assert.equal(
    (await readdir(proofDir)).length,
    filesBefore.length + 1,
    "failed/retried uploads clean only their newly written files",
  );
  assert.equal(await cash(), 0);
  assert.equal((await detail()).remaining, 1500000);
  assert.equal((await detail()).proofs[0].status, "PENDING");
  const stored = await db.openingProof.findUniqueOrThrow({
    where: { id: proof.id },
  });
  assert.notEqual(
    stored.encryptedTenantNote,
    "Private tenant proof explanation",
  );
  assert(!JSON.stringify(await detail()).includes("storageKey"));
  assert(!JSON.stringify(await detail()).includes("contentHash"));
  assert(!JSON.stringify(await detail()).includes("encryptedTenantNote"));
  assert(
    !JSON.stringify(
      await db.audit.findMany({ where: { targetId: proof.id } }),
    ).includes("Private tenant"),
  );
  pass(
    "upload retry returns one pending record, notes are encrypted and no cash/debt changes occur before review",
  );
  const filePath = "/api/opening-proofs/" + proof.id;
  for (const c of [tenant, owner]) {
    const r = await fetch(base + filePath, { headers: { Cookie: c.cookie } });
    assert.equal(r.status, 200);
    assert.equal(r.headers.get("x-content-type-options"), "nosniff");
    assert(r.headers.get("content-disposition").startsWith("attachment;"));
    assert.equal(r.headers.get("cache-control"), "private, no-store");
    assert((await r.arrayBuffer()).byteLength > 10);
  }
  for (const c of [anon, other, staff, peer, replacement])
    assert.equal(
      (
        await fetch(base + filePath + "?token=legacy-public-link", {
          headers: { Cookie: c.cookie },
        })
      ).status,
      404,
    );
  pass(
    "private file download is limited to fresh owner or exact submitting tenant; no public bearer link works",
  );
  const approval = {
    proofId: proof.id,
    decision: "APPROVED",
    note: "Funds checked against synthetic bank statement",
    key: randomUUID(),
  };
  assert.equal(
    (await write("reviewOpeningProof", { ...approval, confirmed: false }))
      .status,
    400,
  );
  const approved = ok(await write("reviewOpeningProof", approval));
  assert.deepEqual(ok(await write("reviewOpeningProof", approval)), approved);
  assert(approved.receiptId);
  assert.equal(await cash(), 200000);
  assert.equal((await detail()).remaining, 1300000);
  assert.equal((await detail()).proofs[0].status, "APPROVED");
  assert.equal(
    (await write("reviewOpeningProof", { ...approval, key: randomUUID() }))
      .status,
    400,
  );
  assert.equal(
    (
      await other.call("/api/opening-balances", {
        action: "reviewOpeningProof",
        receivableId: row.id,
        ...approval,
        key: randomUUID(),
        confirmed: true,
      })
    ).status,
    400,
  );
  pass(
    "confirmed owner approval records exactly one immutable receipt; repeat/review/cross-owner writes cannot duplicate cash",
  );
  const declined = ok(
    await upload(
      tenant,
      { reference: "REJECT-001", amount: 50000 },
      bytes("reject"),
    ),
  );
  ok(
    await write("reviewOpeningProof", {
      proofId: declined.id,
      decision: "REJECTED",
      note: "Please check date and bank reference again",
    }),
  );
  assert.equal(await cash(), 200000);
  const resubmitted = ok(
    await upload(
      tenant,
      { reference: "REJECT-002", amount: 50000 },
      bytes("reject"),
    ),
  );
  assert.notEqual(resubmitted.id, declined.id);
  ok(
    await write("reviewOpeningProof", {
      proofId: resubmitted.id,
      decision: "REJECTED",
      note: "Synthetic follow-up requires another review",
    }),
  );
  await resetRate();
  pass(
    "rejection leaves debt and cash intact and allows a separate corrected resubmission with retained history",
  );
  const linkProof = ok(
    await upload(
      tenant,
      { amount: 100000, reference: "ALREADY-RECORDED-001" },
      bytes("manual"),
    ),
  );
  const manual = ok(
    await write("receipt", {
      amount: 100000,
      date: today,
      method: "TRANSFER",
      reference: "ALREADY-RECORDED-001",
      note: "Synthetic receipt recorded before proof review",
    }),
  );
  const e = ok(await evidence(linkProof.id)).evidence;
  assert.equal(e.review.matchingReceipts[0].id, manual.id);
  assert.equal(
    (
      await write("reviewOpeningProof", {
        proofId: linkProof.id,
        decision: "APPROVED",
        note: "Already recorded bank funds are reviewed",
      })
    ).status,
    400,
  );
  ok(
    await write("reviewOpeningProof", {
      proofId: linkProof.id,
      existingReceiptId: manual.id,
      decision: "APPROVED",
      note: "Link proof to the existing exact receipt",
    }),
  );
  assert.equal(await cash(), 300000);
  ok(
    await write("reverseReceipt", {
      entryId: manual.id,
      note: "Synthetic receipt correction preserves proof review",
    }),
  );
  assert(
    (await detail()).proofs.find((x) => x.id === linkProof.id).receiptCorrected,
  );
  pass(
    "proof links an exact existing receipt without adding cash; later receipt correction is visible in proof status",
  );
  const raceA = ok(
      await upload(
        tenant,
        { amount: 900000, reference: "RACE-PROOF-A" },
        bytes("raceA"),
      ),
    ),
    raceB = ok(
      await upload(
        tenant,
        { amount: 900000, reference: "RACE-PROOF-B" },
        bytes("raceB"),
      ),
    );
  const race = await Promise.all(
    [raceA, raceB].map((p) =>
      write("reviewOpeningProof", {
        proofId: p.id,
        decision: "APPROVED",
        note: "Concurrent synthetic receipt verified against bank",
      }),
    ),
  );
  assert.equal(race.filter((x) => x.status === 200).length, 1);
  assert.equal(await cash(), 1100000);
  assert.equal((await detail()).remaining, 400000);
  pass(
    "concurrent approvals cannot overcollect when submitted proofs exceed the remaining balance",
  );
  await assert.rejects(
    db.openingProof.update({ where: { id: proof.id }, data: { amount: 1 } }),
  );
  await assert.rejects(db.openingProof.delete({ where: { id: proof.id } }));
  await assert.rejects(db.openingShare.delete({ where: { id: shared.id } }));
  await assert.rejects(
    db.openingShare.update({
      where: { id: shared.id },
      data: { userId: rep.id },
    }),
  );
  await assert.rejects(
    db.openingReceivable.update({
      where: { id: row.id },
      data: { status: "VOID" },
    }),
  );
  await assert.rejects(
    db.openingShare.create({
      data: {
        receivableId: row.id,
        grantId: peerGrant.id,
        userId: p.id,
        stayId: otherStay.id,
        actorId: u.id,
      },
    }),
  );
  assert.equal(
    (
      await write("void", {
        batchId: batch.id,
        reason: "Source cannot be deleted after financial evidence",
      })
    ).status,
    400,
  );
  pass(
    "database and application retain immutable proofs, sharing targets, reviewed decisions and debt sources",
  );
  ok(await write("revokeOpening", { shareId: shared.id }));
  assert.equal(ok(await tenant.call("/api/opening-tenant")).rows.length, 0);
  assert.equal(
    (await tenant.call("/api/opening-tenant?receivableId=" + row.id)).status,
    403,
  );
  assert.equal(
    (await fetch(base + filePath, { headers: { Cookie: tenant.cookie } }))
      .status,
    404,
  );
  ok(await write("shareOpening", { grantId: replacementGrant.id }));
  const repDetail = ok(
    await replacement.call("/api/opening-tenant?receivableId=" + row.id),
  ).detail;
  assert.equal(repDetail.proofs.length, 0);
  assert.equal(repDetail.remaining, 400000);
  assert.equal(
    (await fetch(base + filePath, { headers: { Cookie: replacement.cookie } }))
      .status,
    404,
  );
  const activeShare = await db.openingShare.findFirstOrThrow({
    where: { receivableId: row.id, revokedAt: null },
  });
  ok(await write("revokeOpening", { shareId: activeShare.id }));
  ok(await write("shareOpening", { grantId: grant.id }));
  pass(
    "revocation immediately removes tenant/file access; a replacement recipient does not inherit prior user proofs",
  );
  await db.occupantAccess.update({
    where: { id: grant.id },
    data: { canViewBilling: false },
  });
  assert.equal((await tenant.call("/api/opening-tenant")).status, 403);
  assert.equal((await upload()).status, 400);
  assert.equal(
    (await fetch(base + filePath, { headers: { Cookie: tenant.cookie } }))
      .status,
    404,
  );
  await db.occupantAccess.update({
    where: { id: grant.id },
    data: { canViewBilling: true },
  });
  assert.equal(ok(await tenant.call("/api/opening-tenant")).rows.length, 1);
  const membership = await db.orgMembership.findFirstOrThrow({
    where: { userId: u.id, organizationId: u.organizationId },
  });
  await db.orgMembership.update({
    where: { id: membership.id },
    data: { status: "SUSPENDED" },
  });
  assert.equal((await evidence()).status, 403);
  assert.equal(
    (await fetch(base + filePath, { headers: { Cookie: owner.cookie } }))
      .status,
    404,
  );
  await db.orgMembership.update({
    where: { id: membership.id },
    data: { status: "ACTIVE" },
  });
  pass(
    "fresh billing permission and owner membership revocation also guard bytes and review endpoints",
  );
  // Keep a dedicated pending proof for the browser review workflow.
  await resetRate();
  const capped = [];
  for (let i = 0; i < 4; i++)
    capped.push(
      ok(
        await upload(
          tenant,
          { amount: 1, reference: "CAP-" + i },
          bytes("cap" + i),
        ),
      ),
    );
  assert.equal(
    await db.openingProof.count({
      where: { receivableId: row.id, status: "PENDING" },
    }),
    5,
  );
  const cap = await upload(
    tenant,
    { amount: 1, reference: "CAP-EXCESS" },
    bytes("cap-excess"),
  );
  assert.equal(cap.status, 400);
  assert(cap.error.includes("lima"));
  for (const p of capped)
    ok(
      await write("reviewOpeningProof", {
        proofId: p.id,
        decision: "REJECTED",
        note: "Synthetic queue limit fixture reviewed and rejected",
      }),
    );
  await resetRate();
  for (let i = 0; i < 10; i++)
    assert.equal(
      (await upload(tenant, {}, Buffer.from("invalid"), "application/pdf"))
        .status,
      400,
    );
  const limited = await upload(
    tenant,
    { amount: 1, reference: "RATE-BLOCK" },
    bytes("rate"),
  );
  assert.equal(limited.status, 400);
  assert(limited.error.includes("15 menit"));
  pass(
    "pending queue limit, 15-minute upload rate limit and failed-upload file cleanup are enforced",
  );
  const rejectedNote = (
    await db.openingProof.findUniqueOrThrow({ where: { id: declined.id } })
  ).encryptedReviewNote;
  const currentShare = await db.openingShare.findFirstOrThrow({
    where: { receivableId: row.id, revokedAt: null },
  });
  for (let i = 0; i < 20; i++) {
    const storageKey = randomUUID();
    await copyFile(
      join(proofDir, stored.storageKey),
      join(proofDir, storageKey),
    );
    const generated = await db.openingProof.create({
      data: {
        receivableId: row.id,
        shareId: currentShare.id,
        uploadedBy: t.id,
        requestKey: randomUUID(),
        requestHash: createHash("sha256")
          .update("history" + i)
          .digest("hex"),
        amount: 1,
        date: today,
        method: "TRANSFER",
        reference: "HISTORY-" + i,
        encryptedTenantNote: stored.encryptedTenantNote,
        storageKey,
        contentHash: createHash("sha256")
          .update("history-content" + i)
          .digest("hex"),
        mimeType: stored.mimeType,
        fileSize: stored.fileSize,
      },
    });
    await db.openingProof.update({
      where: { id: generated.id },
      data: {
        status: "REJECTED",
        encryptedReviewNote: rejectedNote,
        reviewedAt: new Date(),
        reviewedBy: u.id,
      },
    });
  }
  const history1 = await detail(),
    history2 = ok(
      await tenant.call(
        "/api/opening-tenant?receivableId=" + row.id + "&page=2",
      ),
    ).detail;
  assert.equal(history1.proofs.length, 20);
  assert(history2.proofs.length > 0);
  assert(
    !history2.proofs.some((x) => history1.proofs.some((y) => x.id === y.id)),
  );
  assert.equal(ok(await evidence()).evidence.proofs.length, 20);
  pass(
    "tenant and owner proof history is bounded and paginated without repeated records or private storage metadata",
  );
  await resetRate();
  const browserProof = ok(
    await upload(
      tenant,
      { amount: 50000, reference: "BROWSER-PROOF-READY" },
      bytes("browser-ready"),
    ),
  );
  await mkdir("artifacts/phase4m", { recursive: true });
  await writeFile(
    "artifacts/phase4m/opening-tenant-api.json",
    JSON.stringify(
      { groups, externalEmail: false, mainDatabase: false },
      null,
      2,
    ),
  );
  await writeFile(
    ".local-secrets/phase4m-browser.json",
    JSON.stringify(
      {
        ownerEmail: u.email,
        tenantEmail: t.email,
        password,
        propertyId: property.id,
        receivableId: row.id,
        batchId: batch.id,
        proofId: browserProof.id,
      },
      null,
      2,
    ),
  );
  await writeFile(
    ".local-secrets/phase4m-browser.pdf",
    bytes("browser-upload"),
  );
  console.log(`PASS ${groups} opening tenant proof API scenario groups`);
} finally {
  await db.$disconnect();
}
