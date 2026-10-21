import { zipSync, strToU8, unzipSync } from "fflate";
const escape = (v) =>
  String(v)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll('"', "&quot;");
const col = (n) => {
  let s = "";
  for (n++; n; n = Math.floor((n - 1) / 26))
    s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
};
export function xlsxFixture(sheets, { date1904 = false } = {}) {
  const files = {};
  const add = (name, xml) => (files[name] = strToU8(xml));
  add(
    "[Content_Types].xml",
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((s, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}</Types>`,
  );
  add(
    "_rels/.rels",
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="root" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
  );
  add(
    "xl/workbook.xml",
    `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><workbookPr date1904="${date1904 ? 1 : 0}"/><sheets>${sheets.map((s, i) => `<sheet name="${escape(s.name)}" sheetId="${i + 1}" r:id="s${i + 1}"/>`).join("")}</sheets></workbook>`,
  );
  add(
    "xl/_rels/workbook.xml.rels",
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((s, i) => `<Relationship Id="s${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}<Relationship Id="styles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
  );
  add(
    "xl/styles.xml",
    '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="1"><font/></fonts><fills count="1"><fill><patternFill patternType="none"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0"/><xf numFmtId="14" applyNumberFormat="1"/></cellXfs></styleSheet>',
  );
  sheets.forEach((sheet, i) =>
    add(
      `xl/worksheets/sheet${i + 1}.xml`,
      `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:${col(Math.max(...sheet.data.map((r) => r.length)) - 1)}${sheet.data.length}"/><sheetData>${sheet.data
        .map(
          (row, r) =>
            `<row r="${r + 1}">${row
              .map((v, c) => {
                const ref = col(c) + (r + 1);
                if (v === null || v === undefined) return "";
                if (v instanceof Date)
                  return `<c r="${ref}" s="1"><v>${+v / 86400000 + (date1904 ? 24107 : 25569)}</v></c>`;
                if (typeof v === "number")
                  return `<c r="${ref}"><v>${v}</v></c>`;
                if (typeof v === "boolean")
                  return `<c r="${ref}" t="b"><v>${+v}</v></c>`;
                if (typeof v === "object" && v.formula)
                  return `<c r="${ref}"><f>${escape(v.formula)}</f><v>${v.cached || 0}</v></c>`;
                return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${escape(v)}</t></is></c>`;
              })
              .join("")}</row>`,
        )
        .join("")}</sheetData></worksheet>`,
    ),
  );
  return zipSync(files, { level: 6 });
}
export function alterXlsx(bytes, path, change) {
  const files = unzipSync(bytes);
  files[path] = strToU8(
    typeof change === "function"
      ? change(new TextDecoder().decode(files[path]))
      : change,
  );
  return zipSync(files, { level: 6 });
}
