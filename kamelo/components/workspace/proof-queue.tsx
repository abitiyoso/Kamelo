"use client";
import { useEffect, useRef, useState } from "react";
import { WorkspaceCard } from "./card";
import { rupiah } from "@/lib/plans";
const label = (s: string) => (s === "INVOICE" ? "Invoice" : "Saldo awal");
const statusLabel = (s: string) =>
  ({ PENDING: "Menunggu", APPROVED: "Disetujui", REJECTED: "Ditolak" })[s] || s;
export function ProofQueue({
  propertyId,
  onChange,
  focusOnMount = false,
}: {
  propertyId: string;
  onChange: () => void;
  focusOnMount?: boolean;
}) {
  const initial = {
    propertyId,
    source: "ALL",
    status: "PENDING",
    q: "",
    order: "OLDEST",
  };
  const [draft, setDraft] = useState(initial),
    [filters, setFilters] = useState(initial),
    [page, setPage] = useState(1),
    [data, setData] = useState<any>(null),
    [selected, setSelected] = useState<{ id: string; source: string } | null>(
      null,
    ),
    [detail, setDetail] = useState<any>(null),
    [decision, setDecision] = useState("REJECTED"),
    [mode, setMode] = useState(""),
    [note, setNote] = useState(""),
    [confirmed, setConfirmed] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const queueRoot = useRef<HTMLDivElement>(null),
    didFocus = useRef(false);
  useEffect(() => {
    if (data && focusOnMount && !didFocus.current) {
      didFocus.current = true;
      queueRoot.current?.scrollIntoView({ block: "start" });
      queueRoot.current?.focus({ preventScroll: true });
    }
  }, [data, focusOnMount]);
  const seq = useRef(0),
    active = useRef(false),
    keys = useRef(new Map<string, string>()),
    heading = useRef<HTMLHeadingElement>(null),
    feedback = useRef<HTMLParagraphElement>(null);
  async function get(url: string) {
    const r = await fetch(url, { cache: "no-store" }),
      d = await r.json();
    if (!r.ok) throw Error(d.error);
    return d;
  }
  async function load() {
    const n = ++seq.current,
      d = await get(
        "/api/proof-queue?" +
          new URLSearchParams({ ...filters, page: String(page) }),
      ),
      e = selected
        ? await get(
            "/api/proof-queue?" +
              new URLSearchParams({
                proofId: selected.id,
                source: selected.source,
              }),
          )
        : null;
    if (n === seq.current) {
      setData(d);
      setDetail(e?.detail || null);
      setConfirmed(false);
    }
  }
  useEffect(() => {
    setData(null);
    setDetail(null);
    setConfirmed(false);
    setMessage("");
    void load().catch((e) => setMessage(e.message));
    return () => {
      seq.current++;
    };
  }, [filters, page, selected]);
  useEffect(() => {
    if (detail?.proof.id) heading.current?.focus();
  }, [detail?.proof.id]);
  function reset() {
    setDecision("REJECTED");
    setMode("");
    setNote("");
    setConfirmed(false);
  }
  async function refresh() {
    if (active.current) return;
    active.current = true;
    setBusy(true);
    setConfirmed(false);
    try {
      await load();
      setMessage("Antrean dan saldo terbaru dimuat.");
    } catch (e) {
      setData(null);
      setDetail(null);
      setMessage(e instanceof Error ? e.message : "Antrean belum dimuat.");
    } finally {
      active.current = false;
      setBusy(false);
    }
  }
  async function review() {
    if (active.current || !detail) return;
    active.current = true;
    setBusy(true);
    setMessage("");
    try {
      const body = {
        source: detail.source,
        proofId: detail.proof.id,
        decision,
        note,
        digest: detail.digest,
        confirmed,
        existingReceiptId: mode === "NEW" ? "" : mode,
      };
      let key = keys.current.get(JSON.stringify(body));
      if (!key) {
        key = crypto.randomUUID();
        keys.current.set(JSON.stringify(body), key);
      }
      const r = await fetch("/api/proof-queue", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...body, key }),
        }),
        d = await r.json();
      if (!r.ok) throw Error(d.error);
      reset();
      setMessage("Keputusan tersimpan. Saldo dan antrean diperbarui.");
      try {
        await load();
      } catch {
        setData(null);
        setDetail(null);
        setMessage(
          "Keputusan tersimpan. Muat ulang antrean untuk melihat hasil terbaru.",
        );
      }
      onChange();
    } catch (e) {
      setConfirmed(false);
      setMessage(e instanceof Error ? e.message : "Keputusan belum tersimpan.");
    } finally {
      active.current = false;
      setBusy(false);
      requestAnimationFrame(() => feedback.current?.focus());
    }
  }
  return (
    <div
      ref={queueRoot}
      tabIndex={-1}
      aria-label="Antrean bukti pembayaran gabungan"
      style={{ scrollMarginTop: 90 }}
    >
      <WorkspaceCard
        title="Antrean bukti pembayaran"
        description="Invoice dan saldo awal dalam satu antrean; pembukuan dan aturan persetujuannya tetap terpisah."
      >
        <div className="bo-import-body">
          <p>
            Unggahan belum membuktikan dana masuk. Cocokkan mutasi dan catatan
            sebelumnya sebelum memutuskan. Angka berikut menghitung berkas,
            bukan pendapatan atau total utang.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              reset();
              setSelected(null);
              setPage(1);
              setFilters({ ...draft });
            }}
          >
            <div className="bo-finance-filters">
              <label>
                Properti antrean
                <select
                  value={draft.propertyId}
                  disabled={busy}
                  onChange={(e) =>
                    setDraft({ ...draft, propertyId: e.target.value })
                  }
                >
                  <option value="all">Semua properti organisasi</option>
                  {(
                    data?.properties || [
                      { id: propertyId, name: "Properti pilihan" },
                    ]
                  ).map((p: any) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Sumber bukti
                <select
                  value={draft.source}
                  disabled={busy}
                  onChange={(e) =>
                    setDraft({ ...draft, source: e.target.value })
                  }
                >
                  <option value="ALL">Semua sumber</option>
                  <option value="INVOICE">Invoice</option>
                  <option value="OPENING">Saldo awal</option>
                </select>
              </label>
              <label>
                Status bukti
                <select
                  value={draft.status}
                  disabled={busy}
                  onChange={(e) =>
                    setDraft({ ...draft, status: e.target.value })
                  }
                >
                  <option value="PENDING">Menunggu</option>
                  <option value="APPROVED">Disetujui</option>
                  <option value="REJECTED">Ditolak</option>
                  <option value="ALL">Semua status</option>
                </select>
              </label>
              <label>
                Urutan bukti
                <select
                  value={draft.order}
                  disabled={busy}
                  onChange={(e) =>
                    setDraft({ ...draft, order: e.target.value })
                  }
                >
                  <option value="OLDEST">Unggahan terlama</option>
                  <option value="NEWEST">Unggahan terbaru</option>
                </select>
              </label>
              <label>
                Cari bukti
                <input
                  maxLength={100}
                  value={draft.q}
                  disabled={busy}
                  placeholder="Referensi, penghuni, kamar"
                  onChange={(e) => setDraft({ ...draft, q: e.target.value })}
                />
              </label>
              <button className="btn" disabled={busy}>
                Terapkan filter bukti
              </button>
            </div>
          </form>
          <button
            className="btn outline"
            disabled={busy}
            onClick={() => void refresh()}
          >
            Perbarui antrean bukti
          </button>
          {data && (
            <>
              <div className="billing-summary">
                <div>
                  <small>Invoice menunggu</small>
                  <b>{data.summary.pendingInvoice}</b>
                </div>
                <div>
                  <small>Saldo awal menunggu</small>
                  <b>{data.summary.pendingOpening}</b>
                </div>
                <div>
                  <small>Riwayat keputusan</small>
                  <b>{data.summary.approved + data.summary.rejected}</b>
                </div>
              </div>
              <p>
                Ringkasan mengikuti properti, sumber dan pencarian yang
                diterapkan, mencakup semua status. Daftar mengikuti filter
                status. Keputusan atas berkas tidak selalu berarti sumber
                tagihan sudah lunas.
              </p>
              <div
                className="bo-import-table"
                role="region"
                aria-label="Antrean bukti gabungan"
                tabIndex={0}
              >
                <table>
                  <thead>
                    <tr>
                      <th>Sumber / referensi</th>
                      <th>Properti / penghuni</th>
                      <th>Nominal / unggah</th>
                      <th>Status / tindakan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows.map((r: any) => (
                      <tr key={r.source + r.id}>
                        <td>
                          {label(r.source)} · {r.sourceReference}
                          <br />
                          {r.reference}
                        </td>
                        <td>
                          {r.propertyName}
                          <br />
                          {r.guestName} · kamar {r.roomNumber}
                        </td>
                        <td>
                          {rupiah(r.amount)}
                          <br />
                          {new Date(r.uploadedAt).toLocaleString("id-ID")}
                        </td>
                        <td>
                          {statusLabel(r.status)}
                          <br />
                          <button
                            className="btn outline small"
                            aria-label={`Periksa ${r.sourceReference} · ${r.reference}`}
                            disabled={busy}
                            onClick={() => {
                              reset();
                              if (
                                selected?.id === r.id &&
                                selected?.source === r.source
                              )
                                void refresh();
                              else setSelected({ id: r.id, source: r.source });
                            }}
                          >
                            Periksa bukti
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!data.rows.length && (
                <p>
                  Tidak ada bukti sesuai filter. Perbarui untuk memeriksa
                  unggahan terbaru.
                </p>
              )}
              <div className="bo-import-history">
                <button
                  className="btn outline"
                  disabled={busy || page <= 1}
                  onClick={() => {
                    setSelected(null);
                    setPage(page - 1);
                  }}
                >
                  Bukti antrean sebelumnya
                </button>
                <span>
                  Halaman {page} · {data.total} berkas
                </span>
                <button
                  className="btn outline"
                  disabled={busy || page * 20 >= data.total}
                  onClick={() => {
                    setSelected(null);
                    setPage(page + 1);
                  }}
                >
                  Bukti antrean berikutnya
                </button>
              </div>
            </>
          )}
          {detail && (
            <>
              <h3 ref={heading} tabIndex={-1}>
                Pemeriksaan {label(detail.source)} · {detail.parent.reference}
              </h3>
              <p>
                {detail.parent.propertyName} · {detail.parent.guestName} · kamar{" "}
                {detail.parent.roomNumber}. Status sumber:{" "}
                {detail.parent.status} · sisa saat ini{" "}
                {rupiah(detail.parent.remaining)}.
              </p>
              <p>
                Bukti {detail.proof.reference}:{" "}
                <strong>{rupiah(detail.proof.amount)}</strong> ·{" "}
                {detail.proof.date} · {detail.proof.method} ·{" "}
                {statusLabel(detail.proof.status)}.
              </p>
              <a
                className="btn outline"
                href={
                  (detail.source === "INVOICE"
                    ? "/api/proofs/"
                    : "/api/opening-proofs/") +
                  encodeURIComponent(detail.proof.id)
                }
              >
                Unduh bukti untuk diperiksa
              </a>
              {detail.proof.tenantNote && (
                <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                  {detail.proof.tenantNote}
                </p>
              )}
              {detail.proof.receiptCorrected && (
                <p>
                  Penerimaan terkait telah dikoreksi; keputusan bukti tetap
                  tersimpan.
                </p>
              )}
              {detail.proof.status === "PENDING" ? (
                <>
                  <label>
                    Keputusan antrean
                    <select
                      value={decision}
                      disabled={busy}
                      onChange={(e) => {
                        setDecision(e.target.value);
                        setConfirmed(false);
                        setMode("");
                      }}
                    >
                      <option value="REJECTED">Tolak bukti</option>
                      <option value="APPROVED">
                        Setujui setelah cocok dengan dana masuk
                      </option>
                    </select>
                  </label>
                  {decision === "APPROVED" && (
                    <p>
                      {detail.source === "INVOICE"
                        ? `Persetujuan mencatat pembayaran baru ${rupiah(detail.proof.amount)} pada invoice ini. Periksa agar dana yang sama belum dicatat sebelumnya.`
                        : "Pilih penerimaan baru atau tautkan penerimaan manual yang persis sama agar kas tidak tercatat dua kali."}
                    </p>
                  )}
                  {decision === "APPROVED" && detail.source === "OPENING" && (
                    <label>
                      Pencatatan persetujuan
                      <select
                        value={mode}
                        disabled={busy}
                        onChange={(e) => {
                          setMode(e.target.value);
                          setConfirmed(false);
                        }}
                      >
                        <option value="">Pilih pencatatan</option>
                        <option value="NEW">Catat penerimaan baru</option>
                        {detail.matchingReceipts.map((r: any) => (
                          <option key={r.id} value={r.id}>
                            Tautkan {r.reference} · {r.date} · {rupiah(r.delta)}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <label>
                    Catatan keputusan untuk penghuni
                    <input
                      minLength={10}
                      maxLength={500}
                      value={note}
                      disabled={busy}
                      onChange={(e) => {
                        setNote(e.target.value);
                        setConfirmed(false);
                      }}
                    />
                  </label>
                  <label className="bo-import-confirm">
                    <input
                      type="checkbox"
                      checked={confirmed}
                      disabled={busy}
                      onChange={(e) => setConfirmed(e.target.checked)}
                    />
                    Saya telah mencocokkan bukti, dana masuk, saldo dan catatan
                    sebelumnya. Keputusan serta pilihan pencatatan sudah benar.
                  </label>
                  <button
                    className="btn"
                    disabled={
                      busy ||
                      !confirmed ||
                      note.trim().length < 10 ||
                      (decision === "APPROVED" &&
                        detail.source === "OPENING" &&
                        !mode)
                    }
                    onClick={() => void review()}
                  >
                    Simpan keputusan antrean
                  </button>
                </>
              ) : (
                <p>
                  Keputusan {statusLabel(detail.proof.status)}:{" "}
                  {detail.proof.reviewNote}. Riwayat keputusan tidak ditimpa.
                </p>
              )}
            </>
          )}
          <p role="status" aria-live="polite" tabIndex={-1} ref={feedback}>
            {message}
          </p>
        </div>
      </WorkspaceCard>
    </div>
  );
}
