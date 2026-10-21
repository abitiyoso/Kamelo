"use client";
import { useEffect, useRef, useState } from "react";
import { readCsvTable } from "@/lib/room-import-csv.mjs";
import { residentColumns } from "@/lib/resident-import-csv.mjs";
import { ImportFileInput } from "./import-file";
import { rupiah } from "@/lib/plans";
type Row = {
  line: number;
  number: string;
  name: string;
  phone: string;
  start: string;
  end: string | null;
  rate: number;
  billingDay: number;
  errors: string[];
  guestId: string;
  candidates: { id: string; name: string; phone: string }[];
};
type Preview = {
  rows: Row[];
  valid: boolean;
  digest: string;
  automation: { billing: boolean; locks: boolean };
};
type Batch = {
  id: string;
  recordCount: number;
  status: string;
  createdAt: string;
};
const labels = {
  number: "Nomor kamar",
  name: "Nama penghuni",
  phone: "Telepon",
  start: "Tanggal mulai",
  end: "Tanggal akhir",
  rate: "Tarif",
  billingDay: "Hari jatuh tempo",
};
export function ResidentImportCenter({
  propertyId,
  onChange,
}: {
  propertyId: string;
  onChange: () => void;
}) {
  const [open, setOpen] = useState(false),
    [csv, setCsv] = useState(""),
    [mapping, setMapping] = useState(residentColumns),
    [choices, setChoices] = useState<Record<string, string>>({}),
    [preview, setPreview] = useState<Preview | null>(null),
    [rows, setRows] = useState<Batch[]>([]),
    [busy, setBusy] = useState(false),
    [feedback, setFeedback] = useState(""),
    [confirmed, setConfirmed] = useState(false),
    [rollback, setRollback] = useState("");
  const active = useRef(false),
    keys = useRef(new Map<string, string>()),
    feedbackRef = useRef<HTMLParagraphElement>(null);
  let headers: string[] = [];
  try {
    headers = readCsvTable(csv).headers;
  } catch {}
  async function history() {
    const r = await fetch(
        `/api/resident-imports?propertyId=${encodeURIComponent(propertyId)}`,
        { cache: "no-store" },
      ),
      d = await r.json();
    if (!r.ok) throw Error(d.error);
    setRows(d.rows);
  }
  useEffect(() => {
    if (open) void history().catch((e) => setFeedback(e.message));
  }, [open, propertyId]);
  function reset() {
    setPreview(null);
    setConfirmed(false);
    setChoices({});
    setFeedback("");
  }
  async function send(action: string, batchId?: string) {
    if (active.current) return;
    active.current = true;
    setBusy(true);
    setFeedback("");
    try {
      const body =
        action === "rollback"
          ? { action, batchId, confirmed: rollback === batchId }
          : {
              action,
              propertyId,
              csv,
              mapping,
              choices,
              digest: preview?.digest,
              confirmed,
            };
      const hash = JSON.stringify(body);
      let key = keys.current.get(hash);
      if (!key) {
        key = crypto.randomUUID();
        keys.current.set(hash, key);
      }
      const r = await fetch("/api/resident-imports", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...body, key }),
        }),
        d = await r.json();
      if (!r.ok) throw Error(d.error);
      if (action === "preview") {
        setPreview(d.result);
        setConfirmed(false);
        setFeedback(
          d.result.valid
            ? "Pratinjau siap. Tinjau profil, periode, dan dampak otomatisasi sebelum menyimpan."
            : "Perbaiki baris bermasalah atau pilih profil yang cocok, lalu pratinjau ulang.",
        );
      } else {
        setPreview(null);
        setConfirmed(false);
        setRollback("");
        setFeedback(
          action === "commit"
            ? `${d.result.count} masa tinggal berhasil diimpor.`
            : "Impor dibatalkan. Profil lama tetap disimpan.",
        );
        onChange();
        try {
          await history();
        } catch {
          setFeedback(
            "Perubahan tersimpan. Buka ulang panel untuk memuat riwayat terbaru.",
          );
        }
      }
    } catch (e) {
      setFeedback(
        e instanceof Error ? e.message : "Impor belum dapat diproses.",
      );
    } finally {
      active.current = false;
      setBusy(false);
      requestAnimationFrame(() => feedbackRef.current?.focus());
    }
  }
  return (
    <section className="panel bo-room-import" aria-label="Impor penghuni CSV">
      <button
        className="btn outline"
        aria-expanded={open}
        disabled={busy}
        onClick={() => setOpen(!open)}
      >
        {open ? "Tutup impor penghuni" : "Impor penghuni dari CSV / XLSX"}
      </button>
      {open && (
        <div className="bo-import-body">
          <h2>Tambahkan penghuni ke kamar yang sudah ada</h2>
          <p>
            Maksimal 50 baris / 100 KB CSV UTF-8, pemisah koma. Tujuh kolom
            wajib tersedia; tanggal akhir boleh kosong untuk kos, wajib untuk
            hotel. Tanggal YYYY-MM-DD, tarif rupiah bulat, hari jatuh tempo
            1–31.
          </p>
          <p>
            Profil lama tidak ditimpa. Jika nama atau telepon cocok, pilih
            profil secara eksplisit. Akun tenant, undangan, kontrak, deposit,
            dan saldo awal tidak dibuat oleh impor ini. Saldo/tagihan lama tidak
            diimpor.
          </p>
          <a
            className="text-link"
            href="/templates/kamelo-penghuni.csv"
            download="kamelo-template-penghuni.csv"
          >
            Unduh contoh CSV penghuni
          </a>
          <a
            className="text-link"
            href="/templates/kamelo-penghuni.xlsx"
            download="kamelo-template-penghuni.xlsx"
          >
            Unduh contoh XLSX penghuni
          </a>
          <ImportFileInput
            kind="residents"
            disabled={busy}
            onBusy={setBusy}
            onFeedback={setFeedback}
            onLoad={(text) => {
              setCsv(text);
              reset();
              setMapping(residentColumns);
            }}
          />
          <label>
            Isi CSV penghuni
            <textarea
              rows={5}
              maxLength={100000}
              value={csv}
              disabled={busy}
              onChange={(e) => {
                setCsv(e.target.value);
                reset();
              }}
            />
          </label>
          {!!headers.length && (
            <div className="bo-import-mapping">
              {(Object.keys(labels) as (keyof typeof labels)[]).map((k) => (
                <label key={k}>
                  Kolom {labels[k].toLowerCase()}
                  <select
                    value={mapping[k]}
                    disabled={busy}
                    onChange={(e) => {
                      setMapping({ ...mapping, [k]: Number(e.target.value) });
                      reset();
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
          )}
          <button
            className="btn outline"
            disabled={busy || !csv}
            onClick={() => void send("preview")}
          >
            Pratinjau penghuni
          </button>
          {preview && (
            <>
              <p>
                Otomatisasi tagihan properti:{" "}
                <strong>
                  {preview.automation.billing ? "aktif" : "nonaktif"}
                </strong>
                . Kunci otomatis pada kamar impor:{" "}
                <strong>
                  {preview.automation.locks ? "ada" : "tidak ada"}
                </strong>
                . Masa tinggal kos menjadi aktif; hotel menjadi reservasi
                terkonfirmasi. Aturan operasional yang sudah aktif berlaku
                setelah impor; sinkronisasi kunci mengikuti alur masa tinggal
                biasa. Aktivitas turunan dapat mengunci pembatalan.
              </p>
              <div
                className="bo-import-table"
                role="region"
                aria-label="Pratinjau penghuni"
                tabIndex={0}
              >
                <table>
                  <thead>
                    <tr>
                      <th>Baris / kamar</th>
                      <th>Penghuni / profil</th>
                      <th>Periode</th>
                      <th>Tarif / jatuh tempo</th>
                      <th>Validasi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((r) => (
                      <tr key={r.line}>
                        <td>
                          {r.line} / {r.number}
                        </td>
                        <td>
                          {r.name}
                          <br />
                          {r.phone}
                          {r.candidates.length ? (
                            <label>
                              Profil untuk baris {r.line}
                              <select
                                value={choices[String(r.line)] || ""}
                                disabled={busy}
                                onChange={(e) => {
                                  setChoices({
                                    ...choices,
                                    [String(r.line)]: e.target.value,
                                  });
                                  setConfirmed(false);
                                  setPreview({ ...preview, valid: false });
                                }}
                              >
                                <option value="">Pilih profil lama</option>
                                {r.candidates.map((c) => (
                                  <option key={c.id} value={c.id}>
                                    {c.name} ({c.phone})
                                  </option>
                                ))}
                              </select>
                            </label>
                          ) : (
                            <p>Profil baru</p>
                          )}
                        </td>
                        <td>
                          {r.start} → {r.end || "Tanpa tanggal akhir"}
                        </td>
                        <td>
                          {rupiah(r.rate)} / tanggal {r.billingDay}
                        </td>
                        <td>{r.errors.join(" ") || "Siap disimpan"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <label className="bo-import-confirm">
                <input
                  type="checkbox"
                  checked={confirmed}
                  disabled={busy || !preview.valid}
                  onChange={(e) => setConfirmed(e.target.checked)}
                />
                Saya sudah memeriksa properti, identitas/profil yang dipakai,
                tanggal, tarif, dan jatuh tempo. Saya memahami otomatisasi yang
                aktif tetap berlaku.
              </label>
              <button
                className="btn"
                disabled={busy || !preview.valid || !confirmed}
                onClick={() => void send("commit")}
              >
                Simpan {preview.rows.length} masa tinggal
              </button>
            </>
          )}
          <p ref={feedbackRef} tabIndex={-1} role="status" aria-live="polite">
            {busy ? "Memproses impor penghuni…" : feedback}
          </p>
          <h3>20 impor penghuni terakhir</h3>
          <p>
            Pembatalan hanya jika semua masa tinggal tetap sama dan belum
            memiliki tagihan, kontrak, deposit, akses, undangan, pesan,
            transfer, atau aktivitas lain. Profil baru juga harus belum
            diubah/digunakan. Profil lama selalu dipertahankan.
          </p>
          {!rows.length && <p>Belum ada riwayat impor yang dimuat.</p>}
          {rows.map((b) => (
            <div className="bo-import-history" key={b.id}>
              <span>
                {new Intl.DateTimeFormat("id-ID", {
                  dateStyle: "medium",
                  timeStyle: "short",
                  timeZone: "Asia/Jakarta",
                }).format(new Date(b.createdAt))}{" "}
                · {b.recordCount} masa tinggal ·{" "}
                {b.status === "COMMITTED" ? "Tersimpan" : "Dibatalkan"}
              </span>
              {b.status === "COMMITTED" &&
                (rollback === b.id ? (
                  <>
                    <p>
                      Batalkan seluruh {b.recordCount} masa tinggal dari batch
                      ini?
                    </p>
                    <button
                      className="btn outline"
                      disabled={busy}
                      onClick={() => void send("rollback", b.id)}
                    >
                      Konfirmasi pembatalan penghuni
                    </button>
                    <button
                      className="text-link"
                      disabled={busy}
                      onClick={() => setRollback("")}
                    >
                      Kembali
                    </button>
                  </>
                ) : (
                  <button
                    className="btn outline"
                    disabled={busy}
                    onClick={() => setRollback(b.id)}
                  >
                    Batalkan impor penghuni
                  </button>
                ))}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
