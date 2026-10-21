"use client";
import { useEffect, useRef, useState } from "react";
import { identityCall } from "../identity/api";
import { useDialogFocus } from "../dialog-focus";
import { WorkspaceCard } from "./card";
import { Form } from "./resident360";
const statuses: Record<string, string> = {
  OPEN: "Terbuka",
  IN_PROGRESS: "Ditangani",
  WAITING_CUSTOMER: "Menunggu owner",
  RESOLVED: "Diselesaikan",
  CLOSED: "Ditutup",
};
const categories: Record<string, string> = {
  ACCOUNT: "Akun & akses",
  BILLING: "Subscription",
  OPERATIONS: "Operasional",
  INTEGRATION: "Integrasi",
  OTHER: "Lainnya",
};
const kinds: Record<string, string> = {
  CREATE: "Tiket dibuat",
  REPLY: "Balasan",
  CLAIM: "Diambil admin",
  STATUS: "Status diperbarui",
  REOPEN: "Dibuka kembali",
};
function when(v: string) {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(new Date(v));
}
export function SupportWorkspace({ platform = false }: { platform?: boolean }) {
  const [data, setData] = useState<any>(null),
    [detail, setDetail] = useState<any>(null),
    [creating, setCreating] = useState(false),
    [busy, setBusy] = useState(false),
    [page, setPage] = useState(1),
    [entryPage, setEntryPage] = useState(1),
    [q, setQ] = useState(""),
    [search, setSearch] = useState(""),
    [status, setStatus] = useState(""),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const sequence = useRef(0),
    busyRef = useRef(false),
    feedback = useRef<HTMLParagraphElement>(null);
  const close = () => {
    if (!busyRef.current) {
      setDetail(null);
      setCreating(false);
    }
  };
  useDialogFocus(Boolean(detail || creating), close);
  useEffect(() => {
    if (error || notice) feedback.current?.focus();
  }, [error, notice]);
  const listUrl = () =>
    "/api/support?" + new URLSearchParams({ page: String(page), q, status });
  async function load() {
    const n = ++sequence.current;
    try {
      const next = await identityCall(listUrl());
      if (n === sequence.current) setData(next);
    } catch (e) {
      if (n === sequence.current)
        setError(
          e instanceof Error ? e.message : "Bantuan belum dapat dimuat.",
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
  }, [page, q, status]);
  async function open(id: string, ep = 1) {
    try {
      setError("");
      setNotice("");
      setDetail(
        await identityCall(
          `/api/support?caseId=${encodeURIComponent(id)}&entryPage=${ep}`,
        ),
      );
      setEntryPage(ep);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Tiket belum dapat dimuat.");
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
      const result = await identityCall("/api/support", {
        ...body,
        action,
        key,
        organizationId: detail?.case.organizationId || data.organizationId,
      });
      setCreating(false);
      setDetail(
        await identityCall(
          `/api/support?caseId=${encodeURIComponent(result.result.caseId)}`,
        ),
      );
      setEntryPage(1);
      await load();
      setNotice(
        "Tindak lanjut tersimpan. Balasan dapat dibaca oleh owner organisasi dan admin ELENIO.",
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
  const c = detail?.case,
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
          <h2>{platform ? "Customer Support" : "Bantuan pelanggan"}</h2>
          <p>
            {platform
              ? "Tiket bantuan pelanggan Kamelo, eskalasi, dan audit tindak lanjut."
              : "Kirim masalah dan pantau progres penyelesaiannya bersama tim ELENIO."}
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
            Buat tiket bantuan
          </button>
        )}
      </div>
      {!modal && feedbackNode}
      <WorkspaceCard
        title={platform ? "Support Queue" : "Tiket organisasi Anda"}
        description="Isi tiket dibagikan kepada admin ELENIO dan owner organisasi. Jangan sertakan kata sandi, PIN, API key, bukti identitas, atau data penghuni."
      >
        <form
          className="bo-prospect-filters"
          onSubmit={(e) => {
            e.preventDefault();
            setQ(search);
            setPage(1);
          }}
        >
          <label>
            Cari tiket
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              maxLength={100}
              placeholder={platform ? "Judul atau organisasi" : "Judul tiket"}
            />
          </label>
          <label>
            Status
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Semua status</option>
              {Object.entries(statuses).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <button className="btn outline">Cari</button>
          <button
            type="button"
            className="btn outline"
            onClick={() => void load()}
          >
            Muat ulang daftar
          </button>
        </form>
        {!data ? (
          <p role="status">Memuat bantuan…</p>
        ) : (
          <>
            <p>
              {data.summary
                .filter((r: any) => !["RESOLVED", "CLOSED"].includes(r.status))
                .reduce((n: number, r: any) => n + r._count._all, 0)}{" "}
              tiket masih terbuka dalam cakupan akses Anda.
            </p>
            {data.rows.map((r: any) => (
              <div className="item bo-support-row" key={r.id}>
                <div>
                  <strong>{r.subject}</strong>
                  <small>
                    {r.id} · {r.organization.name}
                  </small>
                  <small>
                    {categories[r.category]} ·{" "}
                    {r.priority === "HIGH"
                      ? "Prioritas tinggi"
                      : "Prioritas normal"}{" "}
                    · {when(r.updatedAt)}
                  </small>
                  <span className="tag">{statuses[r.status]}</span>
                  <small>
                    {r.assignee
                      ? `Ditangani ${r.assignee.name}`
                      : "Belum diambil admin"}
                  </small>
                </div>
                <button
                  className="btn outline small"
                  onClick={() => void open(r.id)}
                >
                  Tinjau
                </button>
              </div>
            ))}
            {!data.rows.length && <p>Belum ada tiket yang sesuai.</p>}
            <div className="between">
              <button
                className="btn outline small"
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
              >
                Sebelumnya
              </button>
              <small>
                Halaman {page} · {data.total} tiket
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
            aria-labelledby="support-title"
          >
            <div className="modalhead">
              <h2 id="support-title">
                {creating ? "Buat tiket bantuan" : "Detail bantuan"}
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
                Bagikan hanya informasi yang diperlukan. Tiket ini tidak memberi
                admin akses ke kamera, kunci kamar, akun, atau dokumen pribadi
                Anda. Notifikasi email bantuan belum diaktifkan; periksa
                pembaruan di sini.
              </p>
              {creating ? (
                <Form
                  action="create"
                  label="Kirim tiket"
                  busy={busy}
                  onAction={act}
                  confirmed="Saya sudah memeriksa isi tiket dan setuju membagikannya kepada tim ELENIO serta owner organisasi."
                >
                  <label>
                    Judul masalah
                    <input
                      name="subject"
                      minLength={5}
                      maxLength={160}
                      required
                    />
                  </label>
                  <label>
                    Kategori
                    <select name="category">
                      {Object.entries(categories).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Prioritas
                    <select name="priority">
                      <option value="NORMAL">Normal</option>
                      <option value="HIGH">
                        Tinggi — operasional terhambat
                      </option>
                    </select>
                  </label>
                  <MessageField label="Jelaskan masalah dan langkah yang sudah dicoba" />
                </Form>
              ) : (
                c && (
                  <>
                    <h3>{c.subject}</h3>
                    <p>
                      {c.organization.name} · {categories[c.category]} ·{" "}
                      {c.priority === "HIGH"
                        ? "Prioritas tinggi"
                        : "Prioritas normal"}
                    </p>
                    <p>
                      <span className="tag">{statuses[c.status]}</span> ·{" "}
                      {c.assignee
                        ? `Ditangani ${c.assignee.name}`
                        : "Belum diambil admin"}
                    </p>
                    <small>
                      {c.id} · Versi {c.revision}
                    </small>
                    <button
                      className="btn outline small"
                      disabled={busy}
                      onClick={() => void open(c.id)}
                    >
                      Muat ulang detail
                    </button>
                    <h3>Tindak lanjut</h3>
                    {!["RESOLVED", "CLOSED"].includes(c.status) && (
                      <details>
                        <summary>Balas tiket</summary>
                        <Form
                          key={"reply" + c.revision}
                          action="reply"
                          label="Kirim balasan"
                          busy={busy}
                          onAction={act}
                          extra={{ caseId: c.id, revision: c.revision }}
                          confirmed="Isi balasan telah diperiksa dan dapat dibaca pihak yang menangani tiket."
                        >
                          <MessageField label="Balasan" />
                        </Form>
                      </details>
                    )}
                    {platform &&
                      !c.assigneeId &&
                      !["RESOLVED", "CLOSED"].includes(c.status) && (
                        <details>
                          <summary>Ambil penanganan tiket</summary>
                          <Form
                            action="claim"
                            label="Ambil tiket ini"
                            busy={busy}
                            onAction={act}
                            extra={{ caseId: c.id, revision: c.revision }}
                            confirmed="Saya menjadi penanggung jawab tindak lanjut tiket ini."
                          >
                            <MessageField label="Catatan penanganan" />
                          </Form>
                        </details>
                      )}
                    {((platform &&
                      !["RESOLVED", "CLOSED"].includes(c.status)) ||
                      (!platform && c.status === "RESOLVED")) && (
                      <details>
                        <summary>Perbarui status</summary>
                        <Form
                          key={"status" + c.revision}
                          action="status"
                          label="Simpan status"
                          busy={busy}
                          onAction={act}
                          extra={{ caseId: c.id, revision: c.revision }}
                          confirmed="Status dan alasan pembaruan telah diperiksa."
                        >
                          <label>
                            Status berikutnya
                            <select name="status">
                              {(platform
                                ? [
                                    "IN_PROGRESS",
                                    "WAITING_CUSTOMER",
                                    "RESOLVED",
                                  ]
                                : ["CLOSED"]
                              )
                                .filter((k) => k !== c.status)
                                .map((k) => (
                                  <option value={k} key={k}>
                                    {statuses[k]}
                                  </option>
                                ))}
                            </select>
                          </label>
                          <MessageField label="Alasan / ringkasan solusi" />
                        </Form>
                      </details>
                    )}
                    {["RESOLVED", "CLOSED"].includes(c.status) && (
                      <details>
                        <summary>Buka kembali tiket</summary>
                        <Form
                          key={"reopen" + c.revision}
                          action="reopen"
                          label="Buka kembali"
                          busy={busy}
                          onAction={act}
                          extra={{ caseId: c.id, revision: c.revision }}
                          confirmed="Masalah memerlukan tindak lanjut tambahan."
                        >
                          <MessageField label="Alasan membuka kembali" />
                        </Form>
                      </details>
                    )}
                    <h3>Riwayat tindak lanjut</h3>
                    <p>
                      Terbaru terlebih dahulu. Catatan yang telah dikirim tidak
                      ditimpa.
                    </p>
                    {detail.entries.map((e: any) => (
                      <article className="bo-lifecycle-section" key={e.id}>
                        <strong>
                          {kinds[e.kind]} ·{" "}
                          {e.actorRole === "OWNER"
                            ? "Owner organisasi"
                            : "Admin ELENIO"}
                        </strong>
                        <small>
                          {when(e.createdAt)} · {statuses[e.status]} · Versi{" "}
                          {e.revision}
                        </small>
                        <p className="bo-support-message">{e.message}</p>
                      </article>
                    ))}
                    <div className="between">
                      <button
                        className="btn outline small"
                        disabled={entryPage === 1 || busy}
                        onClick={() => void open(c.id, entryPage - 1)}
                      >
                        Riwayat sebelumnya
                      </button>
                      <small>{detail.entryTotal} catatan</small>
                      <button
                        className="btn outline small"
                        disabled={entryPage * 30 >= detail.entryTotal || busy}
                        onClick={() => void open(c.id, entryPage + 1)}
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
function MessageField({ label }: { label: string }) {
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
