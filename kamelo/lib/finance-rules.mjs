export function expenseMovement(paid, amount, delta) {
  if (
    ![paid, amount, delta].every(Number.isSafeInteger) ||
    amount <= 0 ||
    delta === 0 ||
    paid + delta < 0 ||
    paid + delta > amount
  )
    throw Error("Nominal melebihi saldo biaya atau pembayaran yang tercatat.");
  return paid + delta;
}
export function reportComparison(from, to) {
  const start = Date.parse(from + "T00:00:00Z"),
    end = Date.parse(to + "T00:00:00Z");
  const days = Math.round((end - start) / 86400000) + 1;
  if (!Number.isFinite(days) || days < 1 || days > 366)
    throw Error("Pilih periode laporan antara 1 dan 366 hari.");
  return {
    days,
    from: new Date(start - days * 86400000).toISOString().slice(0, 10),
    to: new Date(start - 86400000).toISOString().slice(0, 10),
  };
}
export function financeCsv(rows) {
  const cell = (value) => {
    let text = String(value ?? "");
    if (
      typeof value !== "number" &&
      (/^[=+\-@]/.test(text.trimStart()) || /^[\u0000-\u001f]/.test(text))
    )
      text = "'" + text;
    return '"' + text.replaceAll('"', '""') + '"';
  };
  return (
    "\uFEFF" + rows.map((row) => row.map(cell).join(",")).join("\r\n") + "\r\n"
  );
}
