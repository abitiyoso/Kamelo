import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { PrismaClient } from "../generated/prisma/index.js";
const db = new PrismaClient(),
  base = process.env.TEST_URL || "http://127.0.0.1:3000",
  suffix = Date.now();
async function register(label, requestedPlan) {
  const email = `acquisition-${label}-${suffix}@example.test`;
  const r = await fetch(base + "/api/auth", {
    method: "POST",
    headers: { Origin: base, "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "register",
      email,
      password: "Local-test-password-123",
      name: "Acquisition QA " + label,
      phone: "081234567890",
      ...(requestedPlan ? { requestedPlan } : {}),
    }),
  });
  return {
    status: r.status,
    cookie: r.headers.get("set-cookie")?.split(";")[0],
    body: await r.json(),
    email,
  };
}
try {
  const r = await fetch(base),
    html = await r.text();
  assert.equal(r.status, 200);
  for (const expected of [
    "Punya properti.",
    "sendiri.",
    "BANTU PILIH PAKET",
    "Cara mulai",
    "Simulasi · tidak mengirim pesan",
    "Rp",
    "pemulihan",
    "Masuk Owner",
  ])
    assert.ok(html.toLowerCase().includes(expected.toLowerCase()), expected);
  for (const id of [
    "fitur",
    "cara-kerja",
    "mulai",
    "layanan",
    "harga",
    "faq",
    "demo-owner",
  ])
    assert.equal(
      (html.match(new RegExp(`id="${id}"`, "g")) || []).length,
      1,
      id,
    );
  const destinations = new Set(
    [...html.matchAll(/<a\b[^>]*\bhref="([^"]+)"/g)].map((match) =>
      match[1].replaceAll("&amp;", "&"),
    ),
  );
  for (const href of destinations) {
    const target = new URL(href, base);
    if (target.origin !== new URL(base).origin) {
      assert.equal(
        target.hostname,
        "wa.me",
        "only explicit contact links leave the site",
      );
      continue;
    }
    if (target.hash)
      assert.ok(
        html.includes(`id="${target.hash.slice(1)}"`),
        `anchor ${target.hash} exists`,
      );
    assert.equal(
      (await fetch(target.origin + target.pathname + target.search)).status,
      200,
      href,
    );
  }
  for (const path of [
    "/demo/owner",
    "/demo/tenant",
    "/demo?tab=rooms",
    "/register?plan=starter",
    "/register?plan=plus",
    "/login",
    "/pricing",
    "/privacy",
    "/terms",
  ]) {
    const response = await fetch(base + path);
    assert.equal(response.status, 200, path);
  }
  for (const file of [
    "journal-hero-v1.webp",
    "journal-room-v1.webp",
    "journal-reception-v1.webp",
    "journal-lock-v1.webp",
    "journal-owner-coffee-v1.webp",
    "journal-tenant-v1.webp",
  ]) {
    assert.ok(html.includes(file), `homepage consumes ${file}`);
    const photo = await fetch(base + "/images/homepage/" + file);
    assert.equal(photo.status, 200);
    assert.ok(photo.headers.get("content-type").includes("image/webp"));
  }
  console.log(
    "PASS homepage/routes/anchors/optimized photos and complete acquisition information",
  );
  const free = await register("free");
  assert.equal(free.status, 200);
  const freeUser = await db.user.findUnique({
    where: { email: free.email },
    include: { organization: { include: { upgrades: true } } },
  });
  assert.equal(freeUser.organization.plan, "free");
  assert.equal(freeUser.organization.upgrades.length, 0);
  for (const plan of ["starter", "plus"]) {
    const registered = await register(plan, plan);
    assert.equal(registered.status, 200, JSON.stringify(registered.body));
    const user = await db.user.findUnique({
      where: { email: registered.email },
      include: { organization: { include: { upgrades: true, audits: true } } },
    });
    assert.equal(user.organization.plan, "free");
    assert.equal(user.role, "OWNER");
    assert.equal(user.platformAdmin, false);
    assert.equal(user.organization.upgrades.length, 1);
    assert.equal(user.organization.upgrades[0].plan, plan);
    assert.equal(user.organization.upgrades[0].status, "REQUESTED");
    assert.ok(
      user.organization.audits.some((a) => a.action === "UPGRADE_REQUESTED"),
    );
    const state = await fetch(base + "/api/manage", {
      headers: { Cookie: registered.cookie },
    }).then((r) => r.json());
    assert.equal(state.plan, "free");
    assert.equal(state.upgrades[0].status, "REQUESTED");
    const onboarding = await fetch(base + "/onboarding", {
      headers: { Cookie: registered.cookie },
    }).then((r) => r.text());
    assert.ok(onboarding.includes("menunggu aktivasi admin"));
    if (plan === "starter")
      await writeFile(
        ".local-secrets/acquisition-qa.json",
        JSON.stringify({
          email: registered.email,
          password: "Local-test-password-123",
        }),
      );
  }
  console.log(
    "PASS paid selection → audited request → free entitlement until admin activates / onboarding explains pending state",
  );
  const orgCount = await db.organization.count(),
    upgradeCount = await db.upgrade.count();
  const invalid = await register("invalid", "ultimate");
  assert.equal(invalid.status, 400);
  assert.equal(await db.organization.count(), orgCount);
  assert.equal(await db.upgrade.count(), upgradeCount);
  const duplicate = await register("starter", "plus");
  assert.equal(duplicate.status, 400);
  assert.equal(await db.organization.count(), orgCount);
  assert.equal(await db.upgrade.count(), upgradeCount);
  const invalidQuery = await fetch(base + "/register?plan=ultimate").then((r) =>
    r.text(),
  );
  assert.ok(!invalidQuery.includes("Pilihan Anda:"));
  console.log(
    "PASS invalid plan rejected / duplicate registration rolls back organization and upgrade atomically",
  );

  // A complete server-side customer journey using the account registered from
  // the landing flow. This exercises real HTTP/session/database behavior; it
  // does not claim browser clicks, clipboard or visual responsiveness.
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  let session = free.cookie;
  async function call(path, body) {
    const response = await fetch(base + path, {
      method: body ? "POST" : "GET",
      headers: {
        Origin: base,
        Cookie: session,
        "Content-Type": "application/json",
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const cookie = response.headers.get("set-cookie");
    if (cookie) session = cookie.split(";")[0];
    const data = await response.json();
    return { status: response.status, ...data };
  }
  async function write(action, body = {}) {
    const result = await call("/api/manage", { action, ...body });
    assert.equal(result.status, 200, JSON.stringify(result));
    return result.result;
  }
  const property = await write("property", {
    name: "Landing journey QA Kos",
    type: "KOS",
    count: 3,
    rate: 1000000,
  });
  let state = await call("/api/manage");
  const rooms = state.properties.find((p) => p.id === property.id).rooms;
  const stay = await write("stay", {
    propertyId: property.id,
    roomId: rooms[0].id,
    name: "Landing Tenant QA A",
    phone: "081234567890",
    start: today,
    rate: 1000000,
    billingDay: 5,
  });
  const secondStay = await write("stay", {
    propertyId: property.id,
    roomId: rooms[1].id,
    name: "Landing Tenant QA B",
    phone: "081234567891",
    start: today,
    rate: 1000000,
    billingDay: 20,
  });
  const invoice = await write("invoice", {
    propertyId: property.id,
    stayId: stay.id,
    due: today,
    items: [{ label: "Sewa uji onboarding", amount: 1000000 }],
  });
  const invoiceB = await write("invoice", {
    propertyId: property.id,
    stayId: secondStay.id,
    due: new Date(Date.parse(today + "T00:00:00Z") + 5 * 86400000)
      .toISOString()
      .slice(0, 10),
    items: [{ label: "Sewa uji penghuni kedua", amount: 1000000 }],
  });
  assert.notEqual(invoice.due, invoiceB.due, "independent due dates");
  const link = await write("tenantLink", {
    propertyId: property.id,
    invoiceId: invoice.id,
  });
  const token = new URL(link.url).pathname.split("/").pop();
  assert.equal((await fetch(link.url)).status, 200);
  const tenant = async () =>
    fetch(base + "/api/tenant/" + token).then((response) => response.json());
  assert.equal((await tenant()).invoice.balance, 1000000);
  const form = new FormData();
  form.set(
    "file",
    new Blob(["%PDF-1.7\nSynthetic landing journey proof\n%%EOF"], {
      type: "application/pdf",
    }),
    "landing-qa-proof.pdf",
  );
  form.set("amount", "1000000");
  form.set("date", today);
  form.set("method", "TRANSFER");
  form.set("reference", "Synthetic landing journey QA");
  const uploadResponse = await fetch(base + "/api/tenant/" + token + "/proof", {
    method: "POST",
    headers: { Origin: base },
    body: form,
  });
  const upload = await uploadResponse.json();
  assert.equal(uploadResponse.status, 200, JSON.stringify(upload));
  const proofId = upload.result?.id || upload.id;
  assert.ok(proofId);
  assert.equal(
    (await tenant()).invoice.balance,
    1000000,
    "upload alone does not pay invoice",
  );
  assert.equal(
    (
      await call("/api/manage", {
        action: "reviewProof",
        propertyId: property.id,
        proofId,
        decision: "APPROVE",
      })
    ).status,
    400,
    "explicit receipt confirmation required",
  );
  await write("reviewProof", {
    propertyId: property.id,
    proofId,
    decision: "APPROVE",
    confirmed: true,
  });
  await write("reviewProof", {
    propertyId: property.id,
    proofId,
    decision: "APPROVE",
    confirmed: true,
  });
  assert.equal((await tenant()).invoice.balance, 0);
  assert.equal(
    await db.payment.count({ where: { invoiceId: invoice.id } }),
    1,
    "repeated review does not duplicate payment",
  );
  assert.equal((await fetch(base + "/api/proofs/" + proofId)).status, 403);
  assert.equal(
    (
      await fetch(base + "/api/proofs/" + proofId, {
        headers: { Cookie: session },
      })
    ).status,
    200,
  );
  console.log(
    "PASS landing account → property/rooms → individual tenant dates → invoice link → proof upload → confirmed payment exactly once",
  );
  await write("ticketCreate", {
    propertyId: property.id,
    title: "Landing QA cek AC kamar",
    description: "Synthetic maintenance task",
    category: "OTHER",
  });
  state = await call("/api/manage");
  const ticket = state.properties
    .find((p) => p.id === property.id)
    .tickets.find((t) => t.title === "Landing QA cek AC kamar");
  assert.ok(ticket?.id);
  await write("ticketUpdate", {
    propertyId: property.id,
    ticketId: ticket.id,
    status: "IN_PROGRESS",
    note: "Pemeriksaan dimulai",
  });
  await write("ticketUpdate", {
    propertyId: property.id,
    ticketId: ticket.id,
    status: "RESOLVED",
    note: "Pemeriksaan selesai",
  });
  assert.equal((await call("/api/auth", { action: "logout" })).status, 200);
  assert.equal((await call("/api/manage")).status, 401);
  assert.equal(
    (
      await call("/api/auth", {
        action: "login",
        email: free.email,
        password: "Local-test-password-123",
      })
    ).status,
    200,
  );
  state = await call("/api/manage");
  const persisted = state.properties.find((p) => p.id === property.id);
  assert.equal(
    persisted.tickets.find((t) => t.id === ticket.id).status,
    "RESOLVED",
  );
  assert.ok(persisted.rooms.some((room) => room.id === rooms[0].id));
  assert.equal((await tenant()).invoice.balance, 0);
  console.log(
    "PASS owner task lifecycle → logout denies access → login restores persisted property/payment/task",
  );
  console.log(
    "ALL 5 ACQUISITION GROUPS PASSED. HTTP/API journeys; browser interactions not covered. Synthetic records retained; no external messages/payments sent.",
  );
} finally {
  await db.$disconnect();
}
