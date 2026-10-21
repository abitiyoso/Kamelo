import test from "node:test";
import assert from "node:assert/strict";
import { dashboardPeriods } from "../lib/dashboard-periods.mjs";
test("dashboard comparison uses prior month through matching calendar day", () => {
  const p = dashboardPeriods("2026-10-20");
  assert.equal(p.start, "2026-10-01");
  assert.equal(p.comparisonStart, "2026-09-01");
  assert.equal(p.comparisonEnd, "2026-09-20");
  assert.deepEqual(p.months, [
    "2026-05",
    "2026-06",
    "2026-07",
    "2026-08",
    "2026-09",
    "2026-10",
  ]);
});
test("dashboard comparison clamps February and respects leap years", () => {
  assert.equal(dashboardPeriods("2026-03-31").comparisonEnd, "2026-02-28");
  assert.equal(dashboardPeriods("2024-03-31").comparisonEnd, "2024-02-29");
});
test("dashboard months and comparison cross the year boundary", () => {
  const p = dashboardPeriods("2026-01-01");
  assert.equal(p.comparisonStart, "2025-12-01");
  assert.equal(p.comparisonEnd, "2025-12-01");
  assert.deepEqual(p.months, [
    "2025-08",
    "2025-09",
    "2025-10",
    "2025-11",
    "2025-12",
    "2026-01",
  ]);
});
