import { test } from "node:test";
import assert from "node:assert/strict";
import {
  amount,
  paymentBalance,
  nights,
  overlaps,
  billingDate,
  assertCapacity,
  roomStatus,
  validateCommand,
} from "../lib/domain.mjs";
test("invoice totals include discounts and reject unsafe amounts", () => {
  assert.equal(amount([{ amount: 1500000 }, { amount: -50000 }]), 1450000);
  assert.throws(() => amount([{ amount: 0.5 }]));
});
test("partial payment and overpayment protection", () => {
  assert.equal(paymentBalance(1500000, 500000, 250000), 750000);
  assert.throws(() => paymentBalance(100, 50, 51));
  assert.throws(() => paymentBalance(100, 0, -1));
});
test("booking dates handle calendar boundaries", () => {
  assert.equal(nights("2026-01-31", "2026-02-02"), 2);
  assert.throws(() => nights("2026-02-30", "2026-03-03"));
  assert.throws(() => nights("2026-01-01", "2026-01-01"));
});
test("overlap excludes adjacent reservations", () => {
  assert.equal(
    overlaps(
      { start: "2026-01-01", end: "2026-01-03" },
      { start: "2026-01-03", end: "2026-01-04" },
    ),
    false,
  );
  assert.equal(
    overlaps(
      { start: "2026-01-01", end: "2026-01-03" },
      { start: "2026-01-02", end: "2026-01-04" },
    ),
    true,
  );
});
test("billing day retains month-end semantics", () => {
  assert.equal(billingDate(2026, 2, 31), "2026-02-28");
  assert.equal(billingDate(2028, 2, 31), "2028-02-29");
  assert.equal(billingDate(2026, 3, 31), "2026-03-31");
});
test("room limits reject whole batch", () => {
  assertCapacity(0, 5, 5);
  assert.throws(() => assertCapacity(4, 2, 5));
});
test("operational status and occupancy are separate", () => {
  assert.equal(
    roomStatus({ operational: "CLEANING" }, [], "2026-10-13"),
    "CLEANING",
  );
  assert.equal(
    roomStatus({ operational: "READY" }, [{ status: "ACTIVE" }], "2026-10-13"),
    "OCCUPIED",
  );
});
test("future monthly occupancy does not mark a room occupied early", () => {
  assert.equal(
    roomStatus(
      { operational: "READY" },
      [{ status: "ACTIVE", start: "2026-11-01", end: null }],
      "2026-10-13",
    ),
    "AVAILABLE",
  );
});
test("device capabilities and offline validation", () => {
  const d = {
    online: true,
    capabilities: {
      power: { type: "boolean" },
      temperature: { type: "integer", min: 16, max: 30 },
    },
  };
  validateCommand(d, { code: "power", value: true });
  assert.throws(() => validateCommand(d, { code: "unlock", value: true }));
  assert.throws(() => validateCommand(d, { code: "temperature", value: 31 }));
  assert.throws(() =>
    validateCommand({ ...d, online: false }, { code: "power", value: true }),
  );
});
