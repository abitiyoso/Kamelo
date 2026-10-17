export function amount(items) {
  const total = items.reduce((sum, item) => {
    if (!Number.isSafeInteger(item.amount))
      throw new Error("Nominal harus bilangan bulat rupiah.");
    return sum + item.amount;
  }, 0);
  if (!Number.isSafeInteger(total) || total <= 0)
    throw new Error("Total tagihan harus positif.");
  return total;
}
export function paymentBalance(total, paid, payment) {
  if (
    ![total, paid, payment].every(Number.isSafeInteger) ||
    payment <= 0 ||
    payment > total - paid
  )
    throw new Error("Pembayaran melebihi saldo atau tidak valid.");
  return total - paid - payment;
}
export function nights(start, end) {
  const parse = (value) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value))
      throw new Error("Tanggal tidak valid.");
    const d = new Date(value + "T00:00:00Z");
    if (!Number.isFinite(+d) || d.toISOString().slice(0, 10) !== value)
      throw new Error("Tanggal tidak valid.");
    return +d;
  };
  const n = (parse(end) - parse(start)) / 86400000;
  if (n <= 0) throw new Error("Check-out harus setelah check-in.");
  return n;
}
export const overlaps = (a, b) => a.start < b.end && b.start < a.end;
export function billingDate(year, month, day) {
  if (!Number.isInteger(day) || day < 1 || day > 31 || month < 1 || month > 12)
    throw new Error("Hari tagihan tidak valid.");
  return new Date(
    Date.UTC(
      year,
      month - 1,
      Math.min(day, new Date(Date.UTC(year, month, 0)).getUTCDate()),
    ),
  )
    .toISOString()
    .slice(0, 10);
}
export function assertCapacity(current, added, limit) {
  if (!Number.isInteger(added) || added < 1 || current + added > limit)
    throw new Error(
      "Kamar sudah mencapai batas paket. Lihat Paket untuk menambah kamar.",
    );
}
export function roomStatus(room, stays, today) {
  if (room.operational !== "READY") return room.operational;
  if (
    stays.some(
      (s) =>
        s.status === "CHECKED_IN" ||
        (s.status === "ACTIVE" &&
          (!s.start || s.start <= today) &&
          (!s.end || s.end > today)),
    )
  )
    return "OCCUPIED";
  if (
    stays.some(
      (s) => s.status === "CONFIRMED" && s.start <= today && s.end > today,
    )
  )
    return "RESERVED";
  return "AVAILABLE";
}
export function validateCommand(device, command) {
  if (!device.online) throw new Error("Perangkat sedang offline.");
  const cap = device.capabilities[command.code];
  if (
    !cap ||
    (cap.type === "boolean"
      ? typeof command.value !== "boolean"
      : !Number.isInteger(command.value) ||
        command.value < cap.min ||
        command.value > cap.max)
  )
    throw new Error("Perintah tidak didukung.");
}
