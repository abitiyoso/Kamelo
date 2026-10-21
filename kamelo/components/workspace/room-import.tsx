"use client";
import { useEffect, useRef, useState } from "react";
import { readRoomCsv } from "@/lib/room-import-csv.mjs";
import { ImportFileInput } from "./import-file";
import { rupiah } from "@/lib/plans";
type Preview = ReturnType<typeof readRoomCsv> & {
  digest: string;
  valid: boolean;
  capacityError: string;
};
type Batch = {
  id: string;
  roomCount: number;
  status: string;
  createdAt: string;
};
export function RoomImportCenter({
  propertyId,
  onChange,
}: {
  propertyId: string;
  onChange: () => void;
}) {
  const [open, setOpen] = useState(false),
    [csv, setCsv] = useState(""),
    [mapping, setMapping] = useState({ number: 0, rate: 1 });
  const [preview, setPreview] = useState<Preview | null>(null),
    [rows, setRows] = useState<Batch[]>([]),
    [busy, setBusy] = useState(false),
    [feedback, setFeedback] = useState("");
  const [confirmed, setConfirmed] = useState(false),
    [rollback, setRollback] = useState("");
  const keys = useRef(new Map<string, string>()),
    active = useRef(false),
    feedbackRef = useRef<HTMLParagraphElement>(null);
  let headers: string[] = [];
  try {
    headers = readRoomCsv(csv).headers;
  } catch {}
  async function history() {
    const r = await fetch(
      `/api/room-imports?propertyId=${encodeURIComponent(propertyId)}`,
      { cache: "no-store" },
    );
    const d = await r.json();
    if (!r.ok) throw Error(d.error);
    setRows(d.rows);
  }
  useEffect(() => {
    if (open) void history().catch((e) => setFeedback(e.message));
  }, [open, propertyId]);
  function reset() {
    setPreview(null);
    setConfirmed(false);
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
              digest: preview?.digest,
              confirmed,
            };
      const hash = JSON.stringify(body);
      let key = keys.current.get(hash);
      if (!key) {
        key = crypto.randomUUID();
        keys.current.set(hash, key);
      }
      const r = await fetch("/api/room-imports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, key }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      if (action === "preview") {
        setPreview(d.result);
        setConfirmed(false);
        setFeedback(
          d.result.valid
            ? "Pratinjau siap. Tinjau semua baris sebelum menyimpan."
            : "Ada masalah pada CSV. Perbaiki lalu pratinjau ulang.",
        );
      } else {
        setPreview(null);
        setConfirmed(false);
        setRollback("");
        setFeedback(
          action === "commit"
            ? `${d.result.count} kamar berhasil diimpor.`
            : "Impor dibatalkan; kamar yang belum digunakan telah dihapus.",
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
    <section className="panel bo-room-import" aria-label="Impor kamar CSV">
      <button
        className="btn outline"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        disabled={busy}
      >
        {open ? "Tutup impor kamar" : "Impor kamar dari CSV / XLSX"}
      </button>
      {open && (
        <div className="bo-import-body">
          <h2>Mulai dari data kamar Anda</h2>
          <p>
            Tambahkan kamar baru ke properti ini. Maksimal 100 baris / 100 KB,
            format CSV UTF-8 dengan pemisah koma. Tarif dalam rupiah bulat,
            tanpa titik atau koma. Kamar lama tidak ditimpa.
          </p>
          <p>
            Tarif mengikuti periode properti: bulanan untuk kos, per malam untuk
            hotel. Data penghuni dan saldo awal belum termasuk impor ini.
          </p>
          <a
            className="text-link"
            download="kamelo-template-kamar.csv"
            href="/templates/kamelo-kamar.csv"
          >
            Unduh contoh CSV
          </a>
          <a
            className="text-link"
            href="/templates/kamelo-kamar.xlsx"
            download="kamelo-template-kamar.xlsx"
          >
            Unduh contoh XLSX
          </a>
          <ImportFileInput
            kind="rooms"
            disabled={busy}
            onBusy={setBusy}
            onFeedback={setFeedback}
            onLoad={(text) => {
              setCsv(text);
              reset();
              setMapping({ number: 0, rate: 1 });
            }}
          />
          <label>
            Atau tempel isi CSV
            <textarea
              rows={5}
              maxLength={100000}
              value={csv}
              disabled={busy}
              placeholder={"nomor,tarif\nK-01,1500000"}
              onChange={(e) => {
                setCsv(e.target.value);
                reset();
              }}
            />
          </label>
          {!!headers.length && (
            <div className="bo-import-mapping">
              {(["number", "rate"] as const).map((field) => (
                <label key={field}>
                  {field === "number" ? "Kolom nomor kamar" : "Kolom tarif"}
                  <select
                    disabled={busy}
                    value={mapping[field]}
                    onChange={(e) => {
                      setMapping({
                        ...mapping,
                        [field]: Number(e.target.value),
                      });
                      reset();
                    }}
                  >
                    {headers.map((h, i) => (
                      <option value={i} key={i}>
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
            Pratinjau impor
          </button>
          {preview && (
            <>
              {preview.capacityError && (
                <p role="alert">{preview.capacityError}</p>
              )}
              <div
                className="bo-import-table"
                tabIndex={0}
                role="region"
                aria-label="Pratinjau kamar"
              >
                <table>
                  <thead>
                    <tr>
                      <th>Baris</th>
                      <th>Nomor</th>
                      <th>Tarif</th>
                      <th>Validasi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((r) => (
                      <tr key={r.line}>
                        <td>{r.line}</td>
                        <td>{r.number}</td>
                        <td>{rupiah(r.rate)}</td>
                        <td>{r.errors.join(" ") || "Siap ditambahkan"}</td>
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
                Saya sudah memeriksa nomor, tarif, dan properti tujuan.
                Tambahkan {preview.rows.length} kamar baru.
              </label>
              <button
                className="btn"
                disabled={busy || !preview.valid || !confirmed}
                onClick={() => void send("commit")}
              >
                Simpan {preview.rows.length} kamar
              </button>
            </>
          )}
          <p ref={feedbackRef} tabIndex={-1} role="status" aria-live="polite">
            {busy ? "Memproses impor…" : feedback}
          </p>
          <h3>20 impor terakhir pada properti ini</h3>
          <p>
            Pembatalan berlaku untuk seluruh batch dan hanya jika semua kamar
            masih sama dan belum dipakai untuk penghuni, tagihan, perangkat,
            atau prospek.
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
                · {b.roomCount} kamar ·{" "}
                {b.status === "COMMITTED" ? "Tersimpan" : "Dibatalkan"}
              </span>
              {b.status === "COMMITTED" && (
                <>
                  {rollback === b.id ? (
                    <>
                      <label className="bo-import-confirm">
                        <input
                          type="checkbox"
                          checked
                          disabled={busy}
                          onChange={() => setRollback("")}
                        />
                        Batalkan seluruh {b.roomCount} kamar dari impor ini.
                      </label>
                      <button
                        className="btn outline"
                        disabled={busy}
                        onClick={() => void send("rollback", b.id)}
                      >
                        Konfirmasi pembatalan
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
                      Batalkan impor
                    </button>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
