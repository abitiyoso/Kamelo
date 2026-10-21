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
  const path = "/api/reminder-automation?propertyId=" + property.id;
  const read = async () => ok(await owner.call(path));
  const post = (action, extra = {}) =>
    owner.call("/api/reminder-automation", {
      action,
      propertyId: property.id,
      key: randomUUID(),
      confirmed: true,
      ...extra,
    });
  const save = async (extra = {}) =>
    post("save", { ...(await read()).policy, ...extra });
  const run = async () => ok(await post("run"));
  const shift = (n) =>
    new Date(Date.parse(today + "T00:00:00Z") + n * 86400000)
      .toISOString()
      .slice(0, 10);
  const invoice = async (due = today, amount = 100000) =>
    ok(
      await owner.call("/api/manage", {
        action: "invoice",
        propertyId: property.id,
        stayId: stay.id,
        due,
        items: [{ label: "Synthetic automatic reminder", amount }],
      }),
    );
  const pay = async (id, amount) =>
    ok(
      await owner.call("/api/manage", {
        action: "payment",
        propertyId: property.id,
        invoiceId: id,
        amount,
        date: today,
        method: "TRANSFER",
        reference: "AUTO-" + randomUUID(),
        confirmed: true,
      }),
    );
  const mail = async () => {
    for (let n = 0; n < 30; n++) {
      const r = await fetch(base + "/api/jobs/mail", {
        method: "POST",
        headers: { authorization: "Bearer " + process.env.OPERATIONS_JOB_KEY },
      });
      assert.equal(r.status, 200);
      if ((await r.json()).processed === 0) break;
    }
  };
  const delivery = async (id) =>
    db.reminderDelivery.findFirstOrThrow({
      where: { invoiceId: id, channel: "EMAIL" },
      include: { emailOutbox: true },
    });
  assert.equal((await read()).policy.enabled, false);
  assert.deepEqual(await run(), { portal: 0, email: 0 });
  assert.equal(
    await db.reminderPolicy.count({ where: { propertyId: property.id } }),
    0,
  );
  assert.equal((await anon.call(path)).status, 401);
  for (const c of [tenant, peer, other])
    assert.equal((await c.call(path)).status, 403);
  const staffEmail = `auto-staff-${suffix}@example.test`;
  ok(
    await staffFixture(db, base, owner.cookie, {
      name: "Reminder Staff",
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
  assert.equal((await staff.call(path)).status, 403);
  for (const c of [staff, tenant, other])
    assert.notEqual(
      (
        await c.call("/api/reminder-automation", {
          action: "run",
          key: randomUUID(),
          propertyId: property.id,
          confirmed: true,
        })
      ).status,
      200,
    );
  assert.equal((await owner.call(path + "&page=0")).status, 403);
  assert.equal(
    (
      await owner.call(
        "/api/reminder-automation",
        {
          action: "run",
          key: randomUUID(),
          propertyId: property.id,
          confirmed: true,
        },
        "http://evil.test",
      )
    ).status,
    403,
  );
  assert.equal(
    (await fetch(base + "/api/jobs/reminders", { method: "POST" })).status,
    401,
  );
  pass(
    "Default off, bounded pages, CSRF, job secret and fresh owner/property access",
  );
  assert.equal((await save({ hour: 24 })).status, 400);
  assert.equal((await save({ intervalDays: 0 })).status, 400);
  assert.equal((await save({ confirmed: false })).status, 400);
  const config = {
    action: "save",
    propertyId: property.id,
    key: randomUUID(),
    confirmed: true,
    ...(await read()).policy,
    enabled: true,
    emailEnabled: true,
    hour: 0,
  };
  const saved = ok(await owner.call("/api/reminder-automation", config));
  assert.deepEqual(
    ok(await owner.call("/api/reminder-automation", config)),
    saved,
  );
  assert.equal(
    (await owner.call("/api/reminder-automation", { ...config, hour: 1 }))
      .status,
    400,
  );
  assert.equal((await save({ revision: 0 })).status, 400);
  pass(
    "Confirmed owner opt-in, schedule bounds, exact retry and stale revision protection",
  );
  const inv = await invoice(shift(-1)),
    future = await invoice(shift(2));
  let r = await run();
  assert.deepEqual(r, { portal: 1, email: 1 });
  assert.equal(
    await db.reminderDelivery.count({ where: { receivableId: row.id } }),
    0,
  );
  assert.equal(
    await db.reminderDelivery.count({ where: { invoiceId: future.id } }),
    0,
  );
  const q = await delivery(inv.id);
  assert.equal(q.emailOutbox.status, "QUEUED");
  assert.deepEqual(await run(), { portal: 0, email: 0 });
  assert(
    (await Promise.all([run(), run()])).every(
      (x) => x.portal === 0 && x.email === 0,
    ),
  );
  let reminders = ok(await tenant.call("/api/resident-reminders"));
  assert.equal(reminders.total, 1);
  assert.equal(reminders.rows[0].amount, 100000);
  assert.equal(ok(await peer.call("/api/resident-reminders")).total, 0);
  assert.equal(ok(await replacement.call("/api/resident-reminders")).total, 0);
  for (const key of [
    "emailHash",
    "emailOutbox",
    "grantId",
    "userId",
    "dedupeKey",
    "encrypted",
  ])
    assert(!JSON.stringify(reminders).includes(key));
  pass(
    "Invoice scheduling, no implicit opening share, future suppression, source cooldown and private tenant history",
  );
  await mail();
  const sent = await delivery(inv.id);
  assert.equal(sent.emailOutbox.status, "SINKED");
  const payload = JSON.parse(
    await readFile(
      `.local-secrets/mail-sink/${sent.emailOutbox.id}.json`,
      "utf8",
    ),
  );
  assert.equal(payload.to, t.email);
  assert(!payload.text.includes("100000"));
  assert(!payload.text.includes(inv.number));
  assert(payload.text.includes("/resident"));
  pass(
    "Email sink only, exact verified recipient and generic portal link without stale balance",
  );
  ok(await write("shareOpening", { grantId: grant.id }));
  const beforeCash = await cash();
  const receiptCount = await db.openingReceipt.count({
    where: { receivableId: row.id },
  });
  r = await run();
  assert.deepEqual(r, { portal: 1, email: 1 });
  assert.equal(ok(await tenant.call("/api/resident-reminders")).total, 2);
  const manualPreview = ok(
    await owner.call(
      `/api/opening-balances?propertyId=${property.id}&receivableId=${row.id}&reminders=1`,
    ),
  ).reminders.preview;
  assert.equal(manualPreview.eligible, false);
  assert.match(manualPreview.reason, /24 jam/);
  assert.equal(await cash(), beforeCash);
  assert.equal(
    await db.openingReceipt.count({ where: { receivableId: row.id } }),
    receiptCount,
  );
  const openMail = await db.reminderDelivery.findFirstOrThrow({
    where: { receivableId: row.id, channel: "EMAIL" },
    include: { emailOutbox: true },
  });
  ok(
    await write("revokeOpening", {
      shareId: (
        await db.openingShare.findFirstOrThrow({
          where: { receivableId: row.id, revokedAt: null },
        })
      ).id,
    }),
  );
  assert.equal(ok(await tenant.call("/api/resident-reminders")).total, 1);
  await mail();
  assert.equal(
    (
      await db.emailOutbox.findUniqueOrThrow({
        where: { id: openMail.emailOutbox.id },
      })
    ).status,
    "CANCELLED",
  );
  pass(
    "Explicit opening share, manual cooldown interoperability, revocation hides history and cancels queued email; no ledger effects",
  );
  const d = await db.reminderDelivery.findFirstOrThrow({
    where: { invoiceId: inv.id, channel: "PORTAL" },
  });
  await assert.rejects(
    db.reminderDelivery.update({ where: { id: d.id }, data: { amount: 1 } }),
  );
  await assert.rejects(db.reminderDelivery.delete({ where: { id: d.id } }));
  const { id: ignore, createdAt: ignoreDate, ...bad } = d;
  await assert.rejects(
    db.reminderDelivery.create({
      data: { ...bad, amount: 1, dedupeKey: randomUUID() },
    }),
  );
  await assert.rejects(
    db.reminderDelivery.create({
      data: {
        ...bad,
        userId: p.id,
        grantId: peerGrant.id,
        dedupeKey: randomUUID(),
      },
    }),
  );
  pass(
    "Database rejects history mutation/deletion, forged source amounts and cross-tenant binding",
  );
  ok(await save({ leadDays: 2 }));
  r = await run();
  assert.equal(r.portal, 1);
  assert.equal(r.email, 1);
  await pay(future.id, 100000);
  await mail();
  assert.equal((await delivery(future.id)).emailOutbox.status, "CANCELLED");
  assert.equal((await delivery(future.id)).emailOutbox.encryptedPayload, "");
  pass(
    "Lead window honored; settlement before dispatch cancels email and clears encrypted payload",
  );
  const partial = await invoice();
  await run();
  await pay(partial.id, 1000);
  await mail();
  assert.equal((await delivery(partial.id)).emailOutbox.status, "CANCELLED");
  const disabled = await invoice();
  await run();
  ok(await save({ enabled: false }));
  await mail();
  assert.equal((await delivery(disabled.id)).emailOutbox.status, "CANCELLED");
  assert.deepEqual(await run(), { portal: 0, email: 0 });
  ok(await save({ enabled: true }));
  pass(
    "Partial balance changes and policy disable invalidate queued snapshots",
  );
  const permission = await invoice();
  await run();
  await db.occupantAccess.update({
    where: { id: grant.id },
    data: { canViewBilling: false },
  });
  assert.equal((await tenant.call("/api/resident-reminders")).status, 403);
  await mail();
  assert.equal((await delivery(permission.id)).emailOutbox.status, "CANCELLED");
  assert.deepEqual(await run(), { portal: 0, email: 0 });
  await db.occupantAccess.update({
    where: { id: grant.id },
    data: { canViewBilling: true },
  });
  const changedEmail = await invoice();
  await run();
  await db.user.update({
    where: { id: t.id },
    data: { email: `auto-changed-${suffix}@example.test` },
  });
  await mail();
  assert.equal(
    (await delivery(changedEmail.id)).emailOutbox.status,
    "CANCELLED",
  );
  await db.user.update({ where: { id: t.id }, data: { email: t.email } });
  pass(
    "Fresh billing permission and verified recipient address checked again at dispatch",
  );
  async function uploadProof(id) {
    const link = ok(
      await owner.call("/api/manage", {
        action: "tenantLink",
        propertyId: property.id,
        invoiceId: id,
      }),
    );
    const form = new FormData();
    for (const [k, v] of Object.entries({
      amount: "100",
      date: today,
      method: "TRANSFER",
      reference: "AUTO-PENDING",
    }))
      form.set(k, v);
    form.set(
      "file",
      new Blob(["%PDF-1.7\nSynthetic automatic reminder proof\n%%EOF"], {
        type: "application/pdf",
      }),
      "proof.pdf",
    );
    const response = await fetch(
      base +
        "/api/tenant/" +
        new URL(link.url).pathname.split("/").pop() +
        "/proof",
      { method: "POST", headers: { Origin: base }, body: form },
    );
    assert.equal(response.status, 200);
  }
  const pendingBefore = await invoice();
  await uploadProof(pendingBefore.id);
  await run();
  assert.equal(
    await db.reminderDelivery.count({ where: { invoiceId: pendingBefore.id } }),
    0,
  );
  const pendingAfter = await invoice();
  await run();
  await uploadProof(pendingAfter.id);
  await mail();
  assert.equal(
    (await delivery(pendingAfter.id)).emailOutbox.status,
    "CANCELLED",
  );
  pass(
    "Pending proof suppresses initial reminders and cancels emails queued before upload",
  );
  const ownerRevoked = await invoice();
  await run();
  const membership = await db.orgMembership.findUniqueOrThrow({
    where: {
      userId_organizationId: { userId: u.id, organizationId: u.organizationId },
    },
  });
  await db.orgMembership.update({
    where: { id: membership.id },
    data: { status: "REVOKED" },
  });
  assert.equal((await owner.call(path)).status, 403);
  await mail();
  assert.equal(
    (await delivery(ownerRevoked.id)).emailOutbox.status,
    "CANCELLED",
  );
  await db.orgMembership.update({
    where: { id: membership.id },
    data: { status: "ACTIVE" },
  });
  pass("Revoked policy owner stops automation and queued dispatch");
  const uncertain = await invoice();
  await run();
  const unknown = await delivery(uncertain.id);
  await db.emailOutbox.update({
    where: { id: unknown.emailOutbox.id },
    data: { status: "PROCESSING", leaseUntil: new Date(Date.now() - 60000) },
  });
  await mail();
  assert.equal((await delivery(uncertain.id)).emailOutbox.status, "UNKNOWN");
  assert.deepEqual(await run(), { portal: 0, email: 0 });
  pass("Uncertain delivery becomes UNKNOWN without automatic resend");
  // More than one batch: settled/recent earlier sources cannot starve later eligible sources.
  for (let n = 0; n < 23; n++) await invoice(shift(-1));
  const bounded = await run();
  assert.equal(bounded.portal, 20);
  assert.equal(bounded.email, 20);
  const remaining = await run();
  assert.equal(remaining.portal, 3);
  assert.equal(remaining.email, 3);
  assert.deepEqual(await run(), { portal: 0, email: 0 });
  const page1 = await read(),
    page2 = ok(await owner.call(path + "&page=2"));
  assert.equal(page1.history.length, 20);
  assert.equal(page2.history.length, 20);
  const tenant1 = ok(await tenant.call("/api/resident-reminders")),
    tenant2 = ok(await tenant.call("/api/resident-reminders?page=2"));
  assert.equal(tenant1.rows.length, 20);
  assert(tenant2.rows.length > 0);
  assert(!tenant2.rows.some((x) => tenant1.rows.some((y) => x.id === y.id)));
  assert.equal(
    (await tenant.call("/api/resident-reminders?page=-1")).status,
    403,
  );
  pass(
    "Twenty-per-channel batches progress without starvation; owner/tenant history paginates privately",
  );
  await mail();
  const raceInvoice = await invoice();
  const race = await Promise.all([run(), run()]);
  assert.equal(
    race.reduce((s, r) => s + r.portal, 0),
    1,
  );
  assert.equal(
    race.reduce((s, r) => s + r.email, 0),
    1,
  );
  assert.equal(
    await db.reminderDelivery.count({ where: { invoiceId: raceInvoice.id } }),
    2,
  );
  const expiring = await delivery(raceInvoice.id);
  await db.emailOutbox.update({
    where: { id: expiring.emailOutbox.id },
    data: { expiresAt: new Date(Date.now() - 1000) },
  });
  await mail();
  const expired = await delivery(raceInvoice.id);
  assert.equal(expired.status, "CANCELLED");
  assert.equal(expired.reason, "REMINDER_EXPIRED");
  assert.equal(expired.emailOutbox.status, "CANCELLED");
  pass(
    "Concurrent first publication creates one delivery per channel; expired email is cancelled before sink",
  );
  const jakartaHour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Jakarta",
      hour: "2-digit",
      hourCycle: "h23",
    }).format(new Date()),
  );
  const gated = await invoice();
  if (jakartaHour < 23) {
    ok(await save({ hour: jakartaHour + 1 }));
    assert.deepEqual(await run(), { portal: 0, email: 0 });
    assert.equal(
      await db.reminderDelivery.count({ where: { invoiceId: gated.id } }),
      0,
    );
  }
  ok(await save({ hour: 0 }));
  await run();
  await mail();
  const template = await db.invoice.findUniqueOrThrow({
    where: { id: gated.id },
  });
  for (const status of ["DRAFT", "VOID"]) {
    await db.invoice.create({
      data: {
        ...template,
        id: undefined,
        number: "AUTO-" + status + "-" + randomUUID(),
        status,
      },
    });
  }
  await invoice(shift(31));
  assert.deepEqual(await run(), { portal: 0, email: 0 });
  pass(
    "Jakarta start hour, draft/void and distant due dates suppress scheduling",
  );
  const aged = await invoice();
  const agedOutbox = await db.emailOutbox.create({
    data: {
      dedupeKey: "aged-" + randomUUID(),
      template: "payment_reminder",
      userId: t.id,
      organizationId: u.organizationId,
      status: "UNKNOWN",
      encryptedPayload: "synthetic-not-deliverable",
      expiresAt: new Date(Date.now() + 3600000),
    },
  });
  const policy = (await read()).policy;
  const agedInvoice = await db.invoice.findUniqueOrThrow({
    where: { id: aged.id },
  });
  await db.reminderDelivery.create({
    data: {
      propertyId: property.id,
      invoiceId: aged.id,
      grantId: grant.id,
      userId: t.id,
      channel: "EMAIL",
      scheduledOn: shift(-10),
      amount: 100000,
      due: agedInvoice.due,
      reference: agedInvoice.number,
      emailHash: createHash("sha256").update(t.email).digest("hex"),
      policyRevision: policy.revision,
      dedupeKey: agedOutbox.dedupeKey,
      status: "QUEUED",
      emailOutboxId: agedOutbox.id,
      createdAt: new Date(Date.now() - 10 * 86400000),
    },
  });
  assert.deepEqual(await run(), { portal: 1, email: 0 });
  assert.equal(
    await db.reminderDelivery.count({
      where: { invoiceId: aged.id, channel: "EMAIL" },
    }),
    1,
  );
  pass("UNKNOWN email blocks automatic resend beyond the configured cooldown");
  assert.equal(await cash(), beforeCash + 101000);
  const worker = await fetch(base + "/api/jobs/reminders", {
    method: "POST",
    headers: { authorization: "Bearer " + process.env.OPERATIONS_JOB_KEY },
  });
  assert.equal(worker.status, 200);
  const secure = await fetch(base + path, {
    headers: { Cookie: owner.cookie },
  });
  assert.equal(secure.headers.get("cache-control"), "private, no-store");
  const safe = JSON.stringify(await secure.json());
  for (const key of [
    "encryptedPayload",
    "emailHash",
    "providerMessageId",
    "password",
  ])
    assert(!safe.includes(key));
  await mkdir("artifacts/reminder-stage3", { recursive: true });
  await writeFile(
    "artifacts/reminder-stage3/reminder-api.json",
    JSON.stringify(
      {
        groups: groups + 1,
        environment: "Disposable QA 55432 / loopback 3001",
        externalEmail: false,
        ledgerEffects:
          "Only explicit QA payments; reminders created no financial entries",
        sample: await read(),
      },
      null,
      2,
    ),
  );
  await writeFile(
    ".local-secrets/reminder-browser.json",
    JSON.stringify(
      {
        ownerEmail: u.email,
        tenantEmail: t.email,
        password,
        propertyId: property.id,
      },
      null,
      2,
    ),
  );
  pass(
    "Authenticated worker, no-store safe owner response and cash unchanged by notifications",
  );
  console.log("Reminder automation API groups passed:", groups);
} finally {
  await db.$disconnect();
}
