// Deliberately accepts text CSV only: no formulas, locale-dependent money, or spreadsheets.
export function readCsvTable(text) {
  if (
    typeof text !== "string" ||
    new TextEncoder().encode(text).length > 100000 ||
    text.includes("\0")
  )
    throw Error("CSV tidak valid atau melebihi 100 KB.");
  text = text.replace(/^\uFEFF/, "");
  const rows = [];
  let row = [],
    value = "",
    quoted = false,
    closed = false;
  const cell = () => {
    row.push(value);
    value = "";
    closed = false;
  };
  const line = () => {
    cell();
    if (row.some((v) => v.trim())) rows.push(row);
    row = [];
  };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          value += '"';
          i++;
        } else {
          quoted = false;
          closed = true;
        }
      } else value += c;
    } else if (c === '"') {
      if (value || closed) throw Error("Tanda kutip CSV tidak valid.");
      quoted = true;
    } else if (c === ",") cell();
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      line();
    } else {
      if (closed) throw Error("Karakter setelah tanda kutip tidak valid.");
      value += c;
    }
  }
  if (quoted) throw Error("Tanda kutip CSV belum ditutup.");
  if (value || row.length || closed) line();
  if (rows.length < 2 || rows.length > 101)
    throw Error("CSV harus berisi header dan 1–100 baris data.");
  const headers = rows.shift();
  if (headers.length > 20 || headers.some((h) => !h.trim() || h.length > 100))
    throw Error("Header CSV tidak valid (maksimal 20 kolom).");
  return { headers, rows };
}
export function readRoomCsv(text, mapping = { number: 0, rate: 1 }) {
  const { headers, rows } = readCsvTable(text);
  if (
    ![mapping.number, mapping.rate].every(
      (n) => Number.isInteger(n) && n >= 0 && n < headers.length,
    ) ||
    mapping.number === mapping.rate
  )
    throw Error("Pilih kolom nomor dan tarif yang berbeda.");
  const seen = new Set();
  return {
    headers,
    rows: rows.map((r, i) => {
      const number = (r[mapping.number] || "").trim(),
        raw = (r[mapping.rate] || "").trim();
      const errors = [];
      if (r.length !== headers.length)
        errors.push("Jumlah kolom berbeda dari header.");
      if (
        !number ||
        number.length > 20 ||
        /[\x00-\x1f=+@]/.test(number) ||
        number.startsWith("-")
      )
        errors.push(
          "Nomor kamar 1–20 karakter, tanpa formula atau karakter kontrol.",
        );
      const rate = Number(raw);
      if (
        !/^\d+$/.test(raw) ||
        !Number.isSafeInteger(rate) ||
        rate > 1000000000
      )
        errors.push("Tarif berupa rupiah bulat 0–1.000.000.000 tanpa pemisah.");
      const normalized = number.normalize("NFKC").toLocaleLowerCase("id-ID");
      if (seen.has(normalized)) errors.push("Nomor kamar berulang di CSV.");
      seen.add(normalized);
      return {
        line: i + 2,
        number,
        rate: Number.isSafeInteger(rate) ? rate : 0,
        errors,
      };
    }),
  };
}
