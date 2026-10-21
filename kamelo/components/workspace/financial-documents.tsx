"use client";
import { useEffect, useRef, useState } from "react";
import { WorkspaceCard } from "./card";
import { rupiah } from "@/lib/plans";
const status = (s: string) =>
  ({
    ACTIVE: "Aktif",
    PARTIALLY_REFUNDED: "Sebagian dikembalikan",
    REFUNDED: "Dikembalikan penuh",
    CORRECTED: "Penerimaan dikoreksi",
  })[s] || s;
export function FinancialDocuments({
  propertyId = "all",
  tenant = false,
}: {
  propertyId?: string;
  tenant?: boolean;
}) {
  const [data, setData] = useState<any>(null),
    [page, setPage] = useState(1),
    [selected, setSelected] = useState<any>(null),
    [review, setReview] = useState<any>(null),
    [action, setAction] = useState("KEEP"),
    [date, setDate] = useState(""),
    [note, setNote] = useState(""),
    [confirmed, setConfirmed] = useState(false),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(false),
    [message, setMessage] = useState("");
  const seq = useRef(0),
    active = useRef(false),
    keys = useRef(new Map<string, string>());
  async function call(url: string, body?: unknown) {
    const r = await fetch(url, {
        cache: "no-store",
        ...(body
          ? {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
            }
          : {}),
      }),
      d = await r.json();
    if (!r.ok) throw Error(d.error);
    return d;
  }
  async function load() {
    const n = ++seq.current;
    setLoading(true);
    try {
      const d = await call(
        `/api/financial-documents?propertyId=${encodeURIComponent(propertyId)}&page=${page}`,
      );
      if (n === seq.current) setData(d);
    } finally {
      if (n === seq.current) setLoading(false);
    }
  }
  useEffect(() => {
    setSelected(null);
    setReview(null);
    setMessage("");
    void load().catch((e) => {
      setData(null);
      setMessage(e.message);
    });
    return () => {
      seq.current++;
    };
  }, [propertyId, page]);
  async function send() {
    if (active.current || loading) return;
    active.current = true;
    setBusy(true);
    setMessage("");
    try {
      const body = selected
        ? {
            action: "issue",
            source: selected.source,
            entryId: selected.id,
            digest: selected.digest,
            confirmed,
          }
        : {
            action: "review",
            documentId: review.id,
            revision: review.review.revision,
            retentionAction: action,
            reviewOn: date || null,
            note,
            confirmed,
          };
      const fingerprint = JSON.stringify(body);
      if (!keys.current.has(fingerprint))
        keys.current.set(fingerprint, crypto.randomUUID());
      const response = await call("/api/financial-documents", {
        ...body,
        key: keys.current.get(fingerprint),
      });
      setSelected(null);
      setReview(null);
      setConfirmed(false);
      await load();
      setMessage(
        body.action === "issue"
          ? `Kuitansi ${response.result.number} diterbitkan. Tidak menambah penerimaan atau mengirim email.`
          : "Peninjauan arsip tercatat. Dokumen tetap disimpan.",
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Arsip belum diproses.");
    } finally {
      active.current = false;
      setBusy(false);
    }
  }
  const reset = () => {
    setConfirmed(false);
    setMessage("");
  };
  async function reviewHistory(id: string, page = 1, initialize = false) {
    setBusy(true);
    try {
      const d = await call(
        `/api/financial-documents?id=${id}&reviewPage=${page}`,
      );
      if (initialize) {
        setReview(d);
        setAction(d.review.action);
        setDate(d.review.reviewOn || "");
        setNote(d.review.note);
        setConfirmed(false);
      } else
        setReview((old: any) =>
          old?.id === id ? { ...old, reviewHistory: d.reviewHistory } : old,
        );
    } catch (e) {
      if (initialize) setReview(null);
      setMessage(e instanceof Error ? e.message : "Riwayat tidak tersedia.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section aria-label="Kuitansi pembayaran" style={{ marginBottom: 24 }}>
      <WorkspaceCard
        title="Kuitansi pembayaran"
        description="Arsip penerimaan yang dapat diperiksa dan dicetak."
      >
        <p>
          Kuitansi mengikuti penerimaan yang sudah tercatat. Status koreksi dan
          refund diperiksa kembali saat dibuka. Salinan unduhan dapat
          kedaluwarsa; gunakan status portal terbaru.
        </p>
        {message && <p role="status">{message}</p>}
        {!data ? (
          <button
            className="btn outline"
            onClick={() => void load().catch((e) => setMessage(e.message))}
          >
            {message ? "Coba muat arsip lagi" : "Memuat arsip…"}
          </button>
        ) : (
          <>
            {!tenant && (
              <details>
                <summary>
                  Penerimaan siap diterbitkan ({data.candidates.length}
                  {data.candidates.length === 20 ? "+" : ""})
                </summary>
                {data.candidates.length ? (
                  data.candidates.map((r: any) => (
                    <article
                      key={r.source + r.id}
                      className="item"
                      style={{ flexWrap: "wrap", gap: 12 }}
                    >
                      <div>
                        <strong>{r.snapshot.sourceReference}</strong>
                        <p>
                          {r.snapshot.guest} · {rupiah(r.snapshot.amount)} ·{" "}
                          {r.snapshot.date}
                        </p>
                      </div>
                      <button
                        className="btn outline"
                        disabled={busy || loading}
                        onClick={() => {
                          setSelected(r);
                          setReview(null);
                          reset();
                        }}
                      >
                        Tinjau kuitansi {r.snapshot.sourceReference}
                      </button>
                    </article>
                  ))
                ) : (
                  <p>
                    Belum ada penerimaan aktif tanpa kuitansi. Penerbitan
                    maksimal 20 kandidat per halaman ini; perbarui setelah
                    diterbitkan.
                  </p>
                )}
              </details>
            )}
            {selected && (
              <div
                style={{
                  padding: 20,
                  border: "1px solid #dfe7df",
                  borderRadius: 12,
                  marginTop: 16,
                }}
              >
                <h3>Tinjau kuitansi</h3>
                <p>
                  {selected.snapshot.property} · {selected.snapshot.guest} ·{" "}
                  {selected.snapshot.sourceReference}
                </p>
                <p>
                  {rupiah(selected.snapshot.amount)} diterima{" "}
                  {selected.snapshot.date} melalui {selected.snapshot.method}.
                  Referensi: {selected.snapshot.reference || "—"}. Dana masih
                  tercatat: {rupiah(selected.state.retained)}.
                </p>
                <p>
                  Terbit sebagai kuitansi pencatatan pengelola, tanpa tanda
                  tangan elektronik tersertifikasi atau klaim faktur pajak.
                </p>
              </div>
            )}
            {review && (
              <div
                style={{
                  padding: 20,
                  border: "1px solid #dfe7df",
                  borderRadius: 12,
                  marginTop: 16,
                }}
              >
                <h3>Peninjauan arsip {review.number}</h3>
                <p>
                  Arsip tidak dihapus otomatis. Tanggal tinjau adalah pengingat
                  pemeriksaan kebijakan, bukan izin pemusnahan.
                </p>
                <label>
                  Status arsip
                  <select
                    value={action}
                    disabled={busy}
                    onChange={(e) => {
                      setAction(e.target.value);
                      reset();
                    }}
                  >
                    <option value="KEEP">Tetap simpan</option>
                    <option value="HOLD">Tahan pemusnahan / legal hold</option>
                    <option value="REVIEW">Jadwalkan tinjauan kebijakan</option>
                  </select>
                </label>
                <label>
                  Tanggal tinjau
                  <input
                    type="date"
                    value={date}
                    disabled={busy}
                    onChange={(e) => {
                      setDate(e.target.value);
                      reset();
                    }}
                  />
                </label>
                <label>
                  Dasar kebijakan / catatan (minimal 10 karakter)
                  <textarea
                    value={note}
                    maxLength={1000}
                    disabled={busy}
                    onChange={(e) => {
                      setNote(e.target.value);
                      reset();
                    }}
                  />
                </label>
                {review.reviewHistory && (
                  <details>
                    <summary>
                      Riwayat peninjauan ({review.reviewHistory.total})
                    </summary>
                    {review.reviewHistory.rows.map((r: any) => (
                      <p key={r.revision}>
                        Versi {r.revision} · {r.action} ·{" "}
                        {r.reviewOn || "Tanpa tanggal tinjau"}
                        <br />
                        {r.note}
                      </p>
                    ))}
                    <button
                      className="btn outline"
                      disabled={busy || review.reviewHistory.page <= 1}
                      onClick={() =>
                        void reviewHistory(
                          review.id,
                          review.reviewHistory.page - 1,
                        )
                      }
                    >
                      Tinjauan sebelumnya
                    </button>{" "}
                    <button
                      className="btn outline"
                      disabled={
                        busy ||
                        review.reviewHistory.page * 20 >=
                          review.reviewHistory.total
                      }
                      onClick={() =>
                        void reviewHistory(
                          review.id,
                          review.reviewHistory.page + 1,
                        )
                      }
                    >
                      Tinjauan berikutnya
                    </button>
                  </details>
                )}
              </div>
            )}
            {(selected || review) && (
              <>
                <label className="bo-import-confirm">
                  <input
                    type="checkbox"
                    checked={confirmed}
                    disabled={busy}
                    onChange={(e) => setConfirmed(e.target.checked)}
                  />
                  Saya sudah meninjau sumber dan informasi di atas.
                </label>
                <button
                  className="btn"
                  disabled={
                    busy ||
                    loading ||
                    !confirmed ||
                    (!!review &&
                      (note.trim().length < 10 ||
                        (action === "REVIEW" && !date)))
                  }
                  onClick={() => void send()}
                >
                  {selected ? "Terbitkan kuitansi" : "Simpan peninjauan"}
                </button>{" "}
                <button
                  className="btn outline"
                  disabled={busy || loading}
                  onClick={() => {
                    setSelected(null);
                    setReview(null);
                    reset();
                  }}
                >
                  Batal tinjauan
                </button>
              </>
            )}
            <details style={{ marginTop: 18 }}>
              <summary>Arsip kuitansi ({data.total})</summary>
              {data.rows.length ? (
                data.rows.map((r: any) => (
                  <article
                    key={r.id}
                    className="item"
                    style={{ flexWrap: "wrap", gap: 12 }}
                  >
                    <div style={{ minWidth: 0, overflowWrap: "anywhere" }}>
                      <strong>{r.number}</strong>
                      <p>
                        {r.snapshot.sourceReference} ·{" "}
                        {rupiah(r.snapshot.amount)} · {status(r.state.status)}
                      </p>
                      {r.review && (
                        <small>
                          {r.review.action === "HOLD"
                            ? "Ditahan dari pemusnahan"
                            : r.review.action === "REVIEW"
                              ? "Perlu tinjauan kebijakan"
                              : "Tetap disimpan"}
                          {r.review.reviewOn ? " · " + r.review.reviewOn : ""}
                        </small>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <a
                        className="btn outline"
                        href={`/api/financial-documents?id=${r.id}&format=html`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Buka / cetak
                      </a>
                      <a
                        className="btn outline"
                        href={`/api/financial-documents?id=${r.id}&format=html&download=1`}
                      >
                        Unduh kuitansi
                      </a>
                      {!tenant && (
                        <button
                          className="btn outline"
                          disabled={busy}
                          onClick={() => {
                            setReview(r);
                            void reviewHistory(r.id, 1, true);
                            setSelected(null);
                            setAction(r.review.action);
                            setDate(r.review.reviewOn || "");
                            setNote(r.review.note);
                            reset();
                          }}
                        >
                          Tinjau retensi {r.number}
                        </button>
                      )}
                    </div>
                  </article>
                ))
              ) : (
                <p>Belum ada kuitansi yang diterbitkan.</p>
              )}
              <div
                style={{
                  display: "flex",
                  gap: 12,
                  flexWrap: "wrap",
                  marginTop: 16,
                }}
              >
                <button
                  className="btn outline"
                  disabled={busy || loading || page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Kuitansi sebelumnya
                </button>
                <span>
                  Halaman {data.page} dari{" "}
                  {Math.max(1, Math.ceil(data.total / 20))}
                </span>
                <button
                  className="btn outline"
                  disabled={busy || loading || page * 20 >= data.total}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Kuitansi berikutnya
                </button>
              </div>
            </details>
            <button
              className="btn outline"
              style={{ marginTop: 16 }}
              disabled={busy}
              onClick={() => void load().catch((e) => setMessage(e.message))}
            >
              Perbarui kuitansi
            </button>
          </>
        )}
      </WorkspaceCard>
    </section>
  );
}
