"use client";
import { useEffect, useRef, useState } from "react";
import { identityCall } from "../identity/api";
import { useDialogFocus } from "../dialog-focus";
import { Form } from "./resident360";
import { WorkspaceCard } from "./card";
const roles: Record<string, string> = {
  OWNER: "Owner",
  STAFF: "Staf",
  TENANT: "Penghuni",
};
const kinds: Record<string, string> = {
  MESSAGE: "Pesan",
  ASSIGN: "Penugasan diubah",
  CLOSE: "Percakapan ditutup",
  REOPEN: "Dibuka kembali",
};
const when = (d: string) =>
  new Date(d).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });
export function MessagesWorkspace({
  propertyId = "",
  canStart = true,
}: {
  propertyId?: string;
  canStart?: boolean;
}) {
  const [data, setData] = useState<any>(null),
    [page, setPage] = useState(1),
    [detail, setDetail] = useState<any>(null),
    [entryPage, setEntryPage] = useState(1),
    [creating, setCreating] = useState(false),
    [recipients, setRecipients] = useState<any>(null),
    [recipientPage, setRecipientPage] = useState(1),
    [search, setSearch] = useState(""),
    [q, setQ] = useState(""),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  const seq = useRef(0),
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
  async function load() {
    const n = ++seq.current;
    try {
      const d = await identityCall(
        "/api/messages?" +
          new URLSearchParams({ propertyId, page: String(page) }),
      );
      if (n === seq.current) setData(d);
    } catch (e) {
      if (n === seq.current)
        setError(e instanceof Error ? e.message : "Pesan belum dapat dimuat.");
    }
  }
  useEffect(() => {
    setData(null);
    setError("");
    void load();
    return () => {
      seq.current++;
    };
  }, [propertyId, page]);
  useEffect(() => {
    if (!creating || data?.role !== "OWNER") return;
    let ignore = false;
    setRecipients(null);
    identityCall(
      "/api/messages?" +
        new URLSearchParams({
          propertyId,
          recipients: "1",
          page: String(recipientPage),
          q,
        }),
    )
      .then((d) => {
        if (!ignore) setRecipients(d);
      })
      .catch((e) => {
        if (!ignore) setError(e.message);
      });
    return () => {
      ignore = true;
    };
  }, [creating, recipientPage, q, propertyId, data?.role]);
  async function open(id: string, ep = 1) {
    setError("");
    setNotice("");
    try {
      setDetail(
        await identityCall(
          `/api/messages?threadId=${encodeURIComponent(id)}&page=${ep}`,
        ),
      );
      setEntryPage(ep);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Percakapan belum tersedia.");
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
      const payload = { ...body };
      if (payload.recipient) {
        const [stayId, residentUserId] = String(payload.recipient).split(":");
        payload.stayId = stayId;
        payload.residentUserId = residentUserId;
        delete payload.recipient;
      }
      const r = await identityCall("/api/messages", {
        ...payload,
        action,
        key,
      });
      setCreating(false);
      setDetail(
        await identityCall(
          `/api/messages?threadId=${encodeURIComponent(r.result.threadId)}`,
        ),
      );
      setEntryPage(1);
      await load();
      setNotice(
        "Tersimpan di percakapan. Status dibaca atau diterima perangkat tidak dilacak.",
      );
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Pesan belum tersimpan.");
      return false;
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  const modal = Boolean(creating || detail),
    t = detail?.thread;
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
          <h2>{data?.role === "TENANT" ? "Pesan" : "Kotak Masuk"}</h2>
          <p>
            Komunikasi terhubung dengan profil penghuni dan catatan operasional.
          </p>
        </div>
        {data && data.role !== "STAFF" && (
          <button
            className="btn"
            disabled={!canStart}
            onClick={() => {
              setError("");
              setNotice("");
              setCreating(true);
              setRecipientPage(1);
            }}
          >
            Tulis pesan
          </button>
        )}
      </div>
      {!modal && feedbackNode}
      <WorkspaceCard
        title={data?.role === "TENANT" ? "Percakapan Penghuni" : "Kotak Masuk"}
        description="Percakapan terkait akun dan masa tinggal. Muat ulang untuk melihat pesan baru; email, WhatsApp otomatis, dan status dibaca belum diaktifkan."
      >
        <button className="btn outline small" onClick={() => void load()}>
          Muat ulang pesan
        </button>
        {!data ? (
          <p role="status">Memuat percakapan…</p>
        ) : (
          <>
            {data.role === "STAFF" && (
              <p>
                Hanya percakapan yang ditugaskan kepada Anda pada properti
                berizin.
              </p>
            )}
            {data.rows.map((r: any) => (
              <div className="item bo-support-row" key={r.id}>
                <div>
                  <strong>
                    {r.residentUser.name} · Kamar {r.stay.room.number}
                  </strong>
                  <small>
                    {r.stay.room.property.name} · {when(r.updatedAt)} WIB
                  </small>
                  <span className="tag">
                    {r.status === "OPEN" ? "Terbuka" : "Ditutup"}
                  </span>
                  <small>
                    {r.assignee
                      ? `Staf: ${r.assignee.user.name}`
                      : "Ditangani owner"}
                  </small>
                </div>
                <button
                  className="btn outline small"
                  onClick={() => void open(r.id)}
                >
                  Buka percakapan
                </button>
              </div>
            ))}
            {!data.rows.length && (
              <p>Belum ada percakapan dalam cakupan akses Anda.</p>
            )}
            <div className="between">
              <button
                className="btn outline small"
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
              >
                Sebelumnya
              </button>
              <small>
                Halaman {page} · {data.total} percakapan
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
            aria-labelledby="messages-title"
          >
            <div className="modalhead">
              <h2 id="messages-title">
                {creating ? "Tulis pesan" : "Percakapan penghuni"}
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
                Pesan dibagikan dengan penghuni terkait, owner, dan staf yang
                ditugaskan. Jangan kirim kata sandi, PIN, API key, atau dokumen
                identitas.
              </p>
              {creating ? (
                <>
                  {data.role === "OWNER" && (
                    <>
                      <form
                        className="identity-form"
                        onSubmit={(e) => {
                          e.preventDefault();
                          setQ(search);
                          setRecipientPage(1);
                        }}
                      >
                        <label>
                          Cari akun penghuni
                          <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            maxLength={100}
                          />
                        </label>
                        <button className="btn outline">Cari penerima</button>
                      </form>
                      {!recipients ? (
                        <p>Memuat akun penghuni…</p>
                      ) : (
                        <div className="between">
                          <button
                            className="btn outline small"
                            disabled={recipientPage === 1}
                            onClick={() => setRecipientPage(recipientPage - 1)}
                          >
                            Penerima sebelumnya
                          </button>
                          <small>
                            {recipients.total} akun pada masa tinggal tercatat
                          </small>
                          <button
                            className="btn outline small"
                            disabled={recipientPage * 30 >= recipients.total}
                            onClick={() => setRecipientPage(recipientPage + 1)}
                          >
                            Penerima berikutnya
                          </button>
                        </div>
                      )}
                    </>
                  )}
                  {data.role === "OWNER" &&
                    recipients &&
                    !recipients.recipients.some((r: any) => r.active) && (
                      <p>
                        Belum ada akun penghuni aktif pada hasil ini. Periksa
                        halaman penerima lain atau undang penghuni melalui Tim &
                        Akses.
                      </p>
                    )}
                  {(data.role === "TENANT" || recipients) && (
                    <Form
                      key={recipientPage + q}
                      action="start"
                      label="Kirim pesan"
                      busy={busy}
                      onAction={act}
                      confirmed="Isi pesan sudah diperiksa dan dapat dibaca peserta percakapan."
                    >
                      {data.role === "OWNER" && (
                        <label>
                          Penerima terverifikasi
                          <select name="recipient" required defaultValue="">
                            <option value="">Pilih penghuni aktif</option>
                            {recipients.recipients
                              .filter((r: any) => r.active)
                              .map((r: any) => (
                                <option
                                  key={r.stayId + r.userId}
                                  value={r.stayId + ":" + r.userId}
                                >
                                  {r.name} · Kamar {r.room}
                                </option>
                              ))}
                          </select>
                        </label>
                      )}
                      <MessageText label="Pesan" />
                    </Form>
                  )}
                </>
              ) : (
                t && (
                  <>
                    <h3>
                      {t.residentUser.name} · Kamar {t.stay.room.number}
                    </h3>
                    <p>
                      {t.stay.room.property.name} ·{" "}
                      {t.status === "OPEN" ? "Terbuka" : "Ditutup"} ·{" "}
                      {t.assignee
                        ? `Staf: ${t.assignee.user.name}`
                        : "Ditangani owner"}
                    </p>
                    <button
                      className="btn outline small"
                      disabled={busy}
                      onClick={() => void open(t.id)}
                    >
                      Muat ulang percakapan
                    </button>
                    {!detail.active && (
                      <p>
                        Masa tinggal selesai. Percakapan disimpan sebagai
                        riwayat; pengiriman pesan dinonaktifkan.
                      </p>
                    )}
                    {detail.active && t.status === "OPEN" && (
                      <Form
                        action="send"
                        label="Kirim balasan"
                        extra={{ threadId: t.id }}
                        busy={busy}
                        onAction={act}
                        confirmed="Isi balasan sudah diperiksa dan dapat dibaca peserta percakapan."
                      >
                        <MessageText label="Balasan" />
                      </Form>
                    )}
                    {data.role === "OWNER" && (
                      <details>
                        <summary>Tugaskan staf</summary>
                        <Form
                          action="assign"
                          label="Simpan penugasan"
                          extra={{ threadId: t.id, revision: t.revision }}
                          busy={busy}
                          onAction={act}
                          confirmed="Staf terpilih dapat membaca riwayat percakapan ini selama penugasan dan izin propertinya berlaku."
                        >
                          <label>
                            Staf bertugas
                            <select
                              name="assigneeId"
                              defaultValue={t.assigneeId || ""}
                            >
                              <option value="">Owner saja</option>
                              {data.staff.map((s: any) => (
                                <option value={s.id} key={s.id}>
                                  {s.user.name}
                                </option>
                              ))}
                            </select>
                          </label>
                          <MessageText label="Catatan penugasan" />
                        </Form>
                      </details>
                    )}
                    {((t.status === "OPEN" && data.role !== "TENANT") ||
                      (t.status === "CLOSED" && detail.active)) && (
                      <details>
                        <summary>
                          {t.status === "OPEN"
                            ? "Tutup percakapan"
                            : "Buka kembali percakapan"}
                        </summary>
                        <Form
                          action={t.status === "OPEN" ? "close" : "reopen"}
                          label="Simpan status percakapan"
                          extra={{ threadId: t.id, revision: t.revision }}
                          busy={busy}
                          onAction={act}
                          confirmed="Alasan dan status telah diperiksa. Riwayat pesan tetap disimpan."
                        >
                          <MessageText label="Alasan perubahan status" />
                        </Form>
                      </details>
                    )}
                    <h3>Riwayat percakapan</h3>
                    <small>
                      Terbaru terlebih dahulu · tersimpan di aplikasi, tanpa
                      konfirmasi dibaca.
                    </small>
                    {detail.entries.map((e: any) => (
                      <article className="bo-lifecycle-section" key={e.id}>
                        <strong>
                          {kinds[e.kind]} · {roles[e.actorRole]}
                        </strong>
                        <small>{when(e.createdAt)} WIB</small>
                        <p className="bo-support-message">{e.message}</p>
                      </article>
                    ))}
                    <div className="between">
                      <button
                        className="btn outline small"
                        disabled={entryPage === 1 || busy}
                        onClick={() => void open(t.id, entryPage - 1)}
                      >
                        Pesan sebelumnya
                      </button>
                      <small>{detail.total} catatan</small>
                      <button
                        className="btn outline small"
                        disabled={entryPage * 30 >= detail.total || busy}
                        onClick={() => void open(t.id, entryPage + 1)}
                      >
                        Pesan berikutnya
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
        minLength={1}
        maxLength={4000}
        rows={4}
        required
      />
    </label>
  );
}
