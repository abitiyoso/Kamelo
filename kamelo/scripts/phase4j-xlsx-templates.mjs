import { mkdir, writeFile } from "node:fs/promises";
import { xlsxFixture } from "../tests/helpers/xlsx.mjs";
await mkdir("public/templates", { recursive: true });
await writeFile(
  "public/templates/kamelo-kamar.xlsx",
  xlsxFixture([
    {
      name: "Kamar",
      data: [
        ["nomor", "tarif"],
        ["K-01", 1500000],
        ["K-02", 1750000],
      ],
    },
  ]),
);
await writeFile(
  "public/templates/kamelo-penghuni.xlsx",
  xlsxFixture([
    {
      name: "Penghuni",
      data: [
        ["nomor", "nama", "telepon", "mulai", "akhir", "tarif", "jatuh_tempo"],
        [
          "K-01",
          "Penghuni Contoh",
          "081234567890",
          new Date("2026-11-01T00:00:00Z"),
          null,
          1500000,
          15,
        ],
      ],
    },
  ]),
);
console.log(
  "Created two XLSX templates with text identities and real Excel date cells.",
);
