"use client";
import { useRef, useState } from "react";
const fields = {
  rooms: { number: "Nomor kamar", rate: "Tarif" },
  balances: {
    name: "Nama penghuni",
    phone: "Telepon",
    reference: "Referensi sumber",
    amount: "Saldo piutang",
    due: "Jatuh tempo",
  },
  residents: {
    number: "Nomor kamar",
    name: "Nama penghuni",
    phone: "Telepon",
    start: "Tanggal mulai",
    end: "Tanggal akhir",
    rate: "Tarif",
    billingDay: "Hari jatuh tempo",
  },
};
export function ImportFileInput({
  kind,
  disabled,
  onLoad,
  onBusy,
  onFeedback,
}: {
  kind: "rooms" | "residents" | "balances";
  disabled: boolean;
  onLoad: (csv: string) => void;
  onBusy: (busy: boolean) => void;
  onFeedback: (text: string) => void;
}) {
  const [file, setFile] = useState<File | null>(null),
    [sheets, setSheets] = useState<string[]>([]),
    [sheet, setSheet] = useState(""),
    [headers, setHeaders] = useState<string[]>([]),
    [mapping, setMapping] = useState<Record<string, number>>({}),
    [converted, setConverted] = useState(false);
  const sequence = useRef(0),
    label =
      kind === "rooms"
        ? "kamar"
        : kind === "residents"
          ? "penghuni"
          : "saldo awal";
  async function request(
    file: File,
    action: string,
    sheet = "",
    mapping?: Record<string, number>,
  ) {
    const body = new FormData();
    body.set("file", file);
    body.set("action", action);
    body.set("kind", kind);
    if (sheet) body.set("sheet", sheet);
    if (mapping) body.set("mapping", JSON.stringify(mapping));
    const r = await fetch("/api/import-files", { method: "POST", body }),
      d = await r.json();
    if (!r.ok) throw Error(d.error);
    return d;
  }
  async function run(task: () => Promise<void>) {
    onBusy(true);
    onFeedback("Membaca file…");
    try {
      await task();
    } catch (e) {
      onFeedback(e instanceof Error ? e.message : "File belum dapat dibaca.");
    } finally {
      onBusy(false);
    }
  }
  return (
    <div className="bo-import-body">
      <p>
        CSV maksimal 100 KB; XLSX maksimal 1 MB dan 10 lembar. Setiap lembar
        berisi maksimal 20 kolom dan {kind === "rooms" ? 101 : 51} baris
        termasuk header. Gunakan tabel nilai tanpa formula, sel gabungan, atau
        baris tersembunyi.
      </p>
      <label>
        Pilih CSV atau XLSX {label}
        <input
          type="file"
          accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          disabled={disabled}
          onChange={(e) => {
            const chosen = e.target.files?.[0],
              version = ++sequence.current;
            setFile(null);
            setSheets([]);
            setHeaders([]);
            setSheet("");
            setConverted(false);
            onLoad("");
            if (!chosen) return;
            void run(async () => {
              if (chosen.name.toLowerCase().endsWith(".csv")) {
                if (chosen.size > 100000) throw Error("CSV maksimal 100 KB.");
                const csv = await chosen.text();
                if (version === sequence.current) {
                  onLoad(csv);
                  onFeedback("CSV siap dipetakan dan dipratinjau.");
                }
                return;
              }
              if (
                !chosen.name.toLowerCase().endsWith(".xlsx") ||
                chosen.size > 1000000
              )
                throw Error(
                  "Pilih CSV maksimal 100 KB atau XLSX maksimal 1 MB.",
                );
              const d = await request(chosen, "inspect");
              if (version === sequence.current) {
                setFile(chosen);
                setSheets(d.sheets);
                onFeedback("Pilih lembar XLSX yang akan digunakan.");
              }
            });
          }}
        />
      </label>
      {converted && (
        <>
          <p>
            Lembar <strong>{sheet}</strong> sudah dibaca. Hasilnya ada pada CSV
            di bawah dan tetap perlu dipratinjau sebelum disimpan.
          </p>
          <button
            className="btn outline"
            disabled={disabled}
            onClick={() => {
              setConverted(false);
              onLoad("");
            }}
          >
            Ubah lembar atau pemetaan XLSX {label}
          </button>
        </>
      )}
      {!!sheets.length && !converted && (
        <>
          <p>
            XLSX dibaca sebagai tabel nilai. Simpan nomor kamar, nama,
            referensi, dan telepon sebagai Text; tanggal memakai sel tanggal
            Excel atau teks YYYY-MM-DD. Pilih lembar dan pemetaan sebelum
            melanjutkan ke pratinjau.
          </p>
          <label>
            Lembar XLSX {label}
            <select
              value={sheet}
              disabled={disabled}
              onChange={(e) => {
                const name = e.target.value;
                setSheet(name);
                setHeaders([]);
                onLoad("");
                if (!name || !file) return;
                void run(async () => {
                  const d = await request(file, "headers", name);
                  setHeaders(d.headers);
                  setMapping(
                    Object.fromEntries(
                      Object.keys(fields[kind]).map((k, i) => [k, i]),
                    ),
                  );
                  onFeedback("Petakan kolom XLSX, lalu gunakan lembar ini.");
                });
              }}
            >
              <option value="">Pilih lembar</option>
              {sheets.map((s) => (
                <option value={s} key={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          {!!headers.length && (
            <>
              <div className="bo-import-mapping">
                {Object.entries(fields[kind]).map(([k, title]) => (
                  <label key={k}>
                    XLSX: {title}
                    <select
                      value={mapping[k]}
                      disabled={disabled}
                      onChange={(e) => {
                        setMapping({ ...mapping, [k]: Number(e.target.value) });
                        onLoad("");
                      }}
                    >
                      {headers.map((h, i) => (
                        <option key={i} value={i}>
                          {i + 1}. {h}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
              <button
                className="btn outline"
                disabled={disabled}
                onClick={() => {
                  if (!file) return;
                  void run(async () => {
                    const d = await request(file, "convert", sheet, mapping);
                    onLoad(d.csv);
                    setConverted(true);
                    onFeedback(
                      `${d.records} baris dari lembar ${sheet} siap. Tinjau CSV hasil baca dan jalankan pratinjau impor sebelum menyimpan.`,
                    );
                  });
                }}
              >
                Gunakan lembar XLSX {label}
              </button>
            </>
          )}
        </>
      )}
    </div>
  );
}
