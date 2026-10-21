import test from "node:test";
import assert from "node:assert/strict";
import {
  depositMovement,
  depositState,
  stableHash,
} from "../lib/lifecycle-rules.mjs";
test("deposit liability movement preserves reserved deductions and bounded integer IDR", () => {
  assert.equal(depositMovement(1000, 200, -800), 200);
  assert.throws(() => depositMovement(1000, 200, -801));
  assert.throws(() => depositMovement(1000, 0, -1001));
  assert.throws(() => depositMovement(0, 0, 0));
  assert.throws(() => depositMovement(1e9, 0, 1));
  assert.throws(() => depositMovement(1000, 0, 0.1));
  assert.throws(() => depositMovement(100, 200, 1));
  assert.equal(depositMovement(0, 0, 1000), 1000);
});
test("deposit states distinguish due, held, pending deductions and settled liability", () => {
  assert.equal(depositState(0, 0, 100, 0), "DUE");
  assert.equal(depositState(50, 0, 100, 1), "PARTIALLY_HELD");
  assert.equal(depositState(100, 0, 100, 1), "HELD");
  assert.equal(depositState(100, 50, 100, 1), "DEDUCTION_PENDING");
  assert.equal(depositState(0, 0, 100, 3), "SETTLED");
});
test("idempotency hash ignores object key order but binds financial values and actor", () => {
  assert.equal(
    stableHash({ actor: "a", amount: 5, nested: { b: 2, a: 1 } }),
    stableHash({ nested: { a: 1, b: 2 }, amount: 5, actor: "a" }),
  );
  assert.notEqual(
    stableHash({ actor: "a", amount: 5 }),
    stableHash({ actor: "b", amount: 5 }),
  );
  assert.notEqual(stableHash({ amount: 5 }), stableHash({ amount: 6 }));
});
