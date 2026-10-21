import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

test("approved photo and logo bytes match the locked asset manifest", () => {
  const manifest = JSON.parse(
    readFileSync("docs/APPROVED_ASSET_MANIFEST.json"),
  );
  assert.equal(manifest.assets.length, 14);
  for (const asset of manifest.assets) {
    const bytes = readFileSync(asset.path);
    assert.equal(
      createHash("sha256").update(bytes).digest("hex"),
      asset.sha256,
      asset.path,
    );
  }
});

test("public showcase cannot access operational API, storage or executable HTML", () => {
  const runtime = readFileSync("lib/marketing/showcase-runtime.js", "utf8");
  const markup = readFileSync("lib/marketing/approved-markup.ts", "utf8");
  assert.doesNotMatch(
    runtime,
    /fetch\(|XMLHttpRequest|localStorage|sessionStorage|eval\(/,
  );
  assert.doesNotMatch(markup, /<script|data:image\//);
  for (const plan of ["free", "starter", "plus"])
    assert.ok(markup.includes("/register?plan=" + plan));
  assert.ok(
    markup.includes("Tidak mengubah data atau mengirim perintah perangkat"),
  );
});
