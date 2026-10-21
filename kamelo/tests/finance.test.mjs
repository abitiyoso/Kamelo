import test from "node:test";
import assert from "node:assert/strict";
import {
  expenseMovement,
  reportComparison,
  financeCsv,
} from "../lib/finance-rules.mjs";
test("expense movements preserve partial payments and reject overpayment/overrefund/unsafe IDR", () => {
  assert.equal(expenseMovement(40000, 100000, 60000), 100000);
  assert.equal(expenseMovement(40000, 100000, -15000), 25000);
  for (const delta of [60001, -40001, 0, 0.5, Infinity])
    assert.throws(() => expenseMovement(40000, 100000, delta));
});
test("cash report compares explicit equal-day intervals across leap/month boundaries", () => {
  assert.deepEqual(reportComparison("2028-03-01", "2028-03-02"), {
    days: 2,
    from: "2028-02-28",
    to: "2028-02-29",
  });
  assert.equal(reportComparison("2026-10-01", "2026-10-18").days, 18);
  assert.throws(() => reportComparison("2026-10-18", "2026-10-01"));
  assert.throws(() => reportComparison("2024-01-01", "2026-10-18"));
});
test("accounting CSV escapes formulas, delimiters and newlines while preserving signed numeric cash", () => {
  const csv = financeCsv([
    ['=HYPERLINK("x")', "  +SUM(1)", -20000, 'vendor, "quoted"', "note\nline"],
  ]);
  assert.ok(csv.startsWith('\uFEFF"\'=HYPERLINK(""x"")"'));
  assert.ok(csv.includes('"\'  +SUM(1)"'));
  assert.ok(csv.includes('"-20000"'));
  assert.ok(csv.includes('"vendor, ""quoted"""'));
  assert.ok(csv.includes('"note\nline"'));
});
