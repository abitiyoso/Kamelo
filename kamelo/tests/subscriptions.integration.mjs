import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { PrismaClient } from "../generated/prisma/index.js";
import { verifiedFixture, staffFixture } from "./helpers/identity.mjs";
import { subscriptionEnd } from "../lib/subscription-rules.mjs";
const url = new URL(process.env.DATABASE_URL || "http://invalid"),
  base = process.env.TEST_URL;
assert.equal(url.hostname, "127.0.0.1");
assert.equal(url.port, "55432");
assert.equal(url.pathname, "/kamelo_phase2_qa");
assert.equal(base, "http://127.0.0.1:3001");
const db = new PrismaClient(),
  suffix = Date.now(),
  password = "Subscription-QA-only-password-123";
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
const hash = (v) =>
  createHash("sha256").update(JSON.stringify(v)).digest("hex");
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
      const c = r.headers.get("set-cookie");
      if (c) cookie = c.split(";")[0];
      return { status: r.status, ...(await r.json()) };
    },
    async register(label) {
      const email = `subscription-${label}-${suffix}@example.test`;
      ok(
        await this.call("/api/auth", {
          action: "register",
          name: "Subscription QA " + label,
          email,
          password,
          phone: "081234567890",
        }),
      );
      await verifiedFixture(db, base, cookie, email);
      return db.user.findUniqueOrThrow({ where: { email } });
    },
    manage(action, p) {
      return this.call("/api/manage", { action, ...p });
    },
  };
}
const admin = client(),
  owner = client(),
  other = client(),
  staff = client();
let groups = 0;
const pass = (s) => {
  groups++;
  console.log("PASS", s);
};
try {
  const a = await admin.register("admin"),
    u = await owner.register("owner"),
    o = await other.register("other");
  await db.user.update({ where: { id: a.id }, data: { platformAdmin: true } });
  assert.equal((await admin.call("/api/subscriptions")).status, 403);
  ok(await admin.call("/api/account", { action: "switch", type: "PLATFORM" }));
  const property = ok(
    await owner.manage("property", {
      name: "Subscription QA Residence",
      type: "KOS",
      count: 2,
      rate: 1000000,
    }),
  );
  const foreign = ok(
    await other.manage("property", {
      name: "Other SaaS QA",
      type: "KOS",
      count: 1,
      rate: 1000000,
    }),
  );
  await db.organization.update({
    where: { id: o.organizationId },
    data: { plan: "starter", subscriptionStatus: "ACTIVE" },
  });
  const staffEmail = `subscription-staff-${suffix}@example.test`;
  ok(
    await staffFixture(db, base, other.cookie, {
      email: staffEmail,
      password,
      name: "Subscription Staff",
      phone: "081234567892",
      propertyIds: [foreign.id],
    }),
  );
  ok(
    await staff.call("/api/auth", {
      action: "login",
      email: staffEmail,
      password,
    }),
  );
  const orgId = u.organizationId,
    path = `/api/subscriptions?organizationId=${orgId}`;
  const write = (action, data = {}, key = randomUUID(), org = orgId) =>
    admin.call("/api/subscriptions", {
      action,
      organizationId: org,
      key,
      ...data,
    });
  const get = () => admin.call(path);
  assert.equal((await client().call("/api/subscriptions")).status, 401);
  assert.equal((await owner.call("/api/subscriptions")).status, 403);
  assert.equal((await staff.call("/api/subscriptions?own=1")).status, 403);
  assert.equal(
    (
      await owner.call(
        "/api/subscriptions?own=1&organizationId=" + o.organizationId,
      )
    ).status,
    404,
  );
  assert.equal(
    (
      await owner.call("/api/subscriptions", {
        action: "subscriptionIssue",
        organizationId: orgId,
        key: randomUUID(),
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await admin.call(
        "/api/subscriptions",
        { action: "billingProfile", organizationId: orgId, key: randomUUID() },
        "https://foreign.invalid",
      )
    ).status,
    403,
  );
  assert.equal(
    (await write("billingProfile", {}, randomUUID(), "not-an-organization"))
      .status,
    400,
  );
  pass(
    "explicit platform context, own-organization scope, staff/owner financial denial and CSRF",
  );

  const room = await db.room.findFirstOrThrow({
    where: { propertyId: property.id },
  });
  const stay = ok(
    await owner.manage("stay", {
      propertyId: property.id,
      roomId: room.id,
      name: "Private resident sentinel " + suffix,
      phone: "081234567893",
      start: today,
      rate: 1000000,
      billingDay: 18,
    }),
  );
  const rent = ok(
    await owner.manage("invoice", {
      propertyId: property.id,
      stayId: stay.id,
      due: today,
      items: [{ label: "Existing tenant rent", amount: 1000000 }],
    }),
  );
  const link = ok(
    await owner.manage("tenantLink", {
      propertyId: property.id,
      invoiceId: rent.id,
    }),
  );
  const tenantPath =
    "/api/tenant/" + new URL(link.url).pathname.split("/").pop();
  const residentSnapshot = async () =>
    hash({
      invoices: await db.invoice.findMany({
        where: { propertyId: property.id },
        include: { payments: true },
        orderBy: { id: "asc" },
      }),
      stays: await db.stay.findMany({
        where: { room: { propertyId: property.id } },
        orderBy: { id: "asc" },
      }),
      access: await db.smartAccess.findMany({
        where: { stayId: stay.id },
        orderBy: { id: "asc" },
      }),
    });
  const beforeResident = await residentSnapshot();
  const profile = {
    legalName: "PT Synthetic SaaS QA",
    address: "Synthetic billing address for QA only",
    contactName: "Billing Contact QA",
    contactEmail: "billing-qa@example.test",
    taxId: "QA-TAX-SYNTHETIC-12345",
    reference: "Synthetic customer-provided billing profile",
    revision: 0,
    confirmed: true,
  };
  assert.equal(
    (
      await write("subscriptionIssue", {
        plan: "starter",
        months: 1,
        periodStart: today,
        due: today,
        confirmed: true,
      })
    ).status,
    400,
  );
  ok(
    await owner.call("/api/subscriptions", {
      action: "billingProfile",
      organizationId: orgId,
      key: randomUUID(),
      ...profile,
    }),
  );
  const savedProfile = await db.saaSBillingProfile.findUniqueOrThrow({
    where: { organizationId: orgId },
  });
  assert.ok(!savedProfile.encryptedTaxId.includes(profile.taxId));
  assert.equal((await write("billingProfile", profile)).status, 400);
  const ownProfile = ok(await owner.call("/api/subscriptions?own=1"));
  assert.equal(ownProfile.billingProfile.maskedTaxId, "•••• 2345");
  assert.ok(!JSON.stringify(ownProfile).includes(profile.taxId));
  assert.equal(
    (await db.user.findUniqueOrThrow({ where: { id: u.id } })).email,
    u.email,
  );
  pass(
    "customer-owned billing profile, encrypted/masked tax identity, stale revision and login identity preservation",
  );

  const issue = {
    plan: "starter",
    months: 1,
    periodStart: today,
    due: shift(-2),
    confirmed: true,
    total: 1,
  };
  const key = randomUUID(),
    inv = ok(await write("subscriptionIssue", issue, key));
  assert.deepEqual(ok(await write("subscriptionIssue", issue, key)), inv);
  assert.equal(
    (await write("subscriptionIssue", { ...issue, months: 2 }, key)).status,
    400,
  );
  assert.equal((await write("subscriptionIssue", issue)).status, 400);
  let row = ok(await get()).invoices.find((x) => x.id === inv.invoiceId);
  assert.equal(row.total, 49000);
  assert.equal(row.periodEnd, subscriptionEnd(today, 1));
  assert.equal(row.financialStatus, "OVERDUE");
  const snapshot = JSON.stringify(row.billingSnapshot);
  ok(
    await write("billingProfile", {
      ...profile,
      revision: 1,
      legalName: "Revised SaaS Billing QA",
      taxId: "",
    }),
  );
  assert.equal(
    (
      await db.saaSBillingProfile.findUniqueOrThrow({
        where: { organizationId: orgId },
      })
    ).encryptedTaxId,
    savedProfile.encryptedTaxId,
  );
  assert.equal(
    JSON.stringify(ok(await get()).invoices[0].billingSnapshot),
    snapshot,
  );
  assert.ok(
    !JSON.stringify(ok(await get())).includes("Private resident sentinel"),
  );
  assert.ok(!JSON.stringify(ok(await get())).includes(rent.id));
  assert.equal(
    (await db.organization.findUniqueOrThrow({ where: { id: orgId } })).plan,
    "free",
  );
  pass(
    "catalog price and immutable billing snapshots, calendar period/overlap, issuance idempotency and no rent exposure",
  );

  const receive = (amount, reference, extra = {}) => ({
    invoiceId: inv.invoiceId,
    amount,
    date: today,
    reference,
    note: "Synthetic actual receipt reconciliation",
    confirmed: true,
    ...extra,
  });
  const receiptKey = randomUUID(),
    r1 = ok(
      await write(
        "subscriptionReceipt",
        receive(20000, "SaaS bank ref one"),
        receiptKey,
      ),
    );
  assert.deepEqual(
    ok(
      await write(
        "subscriptionReceipt",
        receive(20000, "SaaS bank ref one"),
        receiptKey,
      ),
    ),
    r1,
  );
  assert.equal(
    (await write("subscriptionReceipt", receive(1000, "SAAS BANK REF ONE")))
      .status,
    400,
  );
  assert.equal(
    (
      await write(
        "subscriptionReceipt",
        receive(1000, "future reference", { date: shift(1) }),
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await write("subscriptionActivate", {
        invoiceId: inv.invoiceId,
        note: "Synthetic activation reviewed",
        confirmed: true,
      })
    ).status,
    400,
  );
  const race = await Promise.all([
    write("subscriptionReceipt", receive(29000, "SaaS race one")),
    write("subscriptionReceipt", receive(29000, "SaaS race two")),
  ]);
  assert.deepEqual(race.map((x) => x.status).sort(), [200, 400]);
  row = ok(await get()).invoices.find((x) => x.id === inv.invoiceId);
  assert.equal(row.paid, 49000);
  assert.equal(row.financialStatus, "PAID");
  assert.equal(row.activatedAt, null);
  assert.equal(
    (await db.organization.findUniqueOrThrow({ where: { id: orgId } })).plan,
    "free",
  );
  pass(
    "partial/exactly-once receipt, duplicate reference, concurrent overpayment guard and no implicit activation",
  );

  const activate = {
    invoiceId: inv.invoiceId,
    note: "Synthetic reviewed current paid service",
    confirmed: true,
  };
  await db.organization.update({
    where: { id: orgId },
    data: {
      plan: "starter",
      subscriptionStatus: "ACTIVE",
      planExpiresAt: new Date(shift(90) + "T00:00:00Z"),
    },
  });
  assert.equal((await write("subscriptionActivate", activate)).status, 400);
  await db.organization.update({
    where: { id: orgId },
    data: { planExpiresAt: null },
  });
  assert.equal((await write("subscriptionActivate", activate)).status, 400);
  const activateKey = randomUUID();
  ok(
    await write(
      "subscriptionActivate",
      { ...activate, replaceLegacy: true },
      activateKey,
    ),
  );
  ok(
    await write(
      "subscriptionActivate",
      { ...activate, replaceLegacy: true },
      activateKey,
    ),
  );
  assert.equal(
    (await write("subscriptionActivate", { ...activate, replaceLegacy: true }))
      .status,
    400,
  );
  const entitlement = await db.organization.findUniqueOrThrow({
    where: { id: orgId },
  });
  assert.equal(entitlement.plan, "starter");
  assert.equal(
    entitlement.planExpiresAt.toISOString(),
    new Date(subscriptionEnd(today, 1) + "T00:00:00+07:00").toISOString(),
  );
  assert.equal(
    await db.subscriptionEvent.count({
      where: { organizationId: orgId, kind: "PAID_PERIOD_ACTIVATED" },
    }),
    1,
  );
  pass(
    "current paid-period activation, no shortening, explicit legacy replacement and immutable activation history",
  );

  const refund = {
    invoiceId: inv.invoiceId,
    receiptId: r1.entryId,
    amount: 10000,
    date: today,
    reference: "SaaS refund reference one",
    note: "Synthetic actual refund confirmed",
    confirmed: true,
  };
  const returned = ok(await write("subscriptionRefund", refund));
  assert.equal(
    (
      await write("subscriptionRefund", {
        ...refund,
        amount: 10001,
        reference: "Over source amount",
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await write("subscriptionCorrect", {
        invoiceId: inv.invoiceId,
        entryId: r1.entryId,
        note: "Cannot reverse partially refunded source",
        confirmed: true,
      })
    ).status,
    400,
  );
  assert.equal(ok(await get()).invoices[0].paid, 39000);
  assert.deepEqual(
    await db.organization.findUniqueOrThrow({ where: { id: orgId } }),
    entitlement,
  );
  ok(
    await write("subscriptionCorrect", {
      invoiceId: inv.invoiceId,
      entryId: returned.entryId,
      note: "Correct synthetic mistaken refund record",
      confirmed: true,
    }),
  );
  ok(
    await write("subscriptionCorrect", {
      invoiceId: inv.invoiceId,
      entryId: r1.entryId,
      note: "Correct synthetic mistaken receipt record",
      confirmed: true,
    }),
  );
  assert.equal(
    (
      await write("subscriptionCorrect", {
        invoiceId: inv.invoiceId,
        entryId: r1.entryId,
        note: "Cannot correct same entry twice",
        confirmed: true,
      })
    ).status,
    400,
  );
  ok(
    await write(
      "subscriptionReceipt",
      receive(20000, "Replacement receipt reference"),
    ),
  );
  assert.equal(ok(await get()).invoices[0].paid, 49000);
  await assert.rejects(
    db.$executeRaw`UPDATE "SubscriptionEntry" SET "delta" = 1 WHERE "id" = ${r1.entryId}`,
  );
  await assert.rejects(
    db.$executeRaw`DELETE FROM "SubscriptionEntry" WHERE "id" = ${r1.entryId}`,
  );
  await assert.rejects(
    db.$executeRaw`UPDATE "SubscriptionInvoice" SET "total" = 1 WHERE "id" = ${inv.invoiceId}`,
  );
  const history = await db.subscriptionEvent.findFirstOrThrow({
    where: { organizationId: orgId },
  });
  await assert.rejects(
    db.$executeRaw`UPDATE "SubscriptionEvent" SET "note" = 'rewrite' WHERE "id" = ${history.id}`,
  );
  pass(
    "source-bounded refunds, append-only corrections/financial snapshots, no implicit entitlement or resident changes",
  );

  const nextStart = subscriptionEnd(today, 1),
    future = ok(
      await write("subscriptionIssue", { ...issue, periodStart: nextStart }),
    );
  const fp = ok(
    await write("subscriptionReceipt", {
      ...receive(49000, "Future service payment"),
      invoiceId: future.invoiceId,
    }),
  );
  assert.equal(
    (
      await write("subscriptionActivate", {
        ...activate,
        invoiceId: future.invoiceId,
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await write("subscriptionVoid", {
        invoiceId: future.invoiceId,
        note: "Cannot void received funds",
        confirmed: true,
      })
    ).status,
    400,
  );
  ok(
    await write("subscriptionCorrect", {
      invoiceId: future.invoiceId,
      entryId: fp.entryId,
      note: "Synthetic prepayment entry correction",
      confirmed: true,
    }),
  );
  ok(
    await write("subscriptionVoid", {
      invoiceId: future.invoiceId,
      note: "Synthetic future invoice cancellation",
      confirmed: true,
    }),
  );
  assert.equal(
    (
      await write("subscriptionReceipt", {
        ...receive(1, "Void write test"),
        invoiceId: future.invoiceId,
      })
    ).status,
    400,
  );
  const replacement = ok(
    await write("subscriptionIssue", { ...issue, periodStart: nextStart }),
  );
  assert.notEqual(replacement.invoiceId, future.invoiceId);
  assert.equal(
    (
      await other.call(
        "/api/subscriptions?own=1&organizationId=" +
          orgId +
          "&invoiceId=" +
          inv.invoiceId,
      )
    ).status,
    404,
  );
  assert.equal(
    (
      await owner.call(
        "/api/subscriptions?own=1&invoiceId=" + replacement.invoiceId,
      )
    ).status,
    200,
  );
  pass(
    "future service payment cannot activate early; controlled void/reissue and scoped invoice/entry reads",
  );

  const upgrade = ok(await other.manage("upgrade", { plan: "plus" }));
  const legacy = await Promise.all([
    admin.manage("activate", { requestId: upgrade.id }),
    admin.manage("activate", { requestId: upgrade.id }),
  ]);
  assert.deepEqual(legacy.map((x) => x.status).sort(), [200, 400]);
  assert.equal(
    await db.subscriptionInvoice.count({
      where: { organizationId: o.organizationId },
    }),
    0,
  );
  assert.equal(
    await db.subscriptionEvent.count({
      where: {
        organizationId: o.organizationId,
        kind: "LEGACY_MANUAL_ACTIVATION",
      },
    }),
    1,
  );
  assert.equal(await residentSnapshot(), beforeResident);
  assert.equal(
    (await (await fetch(base + tenantPath)).json()).invoice.balance,
    1000000,
  );
  await db.organization.update({
    where: { id: orgId },
    data: { planExpiresAt: new Date(Date.now() - 1000) },
  });
  const fallback = ok(await owner.call("/api/manage"));
  assert.equal(fallback.plan, "free");
  assert.equal(await residentSnapshot(), beforeResident);
  await db.organization.update({
    where: { id: orgId },
    data: { planExpiresAt: entitlement.planExpiresAt },
  });
  pass(
    "serialized legacy activation preserves compatibility without invented payment; expiry preserves resident finance/access",
  );

  const plain = await db.subscriptionInvoice.findUniqueOrThrow({
    where: { id: inv.invoiceId },
  });
  const invoiceFixtures = Array.from({ length: 27 }, (_, i) => ({
    organizationId: orgId,
    number: "QA-SaaS-" + suffix + "-" + i,
    plan: "starter",
    monthlyPrice: 49000,
    months: 1,
    total: 49000,
    periodStart: subscriptionEnd("2030-01-01", 1 + (i % 12)),
    periodEnd: subscriptionEnd("2030-01-01", 2 + (i % 11)),
    due: shift(-2),
    billingSnapshot: plain.billingSnapshot,
    createdBy: a.id,
  }));
  // Distinct, valid synthetic calendar periods, including years beyond the interactive month selector.
  for (let i = 0; i < invoiceFixtures.length; i++) {
    const d = new Date(Date.UTC(2030, i, 1));
    invoiceFixtures[i].periodStart = d.toISOString().slice(0, 10);
    invoiceFixtures[i].periodEnd = subscriptionEnd(
      invoiceFixtures[i].periodStart,
      1,
    );
  }
  await db.subscriptionInvoice.createMany({ data: invoiceFixtures });
  const bulk = await db.subscriptionInvoice.findFirstOrThrow({
    where: { number: invoiceFixtures[0].number },
  });
  await db.subscriptionEntry.createMany({
    data: Array.from({ length: 31 }, (_, i) => ({
      invoiceId: bulk.id,
      kind: "RECEIPT",
      delta: 1,
      date: today,
      reference: "QA pagination receipt " + i,
      note: "Synthetic pagination receipt",
      actorId: a.id,
    })),
  });
  await db.subscriptionEvent.createMany({
    data: Array.from({ length: 32 }, (_, i) => ({
      organizationId: orgId,
      kind: "QA_HISTORY",
      note: "Synthetic service event " + i,
      actorId: a.id,
      metadata: {},
    })),
  });
  const detail = ok(await get());
  assert.equal(detail.invoices.length, 25);
  assert.equal(detail.invoiceTotal, 30);
  assert.equal(
    ok(await admin.call(path + "&invoicePage=2")).invoices.length,
    5,
  );
  const allInvoices = await db.subscriptionInvoice.aggregate({
      where: { organizationId: orgId, status: "ISSUED" },
      _sum: { total: true },
    }),
    allPaid = await db.subscriptionEntry.aggregate({
      where: { invoice: { organizationId: orgId } },
      _sum: { delta: true },
    });
  assert.equal(detail.summary.billed, allInvoices._sum.total);
  assert.equal(detail.summary.paid, allPaid._sum.delta);
  assert.equal(
    detail.summary.balance,
    allInvoices._sum.total - allPaid._sum.delta,
  );
  const entries = ok(
    await admin.call(path + "&invoiceId=" + bulk.id + "&entryPage=2"),
  );
  assert.equal(entries.entries.length, 1);
  assert.equal(entries.entryTotal, 31);
  assert.equal(
    ok(await admin.call(path + "&eventPage=2")).events.length > 0,
    true,
  );
  const prefix = "SaaS pagination " + suffix;
  await db.organization.createMany({
    data: Array.from({ length: 51 }, (_, i) => ({ name: prefix + " " + i })),
  });
  const listed = ok(
    await admin.call("/api/subscriptions?q=" + encodeURIComponent(prefix)),
  );
  assert.equal(listed.rows.length, 50);
  assert.equal(listed.total, 51);
  assert.equal(
    ok(
      await admin.call(
        "/api/subscriptions?q=" + encodeURIComponent(prefix) + "&page=2",
      ),
    ).rows.length,
    1,
  );
  assert.equal((await admin.call("/api/subscriptions?page=1.2")).status, 400);
  assert.equal(
    (await admin.call(path + "&entryPage=1.2&invoiceId=" + bulk.id)).status,
    400,
  );
  assert.ok(!JSON.stringify(detail).includes(profile.taxId));
  assert.ok(!JSON.stringify(detail).includes("encryptedTaxId"));
  pass(
    "all-history billed/paid totals, bounded directory/invoice/entry/event pagination and safe customer projections",
  );

  await db.user.update({ where: { id: a.id }, data: { platformAdmin: false } });
  assert.equal((await admin.call(path)).status, 401);
  assert.equal(
    (await write("subscriptionReceipt", receive(1, "Revoked privilege")))
      .status,
    401,
  );
  await db.user.update({ where: { id: a.id }, data: { platformAdmin: true } });
  await mkdir("artifacts/phase4c", { recursive: true });
  await mkdir(".local-secrets", { recursive: true });
  await writeFile(
    "artifacts/phase4c/subscriptions-tests.json",
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
    ".local-secrets/phase4c-browser.json",
    JSON.stringify({
      base,
      admin: a.email,
      owner: u.email,
      password,
      organizationId: orgId,
      invoiceId: inv.invoiceId,
    }),
  );
} finally {
  await db.$disconnect();
}
