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
  const path = "/api/dashboard?propertyId=" + property.id;
  const dash = async (extra = "") => ok(await owner.call(path + extra));
  const from = today.slice(0, 7) + "-01",
    shift = (n) =>
      new Date(Date.parse(today + "T00:00:00Z") + n * 86400000)
        .toISOString()
        .slice(0, 10);
  const prior = new Date(
    Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 2, 1),
  )
    .toISOString()
    .slice(0, 10);
  assert.equal((await anon.call(path)).status, 401);
  assert.equal((await tenant.call(path)).status, 403);
  assert.equal((await other.call(path)).status, 403);
  const staffEmail = `dashboard-staff-${suffix}@example.test`;
  ok(
    await staffFixture(db, base, owner.cookie, {
      name: "Dashboard Staff",
      email: staffEmail,
      password,
      phone: "081234567890",
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
  for (const query of [
    "/api/dashboard",
    "/api/dashboard?propertyId=" + property.id + "&page=0",
    "/api/dashboard?propertyId=" + property.id + "&page=1.5",
  ])
    assert.equal((await owner.call(query)).status, 403);
  pass(
    "Fresh owner-only property scope, anonymous/staff/tenant/cross-owner denial and page bounds",
  );
  const invoice = ok(
    await owner.call("/api/manage", {
      action: "invoice",
      propertyId: property.id,
      stayId: stay.id,
      due: shift(-1),
      items: [{ label: "Synthetic dashboard rent", amount: 1000000 }],
    }),
  );
  ok(
    await owner.call("/api/manage", {
      action: "payment",
      propertyId: property.id,
      invoiceId: invoice.id,
      amount: 300000,
      date: today,
      method: "TRANSFER",
      reference: "DASH-INVOICE-300",
      confirmed: true,
    }),
  );
  const currentReceipt = ok(
    await write("receipt", {
      amount: 200000,
      date: today,
      method: "TRANSFER",
      reference: "DASH-OPENING-200",
      note: "Synthetic current opening receipt",
    }),
  );
  const oldSource = {
    ...source,
    asOf: prior,
    csv:
      header +
      "Opening Proof Resident,081234567881,DASH-OLD-500,500000," +
      prior,
  };
  const preview = ok(
    await owner.call("/api/opening-balances", {
      action: "preview",
      ...oldSource,
    }),
  );
  const oldBatch = ok(
    await owner.call("/api/opening-balances", {
      action: "commit",
      ...oldSource,
      digest: preview.digest,
      key: randomUUID(),
      confirmed: true,
    }),
  );
  const oldRow = await db.openingReceivable.findFirstOrThrow({
    where: { batchId: oldBatch.id },
  });
  const oldReceipt = ok(
    await owner.call("/api/opening-balances", {
      action: "receipt",
      receivableId: oldRow.id,
      amount: 100000,
      date: prior,
      method: "TRANSFER",
      reference: "DASH-PRIOR-100",
      note: "Synthetic prior period receipt",
      key: randomUUID(),
      confirmed: true,
    }),
  );
  const d = await dash();
  assert.equal(d.income, 500000);
  assert.equal(d.previousIncome, 100000);
  assert.equal(d.incomeChangePercent, 400);
  assert.equal(d.incomeDirection, "up");
  assert.equal(d.outstanding, 2400000);
  assert.equal(d.overdueCount, 3);
  assert.equal(d.overdueBalance, 2400000);
  assert.equal(d.trend.length, 6);
  assert.equal(d.trend.at(-1).income, 500000);
  assert.equal(
    d.sources.find((s) => s.source === "INVOICE").outstanding,
    700000,
  );
  assert.equal(
    d.sources.find((s) => s.source === "OPENING").outstanding,
    1700000,
  );
  pass(
    "Current cash, matched calendar comparison, six-month trend and two-source debt reconcile",
  );
  const life = (action, extra) =>
    owner.call("/api/lifecycle", {
      action,
      propertyId: property.id,
      key: randomUUID(),
      confirmed: true,
      ...extra,
    });
  const cost = ok(
    await life("financeExpenseCreate", {
      description: "Synthetic dashboard utility",
      category: "UTILITY",
      amount: 100000,
      incurredOn: today,
      payee: "QA utility vendor",
      reference: "DASH-COST",
      note: "Synthetic dashboard cost bill",
    }),
  );
  const payment = ok(
    await life("financeExpensePay", {
      expenseId: cost.expenseId,
      amount: 60000,
      date: today,
      reference: "DASH-COST-PAY",
      note: "Synthetic paid operating cost",
    }),
  );
  ok(
    await life("financeExpenseRefund", {
      expenseId: cost.expenseId,
      paymentId: payment.entryId,
      amount: 10000,
      date: today,
      reference: "DASH-REFUND",
      note: "Synthetic supplier refund",
    }),
  );
  const finance = ok(
      await owner.call(
        `/api/finance?propertyId=${property.id}&from=${from}&to=${today}`,
      ),
    ).summary,
    withCost = await dash();
  assert.equal(withCost.expense, 50000);
  assert.equal(withCost.surplus, 450000);
  assert.equal(withCost.income, finance.rentReceived);
  assert.equal(withCost.expense, finance.expenseCashOut);
  assert.equal(withCost.surplus, finance.surplus);
  pass(
    "Dashboard shares exact canonical finance cash and net expenses/refunds",
  );
  const account = await db.depositAccount.create({ data: { stayId: stay.id } });
  await db.depositEntry.create({
    data: {
      accountId: account.id,
      kind: "RECEIPT",
      delta: 900000,
      date: today,
      reference: "Synthetic deposit fixture",
      actorId: u.id,
    },
  });
  assert.equal((await dash()).income, 500000);
  assert.equal((await dash()).outstanding, 2400000);
  assert.equal((await dash()).surplus, 450000);
  pass(
    "Deposit liability/cash does not inflate income, debt or operating surplus",
  );
  const shared = ok(await write("shareOpening", { grantId: grant.id }));
  const link = ok(
      await owner.call("/api/manage", {
        action: "tenantLink",
        propertyId: property.id,
        invoiceId: invoice.id,
      }),
    ),
    token = new URL(link.url).pathname.split("/").pop();
  const form = new FormData();
  for (const [k, v] of Object.entries({
    amount: "50000",
    date: today,
    method: "TRANSFER",
    reference: "DASH-PENDING-INVOICE",
  }))
    form.set(k, v);
  form.set(
    "file",
    new Blob(["%PDF-1.7\nSynthetic dashboard proof\n%%EOF"], {
      type: "application/pdf",
    }),
    "proof.pdf",
  );
  const upload = await fetch(base + "/api/tenant/" + token + "/proof", {
    method: "POST",
    headers: { Origin: base },
    body: form,
  });
  assert.equal(upload.status, 200);
  const openingForm = new FormData();
  for (const [k, v] of Object.entries({
    receivableId: row.id,
    key: randomUUID(),
    amount: "50000",
    date: today,
    method: "TRANSFER",
    reference: "DASH-PENDING-OPENING",
    note: "Synthetic pending note",
  }))
    openingForm.set(k, v);
  openingForm.set(
    "file",
    new Blob(["%PDF-1.7\nSynthetic opening dashboard proof\n%%EOF"], {
      type: "application/pdf",
    }),
    "proof.pdf",
  );
  const uploadO = await fetch(base + "/api/opening-tenant", {
    method: "POST",
    headers: { Origin: base, Cookie: tenant.cookie },
    body: openingForm,
  });
  assert.equal(uploadO.status, 200);
  const withProofs = await dash(),
    queue = ok(await owner.call("/api/proof-queue?propertyId=" + property.id));
  assert.equal(withProofs.proofCount, 2);
  assert.equal(withProofs.proofCount, queue.total);
  assert.equal(withProofs.income, 500000);
  assert.equal(withProofs.outstanding, 2400000);
  pass(
    "Pending priority counts both ledgers without treating evidence as cash",
  );
  const resident = ok(await tenant.call("/api/resident"));
  assert.equal(resident.billingSummary.invoice, 700000);
  assert.equal(resident.billingSummary.opening, 1300000);
  assert.equal(resident.billingSummary.outstanding, 2000000);
  assert.equal(resident.billingSummary.next.source, "OPENING");
  assert.equal(
    ok(await peer.call("/api/resident")).billingSummary.outstanding,
    0,
  );
  const oldShare = ok(
    await owner.call("/api/opening-balances", {
      action: "shareOpening",
      receivableId: oldRow.id,
      grantId: grant.id,
      confirmed: true,
      key: randomUUID(),
    }),
  );
  assert.equal(
    ok(await tenant.call("/api/resident")).billingSummary.outstanding,
    2400000,
  );
  ok(
    await owner.call("/api/opening-balances", {
      action: "revokeOpening",
      receivableId: oldRow.id,
      shareId: oldShare.id,
      confirmed: true,
      key: randomUUID(),
    }),
  );
  assert.equal(
    ok(await tenant.call("/api/resident")).billingSummary.outstanding,
    2000000,
  );
  await db.occupantAccess.update({
    where: { id: grant.id },
    data: { canViewBilling: false },
  });
  const hidden = ok(await tenant.call("/api/resident"));
  assert.equal(hidden.billingSummary, null);
  assert.equal(hidden.invoices.length, 0);
  await db.occupantAccess.update({
    where: { id: grant.id },
    data: { canViewBilling: true },
  });
  pass(
    "Tenant home sums only own invoice and explicitly shared debt; revocation and billing permission apply",
  );
  const second = ok(
    await owner.call("/api/manage", {
      action: "property",
      name: "Empty Dashboard Property",
      type: "KOS",
      count: 1,
      rate: 1000000,
    }),
  );
  const empty = ok(await owner.call("/api/dashboard?propertyId=" + second.id));
  assert.equal(empty.income, 0);
  assert.equal(empty.outstanding, 0);
  assert.equal(empty.incomeChangePercent, 0);
  assert.equal(empty.incomeDirection, "flat");
  assert.equal(empty.overdue.rows.length, 0);
  assert.equal(
    ok(await owner.call("/api/dashboard?propertyId=all")).income,
    500000,
  );
  pass(
    "Empty property and portfolio summaries retain accurate zero baselines and scope",
  );
  const excluded = await db.invoice.create({
    data: {
      propertyId: property.id,
      roomId: rooms[0].id,
      stayId: stay.id,
      guestId: actualStay.guestId,
      number: "DASH-DRAFT-" + suffix,
      date: today,
      due: shift(-1),
      total: 999999,
      items: [],
      status: "DRAFT",
    },
  });
  const future = await db.invoice.create({
    data: {
      propertyId: property.id,
      roomId: rooms[0].id,
      stayId: stay.id,
      guestId: actualStay.guestId,
      number: "DASH-FUTURE-" + suffix,
      date: shift(1),
      due: shift(1),
      total: 999999,
      items: [],
      status: "UNPAID",
    },
  });
  assert.equal((await dash()).outstanding, 2400000);
  assert.equal(
    ok(await tenant.call("/api/resident")).billingSummary.outstanding,
    2000000,
  );
  await db.invoice.update({
    where: { id: excluded.id },
    data: { status: "VOID" },
  });
  assert.equal((await dash()).outstanding, 2400000);
  pass("Draft, void and future-issued debt excluded from current aggregates");
  const extra = Array.from({ length: 114 }, (_, i) => ({
    propertyId: property.id,
    roomId: rooms[0].id,
    stayId: stay.id,
    guestId: actualStay.guestId,
    number: `DASH-HISTORY-${suffix}-${i}`,
    date: shift(-400),
    due: shift(-300),
    total: 1,
    items: [],
    status: "UNPAID",
  }));
  await db.invoice.createMany({ data: extra });
  const first = await dash(),
    secondPage = await dash("&page=2");
  assert.equal(first.overdue.rows.length, 10);
  assert.equal(secondPage.overdue.rows.length, 10);
  assert.equal(
    new Set(
      [...first.overdue.rows, ...secondPage.overdue.rows].map(
        (r) => r.source + r.id,
      ),
    ).size,
    20,
  );
  assert.equal(first.overdue.total, 117);
  assert.equal(first.outstanding, 2400114);
  const allResident = ok(await tenant.call("/api/resident"));
  assert.equal(allResident.invoices.length, 100);
  assert.equal(allResident.billingSummary.outstanding, 2000114);
  pass(
    "Owner ten-row drilldown and tenant totals cover debt beyond 50/100 visible invoice limits",
  );
  ok(
    await write("reverseReceipt", {
      entryId: currentReceipt.id,
      note: "Synthetic receipt corrected at source date",
    }),
  );
  assert.equal((await dash()).income, 300000);
  assert.equal((await dash()).outstanding, 2600114);
  assert.equal(
    ok(await tenant.call("/api/resident")).billingSummary.outstanding,
    2200114,
  );
  ok(
    await owner.call("/api/opening-balances", {
      action: "reverseReceipt",
      receivableId: oldRow.id,
      entryId: oldReceipt.id,
      note: "Synthetic prior comparison correction",
      key: randomUUID(),
      confirmed: true,
    }),
  );
  const corrected = await dash();
  assert.equal(corrected.previousIncome, 0);
  assert.equal(corrected.incomeChangePercent, null);
  assert.equal(corrected.incomeDirection, "up");
  assert.equal(corrected.outstanding, 2700114);
  pass(
    "Corrections restate original cash period and debt; zero comparison never fabricates percent",
  );
  const oldCost = ok(
    await life("financeExpenseCreate", {
      description: "Synthetic old cost refund",
      category: "OTHER",
      amount: 100000,
      incurredOn: prior,
      payee: "Old QA vendor",
      reference: "DASH-OLD-COST",
      note: "Synthetic prior month cost",
    }),
  );
  const oldCostPay = ok(
    await life("financeExpensePay", {
      expenseId: oldCost.expenseId,
      amount: 100000,
      date: prior,
      reference: "DASH-OLD-COST-PAY",
      note: "Synthetic prior cost payment",
    }),
  );
  ok(
    await life("financeExpenseRefund", {
      expenseId: oldCost.expenseId,
      paymentId: oldCostPay.entryId,
      amount: 100000,
      date: today,
      reference: "DASH-OLD-REFUND",
      note: "Synthetic old supplier refund",
    }),
  );
  const negative = await dash();
  assert.equal(negative.expense, -50000);
  assert.equal(negative.surplus, 350000);
  assert.equal(negative.trend.at(-1).outflow, -50000);
  pass(
    "Net expense refunds may be negative and increase cash surplus without clipped chart values",
  );
  const tables = [
    "Invoice",
    "Payment",
    "OpeningReceivable",
    "OpeningReceipt",
    "OpeningProof",
    "PaymentProof",
    "DepositEntry",
    "ExpenseEntry",
  ];
  const snapshot = async () => {
    const result = {};
    for (const table of tables) {
      const rows = await db.$queryRawUnsafe(
        `SELECT * FROM "${table}" ORDER BY id`,
      );
      result[table] = createHash("sha256")
        .update(JSON.stringify(rows))
        .digest("hex");
    }
    return result;
  };
  const before = await snapshot();
  await dash();
  await dash("&page=2");
  await tenant.call("/api/resident");
  assert.deepEqual(await snapshot(), before);
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
  await db.orgMembership.update({
    where: { id: membership.id },
    data: { status: "ACTIVE" },
  });
  const response = await fetch(base + path, {
    headers: { Cookie: owner.cookie },
  });
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  const safe = JSON.stringify(await response.json());
  for (const field of ["storageKey", "tokenHash", "encrypted", "password"])
    assert(!safe.includes(field));
  pass(
    "Dashboard reads preserve ledger hashes, deny revoked owner and expose no private file metadata",
  );
  await mkdir("artifacts/dashboard-stage2", { recursive: true });
  await writeFile(
    "artifacts/dashboard-stage2/dashboard-api.json",
    JSON.stringify(
      {
        groups,
        mainDatabase: false,
        externalEmail: false,
        readHashesPreserved: before,
      },
      null,
      2,
    ),
  );
  await writeFile(
    ".local-secrets/dashboard-browser.json",
    JSON.stringify(
      {
        ownerEmail: u.email,
        tenantEmail: t.email,
        password,
        propertyId: property.id,
        expected: await dash(),
      },
      null,
      2,
    ),
  );
  console.log("Dashboard API groups passed:", groups);
} finally {
  await db.$disconnect();
}
