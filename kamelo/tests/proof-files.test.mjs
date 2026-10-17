import test from "node:test";
import assert from "node:assert/strict";
import { proofMime, proofAmount, MAX_PROOF_SIZE } from "../lib/proof-files.mjs";
test("proof validation rejects executable content, mismatched signatures and invalid amounts", () => {
  assert.equal(proofMime(Buffer.from("%PDF-1.7\n")), "application/pdf");
  assert.equal(
    proofMime(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
    "image/png",
  );
  assert.throws(() => proofMime(Buffer.from('<svg onload="alert(1)">')));
  assert.throws(() => proofMime(Buffer.from("PNG invalid")));
  for (const value of ["", 0, -1, 1.5, "NaN", "Infinity", 1000000001])
    assert.throws(() => proofAmount(value));
  assert.equal(proofAmount("1500000"), 1500000);
  assert.equal(MAX_PROOF_SIZE, 5 * 1024 * 1024);
});
