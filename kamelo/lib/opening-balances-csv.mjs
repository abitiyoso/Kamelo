import { readCsvTable } from "./room-import-csv.mjs";
import { residentPhone } from "./resident-import-csv.mjs";
export const openingColumns = {
  name: 0,
  phone: 1,
  reference: 2,
  amount: 3,
  due: 4,
};
export const openingReference = (s) =>
  s.trim().replace(/ +/g, " ").toUpperCase();
export function readOpeningCsv(text, mapping = openingColumns) {
  const { headers, rows } = readCsvTable(text),
    indexes = Object.keys(openingColumns).map((k) => mapping[k]);
  if (rows.length > 50) throw Error("Saldo awal maksimal 50 baris per batch.");
  if (
    new Set(indexes).size !== 5 ||
    indexes.some((i) => !Number.isInteger(i) || i < 0 || i >= headers.length)
  )
    throw Error("Petakan lima kolom yang berbeda.");
  const seen = new Set();
  return {
    headers,
    rows: rows.map((r, i) => {
      const v = Object.fromEntries(
        Object.keys(openingColumns).map((k) => [
          k,
          (r[mapping[k]] || "").trim(),
        ]),
      );
      const errors = [],
        phone = residentPhone(v.phone),
        key = openingReference(v.reference),
        amount = Number(v.amount);
      if (r.length !== headers.length)
        errors.push("Jumlah kolom berbeda dari header.");
      if (
        v.name.length < 2 ||
        v.name.length > 100 ||
        /[\x00-\x1f]/.test(v.name)
      )
        errors.push("Nama penghuni tidak valid.");
      if (!phone) errors.push("Nomor telepon Indonesia tidak valid.");
      if (!/^[A-Za-z0-9][A-Za-z0-9 ._:/#-]{2,99}$/.test(v.reference))
        errors.push(
          "Referensi 3–100 karakter: huruf, angka, spasi, titik, garis, /, :, #, atau _.",
        );
      if (
        !/^\d+$/.test(v.amount) ||
        !Number.isSafeInteger(amount) ||
        amount < 1 ||
        amount > 1000000000
      )
        errors.push(
          "Saldo piutang positif 1–1.000.000.000 rupiah bulat; kredit/deposit memakai alur terpisah.",
        );
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(v.due) ||
        v.due < "1900-01-01" ||
        !Number.isFinite(Date.parse(v.due + "T00:00:00Z")) ||
        new Date(v.due + "T00:00:00Z").toISOString().slice(0, 10) !== v.due
      )
        errors.push("Jatuh tempo harus tanggal nyata YYYY-MM-DD, mulai 1900.");
      if (seen.has(key)) errors.push("Referensi sumber berulang di CSV.");
      seen.add(key);
      return {
        line: i + 2,
        name: v.name,
        phone,
        reference: v.reference,
        sourceKey: key,
        amount: Number.isSafeInteger(amount) ? amount : 0,
        due: v.due,
        errors,
      };
    }),
  };
}
