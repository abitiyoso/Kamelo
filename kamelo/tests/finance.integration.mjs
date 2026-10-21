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
  password = "Finance-QA-only-password-123";
const today = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Jakarta",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());
const shift = (n) =>
    new Date(Date.parse(today + "T00:00:00Z") + n * 86400000)
      .toISOString()
      .slice(0, 10),
  from = today.slice(0, 7) + "-01";
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
      const email = `finance-${label}-${suffix}@example.test`;
      ok(
        await this.call("/api/auth", {
          action: "register",
          name: "Finance QA " + label,
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
const owner = client(),
  other = client(),
  admin = client(),
  staff = client();
let groups = 0;
const pass = (s) => {
  groups++;
  console.log("PASS", s);
};
try {
  const u = await owner.register("owner"),
    o = await other.register("other"),
    a = await admin.register("admin");
  const property = ok(
    await owner.manage("property", {
      name: "Finance QA Residence",
      type: "KOS",
      count: 3,
      rate: 1000000,
    }),
  );
  const foreign = ok(
    await other.manage("property", {
      name: "Foreign Finance QA",
      type: "KOS",
      count: 1,
      rate: 1000000,
    }),
  );
  await db.organization.update({
    where: { id: u.organizationId },
    data: { plan: "plus", subscriptionStatus: "ACTIVE" },
  });
  await db.organization.update({
    where: { id: o.organizationId },
    data: { plan: "starter", subscriptionStatus: "ACTIVE" },
  });
  const second = ok(
    await owner.manage("property", {
      name: "Second Finance QA",
      type: "HOTEL",
      count: 1,
      rate: 350000,
    }),
  );
  const staffEmail = `finance-staff-${suffix}@example.test`;
  ok(
    await staffFixture(db, base, other.cookie, {
      email: staffEmail,
      password,
      name: "Finance Staff",
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
  await db.user.update({ where: { id: a.id }, data: { platformAdmin: true } });
  ok(await admin.call("/api/account", { action: "switch", type: "PLATFORM" }));
  const path = `/api/finance?propertyId=${property.id}&from=${from}&to=${today}`;
  const report = (extra = "") => owner.call(path + extra);
  const write = (action, data = {}, key = randomUUID(), target = property.id) =>
    owner.call("/api/lifecycle", { action, propertyId: target, key, ...data });
  const source = {
    description: "Listrik area bersama",
    category: "UTILITY",
    amount: 100000,
    incurredOn: today,
    payee: "Pemasok QA",
    reference: "COST-QA-ONE",
    note: "Synthetic cost source",
    confirmed: true,
  };
  assert.equal((await client().call(path)).status, 401);
  assert.equal((await staff.call(path)).status, 403);
  assert.equal((await admin.call(path)).status, 403);
  assert.equal((await other.call(path)).status, 404);
  assert.equal(
    (
      await staff.call("/api/lifecycle", {
        action: "financeExpenseCreate",
        propertyId: property.id,
        key: randomUUID(),
        ...source,
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await owner.call(
        "/api/lifecycle",
        {
          action: "financeExpenseCreate",
          propertyId: property.id,
          key: randomUUID(),
          ...source,
        },
        "https://foreign.invalid",
      )
    ).status,
    403,
  );
  assert.equal(
    (await owner.call(`/api/finance?propertyId=${foreign.id}&format=csv`))
      .status,
    404,
  );
  assert.equal((await owner.call(path + "&page=1.2")).status, 400);
  assert.equal(
    (
      await owner.call(
        `/api/finance?propertyId=${property.id}&from=2026-02-30&to=${today}`,
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await owner.call(
        `/api/finance?propertyId=${property.id}&from=2020-01-01&to=${today}`,
      )
    ).status,
    400,
  );
  assert.equal(
    (await owner.call(`/api/finance?propertyId=${property.id}&to=${shift(1)}`))
      .status,
    400,
  );
  pass(
    "owner-only property/portfolio boundaries, platform/staff denial, CSRF and bounded real report dates",
  );

  const key = randomUUID(),
    cost = ok(await write("financeExpenseCreate", source, key));
  assert.deepEqual(ok(await write("financeExpenseCreate", source, key)), cost);
  assert.equal(
    (await write("financeExpenseCreate", { ...source, amount: 99999 }, key))
      .status,
    400,
  );
  assert.equal((await write("financeExpenseCreate", source)).status, 400);
  assert.equal(
    (
      await write("financeExpenseCreate", {
        ...source,
        amount: 0,
        reference: "Invalid amount",
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await write("financeExpenseCreate", {
        ...source,
        confirmed: false,
        reference: "Unconfirmed",
      })
    ).status,
    400,
  );
  const detail = () => report("&expenseId=" + cost.expenseId);
  assert.equal(ok(await detail()).expense.paid, 0);
  assert.equal(ok(await report()).summary.expenseCashOut, 0);
  assert.equal(ok(await report()).summary.bookedExpenses, 100000);
  const pay = {
    expenseId: cost.expenseId,
    amount: 60000,
    date: today,
    reference: "Expense bank reference one",
    note: "Synthetic actual cost payment",
    confirmed: true,
  };
  const payKey = randomUUID(),
    p1 = ok(await write("financeExpensePay", pay, payKey));
  assert.deepEqual(ok(await write("financeExpensePay", pay, payKey)), p1);
  assert.equal(
    (
      await write("financeExpensePay", {
        ...pay,
        amount: 1,
        reference: "EXPENSE BANK REFERENCE ONE",
      })
    ).status,
    400,
  );
  const foreignCost = ok(
    await other.call("/api/lifecycle", {
      action: "financeExpenseCreate",
      propertyId: foreign.id,
      key: randomUUID(),
      ...source,
    }),
  );
  assert.equal(
    (await report("&expenseId=" + foreignCost.expenseId)).status,
    404,
  );
  assert.equal(
    (
      await write("financeExpensePay", {
        ...pay,
        expenseId: foreignCost.expenseId,
      })
    ).status,
    400,
  );
  assert.equal(ok(await detail()).expense.balance, 40000);
  pass(
    "immutable cost source, unpaid versus paid separation, idempotent partial payments and resource isolation",
  );

  const room = await db.room.findFirstOrThrow({
      where: { propertyId: property.id },
    }),
    stay = ok(
      await owner.manage("stay", {
        propertyId: property.id,
        roomId: room.id,
        name: "Finance resident QA",
        phone: "081234567893",
        start: today,
        rate: 1000000,
        billingDay: 18,
      }),
    );
  const invoice = ok(
    await owner.manage("invoice", {
      propertyId: property.id,
      stayId: stay.id,
      due: today,
      items: [{ label: "Rent QA", amount: 1000000 }],
    }),
  );
  const rent = ok(
    await owner.manage("payment", {
      propertyId: property.id,
      invoiceId: invoice.id,
      amount: 600000,
      date: today,
      method: "TRANSFER",
      reference: "RENT-QA-ONE",
      confirmed: true,
    }),
  );
  const link = ok(
      await owner.manage("tenantLink", {
        propertyId: property.id,
        invoiceId: invoice.id,
      }),
    ),
    token = new URL(link.url).pathname.split("/").pop(),
    upload = new FormData();
  upload.set(
    "file",
    new Blob(["%PDF-1.7\nSynthetic finance proof\n%%EOF"], {
      type: "application/pdf",
    }),
    "finance-qa-proof.pdf",
  );
  upload.set("amount", "400000");
  upload.set("date", today);
  upload.set("method", "TRANSFER");
  upload.set("reference", "Unsettled finance proof");
  assert.equal(
    (
      await fetch(base + "/api/tenant/" + token + "/proof", {
        method: "POST",
        headers: { Origin: base },
        body: upload,
      })
    ).status,
    200,
  );
  ok(
    await write("contractCreate", {
      stayId: stay.id,
      end: shift(30),
      depositRequired: 100000,
      terms: "Synthetic manual finance contract terms.",
    }),
  );
  ok(
    await write("contractAgree", {
      stayId: stay.id,
      revision: 1,
      reference: "Synthetic paper agreement",
      confirmed: true,
    }),
  );
  ok(
    await write("depositReceive", {
      stayId: stay.id,
      amount: 100000,
      reference: "Synthetic deposit receipt",
      confirmed: true,
    }),
  );
  ok(
    await owner.manage("transition", {
      propertyId: property.id,
      stayId: stay.id,
      status: "CHECKED_OUT",
    }),
  );
  ok(
    await write("depositRefund", {
      stayId: stay.id,
      amount: 20000,
      reference: "Synthetic deposit refund",
      confirmed: true,
    }),
  );
  const deduction = ok(
    await write("deductionPropose", {
      stayId: stay.id,
      amount: 10000,
      reason: "Synthetic inspection cost",
      inspectionNote: "Synthetic room inspection agreed by both parties.",
    }),
  );
  ok(
    await write("deductionReview", {
      stayId: stay.id,
      adjustmentId: deduction.adjustmentId,
      approved: true,
      confirmed: true,
    }),
  );
  const account = await db.depositAccount.findUniqueOrThrow({
      where: { stayId: stay.id },
    }),
    entry = await db.depositEntry.findFirstOrThrow({
      where: { accountId: account.id, kind: "DEDUCTION" },
    });
  ok(
    await write("depositReverse", {
      stayId: stay.id,
      entryId: entry.id,
      reference: "Synthetic deduction correction",
      confirmed: true,
    }),
  );
  await db.depositEntry.createMany({
    data: [
      {
        accountId: account.id,
        kind: "TRANSFER_OUT",
        delta: -50000,
        date: today,
        reference: "Synthetic paired transfer out",
        actorId: u.id,
      },
      {
        accountId: account.id,
        kind: "TRANSFER_IN",
        delta: 50000,
        date: today,
        reference: "Synthetic paired transfer in",
        actorId: u.id,
      },
    ],
  });
  const sw = (action, data) =>
    admin.call("/api/subscriptions", {
      action,
      organizationId: u.organizationId,
      key: randomUUID(),
      ...data,
    });
  ok(
    await sw("billingProfile", {
      legalName: "Finance QA legal",
      address: "Synthetic billing address QA",
      contactName: "Finance QA",
      contactEmail: "finance-billing@example.test",
      reference: "Synthetic approved billing data",
      revision: 0,
      confirmed: true,
    }),
  );
  const si = ok(
    await sw("subscriptionIssue", {
      plan: "plus",
      months: 1,
      periodStart: today,
      due: today,
      confirmed: true,
    }),
  );
  ok(
    await sw("subscriptionReceipt", {
      invoiceId: si.invoiceId,
      amount: 99000,
      date: today,
      reference: "Synthetic SaaS receipt",
      note: "Synthetic SaaS reconciliation",
      confirmed: true,
    }),
  );
  let s = ok(await report()).summary;
  assert.equal(s.rentReceived, 600000);
  assert.equal(s.expenseCashOut, 60000);
  assert.equal(s.surplus, 540000);
    assert.equal(s.chartResolution, "DAILY");
    assert.equal(s.chart.length, Number(today.slice(8)));
    assert.equal(s.chart.reduce((sum, row) => sum + row.income, 0), s.rentReceived);
    assert.equal(s.chart.reduce((sum, row) => sum + row.outflow, 0), s.expenseCashOut);
    const longReport = ok(await owner.call(`/api/finance?propertyId=${property.id}&from=${shift(-90)}&to=${today}`));
    assert.equal(longReport.summary.chartResolution, "MONTHLY");
    assert.equal(longReport.summary.chart.reduce((sum, row) => sum + row.income, 0), longReport.summary.rentReceived);
  assert.equal(s.depositCashMovement, 80000);
  assert.equal(s.depositLiability, 80000);
  assert.equal(s.depositDeductions, 0);
  assert.equal(s.recordedCashMovement, 620000);
  const preserved = hash(
    await db.invoice.findUniqueOrThrow({
      where: { id: invoice.id },
      include: { payments: true, proofs: true },
    }),
  );
  pass(
    "real paid rent only; pending proof, subscription, deposit deductions and transfers excluded from operating cash",
  );

  const race = await Promise.all([
    write("financeExpensePay", {
      ...pay,
      amount: 40000,
      reference: "Expense race one",
    }),
    write("financeExpensePay", {
      ...pay,
      amount: 40000,
      reference: "Expense race two",
    }),
  ]);
  assert.deepEqual(race.map((r) => r.status).sort(), [200, 400]);
  const refund = ok(
    await write("financeExpenseRefund", {
      expenseId: cost.expenseId,
      paymentId: p1.entryId,
      amount: 15000,
      date: today,
      reference: "Expense refund one",
      note: "Synthetic vendor refund confirmed",
      confirmed: true,
    }),
  );
  assert.equal(
    (
      await write("financeExpenseRefund", {
        expenseId: cost.expenseId,
        paymentId: p1.entryId,
        amount: 45001,
        date: today,
        reference: "Over refund one",
        note: "Synthetic excessive refund",
        confirmed: true,
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await write("financeExpenseCorrect", {
        expenseId: cost.expenseId,
        entryId: p1.entryId,
        note: "Cannot reverse with active vendor refund",
        confirmed: true,
      })
    ).status,
    400,
  );
  ok(
    await write("financeExpenseCorrect", {
      expenseId: cost.expenseId,
      entryId: refund.entryId,
      note: "Correct synthetic refund recording error",
      confirmed: true,
    }),
  );
  assert.equal(ok(await detail()).expense.paid, 100000);
  assert.equal(
    (
      await write("financeExpenseVoid", {
        expenseId: cost.expenseId,
        note: "Cannot cancel paid expense",
        confirmed: true,
      })
    ).status,
    400,
  );
  pass(
    "concurrent expense payment cap, source-bounded vendor refunds, corrections and paid-void denial",
  );

  const rentMatch = {
    source: "RENT",
    entryId: rent.id,
    amount: 600000,
    direction: "IN",
    statementDate: today,
    statementReference: "BANK-QA-RENT",
    note: "Synthetic owner-reviewed statement line",
    confirmed: true,
  };
  assert.equal(
    (await write("financeMatch", { ...rentMatch, amount: 1 })).status,
    400,
  );
  assert.equal(
    (await write("financeMatch", { ...rentMatch, direction: "OUT" })).status,
    400,
  );
  const mk = randomUUID(),
    matches = await Promise.all([
      write("financeMatch", rentMatch, mk),
      write("financeMatch", rentMatch, mk),
    ]);
  const rm = ok(matches[0]);
  assert.deepEqual(ok(matches[1]), rm);
  const costMatch = {
    ...rentMatch,
    source: "EXPENSE",
    entryId: p1.entryId,
    amount: 60000,
    direction: "OUT",
  };
  assert.equal((await write("financeMatch", costMatch)).status, 400);
  const cm = ok(
    await write("financeMatch", {
      ...costMatch,
      statementReference: "BANK-QA-EXPENSE",
    }),
  );
  assert.equal(
    (
      await write("financeExpenseCorrect", {
        expenseId: cost.expenseId,
        entryId: p1.entryId,
        note: "Must revoke matching before correction",
        confirmed: true,
      })
    ).status,
    400,
  );
  ok(
    await write("financeUnmatch", {
      matchId: cm.matchId,
      note: "Synthetic statement matching revoked for review",
      confirmed: true,
    }),
  );
  const corrected = ok(
    await write("financeExpenseCorrect", {
      expenseId: cost.expenseId,
      entryId: p1.entryId,
      note: "Correct original synthetic payment entry",
      confirmed: true,
    }),
  );
  assert.equal(ok(await detail()).expense.paid, 40000);
  assert.equal(
    (
      await write("financeMatch", {
        ...costMatch,
        statementReference: "Corrected cannot match",
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await write("financeMatch", {
        ...costMatch,
        entryId: corrected.entryId,
        statementReference: "Reversal is not bank flow",
      })
    ).status,
    400,
  );
  ok(
    await write("financeExpensePay", {
      ...pay,
      amount: 60000,
      reference: "Replacement payment after correction",
    }),
  );
  ok(
    await write("financeUnmatch", {
      matchId: rm.matchId,
      note: "Synthetic rent matching rechecked by owner",
      confirmed: true,
    }),
  );
  const rematch = ok(
    await write("financeMatch", {
      ...rentMatch,
      statementReference: "BANK-QA-RENT-RECHECKED",
    }),
  );
  const matchHistory = ok(await report("&source=RENT&entryId=" + rent.id));
  assert.equal(matchHistory.matchTotal, 2);
  assert.equal(matchHistory.activeMatch.id, rematch.matchId);
  assert.equal(matchHistory.matches.filter((r) => r.revokedAt).length, 1);
  assert.equal(
    (await other.call(path + "&source=RENT&entryId=" + rent.id)).status,
    404,
  );
  assert.equal(ok(await report()).summary.rentReceived, 600000);
  assert.equal(ok(await report()).summary.expenseCashOut, 100000);
  pass(
    "manual statement matching, duplicate line/direction/amount guards, revoke-before-correct and retained rematch history",
  );

  const oldDate = new Date(Date.parse(from + "T00:00:00Z") - 86400000)
    .toISOString()
    .slice(0, 10);
  const old = ok(
    await write("financeExpenseCreate", {
      ...source,
      description: "Historical cost refunded this month",
      amount: 10000,
      incurredOn: shift(-45),
      reference: "OLD-COST-REFUND",
    }),
  );
  const oldPay = ok(
    await write("financeExpensePay", {
      ...pay,
      expenseId: old.expenseId,
      amount: 10000,
      date: oldDate,
      reference: "Old actual payment reference",
    }),
  );
  ok(
    await write("financeExpenseRefund", {
      expenseId: old.expenseId,
      paymentId: oldPay.entryId,
      amount: 10000,
      date: today,
      reference: "Old cost actual refund",
      note: "Synthetic refund after previous month payment",
      confirmed: true,
    }),
  );
  ok(
    await write("financeExpenseVoid", {
      expenseId: old.expenseId,
      note: "Synthetic cancelled supplier charge after refund",
      confirmed: true,
    }),
  );
  assert.equal(
    ok(await report("&expenseId=" + old.expenseId)).expense.balance,
    0,
  );
  assert.equal(ok(await report()).summary.expenseCashOut, 90000);
  const prior = ok(
    await owner.call(
      `/api/finance?propertyId=${property.id}&from=${oldDate}&to=${oldDate}`,
    ),
  );
  assert.equal(prior.summary.expenseCashOut, 10000);
  const span = ok(
    await owner.call(
      `/api/finance?propertyId=${property.id}&from=${oldDate}&to=${today}&view=monthly`,
    ),
  );
  assert.equal(span.rows.length, 2);
  assert.equal(span.rows[0].outflow, 10000);
  assert.equal(span.rows[1].outflow, 90000);
  const secondCost = ok(
    await write(
      "financeExpenseCreate",
      {
        ...source,
        amount: 40000,
        description: "Second property maintenance",
        category: "MAINTENANCE",
        reference: "SECOND-COST",
      },
      randomUUID(),
      second.id,
    ),
  );
  ok(
    await write(
      "financeExpensePay",
      {
        ...pay,
        expenseId: secondCost.expenseId,
        amount: 40000,
        reference: "Second property cost payment",
      },
      randomUUID(),
      second.id,
    ),
  );
  const all = ok(
    await owner.call(`/api/finance?propertyId=all&from=${from}&to=${today}`),
  );
  assert.equal(all.properties.length, 2);
  assert.equal(all.summary.expenseCashOut, 130000);
  assert.equal(all.summary.rentReceived, 600000);
  assert.equal(all.summary.depositLiability, 80000);
  assert.equal(ok(await report()).summary.expenseCashOut, 90000);
  pass(
    "refunded/voided expense cash history survives across months and consolidated property scopes stay isolated",
  );

  await assert.rejects(
    db.$executeRaw`UPDATE "Expense" SET amount=1 WHERE id=${cost.expenseId}`,
  );
  await assert.rejects(
    db.$executeRaw`DELETE FROM "Expense" WHERE id=${cost.expenseId}`,
  );
  await assert.rejects(
    db.$executeRaw`UPDATE "ExpenseEntry" SET delta=1 WHERE id=${p1.entryId}`,
  );
  await assert.rejects(
    db.$executeRaw`DELETE FROM "ExpenseEntry" WHERE id=${p1.entryId}`,
  );
  await assert.rejects(
    db.$executeRaw`UPDATE "FinanceMatch" SET amount=1 WHERE id=${rematch.matchId}`,
  );
  await assert.rejects(
    db.$executeRaw`DELETE FROM "FinanceMatch" WHERE id=${rematch.matchId}`,
  );
  assert.equal(
    hash(
      await db.invoice.findUniqueOrThrow({
        where: { id: invoice.id },
        include: { payments: true, proofs: true },
      }),
    ),
    preserved,
  );
  assert.equal(
    (await (await fetch(base + "/api/tenant/" + token)).json()).invoice.balance,
    400000,
  );
  pass(
    "database source/entry/matching immutability and existing tenant invoice/proof/history preservation",
  );

  ok(
    await write("financeExpenseCreate", {
      ...source,
      description: '=HYPERLINK("https://example.invalid")',
      payee: "@vendorQA",
      reference: "CSV-INJECTION-CHECK",
      amount: 1,
      note: "line one\nline two",
    }),
  );
  const csvResponse = await fetch(base + path + "&format=csv", {
    headers: { Cookie: owner.cookie },
  });
  assert.equal(csvResponse.status, 200);
  assert.ok(csvResponse.headers.get("content-type").includes("text/csv"));
  assert.ok(csvResponse.headers.get("cache-control").includes("no-store"));
  const bytes = Buffer.from(await csvResponse.arrayBuffer());
  assert.deepEqual([...bytes.subarray(0, 3)], [239, 187, 191]);
  const csv = bytes.toString("utf8");
  assert.ok(csv.includes('"\'=HYPERLINK(""https://example.invalid"")"'));
  assert.ok(csv.includes('"\'@vendorQA"'));
  assert.ok(csv.includes('"line one\nline two"'));
  const movementCsv = await (
    await fetch(base + path + "&view=movements&format=csv", {
      headers: { Cookie: owner.cookie },
    })
  ).text();
  assert.ok(movementCsv.includes('"-60000"'));
  assert.ok(movementCsv.includes('"600000"'));
  assert.equal(
    (
      await fetch(base + path + "&view=monthly&format=csv", {
        headers: { Cookie: owner.cookie },
      })
    ).status,
    200,
  );
  pass(
    "private UTF8 accounting exports preserve signed cash, escape spreadsheet formulas and exclude other ledgers",
  );

  const paginated = ok(
    await write("financeExpenseCreate", {
      ...source,
      description: "Expense entry pagination QA",
      amount: 1000,
      reference: "ENTRY-PAGINATION-QA",
    }),
  );
  await db.expenseEntry.createMany({
    data: Array.from({ length: 61 }, (_, i) => ({
      expenseId: paginated.expenseId,
      kind: "PAYMENT",
      delta: 1,
      date: today,
      reference: "Synthetic pagination payment " + i,
      note: "Synthetic pagination source",
      actorId: u.id,
    })),
  });
  assert.equal(
    ok(await report("&expenseId=" + paginated.expenseId + "&entryPage=3"))
      .entries.length,
    1,
  );
  await db.financeMatch.createMany({
    data: Array.from({ length: 31 }, (_, i) => ({
      propertyId: property.id,
      paymentId: rent.id,
      statementReference: "Synthetic revoked match " + i,
      statementDate: today,
      amount: 600000,
      note: "Synthetic historical manual matching",
      actorId: u.id,
      revokedAt: new Date(),
      revokedBy: u.id,
      revokeReason: "Synthetic historical revocation",
    })),
  });
  const mh = ok(
    await report("&entryId=" + rent.id + "&source=RENT&matchPage=2"),
  );
  assert.equal(mh.matchTotal, 33);
  assert.equal(mh.matches.length, 3);
  assert.equal(mh.activeMatch.id, rematch.matchId);
  const movements = ok(await report("&view=movements"));
  assert.equal(movements.rows.length, 50);
  assert.ok(movements.total > 50);
  assert.ok(ok(await report("&view=movements&page=2")).rows.length > 0);
  assert.ok(movements.summary.unmatched >= 61);
  const prefix = "Expense list pagination " + suffix;
  await db.expense.createMany({
    data: Array.from({ length: 5001 }, (_, i) => ({
      propertyId: second.id,
      description: prefix + " " + i,
      category: "OTHER",
      amount: 1,
      incurredOn: today,
      payee: "Synthetic pagination vendor",
      createdBy: u.id,
    })),
  });
  const secondPath = `/api/finance?propertyId=${second.id}&from=${from}&to=${today}&q=${encodeURIComponent(prefix)}`;
  const list = ok(await owner.call(secondPath));
  assert.equal(list.total, 5001);
  assert.equal(list.rows.length, 50);
  assert.equal(ok(await owner.call(secondPath + "&page=101")).rows.length, 1);
  const oversized = await fetch(base + secondPath + "&format=csv", {
    headers: { Cookie: owner.cookie },
  });
  assert.equal(oversized.status, 400);
  assert.ok((await oversized.json()).error.includes("5.000"));
  s = ok(await report()).summary;
  assert.equal(s.rentReceived, 600000);
  assert.equal(s.expenseCashOut, 90061);
  assert.equal(s.depositCashMovement, 80000);
  pass(
    "all-history totals beyond visible pages, bounded entry/match/list pagination and explicit CSV size guard",
  );

  await mkdir("artifacts/phase4d", { recursive: true });
  await mkdir(".local-secrets", { recursive: true });
  await writeFile(
    "artifacts/phase4d/finance-tests.json",
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
    ".local-secrets/phase4d-browser.json",
    JSON.stringify({
      base,
      owner: u.email,
      password,
      propertyId: property.id,
      expenseId: cost.expenseId,
    }),
  );
} finally {
  await db.$disconnect();
}
