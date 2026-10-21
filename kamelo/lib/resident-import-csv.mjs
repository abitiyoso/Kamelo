import { readCsvTable } from "./room-import-csv.mjs";
export const residentColumns = {
  number: 0,
  name: 1,
  phone: 2,
  start: 3,
  end: 4,
  rate: 5,
  billingDay: 6,
};
export function residentPhone(value) {
  const s = value.trim().replace(/[ -]/g, "");
  if (!/^(?:\+62|62|0)8\d{7,12}$/.test(s)) return "";
  return s.startsWith("+62")
    ? s
    : s.startsWith("62")
      ? "+" + s
      : "+62" + s.slice(1);
}
const date = (s) =>
  /^\d{4}-\d{2}-\d{2}$/.test(s) &&
  Number.isFinite(Date.parse(s + "T00:00:00Z")) &&
  new Date(s + "T00:00:00Z").toISOString().slice(0, 10) === s;
export function readResidentCsv(text, mapping = residentColumns) {
  const { headers, rows } = readCsvTable(text);
  if (rows.length > 50)
    throw Error("Impor penghuni maksimal 50 baris per batch.");
  const columns = Object.keys(residentColumns).map((k) => mapping[k]);
  if (
    new Set(columns).size !== 7 ||
    columns.some((n) => !Number.isInteger(n) || n < 0 || n >= headers.length)
  )
    throw Error(
      "Petakan tujuh kolom yang berbeda, termasuk kolom tanggal akhir (boleh kosong).",
    );
  return {
    headers,
    rows: rows.map((cells, i) => {
      const v = Object.fromEntries(
        Object.keys(residentColumns).map((k) => [
          k,
          (cells[mapping[k]] || "").trim(),
        ]),
      );
      const phone = residentPhone(v.phone),
        rate = Number(v.rate),
        billingDay = Number(v.billingDay),
        errors = [];
      if (cells.length !== headers.length)
        errors.push("Jumlah kolom berbeda dari header.");
      if (!v.number || v.number.length > 20 || /[\x00-\x1f]/.test(v.number))
        errors.push("Nomor kamar tidak valid.");
      if (
        v.name.length < 2 ||
        v.name.length > 100 ||
        /[\x00-\x1f]/.test(v.name) ||
        /^[=+@-]/.test(v.name)
      )
        errors.push(
          "Nama penghuni 2–100 karakter, tanpa formula/karakter kontrol.",
        );
      if (!phone)
        errors.push(
          "Nomor telepon Indonesia tidak valid. Gunakan 08…, 628…, atau +628….",
        );
      if (!date(v.start) || (v.end && (!date(v.end) || v.end <= v.start)))
        errors.push(
          "Tanggal harus YYYY-MM-DD dan tanggal akhir sesudah mulai.",
        );
      if (
        !/^\d+$/.test(v.rate) ||
        !Number.isSafeInteger(rate) ||
        rate > 1000000000
      )
        errors.push("Tarif berupa rupiah bulat 0–1.000.000.000 tanpa pemisah.");
      if (
        !/^\d+$/.test(v.billingDay) ||
        !Number.isInteger(billingDay) ||
        billingDay < 1 ||
        billingDay > 31
      )
        errors.push("Hari jatuh tempo harus 1–31.");
      return {
        line: i + 2,
        number: v.number,
        name: v.name,
        phone,
        start: v.start,
        end: v.end || null,
        rate: Number.isSafeInteger(rate) ? rate : 0,
        billingDay: Number.isInteger(billingDay) ? billingDay : 0,
        errors,
      };
    }),
  };
}
