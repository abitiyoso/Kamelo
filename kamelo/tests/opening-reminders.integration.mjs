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
  const reminderPath = `/api/opening-balances?propertyId=${property.id}&receivableId=${row.id}&reminders=1`;
  const preview = async (page = 1) =>
    ok(await owner.call(reminderPath + "&page=" + page)).reminders;
  const publish = async (extra = {}) =>
    write("remindOpening", {
      digest: (await preview()).preview.digest,
      ...extra,
    });
  assert.equal((await anon.call(reminderPath)).status, 401);
  assert.equal((await tenant.call(reminderPath)).status, 403);
  assert.equal((await other.call(reminderPath)).status, 403);
  const staffEmail = "opening-reminder-staff-" + suffix + "@example.test";
  ok(
    await staffFixture(db, base, owner.cookie, {
      name: "Reminder QA Staff",
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
  assert.equal((await staff.call(reminderPath)).status, 403);
  assert.equal((await publish()).status, 400);
  pass("Only scoped owner can preview or publish; no implicit share");
  ok(await write("shareOpening", { grantId: grant.id }));
  const fresh = (await preview()).preview;
  assert(fresh.eligible);
  assert.equal(fresh.remaining, 1500000);
  assert.equal(fresh.target.email, t.email);
  assert.equal((await publish({ confirmed: false })).status, 400);
  assert.equal((await publish({ digest: "stale" })).status, 400);
  const b = {
    action: "remindOpening",
    receivableId: row.id,
    digest: fresh.digest,
    confirmed: true,
    key: randomUUID(),
  };
  assert.equal(
    (await owner.call("/api/opening-balances", b, "http://evil.invalid"))
      .status,
    403,
  );
  pass("Explicit confirmation, fresh preview and origin required");
  const cashBefore = await cash(),
    ledgerBefore = await db.openingReceipt.count({
      where: { receivableId: row.id },
    });
  const sent = ok(await owner.call("/api/opening-balances", b));
  assert.deepEqual(ok(await owner.call("/api/opening-balances", b)), sent);
  assert.equal(
    (await owner.call("/api/opening-balances", { ...b, digest: "changed" }))
      .status,
    400,
  );
  assert.equal(
    await db.openingReminder.count({ where: { receivableId: row.id } }),
    1,
  );
  assert.equal(await cash(), cashBefore);
  assert.equal(
    await db.openingReceipt.count({ where: { receivableId: row.id } }),
    ledgerBefore,
  );
  const td = await detail();
  assert.equal(td.reminders.total, 1);
  assert.equal(td.reminders.rows[0].amount, 1500000);
  assert(!JSON.stringify(td.reminders).includes("actorId"));
  assert(!JSON.stringify(td.reminders).includes("shareId"));
  assert.equal(
    (await peer.call("/api/opening-tenant?receivableId=" + row.id)).status,
    403,
  );
  pass(
    "Exact retries publish one private snapshot without cash or receipt changes",
  );
  const duplicates = await Promise.all([publish(), publish()]);
  assert(duplicates.every((x) => x.status === 400));
  assert.match((await preview()).preview.reason, /24 jam/);
  pass("Twenty-four-hour cooldown survives concurrent different-key requests");
  await assert.rejects(
    db.openingReminder.update({ where: { id: sent.id }, data: { amount: 1 } }),
  );
  await assert.rejects(db.openingReminder.delete({ where: { id: sent.id } }));
  const share = await db.openingShare.findFirstOrThrow({
    where: { receivableId: row.id, revokedAt: null },
  });
  await assert.rejects(
    db.openingReminder.create({
      data: {
        receivableId: row.id,
        shareId: share.id,
        amount: 1,
        due: row.due,
        reference: row.reference,
        actorId: u.id,
      },
    }),
  );
  pass(
    "Database rejects mutated/deleted history and mismatched amount snapshots",
  );
  await db.occupantAccess.update({
    where: { id: grant.id },
    data: { canViewBilling: false },
  });
  assert.equal(
    (await tenant.call("/api/opening-tenant?receivableId=" + row.id)).status,
    403,
  );
  assert.match((await preview()).preview.reason, /terverifikasi/);
  assert.equal((await preview()).preview.target, null);
  await db.occupantAccess.update({
    where: { id: grant.id },
    data: { canViewBilling: true },
  });
  const member = await db.orgMembership.findUniqueOrThrow({
    where: {
      userId_organizationId: { organizationId: u.organizationId, userId: u.id },
    },
  });
  await db.orgMembership.update({
    where: { id: member.id },
    data: { status: "REVOKED" },
  });
  assert.equal((await owner.call(reminderPath)).status, 403);
  await db.orgMembership.update({
    where: { id: member.id },
    data: { status: "ACTIVE" },
  });
  pass("Fresh billing permission and owner membership checked on each request");
  ok(await write("revokeOpening", { shareId: share.id }));
  assert.equal(
    (await tenant.call("/api/opening-tenant?receivableId=" + row.id)).status,
    403,
  );
  ok(await write("shareOpening", { grantId: replacementGrant.id }));
  const rd = ok(
    await replacement.call("/api/opening-tenant?receivableId=" + row.id),
  ).detail;
  assert.equal(rd.reminders.total, 0);
  assert.equal((await preview()).history.length, 1);
  assert.equal((await publish()).status, 400);
  pass(
    "Revocation hides old reminders; replacement does not inherit them or bypass cooldown",
  );
  // A second independent receivable exercises eligibility without waiting 24 hours.
  const source2 = {
    ...source,
    csv:
      header +
      "Opening Proof Resident,081234567881,REMINDER-SECOND,1000000,2026-09-15",
  };
  const p2 = ok(
    await owner.call("/api/opening-balances", {
      action: "preview",
      ...source2,
    }),
  );
  const b2 = ok(
    await owner.call("/api/opening-balances", {
      action: "commit",
      ...source2,
      digest: p2.digest,
      confirmed: true,
      key: randomUUID(),
    }),
  );
  const r2 = await db.openingReceivable.findFirstOrThrow({
    where: { batchId: b2.id },
  });
  const w2 = (action, extra = {}) =>
    owner.call("/api/opening-balances", {
      action,
      receivableId: r2.id,
      key: randomUUID(),
      confirmed: true,
      ...extra,
    });
  const path2 = `/api/opening-balances?propertyId=${property.id}&receivableId=${r2.id}&reminders=1`;
  const pr2 = async () => ok(await owner.call(path2)).reminders;
  const s2 = ok(await w2("shareOpening", { grantId: grant.id }));
  const beforePayment = (await pr2()).preview.digest;
  ok(
    await w2("receipt", {
      amount: 100000,
      date: today,
      method: "TRANSFER",
      reference: "REMINDER-PARTIAL",
      note: "Synthetic QA manual receipt",
    }),
  );
  assert.equal(
    (await w2("remindOpening", { digest: beforePayment })).status,
    400,
  );
  assert.equal((await pr2()).preview.remaining, 900000);
  pass("Concurrent receipt invalidates stale reminder amount");
  const nonce = randomBytes(12),
    cipher = createCipheriv(
      "aes-256-gcm",
      Buffer.from(process.env.DATA_ENCRYPTION_KEY, "hex"),
      nonce,
    );
  cipher.setAAD(Buffer.from("kamelo:smart-access:v1"));
  const encoded = Buffer.concat([
    cipher.update("Synthetic QA note", "utf8"),
    cipher.final(),
  ]);
  const encrypted = [
    "v1",
    nonce.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    encoded.toString("base64url"),
  ].join(".");
  const proof = await db.openingProof.create({
    data: {
      receivableId: r2.id,
      shareId: s2.id,
      uploadedBy: t.id,
      requestKey: randomUUID(),
      requestHash: "fixture",
      amount: 100,
      date: today,
      method: "TRANSFER",
      reference: "REMINDER-PENDING",
      encryptedTenantNote: encrypted,
      storageKey: randomUUID() + ".pdf",
      contentHash: randomUUID(),
      mimeType: "application/pdf",
      fileSize: 100,
    },
  });
  assert.match((await pr2()).preview.reason, /bukti bayar/);
  assert.equal(
    (await w2("remindOpening", { digest: (await pr2()).preview.digest }))
      .status,
    400,
  );
  ok(
    await w2("reviewOpeningProof", {
      proofId: proof.id,
      decision: "REJECTED",
      note: "Synthetic QA invalid proof fixture",
    }),
  );
  assert((await pr2()).preview.eligible);
  pass("Pending evidence suppresses reminder until reviewed");
  const history = Array.from({ length: 41 }, (_, i) => ({
    receivableId: r2.id,
    shareId: s2.id,
    amount: 900000,
    due: r2.due,
    reference: r2.reference,
    actorId: u.id,
    createdAt: new Date(Date.now() - (i + 2) * 86400000),
  }));
  await db.openingReminder.createMany({ data: history });
  assert.equal(ok(await owner.call(path2)).reminders.history.length, 20);
  assert.equal(
    ok(await owner.call(path2 + "&page=3")).reminders.history.length,
    1,
  );
  const tenantThird = ok(
    await tenant.call(
      "/api/opening-tenant?receivableId=" + r2.id + "&reminderPage=3",
    ),
  ).detail;
  assert.equal(tenantThird.reminders.rows.length, 1);
  assert.equal(tenantThird.reminders.total, 41);
  assert.equal(tenantThird.page, 1);
  assert.equal(
    (
      await tenant.call(
        "/api/opening-tenant?receivableId=" + r2.id + "&reminderPage=-1",
      )
    ).status,
    403,
  );
  const pg = await pr2();
  assert(pg.preview.eligible);
  const racing = await Promise.all([
    w2("remindOpening", { digest: pg.preview.digest }),
    w2("remindOpening", { digest: pg.preview.digest }),
  ]);
  assert.deepEqual(racing.map((x) => x.status).sort(), [200, 400]);
  pass(
    "Bounded owner/tenant history pagination and concurrent first publication",
  );
  ok(
    await w2("receipt", {
      amount: 900000,
      date: today,
      method: "TRANSFER",
      reference: "REMINDER-FINAL",
      note: "Synthetic QA final receipt",
    }),
  );
  assert.match((await pr2()).preview.reason, /lunas/);
  assert.equal(
    (await w2("remindOpening", { digest: (await pr2()).preview.digest }))
      .status,
    400,
  );
  assert.equal(
    ok(await tenant.call("/api/opening-tenant?receivableId=" + r2.id)).detail
      .remaining,
    0,
  );
  pass("Settled balance suppresses reminders and retains historical snapshots");
  async function newSource(ref, due) {
    const input = {
      ...source,
      csv: header + `Opening Proof Resident,081234567881,${ref},250000,${due}`,
    };
    const p = ok(
      await owner.call("/api/opening-balances", {
        action: "preview",
        ...input,
      }),
    );
    const batch = ok(
      await owner.call("/api/opening-balances", {
        action: "commit",
        ...input,
        digest: p.digest,
        confirmed: true,
        key: randomUUID(),
      }),
    );
    const r = await db.openingReceivable.findFirstOrThrow({
      where: { batchId: batch.id },
    });
    ok(
      await owner.call("/api/opening-balances", {
        action: "shareOpening",
        receivableId: r.id,
        grantId: grant.id,
        confirmed: true,
        key: randomUUID(),
      }),
    );
    return { r, batch };
  }
  const future = new Date(Date.parse(today + "T00:00:00Z") + 86400000)
    .toISOString()
    .slice(0, 10);
  const upcoming = await newSource("REMINDER-UPCOMING", future);
  const upcomingPath = `/api/opening-balances?propertyId=${property.id}&receivableId=${upcoming.r.id}&reminders=1`;
  assert.match(
    ok(await owner.call(upcomingPath)).reminders.preview.reason,
    /Belum jatuh tempo/,
  );
  ok(
    await owner.call("/api/opening-balances", {
      action: "void",
      batchId: upcoming.batch.id,
      reason: "Synthetic QA future source cancelled",
      confirmed: true,
      key: randomUUID(),
    }),
  );
  const cancelled = ok(await owner.call(upcomingPath)).reminders.preview;
  assert.match(cancelled.reason, /dibatalkan/);
  assert.equal(
    (
      await owner.call("/api/opening-balances", {
        action: "remindOpening",
        receivableId: upcoming.r.id,
        digest: cancelled.digest,
        confirmed: true,
        key: randomUUID(),
      })
    ).status,
    400,
  );
  pass("Upcoming and void balances cannot publish reminders");
  const browser = await newSource("REMINDER-BROWSER", today);
  await mkdir("artifacts/phase4n", { recursive: true });
  await writeFile(
    "artifacts/phase4n/opening-reminders-api.json",
    JSON.stringify(
      { groups, externalEmail: false, mainDatabase: false },
      null,
      2,
    ),
  );
  await mkdir(".local-secrets", { recursive: true });
  await writeFile(
    ".local-secrets/phase4n-browser.json",
    JSON.stringify(
      {
        ownerEmail: u.email,
        tenantEmail: t.email,
        password,
        propertyId: property.id,
        receivableId: browser.r.id,
        batchId: browser.batch.id,
        reminderId: sent.id,
      },
      null,
      2,
    ),
  );
  console.log("Opening reminder groups passed:", groups);
} finally {
  await db.$disconnect();
}
