import test from "node:test";
import assert from "node:assert/strict";
import { reminderClock, reminderDueLimit } from "../lib/reminder-clock.mjs";
test("reminder clock changes date at Jakarta midnight", () => {
  assert.deepEqual(reminderClock(new Date("2026-10-20T16:59:59Z")), {
    today: "2026-10-20",
    hour: 23,
  });
  assert.deepEqual(reminderClock(new Date("2026-10-20T17:00:00Z")), {
    today: "2026-10-21",
    hour: 0,
  });
});
test("reminder lead window handles month and leap year boundaries", () => {
  assert.equal(reminderDueLimit("2028-02-28", 1), "2028-02-29");
  assert.equal(reminderDueLimit("2026-12-31", 1), "2027-01-01");
  assert.equal(reminderDueLimit("2026-10-20", 0), "2026-10-20");
});
