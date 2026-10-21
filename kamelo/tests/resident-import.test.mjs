import test from "node:test";
import assert from "node:assert/strict";
import {
  readResidentCsv,
  residentColumns,
  residentPhone,
} from "../lib/resident-import-csv.mjs";
const header = "room,name,phone,start,end,rate,day\n";
test("resident CSV preserves literal dates and independent due days; canonical Indonesian phones", () => {
  const p = readResidentCsv(
    header +
      'A01,"Dewi, QA",081234567890,2026-02-01,,1500000,31\nA02,Budi QA,+6281234567891,2026-02-01,2026-03-01,0,2',
  );
  assert(p.rows.every((r) => !r.errors.length));
  assert.equal(p.rows[0].phone, "+6281234567890");
  assert.equal(p.rows[0].billingDay, 31);
  assert.equal(p.rows[0].end, null);
  assert.equal(residentPhone("6281234567890"), "+6281234567890");
  assert.equal(residentPhone("81234567890"), "");
});
test("resident CSV rejects invalid calendar dates, ambiguous money and out-of-range due days", () => {
  for (const value of [
    "A,AB,081234567890,2026-02-30,,1000,15",
    "A,AB,081234567890,2026-02-01,2026-02-01,1000,15",
    "A,AB,081234567890,2026-02-01,,1.000,15",
    "A,AB,081234567890,2026-02-01,,1000,0",
    "A,=AB,081234567890,2026-02-01,,1000,15",
  ])
    assert(readResidentCsv(header + value).rows[0].errors.length);
});
test("resident import mapping is explicit, distinct and bounded at fifty records", () => {
  assert.throws(() =>
    readResidentCsv(header + "A,AB,081234567890,2026-02-01,,1,1", {
      ...residentColumns,
      name: 0,
    }),
  );
  assert.throws(() =>
    readResidentCsv(
      header + Array(51).fill("A,AB,081234567890,2026-02-01,,1,1").join("\n"),
    ),
  );
  const mapping = { ...residentColumns, number: 1, name: 0 };
  assert.equal(
    readResidentCsv(
      header + "Budi QA,A01,081234567890,2026-02-01,,1,1",
      mapping,
    ).rows[0].number,
    "A01",
  );
});
