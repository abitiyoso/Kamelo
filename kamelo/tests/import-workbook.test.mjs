import test from "node:test";
import assert from "node:assert/strict";
import { inspectWorkbook, workbookToCsv } from "../lib/import-workbook.mjs";
import { readRoomCsv } from "../lib/room-import-csv.mjs";
import {
  readResidentCsv,
  residentColumns,
} from "../lib/resident-import-csv.mjs";
import { xlsxFixture, alterXlsx } from "./helpers/xlsx.mjs";
const roomData = [
    ["nomor", "tarif"],
    ["01", 1500000],
    ["02", 0],
  ],
  room = () => xlsxFixture([{ name: "Kamar", data: roomData }]);
test("XLSX names, reordered mapping, quoted values and leading zeros survive canonical CSV", async () => {
  const w = await inspectWorkbook(
    xlsxFixture([
      { name: "Catatan", data: [["Catatan"], ["Pilih data"]] },
      {
        name: "Kamar & Harga",
        data: [
          ["harga", "kamar"],
          [1500000, "01"],
          [0, 'B,"02"'],
        ],
      },
    ]),
  );
  assert.deepEqual(
    w.map((s) => s.sheet),
    ["Catatan", "Kamar & Harga"],
  );
  const c = workbookToCsv(w, "rooms", "Kamar & Harga", { number: 1, rate: 0 });
  const parsed = readRoomCsv(c.csv);
  assert.deepEqual(
    parsed.rows.map((r) => [r.number, r.rate]),
    [
      ["01", 1500000],
      ['B,"02"', 0],
    ],
  );
  assert.throws(() =>
    workbookToCsv(w, "rooms", "absent", { number: 0, rate: 1 }),
  );
});
test("Excel date cells preserve 1900 and 1904 calendars without converting numeric identifiers", async () => {
  for (const date1904 of [false, true]) {
    const w = await inspectWorkbook(
      xlsxFixture(
        [
          {
            name: "Penghuni",
            data: [
              ["n", "nama", "hp", "mulai", "akhir", "tarif", "hari"],
              [
                "01",
                "Dewi QA",
                "081234567890",
                new Date("2026-11-01T00:00:00Z"),
                null,
                1500000,
                31,
              ],
            ],
          },
        ],
        { date1904 },
      ),
    );
    const r = readResidentCsv(
      workbookToCsv(w, "residents", "Penghuni", residentColumns).csv,
    ).rows[0];
    assert.equal(r.start, "2026-11-01");
    assert.equal(r.phone, "+6281234567890");
    assert.equal(r.billingDay, 31);
    assert.equal(r.errors.length, 0);
  }
});
test("numeric room/phone, timestamps, booleans and unsafe numeric cells fail explicitly", async () => {
  const w = await inspectWorkbook(
    xlsxFixture([
      {
        name: "R",
        data: [
          ["n", "rate"],
          [1, 100],
        ],
      },
    ]),
  );
  assert.throws(
    () => workbookToCsv(w, "rooms", "R", { number: 0, rate: 1 }),
    /Text/,
  );
  const bad = [
    [["01", true]],
    [["01", 1.5]],
    [["01", Number.MAX_SAFE_INTEGER + 1]],
  ];
  for (const data of bad) {
    const w = await inspectWorkbook(
      xlsxFixture([{ name: "R", data: [["n", "rate"], ...data] }]),
    );
    assert.throws(() => workbookToCsv(w, "rooms", "R", { number: 0, rate: 1 }));
  }
  for (const value of [45000, new Date("2026-11-01T12:00:00Z")]) {
    const w = await inspectWorkbook(
      xlsxFixture([
        {
          name: "P",
          data: [
            ["n", "name", "hp", "start", "end", "rate", "day"],
            ["01", "QA", "081234567890", value, null, 1, 1],
          ],
        },
      ]),
    );
    assert.throws(() => workbookToCsv(w, "residents", "P", residentColumns));
  }
});
test("formula caches, external references, XML entities, hidden data and merges never become import values", async () => {
  await assert.rejects(
    inspectWorkbook(
      xlsxFixture([
        {
          name: "R",
          data: [
            ["n", "r"],
            ["01", { formula: "1+1", cached: 2 }],
          ],
        },
      ]),
    ),
    /formula/,
  );
  for (const [path, change] of [
    ["xl/vbaProject.bin", "macro"],
    ["xl/externalLinks/externalLink1.xml", "<x/>"],
    [
      "xl/workbook.xml",
      (s) =>
        s.replace(
          "<sheets>",
          '<!DOCTYPE workbook [<!ENTITY x "boom">]><sheets>',
        ),
    ],
    [
      "xl/workbook.xml",
      (s) => s.replace('sheetId="1"', 'state="hidden" sheetId="1"'),
    ],
    [
      "xl/worksheets/sheet1.xml",
      (s) => s.replace('<row r="2">', '<row r="2" hidden="1">'),
    ],
    [
      "xl/worksheets/sheet1.xml",
      (s) =>
        s.replace(
          "</worksheet>",
          '<mergeCells><mergeCell ref="A1:B1"/></mergeCells></worksheet>',
        ),
    ],
    [
      "xl/_rels/workbook.xml.rels",
      (s) =>
        s.replace(
          'Target="styles.xml"',
          'Target="https://untrusted.test/style" TargetMode="External"',
        ),
    ],
  ])
    await assert.rejects(inspectWorkbook(alterXlsx(room(), path, change)));
});
test("ZIP, expanded bytes, sparse coordinates, sheet counts and row limits are bounded before conversion", async () => {
  await assert.rejects(inspectWorkbook(new Uint8Array(1000001)));
  await assert.rejects(inspectWorkbook(new TextEncoder().encode("not XLSX")));
  await assert.rejects(
    inspectWorkbook(
      alterXlsx(room(), "xl/sharedStrings.xml", "x".repeat(2000001)),
    ),
  );
  for (const ref of ["A1:XFD1048576", "a1048576", "A&#49;048576", "A1:U2"])
    await assert.rejects(
      inspectWorkbook(
        alterXlsx(room(), "xl/worksheets/sheet1.xml", (s) =>
          s.replace("A1:B3", ref),
        ),
      ),
    );
  await assert.rejects(
    inspectWorkbook(
      xlsxFixture(
        Array.from({ length: 11 }, (_, i) => ({
          name: "S" + i,
          data: roomData,
        })),
      ),
    ),
  );
  const w = await inspectWorkbook(
    xlsxFixture([
      {
        name: "R",
        data: [
          ["n", "rate"],
          ...Array.from({ length: 51 }, (_, i) => ["A" + i, 1]),
        ],
      },
    ]),
  );
  assert.throws(() => workbookToCsv(w, "residents", "R", residentColumns));
  assert.throws(() =>
    workbookToCsv(
      [
        {
          sheet: "R",
          data: [
            ["n", "rate"],
            ["01", 1],
          ],
        },
      ],
      "rooms",
      "R",
      { number: 0, rate: 0 },
    ),
  );
});
