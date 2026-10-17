import { mkdir, writeFile } from "node:fs/promises";
const base = "http://127.0.0.1:3000";
const auth = await fetch(base + "/api/auth", {
  method: "POST",
  headers: { "Content-Type": "application/json", Origin: base },
  body: JSON.stringify({
    action: "login",
    email: "e2e-local@example.test",
    password: "Local-test-password-123",
  }),
});
if (!auth.ok) throw new Error("Prepare local e2e account first.");
const cookie = auth.headers.get("set-cookie").split(";")[0];
async function write(action, data) {
  const r = await fetch(base + "/api/manage", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: base,
      Cookie: cookie,
    },
    body: JSON.stringify({ action, ...data }),
  });
  const b = await r.json();
  if (!r.ok) throw new Error(b.error);
  return b.result;
}
const state = await (
  await fetch(base + "/api/manage", { headers: { Cookie: cookie } })
).json();
const p = state.properties[0];
const room = p.rooms.find((r) => r.stays.some((s) => s.status === "ACTIVE"));
if (!room) throw new Error("Local fixture needs an active synthetic stay.");
const stay = room.stays.find((s) => s.status === "ACTIVE"),
  today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
const invoice = await write("invoice", {
  propertyId: p.id,
  stayId: stay.id,
  due: today,
  items: [{ label: "Uji unggah bukti, bukan transaksi nyata", amount: 150000 }],
});
const link = await write("tenantLink", {
  propertyId: p.id,
  invoiceId: invoice.id,
});
await mkdir(".local-secrets", { recursive: true });
await writeFile(
  ".local-secrets/browser-fixture.json",
  JSON.stringify(
    {
      url: link.url,
      invoiceId: invoice.id,
      number: invoice.number,
      propertyId: p.id,
      stayId: stay.id,
    },
    null,
    2,
  ),
  { mode: 0o600 },
);
await writeFile(
  "artifacts/synthetic-payment.pdf",
  "%PDF-1.7\nBUKTI UJI KAMELO - DATA SINTETIS - BUKAN TRANSAKSI NYATA\n%%EOF",
);
console.log(
  "Synthetic browser invoice ready: " +
    invoice.number +
    "; private fixture saved locally.",
);
