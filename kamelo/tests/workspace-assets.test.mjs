import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
test("all seven backoffice logo/photos retain approved v5.3 bytes", async () => {
  const manifest = JSON.parse(
    await readFile(
      new URL("../docs/BACKOFFICE_ASSET_MANIFEST.json", import.meta.url),
      "utf8",
    ),
  );
  assert.equal(manifest.length, 7);
  for (const asset of manifest) {
    const data = await readFile(new URL("../" + asset.path, import.meta.url));
    assert.equal(
      createHash("sha256").update(data).digest("hex"),
      asset.sha256,
      asset.path,
    );
  }
});
