import test from "node:test";
import assert from "node:assert/strict";
import { receiptHtml } from "../lib/receipt-html.mjs";
const doc = {
  number: "KML-2026-ABC",
  issuedAt: "2026-10-20T12:00:00Z",
  snapshotHash: "a".repeat(64),
  snapshot: {
    amount: 100000,
    organization: "Owner <script>",
    property: "A&B",
    guest: "<img src=x onerror=alert(1)>",
    source: "OPENING",
    sourceReference: "OPEN-1",
    date: "2026-10-20",
    method: "TRANSFER",
    reference: "<script>bad</script>",
  },
  state: { status: "PARTIALLY_REFUNDED", refunded: 25000, retained: 75000 },
};
test("receipt document escapes all user fields and loads no external resources", () => {
  const html = receiptHtml(doc);
  assert(!html.includes("<script>"));
  assert(!html.includes("<img src=x"));
  assert(!html.includes("https://"));
  assert(html.includes("&lt;script&gt;"));
  assert(html.includes("Rp100.000") || html.includes("100.000"));
  assert(html.includes("@media print"));
});
test("receipt renders current refund/correction warning and identifies checksum honestly", () => {
  const html = receiptHtml(doc);
  assert(html.includes("Sebagian dana"));
  assert(html.includes("bukan tanda tangan digital"));
  assert(
    receiptHtml({
      ...doc,
      state: { status: "CORRECTED", refunded: 0, retained: 0 },
    }).includes("tidak berlaku"),
  );
  assert(
    receiptHtml({
      ...doc,
      state: { status: "REFUNDED", refunded: 100000, retained: 0 },
    }).includes("dikembalikan seluruhnya"),
  );
});
