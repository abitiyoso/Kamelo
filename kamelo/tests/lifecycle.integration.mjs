import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { writeFile, mkdir } from "node:fs/promises";
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
  password = "Lifecycle-qa-password-123";
const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date()),
  shift = (n) =>
    new Date(Date.parse(today + "T00:00:00Z") + n * 86400000)
      .toISOString()
      .slice(0, 10);
const digest = (v) =>
  createHash("sha256").update(JSON.stringify(v)).digest("hex");
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
      const data = await r.json();
      return { status: r.status, ...data };
    },
    async register(label) {
      const email = `lifecycle-${label}-${suffix}@example.test`;
      ok(
        await this.call("/api/auth", {
          action: "register",
          email,
          password,
          name: "Lifecycle QA " + label,
          phone: "081234567890",
        }),
      );
      await verifiedFixture(db, base, cookie, email);
      return db.user.findUniqueOrThrow({ where: { email } });
    },
    manage(action, body) {
      return this.call("/api/manage", { action, ...body });
    },
    write(action, body, key = randomUUID()) {
      return this.call("/api/lifecycle", { key, action, ...body });
    },
  };
}
function ok(r) {
  assert.equal(r.status, 200, JSON.stringify(r));
  return r.result || r;
}
const owner = client(),
  other = client(),
  tenant = client(),
  staff = client();
let groups = 0;
const pass = (s) => {
  groups++;
  console.log("PASS", s);
};
try {
  const u = await owner.register("owner"),
    v = await other.register("other"),
    t = await tenant.register("tenant");
  const property = ok(
      await owner.manage("property", {
        name: "Lifecycle QA Residence",
        type: "KOS",
        count: 5,
        rate: 1000000,
      }),
    ),
    foreign = ok(
      await other.manage("property", {
        name: "Foreign lifecycle QA",
        type: "KOS",
        count: 2,
        rate: 900000,
      }),
    );
  await db.organization.update({
    where: { id: u.organizationId },
    data: { plan: "starter", subscriptionStatus: "ACTIVE" },
  });
  const state = ok(await owner.call("/api/manage")),
    rooms = state.properties[0].rooms;
  const s = ok(
    await owner.manage("stay", {
      propertyId: property.id,
      roomId: rooms[0].id,
      name: "Ayu Lifecycle",
      phone: "081234567891",
      start: shift(-30),
      rate: 1000000,
      billingDay: 15,
    }),
  );
  const b = ok(
    await owner.manage("stay", {
      propertyId: property.id,
      roomId: rooms[1].id,
      name: "Budi Lifecycle",
      phone: "081234567891",
      start: shift(-20),
      rate: 1000000,
      billingDay: 20,
    }),
  );
  const staffEmail = `lifecycle-staff-${suffix}@example.test`;
  ok(
    await staffFixture(db, base, owner.cookie, {
      email: staffEmail,
      password,
      name: "Lifecycle Staff",
      phone: "081234567892",
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
  const guestId = (await db.stay.findUniqueOrThrow({ where: { id: s.id } }))
    .guestId;
  const detail = () =>
    owner.call(`/api/lifecycle?propertyId=${property.id}&guestId=${guestId}`);
  const command = (action, data = {}, stayId = s.id, key) =>
    owner.write(action, { propertyId: property.id, stayId, ...data }, key);
  assert.equal(
    (await client().call(`/api/lifecycle?propertyId=${property.id}`)).status,
    401,
  );
  assert.equal(
    (await staff.call(`/api/lifecycle?propertyId=${property.id}`)).status,
    403,
  );
  assert.equal(
    (
      await staff.write("contractCreate", {
        propertyId: property.id,
        stayId: s.id,
        end: shift(30),
        depositRequired: 1000000,
        terms: "Synthetic terms",
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await other.call(
        `/api/lifecycle?propertyId=${property.id}&guestId=${guestId}`,
      )
    ).status,
    403,
  );
  assert.equal(
    (await owner.call(`/api/lifecycle?propertyId=${foreign.id}`)).status,
    403,
  );
  assert.equal(
    (
      await other.write("contractCreate", {
        propertyId: foreign.id,
        stayId: s.id,
        end: shift(30),
        depositRequired: 100,
        terms: "Synthetic terms",
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await owner.call(
        "/api/lifecycle",
        {
          action: "profile",
          key: randomUUID(),
          propertyId: property.id,
          guestId,
          name: "Ayu",
          phone: "081234567891",
          email: "",
          emergencyConsent: false,
        },
        "https://attacker.test",
      )
    ).status,
    403,
  );
  pass(
    "owner-only lifecycle / cross-organization denial / staff denial / origin protection",
  );
  ok(
    await command("profile", {
      guestId,
      name: "Ayu Lifecycle",
      phone: "081234567891",
      email: "unverified-contact@example.test",
      emergencyConsent: true,
      emergencyName: "Synthetic emergency",
      emergencyPhone: "081234567899",
    }),
  );
  const profile = await db.residentProfile.findUniqueOrThrow({
    where: { guestId },
  });
  assert.ok(!profile.encryptedEmergencyContact.includes("Synthetic emergency"));
  assert.equal((await detail()).guest.emergency.name, "Synthetic emergency");
  assert.equal(
    await db.user.count({
      where: { email: "unverified-contact@example.test" },
    }),
    0,
  );
  ok(
    await command("profile", {
      guestId,
      name: "Ayu Lifecycle",
      phone: "081234567891",
      email: "",
      emergencyConsent: false,
    }),
  );
  assert.equal(
    (await db.residentProfile.findUniqueOrThrow({ where: { guestId } }))
      .encryptedEmergencyContact,
    null,
  );
  const listing = ok(
    await owner.call(`/api/lifecycle?propertyId=${property.id}`),
  );
  assert.equal(listing.rows.length, 2, "same phone does not merge profiles");
  assert.ok(!JSON.stringify(listing).includes("encryptedEmergency"));
  pass(
    "property-bound resident profile / encrypted consented emergency contact / consent withdrawal / no phone or email identity merge",
  );
  const inv = ok(
    await owner.call("/api/invitations", {
      action: "create",
      email: t.email,
      kind: "TENANT",
      propertyIds: [property.id],
      stayId: s.id,
    }),
  );
  ok(await tenant.call("/api/invitations", { action: "accept", id: inv.id }));
  const ctx = ok(await tenant.call("/api/account")).contexts.find(
    (c) => c.type === "STAY",
  );
  ok(
    await tenant.call("/api/account", {
      action: "switch",
      type: "STAY",
      id: ctx.id,
    }),
  );
  const c = ok(
    await command("contractCreate", {
      end: shift(30),
      depositRequired: 1000000,
      terms: "Synthetic tenancy terms agreed outside the application.",
    }),
  );
  assert.equal(
    (await db.stay.findUniqueOrThrow({ where: { id: s.id } })).end,
    null,
    "proposal alone never changes occupancy",
  );
  const original = await db.contractVersion.findFirstOrThrow({
      where: { contractId: c.contractId, revision: 1 },
    }),
    originalHash = digest(original);
  assert.equal(
    (
      await command("depositReceive", {
        amount: 1000000,
        reference: "Synthetic bank reference",
        confirmed: true,
      })
    ).status,
    400,
  );
  assert.equal(
    (await tenant.call("/api/lifecycle?resident=1")).stay.contract.versions
      .length,
    0,
  );
  assert.equal(
    (
      await command("contractAgree", {
        revision: 1,
        reference: "Synthetic signed paper",
        confirmed: false,
      })
    ).status,
    400,
  );
  const agreeKey = randomUUID(),
    agreeBody = {
      revision: 1,
      reference: "Synthetic signed paper",
      confirmed: true,
    };
  ok(await command("contractAgree", agreeBody, s.id, agreeKey));
  ok(await command("contractAgree", agreeBody, s.id, agreeKey));
  assert.equal(
    await db.contractVersion.count({ where: { contractId: c.contractId } }),
    2,
  );
  assert.equal(
    (
      await command(
        "contractAgree",
        { ...agreeBody, reference: "Different request" },
        s.id,
        agreeKey,
      )
    ).status,
    400,
  );
  assert.equal(
    digest(
      await db.contractVersion.findUniqueOrThrow({
        where: { id: original.id },
      }),
    ),
    originalHash,
  );
  assert.equal(
    (await tenant.call("/api/lifecycle?resident=1")).stay.contract.versions
      .length,
    1,
  );
  assert.equal(
    (
      await owner.manage("tenantSettings", {
        propertyId: property.id,
        stayId: s.id,
        name: "Ayu Lifecycle",
        phone: "081234567891",
        rate: 2000000,
        billingDay: 15,
      })
    ).status,
    400,
  );
  pass(
    "contract proposal / explicit manual agreement / immutable versions / tenant hides unagreed drafts / retry idempotency / signed rate protection",
  );
  const future = ok(
    await owner.manage("stay", {
      propertyId: property.id,
      roomId: rooms[0].id,
      name: "Future reservation",
      phone: "081234567895",
      start: shift(32),
      end: shift(50),
      rate: 1000000,
      billingDay: 15,
    }),
  );
  ok(await command("contractRenew", { revision: 2, end: shift(60) }));
  assert.equal(
    (
      await command("contractAgree", {
        revision: 3,
        reference: "Synthetic renewal",
        confirmed: true,
      })
    ).status,
    400,
  );
  assert.equal(
    (await db.stay.findUniqueOrThrow({ where: { id: s.id } })).end,
    shift(30),
  );
  ok(
    await command("contractRevise", {
      revision: 3,
      end: shift(31),
      terms: "Corrected synthetic renewal terms.",
    }),
  );
  assert.equal(
    (
      await command("contractAgree", {
        revision: 3,
        reference: "Stale revision",
        confirmed: true,
      })
    ).status,
    400,
  );
  ok(
    await command("contractAgree", {
      revision: 4,
      reference: "Corrected paper renewal",
      confirmed: true,
    }),
  );
  assert.equal(
    (await db.stay.findUniqueOrThrow({ where: { id: s.id } })).end,
    shift(31),
  );
  assert.equal(
    await db.contractVersion.count({ where: { contractId: c.contractId } }),
    5,
  );
  pass(
    "renewal preserves prior dates until agreement / conflicting reservation denial / revised proposals / stale version protection",
  );
  const invoice = ok(
    await owner.manage("invoice", {
      propertyId: property.id,
      stayId: s.id,
      due: today,
      items: [{ label: "Synthetic rent", amount: 1000000 }],
    }),
  );
  const financialSnapshot = digest(
      await db.invoice.findUniqueOrThrow({
        where: { id: invoice.id },
        include: { payments: true },
      }),
    ),
    incomeBefore = (await owner.call("/api/manage")).properties[0].summary
      .income;
  const receiptKey = randomUUID();
  const receives = await Promise.all(
    [1, 2].map(() =>
      command(
        "depositReceive",
        { amount: 1000000, reference: "Synthetic receipt 1", confirmed: true },
        s.id,
        receiptKey,
      ),
    ),
  );
  receives.forEach(ok);
  assert.equal(
    await db.depositEntry.count({
      where: { account: { stayId: s.id }, kind: "RECEIPT" },
    }),
    1,
  );
  assert.equal(
    (await owner.call("/api/manage")).properties[0].summary.income,
    incomeBefore,
  );
  assert.equal(await db.payment.count({ where: { invoiceId: invoice.id } }), 0);
  assert.equal(
    (
      await command("depositReceive", {
        amount: 0.5,
        reference: "Invalid fractional amount",
        confirmed: true,
      })
    ).status,
    400,
  );
  const recurring = ok(
    await owner.manage("recurring", {
      propertyId: property.id,
      stayId: s.id,
      period: today.slice(0, 7),
      due: today,
      items: [{ label: "Recurring rent", amount: 1000000 }],
    }),
  );
  const oldLink = ok(
      await owner.manage("stayLink", { propertyId: property.id, stayId: s.id }),
    ),
    oldToken = new URL(oldLink.url).pathname.split("/").pop();
  const guestCount = await db.guest.count(),
    stayCount = await db.stay.count();
  assert.equal(
    (await command("transfer", { roomId: rooms[1].id, confirmed: true }))
      .status,
    400,
  );
  const transfers = await Promise.all(
    [rooms[2].id, rooms[3].id].map((roomId) =>
      command("transfer", { roomId, confirmed: true }),
    ),
  );
  assert.equal(
    transfers.filter((r) => r.status === 200).length,
    1,
    JSON.stringify(transfers),
  );
  assert.equal(transfers.filter((r) => r.status === 400).length, 1);
  const next = transfers.find((r) => r.status === 200).result.stayId;
  const inherited = ok(
    await owner.manage("recurring", {
      propertyId: property.id,
      stayId: next,
      period: today.slice(0, 7),
      due: today,
      items: [{ label: "Retry after transfer", amount: 1000000 }],
    }),
  );
  assert.equal(inherited.id, recurring.id);
  assert.equal(
    await db.invoice.count({ where: { guestId, period: today.slice(0, 7) } }),
    1,
    "transfer cannot double-charge an already-issued rental period",
  );
  assert.equal(await db.guest.count(), guestCount);
  assert.equal(await db.stay.count(), stayCount + 1);
  assert.equal(await db.roomTransfer.count({ where: { fromStayId: s.id } }), 1);
  assert.equal(
    digest(
      await db.invoice.findUniqueOrThrow({
        where: { id: invoice.id },
        include: { payments: true },
      }),
    ),
    financialSnapshot,
  );
  const oldAccount = await db.depositAccount.findUniqueOrThrow({
      where: { stayId: s.id },
    }),
    newAccount = await db.depositAccount.findUniqueOrThrow({
      where: { stayId: next },
    });
  assert.equal(
    (
      await db.depositEntry.aggregate({
        where: { accountId: oldAccount.id },
        _sum: { delta: true },
      })
    )._sum.delta,
    0,
  );
  assert.equal(
    (
      await db.depositEntry.aggregate({
        where: { accountId: newAccount.id },
        _sum: { delta: true },
      })
    )._sum.delta,
    1000000,
  );
  assert.equal(await db.payment.count({ where: { invoiceId: invoice.id } }), 0);
  assert.equal((await fetch(base + "/api/stay/" + oldToken)).status, 404);
  assert.equal((await tenant.call("/api/stay/account")).status, 404);
  assert.equal(
    (await tenant.call("/api/tenant/account:" + invoice.id)).status,
    200,
  );
  const newCtx = (await tenant.call("/api/account")).contexts.find(
    (c) => c.type === "STAY" && c.id !== ctx.id,
  );
  assert.ok(newCtx);
  ok(
    await tenant.call("/api/account", {
      action: "switch",
      type: "STAY",
      id: newCtx.id,
    }),
  );
  assert.equal((await tenant.call("/api/stay/account")).status, 200);
  assert.equal(
    (await tenant.call("/api/tenant/account:" + invoice.id)).status,
    403,
  );
  assert.equal(
    (await tenant.call("/api/lifecycle?resident=1")).stay.depositAccount.summary
      .balance,
    1000000,
  );
  assert.equal(
    (await db.contract.findUniqueOrThrow({ where: { stayId: s.id } })).status,
    "SUPERSEDED",
  );
  assert.equal(
    (await db.contract.findUniqueOrThrow({ where: { stayId: next } })).status,
    "DRAFT",
  );
  pass(
    "deposit is liability, not rent / concurrent receipt exactly once / transfer race and collision checks / paired liability transfer / old invoices unchanged / old room services revoked / explicit new stay context",
  );
  ok(
    await owner.manage("invoice", {
      propertyId: property.id,
      stayId: next,
      due: today,
      items: [{ label: "Still unpaid", amount: 500000 }],
    }),
  );
  ok(
    await owner.manage("transition", {
      propertyId: property.id,
      stayId: next,
      status: "CHECKED_OUT",
    }),
  );
  assert.equal(
    (await db.contract.findUniqueOrThrow({ where: { stayId: next } })).status,
    "CLOSED",
  );
  assert.equal(
    await db.ticket.count({ where: { stayId: next, category: "CLEANING" } }),
    1,
  );
  assert.equal((await tenant.call("/api/stay/account")).status, 404);
  assert.equal((await tenant.call("/api/lifecycle?resident=1")).status, 200);
  assert.equal(
    (
      await command(
        "depositRefund",
        { amount: 1000001, reference: "Over-refund rejected", confirmed: true },
        next,
      )
    ).status,
    400,
  );
  const rejected = ok(
    await command(
      "deductionPropose",
      {
        amount: 100000,
        reason: "Synthetic repair",
        inspectionNote: "Room inspection synthetic reference",
      },
      next,
    ),
  );
  ok(
    await command(
      "deductionReview",
      { adjustmentId: rejected.adjustmentId, approved: false },
      next,
    ),
  );
  assert.equal(
    (
      await db.depositEntry.aggregate({
        where: { accountId: newAccount.id },
        _sum: { delta: true },
      })
    )._sum.delta,
    1000000,
  );
  const proposal = ok(
    await command(
      "deductionPropose",
      {
        amount: 300000,
        reason: "Agreed synthetic repair",
        inspectionNote: "Inspection reference QA 001",
      },
      next,
    ),
  );
  assert.equal(
    (
      await command(
        "depositRefund",
        {
          amount: 800000,
          reference: "Pending reserve protected",
          confirmed: true,
        },
        next,
      )
    ).status,
    400,
  );
  ok(
    await command(
      "depositRefund",
      {
        amount: 700000,
        reference: "Synthetic refund transfer",
        confirmed: true,
      },
      next,
    ),
  );
  assert.equal(
    (
      await command(
        "deductionReview",
        {
          adjustmentId: proposal.adjustmentId,
          approved: true,
          confirmed: false,
        },
        next,
      )
    ).status,
    400,
  );
  const reviewKey = randomUUID();
  ok(
    await command(
      "deductionReview",
      { adjustmentId: proposal.adjustmentId, approved: true, confirmed: true },
      next,
      reviewKey,
    ),
  );
  ok(
    await command(
      "deductionReview",
      { adjustmentId: proposal.adjustmentId, approved: true, confirmed: true },
      next,
      reviewKey,
    ),
  );
  assert.equal(
    (
      await db.depositEntry.aggregate({
        where: { accountId: newAccount.id },
        _sum: { delta: true },
      })
    )._sum.delta,
    0,
  );
  pass(
    "unpaid checkout allowed / cleaning task and closed contract / deposit retained / pending deduction reserves balance / reject or confirm / partial refund and deduction exactly once",
  );
  const deduction = await db.depositEntry.findFirstOrThrow({
      where: { accountId: newAccount.id, kind: "DEDUCTION" },
    }),
    reverseKey = randomUUID();
  ok(
    await command(
      "depositReverse",
      {
        entryId: deduction.id,
        reference: "Synthetic correction after inspection",
        confirmed: true,
      },
      next,
      reverseKey,
    ),
  );
  ok(
    await command(
      "depositReverse",
      {
        entryId: deduction.id,
        reference: "Synthetic correction after inspection",
        confirmed: true,
      },
      next,
      reverseKey,
    ),
  );
  assert.equal(
    (
      await command(
        "depositReverse",
        {
          entryId: deduction.id,
          reference: "Duplicate reversal blocked",
          confirmed: true,
        },
        next,
      )
    ).status,
    400,
  );
  const refunds = await Promise.all(
    [1, 2].map((n) =>
      command(
        "depositRefund",
        {
          amount: 200000,
          reference: "Concurrent refund " + n,
          confirmed: true,
        },
        next,
      ),
    ),
  );
  assert.equal(refunds.filter((r) => r.status === 200).length, 1);
  assert.equal(refunds.filter((r) => r.status === 400).length, 1);
  ok(
    await command(
      "depositRefund",
      {
        amount: 100000,
        reference: "Remaining synthetic refund",
        confirmed: true,
      },
      next,
    ),
  );
  assert.equal(
    (await tenant.call("/api/lifecycle?resident=1")).stay.depositAccount.summary
      .balance,
    0,
  );
  assert.equal(
    (await owner.call("/api/manage")).properties[0].summary.income,
    incomeBefore,
  );
  await assert.rejects(
    db.depositEntry.update({
      where: { id: deduction.id },
      data: { delta: -1 },
    }),
    /append-only/,
  );
  await assert.rejects(
    db.contractVersion.update({
      where: { id: original.id },
      data: { terms: "overwrite" },
    }),
    /append-only/,
  );
  pass(
    "append-only settlement corrections / one reversal only / concurrent over-refund protection / database immutability / no deposit-driven rental income",
  );
  const nextStay = await db.stay.findUniqueOrThrow({ where: { id: next } });
  await owner.manage("roomReadiness", {
    propertyId: property.id,
    roomId: nextStay.roomId,
    operational: "READY",
  });
  const returnKey = randomUUID(),
    returnBody = {
      guestId,
      roomId: nextStay.roomId,
      start: shift(1),
      end: shift(20),
      rate: 1000000,
      billingDay: 23,
    };
  const returned = ok(await command("returnStay", returnBody, next, returnKey));
  ok(await command("returnStay", returnBody, next, returnKey));
  assert.equal(
    (await db.stay.findUniqueOrThrow({ where: { id: returned.stayId } }))
      .guestId,
    guestId,
  );
  assert.equal(
    await db.occupantAccess.count({ where: { stayId: returned.stayId } }),
    0,
  );
  assert.equal(await db.guest.count(), guestCount);
  const full = ok(await detail());
  assert.equal(full.stays.length, 3);
  assert.equal(full.totals.balance, 2500000);
  assert.equal(
    full.stays.find((s) => s.id === next).depositAccount.summary.balance,
    0,
  );
  await db.guest.createMany({
    data: Array.from({ length: 51 }, (_, n) => ({
      propertyId: property.id,
      name: `Pagination QA ${n}`,
      phone: "081234567890",
    })),
  });
  const first = ok(
      await owner.call(`/api/lifecycle?propertyId=${property.id}`),
    ),
    second = ok(
      await owner.call(`/api/lifecycle?propertyId=${property.id}&page=1`),
    );
  assert.equal(first.rows.length, 50);
  assert.ok(second.rows.length > 0);
  assert.ok(!second.rows.some((b) => first.rows.some((a) => a.id === b.id)));
  const contracts = ok(
    await owner.call(`/api/lifecycle?propertyId=${property.id}&view=contracts`),
  );
  assert.equal(contracts.summary.held, 0);
  pass(
    "returning stay reuses the explicit profile without automatic account claim / full financial history / directory pagination / liability summary",
  );
  // Dedicated active preview record, so the reviewed UI has a real pending agreement and held deposit.
  const previewContract = ok(
    await command(
      "contractCreate",
      {
        end: shift(90),
        depositRequired: 500000,
        terms:
          "Pembayaran mengikuti tanggal jatuh tempo. Deposit adalah dana titipan dan diselesaikan berdasarkan pemeriksaan kamar.",
      },
      b.id,
    ),
  );
  ok(
    await command(
      "contractAgree",
      {
        revision: 1,
        reference: "Synthetic preview paper agreement",
        confirmed: true,
      },
      b.id,
    ),
  );
  ok(
    await command(
      "depositReceive",
      {
        amount: 500000,
        reference: "Synthetic preview receipt",
        confirmed: true,
      },
      b.id,
    ),
  );
  await mkdir(".local-secrets", { recursive: true });
  await writeFile(
    ".local-secrets/phase4-browser.json",
    JSON.stringify({
      base,
      owner: u.email,
      tenant: t.email,
      password,
      propertyId: property.id,
      guestId: (await db.stay.findUniqueOrThrow({ where: { id: b.id } }))
        .guestId,
      contractId: previewContract.contractId,
    }),
  );
  await writeFile(
    "artifacts/phase4/lifecycle-tests.json",
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
} finally {
  await db.$disconnect();
}
