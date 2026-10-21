"use client";
import { useEffect, useRef, useState } from "react";
import { rupiah } from "@/lib/plans";
import { OpeningReminders } from "./opening-reminders";
export function OpeningEvidence({
  id,
  propertyId,
  onChange,
}: {
  id: string;
  propertyId: string;
  onChange: () => void;
}) {
  const [data, setData] = useState<any>(null),
    [page, setPage] = useState(1),
    [selected, setSelected] = useState(""),
    [grant, setGrant] = useState(""),
    [shareConfirmed, setShareConfirmed] = useState(false),
    [confirmed, setConfirmed] = useState(false),
    [decision, setDecision] = useState("REJECTED"),
    [mode, setMode] = useState(""),
    [note, setNote] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const active = useRef(false),
    keys = useRef(new Map<string, string>()),
    seq = useRef(0),
    feedback = useRef<HTMLParagraphElement>(null);
  async function load() {
    const n = ++seq.current,
      r = await fetch(
        `/api/opening-balances?propertyId=${encodeURIComponent(propertyId)}&receivableId=${encodeURIComponent(id)}&evidence=1&page=${page}${selected ? "&proofId=" + encodeURIComponent(selected) : ""}`,
        { cache: "no-store" },
      ),
      d = await r.json();
    if (!r.ok) throw Error(d.error);
    if (n === seq.current) setData(d.evidence);
  }
  useEffect(() => {
    void load().catch((e) => setMessage(e.message));
    return () => {
      seq.current++;
    };
  }, [id, propertyId, page, selected]);
  async function send(action: string) {
    if (active.current) return;
    active.current = true;
    setBusy(true);
    setMessage("");
    try {
      const body = {
        action,
        receivableId: id,
        grantId: grant,
        shareId: data?.active?.id,
        proofId: selected,
        decision,
        note,
        existingReceiptId: mode === "NEW" ? "" : mode,
        confirmed: action === "reviewOpeningProof" ? confirmed : shareConfirmed,
      };
      let key = keys.current.get(JSON.stringify(body));
      if (!key) {
        key = crypto.randomUUID();
        keys.current.set(JSON.stringify(body), key);
      }
      const r = await fetch("/api/opening-balances", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...body, key }),
        }),
        d = await r.json();
      if (!r.ok) throw Error(d.error);
      setConfirmed(false);
      setShareConfirmed(false);
      setNote("");
      setMessage(
        action === "shareOpening"
          ? "Saldo dibagikan ke akun pilihan."
          : action === "revokeOpening"
            ? "Akses saldo dicabut; riwayat tetap tersimpan."
            : "Pemeriksaan bukti tersimpan.",
      );
      try {
        await load();
      } catch {
        setMessage(
          "Perubahan tersimpan. Muat ulang panel untuk melihat hasil terbaru.",
        );
      }
      onChange();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Perubahan belum tersimpan.");
    } finally {
      active.current = false;
      setBusy(false);
      requestAnimationFrame(() => feedback.current?.focus());
    }
  }
  return (
    <section
      className="bo-import-body"
      aria-label="Akses tenant dan bukti saldo awal"
    >
      <h3>Akses penghuni & bukti bayar</h3>
      <p>
        Saldo tidak dibagikan otomatis dari nama atau telepon. Pilih akun
        terverifikasi pada masa tinggal penghuni yang sama. Izin tagihan, status
        akun, workspace, dan pembagian saldo diperiksa pada setiap akses.
      </p>
      {data && (
        <>
          {data.active ? (
            <p>
              Dibagikan kepada{" "}
              <strong>
                {data.active.target?.name} · {data.active.target?.email}
              </strong>
              .
            </p>
          ) : (
            <label>
              Akun penerima saldo
              <select
                value={grant}
                disabled={busy || data.tooManyCandidates}
                onChange={(e) => {
                  setGrant(e.target.value);
                  setShareConfirmed(false);
                }}
              >
                <option value="">Pilih akun penghuni</option>
                {data.candidates.map((g: any) => (
                  <option key={g.id} value={g.id}>
                    {g.user.name} · {g.user.email} · kamar {g.stay.room.number}{" "}
                    · {g.stay.start}
                  </option>
                ))}
              </select>
            </label>
          )}
          {!data.active && !data.candidates.length && (
            <p>
              Belum ada akun terverifikasi dengan akses tagihan pada penghuni
              ini. Selesaikan undangan penghuni terlebih dahulu.
            </p>
          )}
          {data.tooManyCandidates && (
            <p>
              Terlalu banyak akun terkait; periksa izin dan identitas lebih
              dahulu.
            </p>
          )}
          <label className="bo-import-confirm">
            <input
              type="checkbox"
              checked={shareConfirmed}
              disabled={busy}
              onChange={(e) => setShareConfirmed(e.target.checked)}
            />
            {data.active
              ? "Saya mencabut pembagian saldo ini. Berkas dan catatan pengelola tetap tersimpan."
              : "Saya telah memeriksa identitas akun penerima dan mengizinkan akun tersebut melihat saldo serta mengirim bukti bayar."}
          </label>
          <button
            className="btn outline"
            disabled={
              busy ||
              !shareConfirmed ||
              (!data.active && (!grant || data.tooManyCandidates))
            }
            onClick={() =>
              void send(data.active ? "revokeOpening" : "shareOpening")
            }
          >
            {data.active
              ? "Cabut akses saldo"
              : "Bagikan saldo ke akun penghuni"}
          </button>
          <OpeningReminders id={id} propertyId={propertyId} />
          <h3>Bukti yang diajukan</h3>
          <p>
            Unggahan belum membuktikan dana masuk. Bandingkan dengan mutasi;
            jika penerimaan sudah dicatat manual, tautkan catatan yang sama agar
            kas tidak bertambah lagi.
          </p>
          <div
            className="bo-import-table"
            role="region"
            aria-label="Daftar bukti saldo awal"
            tabIndex={0}
          >
            {data.proofs.map((p: any) => (
              <div className="bo-import-history" key={p.id}>
                <span>
                  {p.reference} · {rupiah(p.amount)} · {p.date} ·{" "}
                  {p.status === "PENDING"
                    ? "Menunggu pemeriksaan"
                    : p.status === "APPROVED"
                      ? "Disetujui"
                      : "Ditolak"}
                  {p.receiptCorrected ? " · penerimaan dikoreksi" : ""}
                </span>
                <a
                  href={"/api/opening-proofs/" + p.id}
                  className="text-link"
                  target="_blank"
                  rel="noreferrer"
                >
                  Unduh bukti {p.reference}
                </a>
                <button
                  className="btn outline"
                  disabled={busy}
                  onClick={() => {
                    setSelected(p.id);
                    setNote("");
                    setConfirmed(false);
                    setMode("");
                    setDecision("REJECTED");
                  }}
                >
                  Periksa {p.reference}
                </button>
              </div>
            ))}
            {!data.proofs.length && <p>Belum ada bukti pada halaman ini.</p>}
          </div>
          <div className="bo-import-history">
            <button
              className="btn outline"
              disabled={busy || page === 1}
              onClick={() => {
                setPage(page - 1);
                setSelected("");
                setConfirmed(false);
              }}
            >
              Bukti sebelumnya
            </button>
            <span>
              Halaman {page} · {data.totalProofs} bukti
            </span>
            <button
              className="btn outline"
              disabled={busy || page * 20 >= data.totalProofs}
              onClick={() => {
                setPage(page + 1);
                setSelected("");
                setConfirmed(false);
              }}
            >
              Bukti berikutnya
            </button>
          </div>
          {data.review && (
            <>
              <h3>Pemeriksaan {data.review.reference}</h3>
              <p>
                {rupiah(data.review.amount)} · {data.review.date} ·{" "}
                {data.review.method}
              </p>
              <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                {data.review.tenantNote}
              </p>
              {data.review.status === "PENDING" ? (
                <>
                  <label>
                    Keputusan bukti
                    <select
                      value={decision}
                      disabled={busy}
                      onChange={(e) => {
                        setDecision(e.target.value);
                        setConfirmed(false);
                      }}
                    >
                      <option value="REJECTED">Tolak / perlu perbaikan</option>
                      <option value="APPROVED">
                        Setujui setelah dana diperiksa
                      </option>
                    </select>
                  </label>
                  {decision === "APPROVED" && (
                    <label>
                      Pencatatan dana
                      <select
                        value={mode}
                        disabled={busy}
                        onChange={(e) => {
                          setMode(e.target.value);
                          setConfirmed(false);
                        }}
                      >
                        <option value="">Pilih cara pencatatan</option>
                        <option value="NEW">
                          Catat penerimaan baru — kas bertambah
                        </option>
                        {data.review.matchingReceipts.map((r: any) => (
                          <option key={r.id} value={r.id}>
                            Tautkan penerimaan {r.reference} · {r.date} ·{" "}
                            {rupiah(r.delta)} — kas tetap
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <label>
                    Catatan keputusan untuk penghuni (minimal 10 karakter)
                    <textarea
                      value={note}
                      maxLength={1000}
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
                    Saya telah memeriksa bukti, penerimaan dana dan catatan
                    sebelumnya; keputusan serta pilihan pencatatan sudah benar.
                  </label>
                  <button
                    className="btn"
                    disabled={
                      busy ||
                      !confirmed ||
                      note.trim().length < 10 ||
                      (decision === "APPROVED" && !mode)
                    }
                    onClick={() => void send("reviewOpeningProof")}
                  >
                    Simpan pemeriksaan bukti
                  </button>
                </>
              ) : (
                <p>
                  Keputusan{" "}
                  {data.review.status === "APPROVED" ? "disetujui" : "ditolak"}:{" "}
                  {data.review.reviewNote}. Riwayat keputusan tidak ditimpa.
                </p>
              )}
            </>
          )}
        </>
      )}
      <p role="status" aria-live="polite" tabIndex={-1} ref={feedback}>
        {busy ? "Menyimpan…" : message}
      </p>
    </section>
  );
}
