// Disposable QA fixture only. Credentials stay in .local-secrets and are never exported.
import { PrismaClient } from "../generated/prisma/index.js";
import { readFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
const url = new URL(process.env.DATABASE_URL || "http://invalid");
assert.equal(url.hostname, "127.0.0.1");
assert.equal(url.port, "55432");
assert.equal(url.pathname, "/kamelo_phase2_qa");
assert.equal(process.env.TEST_URL, "http://127.0.0.1:3001");
const f = JSON.parse(
    await readFile(".local-secrets/finance-stage4-browser.json", "utf8"),
  ),
  db = new PrismaClient();
let cookie = "";
async function call(path, body) {
  const r = await fetch(process.env.TEST_URL + path, {
    method: "POST",
    headers: {
      Origin: process.env.TEST_URL,
      Cookie: cookie,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (r.headers.get("set-cookie"))
    cookie = r.headers.get("set-cookie").split(";")[0];
  const d = await r.json();
  assert.equal(r.status, 200, JSON.stringify(d));
  return d.result || d;
}
try {
  await call("/api/auth", {
    action: "login",
    email: f.ownerEmail,
    password: f.password,
  });
  const r = await db.openingReceivable.findUniqueOrThrow({
      where: { id: f.receivableId },
    }),
    grant = await db.occupantAccess.findFirstOrThrow({
      where: {
        user: { email: f.tenantEmail },
        stay: { guestId: r.guestId, room: { propertyId: r.propertyId } },
        status: "ACTIVE",
        revokedAt: null,
        canViewBilling: true,
      },
    });
  if (
    !(await db.openingShare.findFirst({
      where: { receivableId: r.id, revokedAt: null },
    }))
  )
    await call("/api/opening-balances", {
      action: "shareOpening",
      receivableId: r.id,
      grantId: grant.id,
      key: randomUUID(),
      confirmed: true,
    });
  const ref = "BROWSER-" + Date.now(),
    date = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Jakarta",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  const receipt = await call("/api/opening-balances", {
    action: "receipt",
    receivableId: r.id,
    amount: 50000,
    date,
    method: "CASH",
    reference: ref,
    note: "Synthetic browser receipt; no funds transferred",
    key: randomUUID(),
    confirmed: true,
  });
  await writeFile(
    ".local-secrets/finance-stage4-browser.json",
    JSON.stringify(
      { ...f, browserReceiptId: receipt.id, browserReference: ref },
      null,
      2,
    ),
  );
  console.log(
    "Synthetic owner/tenant browser fixture prepared; no external payment or email.",
  );
} finally {
  await db.$disconnect();
}
