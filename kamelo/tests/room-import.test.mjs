import test from "node:test";
import assert from "node:assert/strict";
import { readRoomCsv } from "../lib/room-import-csv.mjs";
test("CSV handles BOM, CRLF, quoted commas and explicit reordered mapping", () => {
  const result = readRoomCsv(
    '\uFEFFprice,ignored,room\r\n1500000,x,"A,01"\r\n0,y,B02\r\n',
    { number: 2, rate: 0 },
  );
  assert.deepEqual(
    result.rows.map((r) => [r.number, r.rate, r.errors]),
    [
      ["A,01", 1500000, []],
      ["B02", 0, []],
    ],
  );
});
test("malformed quotes and bounds reject entire input", () => {
  for (const text of [
    'a,b\n"unfinished',
    'a,b\n"x"suffix,4',
    'a,b\nx"y,4',
    "a,b",
    "a,b\nx,1\0",
    "a,b\n" + Array(101).fill("x,1").join("\n"),
  ])
    assert.throws(() => readRoomCsv(text));
  assert.throws(() => readRoomCsv("a,b\nx,1", { number: 0, rate: 0 }));
  assert.throws(() => readRoomCsv("a,b\nx,1", { number: 2, rate: 1 }));
  assert.throws(() => readRoomCsv("a,b\n" + "é".repeat(50000) + ",1"));
});
test("row errors flag formulas, locale money, duplicate Unicode identities, mismatched cells", () => {
  const rows = readRoomCsv(
    "number,rate\nA01,100\na01,200\nＡ01,300\n=SUM(A1),5\n-1,2\nB,1.000\nC,1e3\nD,1,2\nE,1000000001\nF,-1",
  ).rows;
  assert.equal(rows[0].errors.length, 0);
  assert(rows.slice(1).every((r) => r.errors.length));
});
test("quoted escape accepted and whitespace-only records ignored", () => {
  const r = readRoomCsv('number,rate\n"A""1",2\n\n , \n');
  assert.equal(r.rows[0].number, 'A"1');
  assert.equal(r.rows.length, 1);
});
