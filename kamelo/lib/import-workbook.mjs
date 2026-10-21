import { unzipSync, zipSync, strFromU8 } from "fflate";
import readExcelFile from "read-excel-file/node";
import { readCsvTable } from "./room-import-csv.mjs";
export const workbookColumns = {
  rooms: ["number", "rate"],
  residents: ["number", "name", "phone", "start", "end", "rate", "billingDay"],
  balances: ["name", "phone", "reference", "amount", "due"],
};
const titles = {
  number: "nomor",
  name: "nama",
  phone: "telepon",
  start: "mulai",
  end: "akhir",
  rate: "tarif",
  billingDay: "jatuh_tempo",
  reference: "referensi",
  amount: "saldo",
  due: "jatuh_tempo",
};
/** @returns {never} */
function fail(message) {
  throw Error(message);
}
// Validate before decompression, then rebuild the ZIP from bounded XML entries. The reader
// never sees attacker-controlled ZIP sizes, duplicate paths or non-workbook binary parts.
export async function inspectWorkbook(bytes) {
  if (
    !(bytes instanceof Uint8Array) ||
    bytes.length > 1000000 ||
    bytes.length < 4 ||
    bytes[0] !== 80 ||
    bytes[1] !== 75 ||
    bytes[2] !== 3 ||
    bytes[3] !== 4
  )
    fail(
      "Pilih file XLSX standar maksimal 1 MB; XLS/XLSM atau file terenkripsi tidak didukung.",
    );
  let count = 0,
    total = 0;
  const sizes = new Map();
  let entries;
  try {
    entries = unzipSync(bytes, {
      filter(f) {
        if (
          ++count > 200 ||
          f.name.length > 256 ||
          f.name.includes("\\") ||
          f.name.startsWith("/") ||
          f.name.split("/").includes("..") ||
          sizes.has(f.name)
        )
          fail("Struktur arsip XLSX tidak didukung.");
        if (
          !Number.isSafeInteger(f.originalSize) ||
          f.originalSize < 0 ||
          f.originalSize > 2000000 ||
          (total += f.originalSize) > 4000000
        )
          fail(
            "Isi XLSX terlalu besar setelah dibuka. Gunakan workbook data yang lebih kecil.",
          );
        sizes.set(f.name, f.originalSize);
        if (
          /vbaProject|externalLinks|embeddings|connections\.xml|queryTables/i.test(
            f.name,
          )
        )
          fail(
            "XLSX dengan makro, koneksi, atau referensi workbook eksternal tidak didukung. Salin data sebagai nilai biasa.",
          );
        return /(?:\.xml|\.rels)$/.test(f.name);
      },
    });
  } catch (e) {
    if (
      (e instanceof Error && e.message.startsWith("XLSX")) ||
      (e instanceof Error && /^(Struktur|Isi)/.test(e.message))
    )
      throw e;
    fail("File XLSX rusak atau format arsipnya tidak didukung.");
  }
  const clean = {};
  let sheets = 0;
  for (const [name, data] of Object.entries(entries)) {
    if (data.length !== sizes.get(name))
      fail("Ukuran isi XLSX tidak cocok dengan metadata arsip.");
    let xml;
    try {
      xml = new TextDecoder("utf-8", { fatal: true }).decode(data);
    } catch {
      fail(
        "Encoding XLSX tidak didukung. Simpan ulang sebagai XLSX standar UTF-8.",
      );
    }
    if (/<!DOCTYPE|<!ENTITY/i.test(xml))
      fail("Deklarasi XML tambahan tidak didukung dalam XLSX.");
    if (/TargetMode\s*=\s*["']External["']/i.test(xml))
      fail(
        "Tautan eksternal dalam XLSX tidak didukung. Salin data sebagai nilai biasa.",
      );
    if (
      name === "xl/workbook.xml" &&
      /\bstate\s*=\s*["'](?:hidden|veryHidden)["']/i.test(xml)
    )
      fail("Tampilkan semua lembar tersembunyi sebelum mengimpor XLSX.");
    if (/^xl\/worksheets\/[^/]+\.xml$/.test(name)) {
      if (++sheets > 10) fail("XLSX maksimal 10 lembar.");
      if (
        [...xml.matchAll(/<(?:[\w-]+:)?c(?:\s|>|\/)/g)].length > 2020 ||
        [...xml.matchAll(/<(?:[\w-]+:)?row(?:\s|>|\/)/g)].length > 101
      )
        fail("Jumlah sel atau baris XLSX melewati area impor.");
      if (/<(?:[\w-]+:)?f(?:\s|>|\/)/.test(xml))
        fail(
          "XLSX berisi formula. Gunakan Copy → Paste Values lalu simpan ulang sebelum impor.",
        );
      if (
        /<(?:[\w-]+:)?mergeCell(?:\s|>|\/)/.test(xml) ||
        /\bhidden\s*=\s*["'](?:1|true)["']/i.test(xml)
      )
        fail(
          "Lepaskan sel gabungan dan tampilkan baris/kolom tersembunyi sebelum impor.",
        );
      for (const m of xml.matchAll(
        /\bref\s*=\s*["']([^"']*)["']|<(?:[\w-]+:)?c\b[^>]*\br\s*=\s*["']([^"']*)["']/g,
      ))
        for (const address of (m[1] || m[2] || "").split(":")) {
          const part = /^([A-Z]+)([1-9]\d*)$/.exec(address);
          if (!part) fail("Koordinat sel XLSX tidak valid.");
          let col = 0;
          for (const c of part[1]) col = col * 26 + c.charCodeAt(0) - 64;
          if (col > 20 || Number(part[2]) > 101 || Number(part[2]) < 1)
            fail(
              "Area XLSX maksimal 20 kolom dan 101 baris termasuk header. Hapus data/format di luar area impor.",
            );
        }
      // Explicit row indexes can be sparse even when cells and dimension are absent.
      for (const m of xml.matchAll(
        /<(?:[\w-]+:)?row\b[^>]*\br\s*=\s*["']([^"']*)["']/g,
      ))
        if (!/^[1-9]\d*$/.test(m[1]) || Number(m[1]) > 101)
          fail("Area XLSX melewati batas 101 baris.");
    }
    clean[name] = data;
  }
  if (
    !clean["[Content_Types].xml"] ||
    !clean["xl/workbook.xml"] ||
    !clean["xl/_rels/workbook.xml.rels"] ||
    !sheets
  )
    fail("Struktur workbook XLSX tidak lengkap.");
  let result;
  try {
    result = await readExcelFile(Buffer.from(zipSync(clean, { level: 0 })), {
      trim: false,
    });
  } catch {
    fail(
      "Workbook XLSX belum dapat dibaca. Gunakan tabel sederhana tanpa fitur tambahan.",
    );
  }
  if (
    !Array.isArray(result) ||
    !result.length ||
    result.length > 10 ||
    new Set(result.map((s) => s.sheet)).size !== result.length
  )
    fail("Daftar lembar XLSX tidak valid.");
  return result;
}
export function workbookToCsv(workbook, kind, sheet, mapping) {
  const fields = workbookColumns[kind];
  if (!fields) fail("Jenis impor tidak valid.");
  const selected = workbook.find((s) => s.sheet === sheet);
  if (!selected) fail("Pilih lembar XLSX yang tersedia.");
  const data = selected.data;
  if (
    !Array.isArray(data) ||
    data.length < 2 ||
    data.length > (kind !== "rooms" ? 51 : 101)
  )
    fail(
      `Lembar harus berisi header dan 1–${kind !== "rooms" ? 50 : 100} baris data.`,
    );
  const headers = data[0];
  if (
    headers.length > 20 ||
    headers.some((v) => typeof v !== "string" || !v.trim() || v.length > 100)
  )
    fail("Header XLSX harus berupa teks, maksimal 20 kolom.");
  if (!mapping) return { headers };
  const indexes = fields.map((f) => mapping[f]);
  if (
    new Set(indexes).size !== fields.length ||
    indexes.some((n) => !Number.isInteger(n) || n < 0 || n >= headers.length)
  )
    fail("Pilih kolom berbeda untuk setiap field impor.");
  const records = [fields.map((f) => titles[f])];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (
      row.length > headers.length &&
      row.slice(headers.length).some((v) => v !== null)
    )
      fail(`Baris ${i + 1} memiliki data di luar header.`);
    if (row.every((v) => v === null || v === "")) continue;
    records.push(
      fields.map((f) => {
        const value = row[mapping[f]];
        if (value === null || value === undefined) return "";
        if (
          ["number", "name", "phone", "reference"].includes(f) &&
          typeof value !== "string"
        )
          fail(
            `Baris ${i + 1}: kolom ${titles[f]} harus disimpan sebagai Text di Excel agar angka nol awal dan identitas tidak berubah.`,
          );
        if (f === "start" || f === "end" || f === "due") {
          if (value instanceof Date) {
            if (
              !Number.isFinite(+value) ||
              value.toISOString().slice(11) !== "00:00:00.000Z"
            )
              fail(`Baris ${i + 1}: tanggal harus tanpa jam.`);
            return value.toISOString().slice(0, 10);
          }
          if (typeof value !== "string")
            fail(
              `Baris ${i + 1}: gunakan sel tanggal Excel atau teks YYYY-MM-DD, bukan nomor serial tanpa format tanggal.`,
            );
        }
        if (typeof value !== "string" && typeof value !== "number")
          fail(`Baris ${i + 1}: tipe sel tidak didukung.`);
        if (typeof value === "number" && !Number.isSafeInteger(value))
          fail(
            `Baris ${i + 1}: nilai numerik harus berupa bilangan bulat yang aman.`,
          );
        return String(value);
      }),
    );
  }
  const csv = records
    .map((r) => r.map((v) => '"' + v.replaceAll('"', '""') + '"').join(","))
    .join("\n");
  readCsvTable(csv); // Keep existing 100 KB, header and record bounds after normalization.
  return { headers, csv, records: records.length - 1 };
}
