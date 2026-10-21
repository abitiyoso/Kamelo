import test from "node:test";
import assert from "node:assert/strict";
import {
  readOpeningCsv,
  openingReference,
  openingColumns,
} from "../lib/opening-balances-csv.mjs";
import { inspectWorkbook, workbookToCsv } from "../lib/import-workbook.mjs";
import { xlsxFixture } from "./helpers/xlsx.mjs";
const header = "nama,hp,ref,saldo,due\n";
test("opening AR keeps exact positive integer debt, source identity and due date", () => {
  const r = readOpeningCsv(
    header + "Dewi QA,081234567890,INV-OLD-001,1500000,2026-02-28",
  ).rows[0];
  assert.equal(r.errors.length, 0);
  assert.equal(r.amount, 1500000);
  assert.equal(r.phone, "+6281234567890");
  assert.equal(openingReference(" inv  old-001 "), "INV OLD-001");
});
test("opening AR rejects duplicate normalized references, credits/deposits, locale amounts and bad dates", () => {
  const p = readOpeningCsv(
    header +
      "Dewi QA,081234567890,inv  old,1,2026-01-01\nDewi QA,081234567890,INV OLD,1,2026-01-01",
  );
  assert(p.rows[1].errors.length);
  for (const [a, d] of [
    [0, "2026-01-01"],
    [-1, "2026-01-01"],
    ["1.000", "2026-01-01"],
    [1000000001, "2026-01-01"],
    [1, "2026-02-30"],
  ])
    assert(
      readOpeningCsv(header + `Dewi QA,081234567890,OLD-001,${a},${d}`).rows[0]
        .errors.length,
    );
  assert.throws(() =>
    readOpeningCsv(header + "QA,081234567890,OLD,1,2026-01-01", {
      ...openingColumns,
      phone: 0,
    }),
  );
});
test("opening XLSX maps text source references and native due dates into unchanged debt values", async () => {
  const w = await inspectWorkbook(
    xlsxFixture([
      {
        name: "Opening",
        data: [
          ["nama", "hp", "ref", "saldo", "due"],
          [
            "Dewi QA",
            "081234567890",
            "OLD-001",
            1500000,
            new Date("2026-09-15T00:00:00Z"),
          ],
        ],
      },
    ]),
  );
  const r = readOpeningCsv(
    workbookToCsv(w, "balances", "Opening", openingColumns).csv,
  ).rows[0];
  assert.equal(r.due, "2026-09-15");
  assert.equal(r.errors.length, 0);
});
