import { writeFile } from "node:fs/promises";
import { xlsxFixture } from "../tests/helpers/xlsx.mjs";
await writeFile(
  "public/templates/kamelo-saldo-awal.xlsx",
  xlsxFixture([
    {
      name: "Saldo Awal",
      data: [
        ["nama", "telepon", "referensi", "saldo", "jatuh_tempo"],
        [
          "Penghuni Contoh",
          "081234567890",
          "INV-LAMA-001",
          1500000,
          new Date("2026-09-15T00:00:00Z"),
        ],
      ],
    },
  ]),
);
console.log("Opening receivable XLSX template created.");
