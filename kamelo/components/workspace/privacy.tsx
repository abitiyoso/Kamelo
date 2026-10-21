"use client";
import { useEffect, useRef, useState } from "react";
import { identityCall } from "../identity/api";
import { useDialogFocus } from "../dialog-focus";
import { WorkspaceCard } from "./card";
import { Form } from "./resident360";
const kinds: Record<string, string> = {
  COPY: "Salinan data",
  CORRECTION: "Koreksi data",
  DELETION: "Peninjauan penghapusan",
  CLOSE_ACCOUNT: "Peninjauan penutupan akun",
};
const statuses: Record<string, string> = {
  SUBMITTED: "Diajukan",
  IN_REVIEW: "Ditinjau",
  NEEDS_INFORMATION: "Perlu informasi",
  RESPONDED: "Tanggapan dicatat",
  DECLINED: "Ditolak dengan alasan",
  CANCELLED: "Dibatalkan pemohon",
};
const pending = ["SUBMITTED", "IN_REVIEW", "NEEDS_INFORMATION"];
export function PrivacyWorkspace({ platform = false }: { platform?: boolean }) {
  const [data, setData] = useState<any>(null),
    [detail, setDetail] = useState<any>(null),
    [creating, setCreating] = useState(false),
    [page, setPage] = useState(1),
    [entryPage, setEntryPage] = useState(1),
    [status, setStatus] = useState(""),
    [kind, setKind] = useState(""),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [downloading, setDownloading] = useState(false);
  const sequence = useRef(0),
    busyRef = useRef(false),
    feedback = useRef<HTMLParagraphElement>(null);
  const close = () => {
    if (!busyRef.current) {
      setDetail(null);
      setCreating(false);
    }
  };
  useDialogFocus(Boolean(creating || detail), close);
  useEffect(() => {
    if (error || notice) feedback.current?.focus();
  }, [error, notice]);
  const query = (extra: Record<string, string> = {}) =>
    "/api/privacy?" +
    new URLSearchParams({
      platform: platform ? "1" : "0",
      page: String(page),
      kind,
      status,
      ...extra,
    });
  async function load() {
    const n = ++sequence.current;
    try {
      const d = await identityCall(query());
      if (n === sequence.current) setData(d);
    } catch (e) {
      if (n === sequence.current)
        setError(
          e instanceof Error ? e.message : "Permintaan belum dapat dimuat.",
        );
    }
  }
  useEffect(() => {
    setData(null);
    setError("");
    void load();
    return () => {
      sequence.current++;
    };
  }, [platform, page, kind, status]);
  async function open(id: string, ep = 1) {
    setError("");
    setNotice("");
    try {
      setDetail(await identityCall(query({ requestId: id, page: String(ep) })));
      setEntryPage(ep);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Permintaan tidak tersedia.");
    }
  }
  async function act(
    action: string,
    body: Record<string, unknown>,
    key: string,
  ) {
    if (busyRef.current) return false;
    busyRef.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const r = await identityCall("/api/privacy", {
        ...body,
        action,
        key,
        platform,
      });
      setCreating(false);
      setDetail(
        await identityCall(query({ requestId: r.result.requestId, page: "1" })),
      );
      setEntryPage(1);
      await load();
      setNotice(
        "Tindak lanjut tercatat. Ini tidak menghapus data atau menutup akun secara otomatis.",
      );
      return true;
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Tindak lanjut belum tersimpan.",
      );
      return false;
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  async function download() {
    setDownloading(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/privacy?summary=1");
      if (!response.ok) throw Error((await response.json()).error);
      const url = URL.createObjectURL(await response.blob()),
        a = document.createElement("a");
      a.href = url;
      a.download = "kamelo-ringkasan-akun.json";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      setNotice(
        "Ringkasan profil dan akses aktif telah disiapkan untuk diunduh. Untuk cakupan lain, ajukan salinan data.",
      );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unduhan belum dapat disiapkan.",
      );
    } finally {
      setDownloading(false);
    }
  }
  const r = detail?.request,
    modal = Boolean(creating || detail);
  const feedbackNode =
    error || notice ? (
      <p
        ref={feedback}
        tabIndex={-1}
        role={error ? "alert" : "status"}
        className={error ? "error" : "success"}
      >
        {error || notice}
      </p>
    ) : null;
  return (
    <>
      <div className="pagehead">
        <div>
          <h2>
            {platform
              ? "Permintaan privasi pelanggan"
              : "Privasi & salinan data"}
          </h2>
          <p>
            {platform
              ? "Tinjau permintaan pemilik akun dan catat tanggapan beserta dasar peninjauannya."
              : "Kelola permintaan terkait data akun Anda dan lihat tindak lanjut ELENIO."}
          </p>
        </div>
        {!platform && (
          <button
            className="btn"
            disabled={!data}
            onClick={() => {
              setError("");
              setNotice("");
              setCreating(true);
            }}
          >
            Ajukan permintaan privasi
          </button>
        )}
      </div>
      {!modal && feedbackNode}
      {!platform && (
        <WorkspaceCard
          title="Ringkasan akun saya"
          description="Unduhan JSON berisi profil, akses aktif, dan status permintaan privasi milik akun ini. Untuk dokumen, transaksi, atau cakupan data lain, ajukan permintaan salinan data."
        >
          <button
            className="btn outline"
            disabled={downloading}
            onClick={() => void download()}
          >
            {downloading ? "Menyiapkan ringkasan…" : "Unduh ringkasan akun"}
          </button>
        </WorkspaceCard>
      )}
      <div className="space" />
      <WorkspaceCard
        title={platform ? "Antrean peninjauan" : "Permintaan saya"}
        description="Penghapusan dan penutupan akun ditinjau terhadap retensi, catatan keuangan, serta kepemilikan akses. Pengajuan atau tanggapan bukan bukti data sudah dihapus. Tenggat dan dasar retensi ditentukan dalam peninjauan."
      >
        <div className="bo-prospect-filters">
          <label>
            Jenis permintaan
            <select
              value={kind}
              onChange={(e) => {
                setKind(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Semua jenis</option>
              {Object.entries(kinds).map(([k, v]) => (
                <option value={k} key={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label>
            Status permintaan
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Semua status</option>
              {Object.entries(statuses).map(([k, v]) => (
                <option value={k} key={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <button className="btn outline" onClick={() => void load()}>
            Muat ulang permintaan
          </button>
        </div>
        {!data ? (
          <p role="status">Memuat permintaan…</p>
        ) : (
          <>
            {data.rows.map((v: any) => (
              <div className="item bo-support-row" key={v.id}>
                <div>
                  <strong>{kinds[v.kind]}</strong>
                  <small>
                    {platform ? v.requester.name + " · " : ""}
                    {v.id}
                  </small>
                  <small>
                    {new Date(v.updatedAt).toLocaleString("id-ID", {
                      timeZone: "Asia/Jakarta",
                    })}{" "}
                    WIB
                  </small>
                  <span className="tag">{statuses[v.status]}</span>
                </div>
                <button
                  className="btn outline small"
                  onClick={() => void open(v.id)}
                >
                  Tinjau permintaan
                </button>
              </div>
            ))}
            {!data.rows.length && <p>Belum ada permintaan yang sesuai.</p>}
            <div className="between">
              <button
                className="btn outline small"
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
              >
                Sebelumnya
              </button>
              <small>
                Halaman {page} · {data.total} permintaan
              </small>
              <button
                className="btn outline small"
                disabled={page * 20 >= data.total}
                onClick={() => setPage(page + 1)}
              >
                Berikutnya
              </button>
            </div>
          </>
        )}
      </WorkspaceCard>
      {modal && (
        <div className="modalback">
          <section
            className="modal bo-lifecycle-dialog bo-support-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="privacy-title"
          >
            <div className="modalhead">
              <h2 id="privacy-title">
                {creating
                  ? "Ajukan permintaan privasi"
                  : "Detail permintaan privasi"}
              </h2>
              <button
                className="btn outline small"
                disabled={busy}
                onClick={close}
              >
                Tutup
              </button>
            </div>
            <div className="modalbody">
              {feedbackNode}
              <p>
                Isi dibagikan kepada pemilik akun dan admin ELENIO yang
                meninjau. Jangan sertakan kata sandi, PIN, API key, atau dokumen
                identitas. Tidak ada email otomatis dari alur ini.
              </p>
              {creating ? (
                <Form
                  action="create"
                  label="Kirim permintaan"
                  onAction={act}
                  busy={busy}
                  confirmed="Saya sudah memeriksa isi permintaan. Pengajuan ini memulai peninjauan, tanpa langsung menghapus data atau menutup akun."
                >
                  <label>
                    Jenis permintaan
                    <select name="kind">
                      {Object.entries(kinds).map(([k, v]) => (
                        <option value={k} key={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </label>
                  <MessageText label="Jelaskan cakupan data atau perubahan yang diminta" />
                </Form>
              ) : (
                r && (
                  <>
                    <h3>{kinds[r.kind]}</h3>
                    <p>
                      {platform ? r.requester.name + " · " : ""}
                      {statuses[r.status]} · Versi {r.revision}
                    </p>
                    <small>{r.id}</small>
                    <button
                      className="btn outline small"
                      disabled={busy}
                      onClick={() => void open(r.id)}
                    >
                      Muat ulang detail privasi
                    </button>
                    {pending.includes(r.status) && (
                      <details>
                        <summary>Tambah informasi</summary>
                        <Form
                          key={"reply" + r.revision}
                          action="reply"
                          label="Simpan informasi"
                          onAction={act}
                          busy={busy}
                          extra={{ requestId: r.id, revision: r.revision }}
                          confirmed="Informasi telah diperiksa dan boleh dibaca pihak yang meninjau."
                        >
                          <MessageText label="Informasi tambahan" />
                        </Form>
                      </details>
                    )}
                    {platform && pending.includes(r.status) && (
                      <details>
                        <summary>Catat peninjauan</summary>
                        <Form
                          key={"review" + r.revision}
                          action="review"
                          label="Simpan hasil peninjauan"
                          onAction={act}
                          busy={busy}
                          extra={{ requestId: r.id, revision: r.revision }}
                          confirmed="Tanggapan dan referensi telah diperiksa. Ini mencatat respons, tanpa menjalankan penghapusan, penutupan, atau perubahan data."
                        >
                          <label>
                            Status berikutnya
                            <select name="status">
                              {[
                                "IN_REVIEW",
                                "NEEDS_INFORMATION",
                                ...(r.status === "IN_REVIEW"
                                  ? ["RESPONDED", "DECLINED"]
                                  : []),
                              ]
                                .filter((k) => k !== r.status)
                                .map((k) => (
                                  <option value={k} key={k}>
                                    {statuses[k]}
                                  </option>
                                ))}
                            </select>
                          </label>
                          <label>
                            Referensi peninjauan
                            <input
                              name="reference"
                              minLength={5}
                              maxLength={200}
                              required
                            />
                          </label>
                          <MessageText label="Tanggapan, cakupan, dasar retensi, atau tindak lanjut" />
                        </Form>
                      </details>
                    )}
                    {!platform && pending.includes(r.status) && (
                      <details>
                        <summary>Batalkan pengajuan</summary>
                        <Form
                          key={"cancel" + r.revision}
                          action="cancel"
                          label="Batalkan pengajuan ini"
                          onAction={act}
                          busy={busy}
                          extra={{ requestId: r.id, revision: r.revision }}
                          confirmed="Saya menarik permintaan ini. Akun, data, dan riwayat permintaan tetap disimpan."
                        >
                          <MessageText label="Alasan pembatalan pengajuan" />
                        </Form>
                      </details>
                    )}
                    {!platform &&
                      ["RESPONDED", "DECLINED"].includes(r.status) && (
                        <details>
                          <summary>Minta peninjauan kembali</summary>
                          <Form
                            key={"reopen" + r.revision}
                            action="reopen"
                            label="Ajukan peninjauan kembali"
                            onAction={act}
                            busy={busy}
                            extra={{ requestId: r.id, revision: r.revision }}
                            confirmed="Permintaan masih memerlukan peninjauan."
                          >
                            <MessageText label="Alasan peninjauan kembali" />
                          </Form>
                        </details>
                      )}
                    <h3>Riwayat peninjauan</h3>
                    <small>
                      Terbaru terlebih dahulu. Tanggapan bukan bukti pelaksanaan
                      penghapusan.
                    </small>
                    {detail.entries.map((e: any) => (
                      <article className="bo-lifecycle-section" key={e.id}>
                        <strong>
                          {e.actorRole === "ACCOUNT"
                            ? "Pemilik akun"
                            : "Admin ELENIO"}{" "}
                          · {statuses[e.status]}
                        </strong>
                        <small>
                          {new Date(e.createdAt).toLocaleString("id-ID", {
                            timeZone: "Asia/Jakarta",
                          })}{" "}
                          WIB
                        </small>
                        {e.reference && <small>Referensi: {e.reference}</small>}
                        <p className="bo-support-message">{e.message}</p>
                      </article>
                    ))}
                    <div className="between">
                      <button
                        className="btn outline small"
                        disabled={entryPage === 1 || busy}
                        onClick={() => void open(r.id, entryPage - 1)}
                      >
                        Riwayat sebelumnya
                      </button>
                      <small>{detail.total} catatan</small>
                      <button
                        className="btn outline small"
                        disabled={entryPage * 30 >= detail.total || busy}
                        onClick={() => void open(r.id, entryPage + 1)}
                      >
                        Riwayat berikutnya
                      </button>
                    </div>
                  </>
                )
              )}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
function MessageText({ label }: { label: string }) {
  return (
    <label>
      {label}
      <textarea
        name="message"
        minLength={10}
        maxLength={4000}
        rows={4}
        required
      />
    </label>
  );
}
