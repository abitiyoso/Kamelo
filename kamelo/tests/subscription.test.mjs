import test from "node:test";
import assert from "node:assert/strict";
import {
  subscriptionEnd,
  subscriptionMovement,
  subscriptionPaymentState,
} from "../lib/subscription-rules.mjs";
test("SaaS periods preserve calendar boundaries and validate months", () => {
  assert.equal(subscriptionEnd("2026-01-31", 1), "2026-02-28");
  assert.equal(subscriptionEnd("2028-01-31", 1), "2028-02-29");
  assert.equal(subscriptionEnd("2026-10-18", 12), "2027-10-18");
  assert.throws(() => subscriptionEnd("2026-02-30", 1));
  assert.throws(() => subscriptionEnd("2026-10-18", 13));
});
test("SaaS entries cannot overpay or overrefund and financial state is distinct from entitlement", () => {
  assert.equal(subscriptionMovement(20000, 49000, 29000), 49000);
  assert.throws(() => subscriptionMovement(20000, 49000, 30000));
  assert.throws(() => subscriptionMovement(20000, 49000, -20001));
  assert.throws(() => subscriptionMovement(0, 49000, 0.5));
  const i = { total: 49000, status: "ISSUED", due: "2026-10-01" };
  assert.equal(subscriptionPaymentState(i, 49000, 1, "2026-10-18"), "PAID");
  assert.equal(
    subscriptionPaymentState(i, 10000, 1, "2026-10-18"),
    "PARTIAL_OVERDUE",
  );
  assert.equal(
    subscriptionPaymentState(i, 0, 2, "2026-10-18"),
    "REFUNDED_OR_CORRECTED",
  );
  assert.equal(
    subscriptionPaymentState({ ...i, status: "VOID" }, 0, 0, "2026-10-18"),
    "VOID",
  );
});
