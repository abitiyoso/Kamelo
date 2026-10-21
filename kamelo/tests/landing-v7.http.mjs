// Read-only HTTP checks: never registers accounts or writes application data.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const base = process.env.TEST_URL || "http://127.0.0.1:3000";
const response = await fetch(base),
  html = await response.text();
assert.equal(response.status, 200);
for (const copy of [
  "Urus kos dan guest house,",
  "Jelajahi Kamelo",
  "Pilih Starter",
  "Pilih Plus",
  "bukan kamera live",
])
  assert.ok(html.includes(copy), copy);
const destinations = new Set(
  Array.from(html.matchAll(/<a\b[^>]*href="([^"]+)"/g), (match) =>
    match[1].replaceAll("&amp;", "&"),
  ),
);
for (const href of destinations) {
  const url = new URL(href, base);
  if (url.origin !== base) {
    assert.ok(["wa.me", "elenio.id"].includes(url.hostname));
    continue;
  }
  if (url.hash) assert.ok(html.includes(`id="${url.hash.slice(1)}"`), href);
  else assert.equal((await fetch(url)).status, 200, href);
}
const manifest = JSON.parse(
  await readFile("docs/APPROVED_ASSET_MANIFEST.json", "utf8"),
);
for (const route of [
  "/demo/owner",
  "/demo/tenant",
  "/pricing",
  "/privacy",
  "/terms",
]) {
  assert.equal((await fetch(base + route)).status, 200, route);
}
for (const asset of manifest.assets) {
  const r = await fetch(base + "/" + asset.path.slice(7));
  assert.equal(r.status, 200, asset.path);
  assert.equal(
    createHash("sha256")
      .update(Buffer.from(await r.arrayBuffer()))
      .digest("hex"),
    asset.sha256,
  );
}
for (const plan of ["free", "starter", "plus"]) {
  const r = await fetch(base + "/register?plan=" + plan);
  assert.equal(r.status, 200);
  if (plan !== "free") {
    const registration = await r.text();
    assert.ok(registration.includes("Pendaftaran mencatat permintaan upgrade"));
    assert.ok(registration.includes("sampai aktivasi admin"));
    assert.ok(registration.includes(plan === "starter" ? "Starter" : "Plus"));
  }
}
console.log(
  "PASS v7 copy, all anchors/local CTA destinations, 14 byte-identical assets, selected-plan routes. Read-only; no application mutations.",
);
