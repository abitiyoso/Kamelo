export function subscriptionEnd(start, months) {
  if (!Number.isInteger(months) || months < 1 || months > 12)
    throw Error("Periode langganan harus 1–12 bulan.");
  const d = new Date(start + "T00:00:00Z");
  if (!Number.isFinite(+d) || d.toISOString().slice(0, 10) !== start)
    throw Error("Tanggal tidak valid.");
  const target = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 1),
  );
  const last = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(d.getUTCDate(), last));
  return target.toISOString().slice(0, 10);
}
export function subscriptionMovement(paid, total, delta) {
  if (
    ![paid, total, delta].every(Number.isSafeInteger) ||
    total <= 0 ||
    delta === 0 ||
    paid + delta < 0 ||
    paid + delta > total
  )
    throw Error("Nominal melebihi saldo tagihan langganan.");
  return paid + delta;
}
export function subscriptionPaymentState(invoice, paid, count, today) {
  if (invoice.status === "VOID") return "VOID";
  if (paid === invoice.total) return "PAID";
  if (paid > 0) return invoice.due < today ? "PARTIAL_OVERDUE" : "PARTIAL";
  if (count > 0) return "REFUNDED_OR_CORRECTED";
  return invoice.due < today ? "OVERDUE" : "UNPAID";
}
