import assert from "node:assert/strict";
import { randomBytes, createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { PrismaClient } from "../generated/prisma/index.js";
import { challengeToken, verifiedFixture } from "./helpers/identity.mjs";
// Hard guard: this test writes ONLY to the disposable local QA database.
const dbUrl = new URL(process.env.DATABASE_URL || "http://invalid"),
  base = process.env.TEST_URL || "http://127.0.0.1:3001";
assert.equal(dbUrl.hostname, "127.0.0.1");
assert.equal(dbUrl.port, "55432");
assert.equal(dbUrl.pathname, "/kamelo_phase2_qa");
assert.equal(base, "http://127.0.0.1:3001");
const db = new PrismaClient(),
  suffix = Date.now(),
  password = "Identity-qa-password-123",
  today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
const hash = (v) => createHash("sha256").update(v).digest("hex");
function client() {
  let cookie = "";
  return {
    get cookie() {
      return cookie;
    },
    async call(path, body, extra = {}) {
      const r = await fetch(base + path, {
        method: body ? "POST" : "GET",
        headers: {
          Origin: base,
          Cookie: cookie,
          "Content-Type": "application/json",
          ...extra,
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      const c = r.headers.get("set-cookie");
      if (c) cookie = c.split(";")[0];
      return { status: r.status, ...(await r.json()) };
    },
    auth(action, body = {}) {
      return this.call("/api/auth", { action, ...body });
    },
    account(action, body = {}) {
      return this.call("/api/account", { action, ...body });
    },
    manage(action, body = {}) {
      return this.call("/api/manage", { action, ...body });
    },
    invite(action, body = {}) {
      return this.call("/api/invitations", { action, ...body });
    },
  };
}
function good(r) {
  assert.equal(r.status, 200, JSON.stringify(r));
  return r;
}
async function signup(c, label, invitationToken) {
  const email = `identity-${label}-${suffix}@example.test`;
  good(
    await c.auth("register", {
      name: "Identity QA " + label,
      email,
      password,
      phone: "081234567890",
      ...(invitationToken ? { invitationToken } : {}),
    }),
  );
  return db.user.findUniqueOrThrow({ where: { email } });
}
async function verify(c, u) {
  await verifiedFixture(db, base, c.cookie, u.email);
}
async function inviteToken(id) {
  const row = await db.emailOutbox.findFirstOrThrow({
    where: { dedupeKey: { startsWith: `invite:${id}:` } },
    orderBy: { createdAt: "desc" },
  });
  assert.equal(row.status, "SINKED");
  const mail = JSON.parse(
    await readFile(`.local-secrets/mail-sink/${row.id}.json`, "utf8"),
  );
  return /token=([a-f0-9]{64})/.exec(mail.text)[1];
}
const owner = client(),
  other = client(),
  tenant = client(),
  staff = client();
try {
  const u = await signup(owner, "owner"),
    v = await signup(other, "other");
  assert.equal(u.accountStatus, "PENDING");
  assert.equal(u.emailVerifiedAt, null);
  assert.equal((await owner.call("/api/manage")).status, 401);
  assert.equal(
    (
      await owner.manage("property", {
        name: "Blocked",
        type: "KOS",
        count: 1,
        rate: 1,
      })
    ).status,
    401,
  );
  const token = await challengeToken(db, u.id);
  const challenge = await db.identityChallenge.findUniqueOrThrow({
    where: { id: token.split(".")[0] },
  });
  assert.equal(challenge.tokenHash, hash(token.split(".")[1]));
  assert.ok(!JSON.stringify(challenge).includes(token));
  assert.equal((await other.account("verify", { token })).status, 400); // forwarded link cannot verify another signed-in identity
  const count = await db.identityChallenge.count({ where: { userId: u.id } });
  good(await owner.account("resend"));
  assert.equal(
    await db.identityChallenge.count({ where: { userId: u.id } }),
    count,
  );
  good(await owner.account("verify", { token }));
  assert.equal((await owner.account("verify", { token })).status, 400);
  await verify(other, v);
  const orgCount = await db.organization.count(),
    userCount = await db.user.count();
  const dupe = good(
    await client().auth("register", {
      email: u.email,
      password: "different-password-123",
      name: "Ignored",
      phone: "081234567890",
    }),
  );
  assert.equal(dupe.redirect, "/verify-email");
  assert.equal(await db.organization.count(), orgCount);
  assert.equal(await db.user.count(), userCount);
  assert.equal(
    (
      await client().auth("login", {
        email: u.email,
        password: "different-password-123",
      })
    ).status,
    401,
  );
  console.log(
    "PASS pending access gate / hashed single-use link / forwarded link / cooldown / anti-enumeration without duplicate identity",
  );
  const locked = client(),
    l = await signup(locked, "locked"),
    lt = await challengeToken(db, l.id),
    bad = lt.split(".")[0] + "." + "0".repeat(64);
  for (let n = 0; n < 5; n++)
    assert.equal((await locked.account("verify", { token: bad })).status, 400);
  assert.equal((await locked.account("verify", { token: lt })).status, 400);
  assert.equal(
    (
      await db.identityChallenge.findUniqueOrThrow({
        where: { id: lt.split(".")[0] },
      })
    ).attempts,
    5,
  );
  const expired = client(),
    e = await signup(expired, "expired"),
    et = await challengeToken(db, e.id);
  await db.identityChallenge.update({
    where: { id: et.split(".")[0] },
    data: { expiresAt: new Date(Date.now() - 1000) },
  });
  assert.equal((await expired.account("verify", { token: et })).status, 400);
  console.log("PASS challenge expiry and persisted five-attempt lockout");
  const property = good(
    await owner.manage("property", {
      name: "Identity QA Kos",
      type: "KOS",
      count: 3,
      rate: 1000000,
    }),
  ).result;
  const propB = good(
    await other.manage("property", {
      name: "Other Identity QA",
      type: "KOS",
      count: 1,
      rate: 1000000,
    }),
  ).result;
  const state = good(await owner.call("/api/manage")),
    rooms = state.properties[0].rooms;
  assert.equal(
    (
      await owner.invite("create", {
        email: `identity-cross-${suffix}@example.test`,
        kind: "STAFF",
        propertyIds: [propB.id],
      })
    ).status,
    400,
  );
  await db.organization.update({
    where: { id: u.organizationId },
    data: { plan: "starter", subscriptionStatus: "ACTIVE" },
  });
  const staffEmail = `identity-staff-${suffix}@example.test`,
    inv = good(
      await owner.invite("create", {
        email: staffEmail,
        kind: "STAFF",
        propertyIds: [property.id],
      }),
    ).result,
    st = await inviteToken(inv.id);
  assert.equal(
    (
      await owner.invite("create", {
        email: `identity-capacity-${suffix}@example.test`,
        kind: "STAFF",
        propertyIds: [property.id],
      })
    ).status,
    400,
    "pending invitation reserves seat",
  );
  assert.equal((await other.invite("accept", { token: st })).status, 400);
  const su = await signup(staff, "staff", st);
  assert.equal(su.role, "IDENTITY");
  assert.equal(await db.orgMembership.count({ where: { userId: su.id } }), 0);
  assert.equal((await staff.invite("accept", { token: st })).status, 400);
  await verify(staff, su);
  const joined = await Promise.all([
    staff.invite("accept", { token: st }),
    staff.invite("accept", { token: st }),
  ]);
  joined.forEach(good);
  assert.equal(
    await db.orgMembership.count({
      where: { userId: su.id, organizationId: u.organizationId },
    }),
    1,
  );
  const staffContext = good(await staff.call("/api/account")).contexts.find(
    (c) => c.type === "ORG",
  );
  good(await staff.account("switch", { type: "ORG", id: staffContext.id }));
  assert.equal(good(await staff.call("/api/manage")).user.role, "STAFF");
  assert.equal(
    (
      await staff.invite("create", {
        email: "denied@example.test",
        kind: "STAFF",
        propertyIds: [property.id],
      })
    ).status,
    403,
  );
  assert.ok(
    !good(
      await staff.call("/api/manage?propertyId=" + propB.id),
    ).properties.some((p) => p.id === propB.id),
  );
  good(await owner.invite("revokeMember", { userId: su.id }));
  assert.equal((await staff.call("/api/manage")).status, 401);
  await staff.auth("login", { email: su.email, password });
  assert.equal(good(await staff.call("/api/account")).contexts.length, 0);
  console.log(
    "PASS scoped verified staff invitation / reserved plan seat / recipient check / concurrent idempotent acceptance / revocation",
  );
  // Existing owner identity may also be staff in another business without duplicating User.
  const cross = good(
    await owner.invite("create", {
      email: v.email,
      kind: "STAFF",
      propertyIds: [property.id],
    }),
  ).result;
  const oldInviteToken = await inviteToken(cross.id);
  assert.equal(
    (await client().invite("preview", { id: cross.id })).status,
    400,
  );
  await db.invitation.update({
    where: { id: cross.id },
    data: {
      expiresAt: new Date(Date.now() - 1000),
      createdAt: new Date(Date.now() - 61000),
    },
  });
  assert.equal(
    (await other.invite("accept", { token: oldInviteToken })).status,
    400,
  );
  good(await owner.invite("resend", { id: cross.id }));
  assert.equal(
    (await other.invite("accept", { token: oldInviteToken })).status,
    400,
  );
  const newInviteToken = await inviteToken(cross.id);
  const issuerVerified = (
    await db.user.findUniqueOrThrow({ where: { id: u.id } })
  ).emailVerifiedAt;
  await db.user.update({
    where: { id: u.id },
    data: { emailVerifiedAt: null },
  });
  assert.equal(
    (await other.invite("accept", { token: newInviteToken })).status,
    400,
  );
  await db.user.update({
    where: { id: u.id },
    data: { emailVerifiedAt: issuerVerified },
  });
  good(await other.invite("accept", { token: newInviteToken }));
  const contexts = good(await other.call("/api/account")).contexts;
  assert.equal(contexts.length, 2);
  assert.equal(await db.user.count({ where: { email: v.email } }), 1);
  const ownContext = contexts.find(
    (c) => c.id !== contexts.find((c) => c.active)?.id,
  );
  assert.ok(ownContext);
  const foreignMembership = good(await owner.call("/api/account")).contexts[0];
  assert.equal(
    (await other.account("switch", { type: "ORG", id: foreignMembership.id }))
      .status,
    400,
  );
  good(await owner.invite("revoke", { id: cross.id }));
  await other.auth("login", { email: v.email, password });
  assert.equal(
    (await other.invite("accept", { token: newInviteToken })).status,
    400,
  );
  console.log(
    "PASS invitation expiry / resend invalidates old link / issuer authority recheck / one identity with multiple organizations / foreign switch denied / revoked invite denied",
  );
  const stay = good(
    await owner.manage("stay", {
      propertyId: property.id,
      roomId: rooms[0].id,
      name: "Identity Resident",
      phone: "081234567891",
      start: today,
      rate: 1000000,
      billingDay: 1,
    }),
  ).result;
  const stayB = good(
    await owner.manage("stay", {
      propertyId: property.id,
      roomId: rooms[1].id,
      name: "Other Resident",
      phone: "081234567892",
      start: today,
      rate: 1000000,
      billingDay: 20,
    }),
  ).result;
  const guestCount = await db.guest.count(),
    stayCount = await db.stay.count();
  const declined = good(
    await owner.invite("create", {
      email: v.email,
      kind: "TENANT",
      propertyIds: [property.id],
      stayId: stayB.id,
    }),
  ).result;
  good(await other.invite("decline", { id: declined.id }));
  assert.equal((await other.invite("accept", { id: declined.id })).status, 400);
  assert.equal(
    await db.occupantAccess.count({
      where: { userId: v.id, stayId: stayB.id },
    }),
    0,
  );
  const ti = good(
      await owner.invite("create", {
        email: `identity-tenant-${suffix}@example.test`,
        kind: "TENANT",
        propertyIds: [property.id],
        stayId: stay.id,
        canControlDevices: false,
        includeAccess: false,
      }),
    ).result,
    tt = await inviteToken(ti.id),
    tu = await signup(tenant, "tenant", tt);
  await verify(tenant, tu);
  good(await tenant.invite("accept", { token: tt }));
  assert.equal(await db.guest.count(), guestCount);
  assert.equal(await db.stay.count(), stayCount);
  assert.equal(await db.orgMembership.count({ where: { userId: tu.id } }), 0);
  const tc = good(await tenant.call("/api/account")).contexts[0];
  good(await tenant.account("switch", { type: "STAY", id: tc.id }));
  assert.equal((await tenant.call("/api/manage")).status, 401);
  assert.equal(
    (await tenant.account("switch", { type: "ORG", id: foreignMembership.id }))
      .status,
    400,
  );
  const ownInvoice = good(
    await owner.manage("invoice", {
      propertyId: property.id,
      stayId: stay.id,
      items: [{ label: "Rent", amount: 1000000 }],
      date: today,
      due: today,
      status: "ISSUED",
    }),
  ).result;
  const draft = good(
    await owner.manage("invoice", {
      propertyId: property.id,
      stayId: stay.id,
      due: today,
      draft: true,
      items: [{ label: "Private draft", amount: 1000 }],
    }),
  ).result;
  assert.equal(
    (await tenant.call("/api/tenant/account:" + draft.id)).status,
    403,
  );
  const otherInvoice = good(
    await owner.manage("invoice", {
      propertyId: property.id,
      stayId: stayB.id,
      items: [{ label: "Other rent", amount: 1000000 }],
      date: today,
      due: today,
      status: "ISSUED",
    }),
  ).result;
  assert.equal(
    (await tenant.call("/api/tenant/account:" + ownInvoice.id)).status,
    200,
  );
  assert.equal(
    (await tenant.call("/api/tenant/account:" + otherInvoice.id)).status,
    403,
  );
  assert.equal(
    (await client().call("/api/tenant/account:" + ownInvoice.id)).status,
    403,
  );
  const proofForm = new FormData();
  proofForm.set(
    "file",
    new Blob(["%PDF-1.7\nSynthetic identity proof\n%%EOF"], {
      type: "application/pdf",
    }),
    "identity-proof.pdf",
  );
  proofForm.set("amount", "100000");
  proofForm.set("date", today);
  proofForm.set("method", "TRANSFER");
  const proofResponse = await fetch(
    base + "/api/tenant/account:" + ownInvoice.id + "/proof",
    {
      method: "POST",
      headers: { Origin: base, Cookie: tenant.cookie },
      body: proofForm,
    },
  );
  assert.equal(proofResponse.status, 200, await proofResponse.clone().text());
  const proof = (await proofResponse.json()).result;
  assert.equal(
    (
      await fetch(
        base + "/api/proofs/" + proof.id + "?token=account:" + ownInvoice.id,
        { headers: { Cookie: tenant.cookie } },
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await fetch(
        base + "/api/proofs/" + proof.id + "?token=account:" + otherInvoice.id,
        { headers: { Cookie: tenant.cookie } },
      )
    ).status,
    403,
  );
  assert.equal(
    await db.payment.count({ where: { invoiceId: ownInvoice.id } }),
    0,
    "upload never confirms funds",
  );
  const resident = good(await tenant.call("/api/resident"));
  assert.ok(resident.invoices.some((i) => i.id === ownInvoice.id));
  assert.ok(!resident.invoices.some((i) => i.id === otherInvoice.id));
  const guide = good(await tenant.call("/api/stay/account"));
  assert.equal(guide.devices.length, 0);
  assert.equal(guide.access, null);
  assert.equal(
    (
      await tenant.call("/api/stay/account", {
        action: "device",
        deviceId: "not-granted",
        code: "switch",
        value: true,
      })
    ).status,
    400,
  );
  // Arrears do not block services or physical access; checkout does.
  good(
    await tenant.call("/api/stay/account", {
      action: "ticket",
      title: "Synthetic issue",
      description: "Synthetic resident report",
      category: "MAINTENANCE",
      priority: "NORMAL",
    }),
  );
  await db.stay.update({
    where: { id: stay.id },
    data: { status: "CHECKED_OUT" },
  });
  assert.equal((await tenant.call("/api/stay/account")).status, 404);
  assert.equal(
    (await tenant.call("/api/tenant/account:" + ownInvoice.id)).status,
    200,
  );
  assert.equal(good(await tenant.call("/api/resident")).active, false);
  await db.stay.update({ where: { id: stay.id }, data: { status: "ACTIVE" } });
  await mkdir(".local-secrets", { recursive: true });
  await writeFile(
    ".local-secrets/phase3-browser.json",
    JSON.stringify({
      base,
      owner: u.email,
      tenant: tu.email,
      password,
      invitationId: ti.id,
      invoiceId: ownInvoice.id,
      token: tt,
    }),
  );
  console.log(
    "PASS tenant claims existing stay without duplicate guest / own invoices only / no organization access / explicit device consent / checkout service gate with financial history preserved",
  );
  const second = client();
  good(await second.auth("login", { email: u.email, password }));
  const self = good(await owner.call("/api/account")),
    otherSessions = good(await other.call("/api/account"));
  assert.ok(self.sessions.length >= 2);
  assert.equal(
    (await owner.account("revokeSession", { id: otherSessions.sessions[0].id }))
      .status,
    400,
  );
  good(await owner.account("revokeOthers"));
  assert.equal((await second.call("/api/account")).status, 401);
  assert.equal(
    (
      await owner.account("changeEmail", {
        email: `identity-new-${suffix}@example.test`,
        password: "wrong-password-123",
      })
    ).status,
    400,
  );
  good(
    await owner.account("changeEmail", {
      email: `identity-new-${suffix}@example.test`,
      password,
    }),
  );
  assert.equal(
    (await db.user.findUniqueOrThrow({ where: { id: u.id } })).email,
    u.email,
  );
  const emailToken = await challengeToken(db, u.id, "EMAIL_CHANGE");
  good(await owner.account("verify", { token: emailToken }));
  assert.equal((await owner.call("/api/account")).status, 401);
  const newEmail = `identity-new-${suffix}@example.test`;
  good(await owner.auth("login", { email: newEmail, password }));
  assert.equal(
    (await owner.account("verify", { token: emailToken })).status,
    400,
  );
  console.log(
    "PASS self-only session revocation / verified email change retains old address until completion / revokes every old session",
  );
  const known = await owner.auth("forgot", { email: newEmail }),
    unknown = await client().auth("forgot", {
      email: `unknown-${suffix}@example.test`,
    });
  assert.deepEqual(known, unknown);
  const reset = await challengeToken(db, u.id, "RESET");
  good(
    await client().auth("reset", {
      token: reset,
      password: "Reset-qa-password-123",
    }),
  );
  assert.equal((await owner.call("/api/account")).status, 401);
  assert.equal(
    (await client().auth("reset", { token: reset, password })).status,
    400,
  );
  good(
    await owner.auth("login", {
      email: newEmail,
      password: "Reset-qa-password-123",
    }),
  );
  // Preserve compatibility for reset links issued before the additive migration.
  const legacy = randomBytes(32).toString("hex");
  await db.resetToken.create({
    data: {
      token: hash(legacy),
      userId: u.id,
      expires: new Date(Date.now() + 60000),
    },
  });
  good(await client().auth("reset", { token: legacy, password }));
  assert.equal(
    (await client().auth("reset", { token: legacy, password })).status,
    400,
  );
  console.log(
    "PASS reset anti-enumeration / single-use / password replacement and session invalidation / old reset-link compatibility",
  );
  const beforePassword = client();
  good(await beforePassword.auth("login", { email: v.email, password }));
  assert.equal(
    (
      await other.account("changePassword", {
        currentPassword: "incorrect-password-123",
        password: "Changed-qa-password-123",
      })
    ).status,
    400,
  );
  good(
    await other.account("changePassword", {
      currentPassword: password,
      password: "Changed-qa-password-123",
    }),
  );
  assert.equal((await other.call("/api/account")).status, 401);
  assert.equal((await beforePassword.call("/api/account")).status, 401);
  assert.equal(
    (await client().auth("login", { email: v.email, password })).status,
    401,
  );
  good(
    await other.auth("login", {
      email: v.email,
      password: "Changed-qa-password-123",
    }),
  );
  await tenant.auth("login", { email: tu.email, password });
  const target = good(await tenant.call("/api/account")).contexts[0];
  good(await tenant.account("switch", { type: "STAY", id: target.id }));
  good(await owner.auth("login", { email: newEmail, password }));
  good(await owner.invite("revokeOccupant", { id: target.id }));
  assert.equal((await tenant.call("/api/resident")).status, 403);
  assert.equal(
    (await tenant.call("/api/tenant/account:" + ownInvoice.id)).status,
    403,
  );
  const key = (
    await readFile(".local-secrets/phase2-qa-key.txt", "utf8")
  ).trim();
  assert.equal(
    (await fetch(base + "/api/jobs/mail", { method: "POST" })).status,
    401,
  );
  const seedMail = await db.emailOutbox.findFirstOrThrow({
    where: { userId: u.id, template: "security", status: "SINKED" },
  });
  const queueIds = [];
  for (let n = 0; n < 6; n++)
    queueIds.push(
      (
        await db.emailOutbox.create({
          data: {
            dedupeKey: `parallel-qa:${suffix}:${n}`,
            template: "security",
            encryptedPayload: seedMail.encryptedPayload,
            status: "QUEUED",
          },
        })
      ).id,
    );
  const stale = await db.emailOutbox.create({
    data: {
      dedupeKey: `stale-qa:${suffix}`,
      template: "security",
      encryptedPayload: seedMail.encryptedPayload,
      status: "PROCESSING",
      leaseUntil: new Date(Date.now() - 1000),
    },
  });
  const expiredMail = await db.emailOutbox.create({
    data: {
      dedupeKey: `expired-qa:${suffix}`,
      template: "security",
      encryptedPayload: seedMail.encryptedPayload,
      status: "QUEUED",
      expiresAt: new Date(Date.now() - 1000),
    },
  });
  const jobs = await Promise.all(
    [1, 2].map(() =>
      fetch(base + "/api/jobs/mail", {
        method: "POST",
        headers: { Authorization: "Bearer " + key },
      }),
    ),
  );
  jobs.forEach((r) => assert.equal(r.status, 200));
  const processed = await db.emailOutbox.findMany({
    where: { id: { in: queueIds } },
  });
  assert.equal(processed.length, 6);
  for (const row of processed) {
    assert.equal(row.status, "SINKED");
    assert.equal(row.attempts, 1);
  }
  assert.equal(
    (await db.emailOutbox.findUniqueOrThrow({ where: { id: stale.id } }))
      .status,
    "UNKNOWN",
  );
  assert.equal(
    (await db.emailOutbox.findUniqueOrThrow({ where: { id: expiredMail.id } }))
      .status,
    "CANCELLED",
  );
  assert.equal(
    await db.emailOutbox.count({
      where: {
        organizationId: u.organizationId,
        status: { in: ["ACCEPTED", "PROCESSING", "UNKNOWN"] },
      },
    }),
    0,
    "local only, no SMTP calls",
  );
  console.log(
    "PASS revoked occupant loses stale session / authenticated outbox worker / parallel queue claims / local sink only",
  );
  // Restore an explicitly synthetic occupant fixture for manual browser review after revocation assertions.
  good(await tenant.auth("login", { email: tu.email, password }));
  const again = good(
    await owner.invite("create", {
      email: tu.email,
      kind: "TENANT",
      propertyIds: [property.id],
      stayId: stay.id,
    }),
  ).result;
  good(await tenant.invite("accept", { id: again.id }));
  await writeFile(
    ".local-secrets/phase3-browser.json",
    JSON.stringify({
      base,
      owner: newEmail,
      tenant: tu.email,
      password,
      invitationId: again.id,
      invoiceId: ownInvoice.id,
    }),
  );
  await writeFile(
    "artifacts/phase3/identity-tests.json",
    JSON.stringify(
      {
        passed: 8,
        environment: "isolated QA 55432 + loopback 3001",
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
