"use client";
import { useEffect, useRef, useState } from "react";
import { ImportFileInput } from "./import-file";
import { OpeningReceipts } from "./opening-receipts";
import { readCsvTable } from "@/lib/room-import-csv.mjs";
import { openingColumns } from "@/lib/opening-balances-csv.mjs";
import { rupiah } from "@/lib/plans";
import { tenantToday } from "@/lib/tenant-types";
const labels = {
  name: "Nama penghuni",
  phone: "Telepon",
  reference: "Referensi sumber",
  amount: "Saldo piutang",
  due: "Jatuh tempo",
};
export function OpeningBalanceRegistry({
  propertyId,
  onChange,
}: {
  propertyId: string;
  onChange: () => void;
}) {
  const [open, setOpen] = useState(false),
    [csv, setCsv] = useState(""),
    [asOf, setAsOf] = useState(tenantToday()),
    [sourceNote, setSourceNote] = useState(""),
    [mapping, setMapping] = useState(openingColumns),
    [choices, setChoices] = useState<Record<string, string>>({}),
    [preview, setPreview] = useState<any>(null),
    [confirmed, setConfirmed] = useState(false),
    [busy, setBusy] = useState(false),
    [feedback, setFeedback] = useState(""),
    [data, setData] = useState<any>(null),
    [page, setPage] = useState(1),
    [detailId, setDetailId] = useState(""),
    [reason, setReason] = useState(""),
    [voidConfirmed, setVoidConfirmed] = useState(false);
  const [receiptId, setReceiptId] = useState("");
  const active = useRef(false),
    keys = useRef(new Map<string, string>()),
    feedbackRef = useRef<HTMLParagraphElement>(null),
    detailRef = useRef<HTMLHeadingElement>(null),
    loadSequence = useRef(0);
  let headers: string[] = [];
  try {
    headers = readCsvTable(csv).headers;
  } catch {}
  async function load() {
    const seq = ++loadSequence.current,
      r = await fetch(
        `/api/opening-balances?propertyId=${encodeURIComponent(propertyId)}&page=${page}${detailId ? "&batchId=" + encodeURIComponent(detailId) : ""}`,
        { cache: "no-store" },
      ),
      d = await r.json();
    if (!r.ok) throw Error(d.error);
    if (seq === loadSequence.current) setData(d);
  }
  useEffect(() => {
    if (open) void load().catch((e) => setFeedback(e.message));
    return () => {
      loadSequence.current++;
    };
  }, [open, page, detailId, propertyId]);
  useEffect(() => {
    if (open && data?.detail?.id === detailId) detailRef.current?.focus();
  }, [data?.detail?.id, detailId, open]);
  function reset() {
    setPreview(null);
    setChoices({});
    setConfirmed(false);
    setFeedback("");
  }
  async function send(action: string) {
    if (active.current) return;
    active.current = true;
    setBusy(true);
    setFeedback("");
    try {
      const body =
        action === "void"
          ? { action, batchId: detailId, reason, confirmed: voidConfirmed }
          : {
              action,
              propertyId,
              csv,
              mapping,
              choices,
              asOf,
              sourceNote,
              digest: preview?.digest,
              confirmed,
            };
      const hash = JSON.stringify(body);
      let key = keys.current.get(hash);
      if (!key) {
        key = crypto.randomUUID();
        keys.current.set(hash, key);
      }
      const r = await fetch("/api/opening-balances", {
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
            ? "Pratinjau siap. Periksa sumber, nominal, dan profil sebelum menyimpan."
            : "Perbaiki baris atau pilih profil, lalu pratinjau ulang.",
        );
      } else {
        reset();
        setReason("");
        setVoidConfirmed(false);
        setFeedback(
          action === "commit"
            ? `${d.result.count} saldo awal piutang tercatat. Kas dan tagihan berjalan tetap terpisah.`
            : "Pencatatan saldo awal dibatalkan; riwayat tetap tersimpan.",
        );
        try {
          await load();
        } catch {
          setFeedback(
            "Perubahan tersimpan. Buka ulang panel untuk memuat riwayat terbaru.",
          );
        }
      }
    } catch (e) {
      setFeedback(
        e instanceof Error ? e.message : "Saldo awal belum dapat diproses.",
      );
    } finally {
      active.current = false;
      setBusy(false);
      requestAnimationFrame(() => feedbackRef.current?.focus());
    }
  }
  const detail = data?.detail;
  return (
    <section
      className="panel bo-room-import"
      aria-label="Register saldo awal piutang"
    >
      <button
        className="btn outline"
        aria-expanded={open}
        disabled={busy}
        onClick={() => setOpen(!open)}
      >
        {open ? "Tutup saldo awal" : "Saldo awal piutang"}
      </button>
      {open && (
        <div className="bo-import-body">
          <h2>Piutang lama, tercatat dengan sumbernya</h2>
          <p>
            Saldo sebelum memakai Kamelo ditampilkan terpisah dari kas, deposit,
            dan tagihan berjalan. Penerimaan sebagian atau penuh dapat dicatat
            melalui rincian saldo dan akan masuk ke laporan kas. Bagikan saldo
            secara eksplisit ke akun penghuni untuk menerima bukti bayar;
            unggahan perlu diperiksa owner sebelum memengaruhi kas. Pengingat
            portal untuk saldo jatuh tempo tersedia di rincian; email dan
            WhatsApp belum dikirim.
          </p>
          {data && (
            <p>
              <strong>Saldo aktif {rupiah(data.summary.total)}</strong> ·{" "}
              {data.summary.count} catatan belum lunas · jatuh tempo lewat{" "}
              {rupiah(data.summary.overdue)}. Ringkasan mencakup seluruh tanggal
              saldo awal pada properti pilihan, di luar filter periode kas.
            </p>
          )}
          {propertyId === "all" ? (
            <p>
              Pilih satu properti pada filter Keuangan untuk mengimpor saldo
              awal.
            </p>
          ) : (
            <>
              <label>
                Tanggal saldo awal
                <input
                  type="date"
                  min="1900-01-01"
                  max={tenantToday()}
                  value={asOf}
                  disabled={busy}
                  onChange={(e) => {
                    setAsOf(e.target.value);
                    reset();
                  }}
                />
              </label>
              <label>
                Sumber dan cakupan saldo (minimal 10 karakter)
                <textarea
                  rows={2}
                  maxLength={1000}
                  value={sourceNote}
                  disabled={busy}
                  onChange={(e) => {
                    setSourceNote(e.target.value);
                    reset();
                  }}
                />
              </label>
              <p>
                Gunakan saldo piutang positif yang belum lunas pada tanggal di
                atas. Setiap baris perlu referensi dokumen sumber dan profil
                penghuni yang sudah ada. Pastikan nilai belum dicatat dalam
                tagihan Kamelo.
              </p>
              <a
                className="text-link"
                href="/templates/kamelo-saldo-awal.csv"
                download
              >
                Unduh contoh CSV saldo awal
              </a>
              <a
                className="text-link"
                href="/templates/kamelo-saldo-awal.xlsx"
                download
              >
                Unduh contoh XLSX saldo awal
              </a>
              <ImportFileInput
                kind="balances"
                disabled={busy}
                onBusy={setBusy}
                onFeedback={setFeedback}
                onLoad={(text) => {
                  setCsv(text);
                  setMapping(openingColumns);
                  reset();
                }}
              />
              <label>
                Isi CSV saldo awal
                <textarea
                  rows={4}
                  value={csv}
                  maxLength={100000}
                  disabled={busy}
                  onChange={(e) => {
                    setCsv(e.target.value);
                    reset();
                  }}
                />
              </label>
              {!!headers.length && (
                <div className="bo-import-mapping">
                  {Object.entries(labels).map(([k, title]) => (
                    <label key={k}>
                      Kolom {title.toLowerCase()}
                      <select
                        disabled={busy}
                        value={mapping[k as keyof typeof mapping]}
                        onChange={(e) => {
                          setMapping({
                            ...mapping,
                            [k]: Number(e.target.value),
                          });
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
                disabled={
                  busy || !csv || !asOf || sourceNote.trim().length < 10
                }
                onClick={() => void send("preview")}
              >
                Pratinjau saldo awal
              </button>
              {preview && (
                <>
                  <p>
                    Total pratinjau: <strong>{rupiah(preview.total)}</strong>{" "}
                    per {asOf}.
                  </p>
                  <div
                    className="bo-import-table"
                    role="region"
                    aria-label="Pratinjau saldo awal"
                    tabIndex={0}
                  >
                    <table>
                      <thead>
                        <tr>
                          <th>Baris / penghuni</th>
                          <th>Referensi</th>
                          <th>Saldo / jatuh tempo</th>
                          <th>Profil / validasi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.rows.map((r: any) => (
                          <tr key={r.line}>
                            <td>
                              {r.line} · {r.name}
                              <br />
                              {r.phone}
                            </td>
                            <td>{r.reference}</td>
                            <td>
                              {rupiah(r.amount)}
                              <br />
                              {r.due}
                            </td>
                            <td>
                              <label>
                                Profil saldo awal baris {r.line}
                                <select
                                  disabled={busy}
                                  value={choices[String(r.line)] || ""}
                                  onChange={(e) => {
                                    setChoices({
                                      ...choices,
                                      [String(r.line)]: e.target.value,
                                    });
                                    setPreview({ ...preview, valid: false });
                                    setConfirmed(false);
                                  }}
                                >
                                  <option value="">Pilih profil</option>
                                  {r.candidates.map((g: any) => (
                                    <option value={g.id} key={g.id}>
                                      {g.name} ({g.phone})
                                    </option>
                                  ))}
                                </select>
                              </label>
                              {r.errors.join(" ") || "Siap dicatat"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <label className="bo-import-confirm">
                    <input
                      type="checkbox"
                      disabled={busy || !preview.valid}
                      checked={confirmed}
                      onChange={(e) => setConfirmed(e.target.checked)}
                    />
                    Saya telah memeriksa sumber, profil, nominal, dan tanggal;
                    saldo ini belum dimasukkan ke tagihan Kamelo serta bukan
                    deposit atau penerimaan kas.
                  </label>
                  <button
                    className="btn"
                    disabled={busy || !preview.valid || !confirmed}
                    onClick={() => void send("commit")}
                  >
                    Catat {preview.rows.length} saldo awal
                  </button>
                </>
              )}
            </>
          )}
          <p ref={feedbackRef} tabIndex={-1} role="status" aria-live="polite">
            {busy ? "Memproses saldo awal…" : feedback}
          </p>
          <h3>Riwayat pencatatan</h3>
          {data?.batches.map((b: any) => (
            <div className="bo-import-history" key={b.id}>
              <span>
                {b.property.name} · per {b.asOf} · {b.recordCount} catatan ·{" "}
                {b.status === "OPEN" ? "Aktif" : "Dibatalkan"}
              </span>
              <button
                className="btn outline"
                disabled={busy}
                onClick={() => {
                  setDetailId(b.id);
                  setReceiptId("");
                  setReason("");
                  setVoidConfirmed(false);
                }}
              >
                Rincian batch {b.id.slice(-6)}
              </button>
            </div>
          ))}
          {data && !data.batches.length && (
            <p>Belum ada pencatatan pada halaman ini.</p>
          )}
          {data && (
            <div className="bo-import-history">
              <button
                className="btn outline"
                disabled={busy || page === 1}
                onClick={() => {
                  setPage(page - 1);
                  setDetailId("");
                }}
              >
                Sebelumnya
              </button>
              <span>
                Halaman {page} · {data.totalBatches} batch
              </span>
              <button
                className="btn outline"
                disabled={busy || page * 20 >= data.totalBatches}
                onClick={() => {
                  setPage(page + 1);
                  setDetailId("");
                }}
              >
                Berikutnya
              </button>
            </div>
          )}
          {detail && (
            <>
              <h3 ref={detailRef} tabIndex={-1}>
                Rincian saldo awal per {detail.asOf}
              </h3>
              <p>
                {detail.property.name} ·{" "}
                {detail.status === "OPEN" ? "Aktif" : "Dibatalkan"}
              </p>
              <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                {detail.sourceNote}
              </p>
              <div
                className="bo-import-table"
                role="region"
                aria-label="Rincian saldo awal"
                tabIndex={0}
              >
                <table>
                  <thead>
                    <tr>
                      <th>Penghuni</th>
                      <th>Referensi</th>
                      <th>Saldo</th>
                      <th>Jatuh tempo</th>
                      <th>Penerimaan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.rows.map((r: any) => (
                      <tr key={r.id}>
                        <td>{r.guest.name}</td>
                        <td>{r.reference}</td>
                        <td>{rupiah(r.amount)}</td>
                        <td>{r.due}</td>
                        <td>
                          <button
                            className="btn outline"
                            disabled={busy}
                            onClick={() => setReceiptId(r.id)}
                          >
                            Tinjau penerimaan {r.reference}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {receiptId && (
                <OpeningReceipts
                  key={receiptId}
                  id={receiptId}
                  propertyId={propertyId}
                  onChange={() => {
                    void load();
                    onChange();
                  }}
                />
              )}
              {detail.status === "OPEN" &&
              !detail.rows.some(
                (r: any) => r._count.entries > 0 || r._count.proofs > 0,
              ) ? (
                <>
                  <label>
                    Alasan pembatalan seluruh batch (minimal 10 karakter)
                    <textarea
                      value={reason}
                      maxLength={1000}
                      disabled={busy}
                      onChange={(e) => setReason(e.target.value)}
                    />
                  </label>
                  <label className="bo-import-confirm">
                    <input
                      type="checkbox"
                      checked={voidConfirmed}
                      disabled={busy}
                      onChange={(e) => setVoidConfirmed(e.target.checked)}
                    />
                    Batalkan seluruh pencatatan batch ini. Riwayat sumber tetap
                    disimpan.
                  </label>
                  <button
                    className="btn outline"
                    disabled={
                      busy || !voidConfirmed || reason.trim().length < 10
                    }
                    onClick={() => void send("void")}
                  >
                    Batalkan pencatatan saldo awal
                  </button>
                </>
              ) : detail.status === "OPEN" ? (
                <p>
                  Batch memiliki riwayat penerimaan. Koreksi catatan penerimaan
                  bila diperlukan; sumber saldo awal tetap disimpan.
                </p>
              ) : (
                <p>Alasan pembatalan: {detail.voidReason}</p>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}
