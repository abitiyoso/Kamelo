"use client";
import { useEffect, useRef, useState } from "react";
import { WorkspaceCard } from "./card";
import { WorkspaceKpi } from "./modules";
import { Form, Field } from "./resident360";
import { identityCall } from "../identity/api";
import { useDialogFocus } from "../dialog-focus";
import { rupiah } from "@/lib/plans";
import { tenantDate, tenantToday } from "@/lib/tenant-types";

const stages: Record<string, string> = {
  NEW: "Baru",
  SURVEY: "Jadwal survei",
  OFFER: "Penawaran",
  CONVERTED: "Menjadi penghuni",
  LOST: "Tidak dilanjutkan",
};
const sources: Record<string, string> = {
  WEBSITE: "Website",
  WHATSAPP: "WhatsApp",
  INSTAGRAM: "Instagram",
  REFERRAL: "Referral",
  WALK_IN: "Kunjungan langsung",
  OTHER: "Lainnya",
};
const when = (v?: string) =>
  v
    ? new Date(v).toLocaleString("id-ID", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "Belum dijadwalkan";
function localMoment(v?: string) {
  if (!v) return "";
  const d = new Date(v);
  return new Date(+d - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}
type Room = { id: string; number: string; operational: string };
function ContactFields({ row = {}, rooms }: { row?: any; rooms: Room[] }) {
  return (
    <>
      <Field name="name" label="Nama calon penghuni" value={row.name} />
      <Field name="phone" label="Nomor WhatsApp" type="tel" value={row.phone} />
      <Field
        name="email"
        label="Email kontak (opsional)"
        type="email"
        value={row.email}
        required={false}
      />
      <label>
        Sumber
        <select name="source" defaultValue={row.source || "WHATSAPP"}>
          {Object.entries(sources).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </label>
      <Field
        name="interest"
        label="Kebutuhan / minat kamar"
        value={row.interest}
        required={false}
      />
      <label>
        Kamar diminati
        <select name="roomId" defaultValue={row.roomId || ""}>
          <option value="">Belum dipilih</option>
          {rooms.map((r) => (
            <option key={r.id} value={r.id}>
              Kamar {r.number}
            </option>
          ))}
        </select>
      </label>
      <div className="grid cols2">
        <Field
          name="requestedStart"
          label="Rencana mulai"
          type="date"
          value={row.requestedStart}
          required={false}
        />
        <Field
          name="requestedEnd"
          label="Rencana selesai"
          type="date"
          value={row.requestedEnd}
          required={false}
        />
      </div>
      <Field
        name="budget"
        label="Anggaran sewa (Rp, opsional)"
        type="number"
        min={0}
        max={1000000000}
        value={row.budget ?? ""}
        required={false}
      />
      <Field
        name="followUpAt"
        label="Tindak lanjut berikutnya"
        type="datetime-local"
        value={localMoment(row.followUpAt)}
        required={false}
      />
      <label>
        Catatan
        <textarea
          name="notes"
          maxLength={2000}
          defaultValue={row.notes || ""}
        />
      </label>
    </>
  );
}
function StageForm({
  row,
  onAction,
  busy,
}: {
  row: any;
  onAction: any;
  busy: boolean;
}) {
  const [stage, setStage] = useState(
    row.stage === "LOST" ? "NEW" : row.stage === "NEW" ? "SURVEY" : "OFFER",
  );
  return (
    <Form
      action="prospectStage"
      label="Simpan tahap"
      extra={{ prospectId: row.id, revision: row.revision }}
      onAction={onAction}
      busy={busy}
    >
      <label>
        Tahap pipeline
        <select
          name="stage"
          value={stage}
          onChange={(e) => setStage(e.target.value)}
        >
          {Object.entries(stages)
            .filter(
              ([k]) =>
                k !== "CONVERTED" &&
                (k !== row.stage || k === "OFFER") &&
                (row.stage !== "LOST" || k === "NEW"),
            )
            .map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
        </select>
      </label>
      {stage === "SURVEY" && (
        <Field
          name="surveyAt"
          label="Jadwal survei"
          type="datetime-local"
          value={localMoment(row.surveyAt)}
        />
      )}
      {stage === "OFFER" && (
        <>
          <Field
            name="offerRent"
            label="Tarif sewa yang ditawarkan (Rp)"
            type="number"
            value={row.offerRent ?? ""}
            min={0}
            max={1000000000}
          />
          <label>
            Rincian penawaran
            <textarea
              name="offerTerms"
              required
              minLength={10}
              maxLength={2000}
              defaultValue={row.offerTerms}
            />
          </label>
          <small>Penawaran belum menjadi kontrak atau menahan kamar.</small>
        </>
      )}
      {stage === "LOST" && (
        <label>
          Alasan tidak dilanjutkan
          <textarea name="lossReason" required minLength={5} maxLength={500} />
        </label>
      )}
    </Form>
  );
}
export function ProspectsWorkspace({
  propertyId,
  type,
  rooms,
  onResidents,
  onChange,
}: {
  propertyId: string;
  type: string;
  rooms: Room[];
  onResidents: () => void;
  onChange: () => void;
}) {
  const [data, setData] = useState<any>(null),
    [detail, setDetail] = useState<any>(null),
    [creating, setCreating] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [search, setSearch] = useState(""),
    [q, setQ] = useState(""),
    [stage, setStage] = useState(""),
    [page, setPage] = useState(1),
    [activityPage, setActivityPage] = useState(1),
    [mode, setMode] = useState("new"),
    [guestQuery, setGuestQuery] = useState(""),
    [guests, setGuests] = useState<any[]>([]);
  const feedback = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (message || error) feedback.current?.focus();
  }, [message, error]);
  const sequence = useRef(0),
    busyRef = useRef(false);
  const close = () => {
    if (!busyRef.current) {
      setCreating(false);
      setDetail(null);
    }
  };
  useDialogFocus(Boolean(detail || creating), close);
  async function load() {
    const n = ++sequence.current;
    try {
      const b = await identityCall(
        `/api/prospects?propertyId=${encodeURIComponent(propertyId)}&q=${encodeURIComponent(q)}&stage=${stage}&page=${page}`,
      );
      if (sequence.current === n) setData(b);
    } catch (e) {
      if (sequence.current === n)
        setError(e instanceof Error ? e.message : "Data belum dapat dimuat.");
    }
  }
  useEffect(() => {
    setData(null);
    void load();
    return () => {
      sequence.current++;
    };
  }, [propertyId, q, stage, page]);
  useEffect(() => {
    let ignore = false;
    if (!detail || mode !== "existing") return;
    setGuests([]);
    identityCall(
      `/api/lifecycle?propertyId=${encodeURIComponent(propertyId)}&q=${encodeURIComponent(guestQuery)}`,
    )
      .then((b) => {
        if (!ignore) setGuests(b.rows);
      })
      .catch(() => {
        if (!ignore) setError("Profil penghuni belum dapat dimuat.");
      });
    return () => {
      ignore = true;
    };
  }, [propertyId, guestQuery, mode, detail?.prospect.id]);
  async function open(id: string, ap = 1) {
    setError("");
    setMessage("");
    try {
      const b = await identityCall(
        `/api/prospects?propertyId=${encodeURIComponent(propertyId)}&prospectId=${id}&activityPage=${ap}`,
      );
      setDetail(b);
      setActivityPage(ap);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Prospek belum dapat dimuat.");
    }
  }
  async function act(
    action: string,
    raw: Record<string, unknown>,
    key: string,
  ) {
    busyRef.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const body = { ...raw };
      for (const k of ["budget", "offerRent", "rate"])
        if (k in body) body[k] = body[k] === "" ? null : Number(body[k]);
      for (const k of ["roomId", "guestId", "requestedStart", "requestedEnd"])
        if (body[k] === "") body[k] = null;
      for (const k of ["followUpAt", "surveyAt"])
        if (k in body)
          body[k] = body[k] ? new Date(String(body[k])).toISOString() : null;
      const b = await identityCall("/api/lifecycle", {
        ...body,
        action,
        key,
        propertyId,
      });
      setCreating(false);
      await open(b.result.prospectId);
      await load();
      onChange();
      setMessage(
        action === "prospectConvert"
          ? "Masa tinggal berhasil dibuat. Lanjutkan kontrak, tagihan, dan undangan dari Database Penghuni."
          : "Catatan prospek tersimpan.",
      );
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Perubahan gagal.");
      return false;
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  const row = detail?.prospect;
  return (
    <>
      <div className="pagehead">
        <div>
          <h2>Prospek & Penyewaan</h2>
          <p>
            Kelola pertanyaan masuk, survei, penawaran, hingga menjadi penghuni.
          </p>
        </div>
        <button
          className="btn"
          onClick={() => {
            setDetail(null);
            setCreating(true);
            setError("");
            setMessage("");
          }}
        >
          Tambah prospek
        </button>
      </div>
      {error && !detail && !creating && (
        <p className="identity-error" role="alert">
          {error}
        </p>
      )}
      {message && !detail && !creating && (
        <p className="identity-notice" role="status">
          {message}
        </p>
      )}
      {!data ? (
        <p>Memuat prospek…</p>
      ) : (
        <>
          <div className="grid cols3">
            <WorkspaceKpi
              label="Prospek aktif"
              value={data.active}
              note={`${data.due} tindak lanjut jatuh tempo`}
            />
            <WorkspaceKpi
              label="Jadwal survei"
              value={data.surveys}
              note="Kunjungan yang akan datang"
            />
            <WorkspaceKpi
              label="Kamar tersedia"
              value={data.available}
              note="Kamar siap dan kosong hari ini"
            />
          </div>
          <div className="space" />
          <WorkspaceCard
            title="Pipeline Calon Penghuni"
            description="Minat dan penawaran belum menahan kamar. Ketersediaan diperiksa kembali saat membuat masa tinggal."
          >
            <form
              className="bo-prospect-filters"
              onSubmit={(e) => {
                e.preventDefault();
                setPage(1);
                setQ(search);
              }}
            >
              <label>
                Cari prospek
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  maxLength={100}
                  placeholder="Nama atau nomor WhatsApp"
                />
              </label>
              <label>
                Tahap
                <select
                  value={stage}
                  onChange={(e) => {
                    setPage(1);
                    setStage(e.target.value);
                  }}
                >
                  <option value="">Semua tahap</option>
                  {Object.entries(stages).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
              <button className="btn outline">Cari</button>
            </form>
            <div className="tablewrap">
              <table>
                <thead>
                  <tr>
                    {[
                      "Nama & kontak",
                      "Minat kamar",
                      "Sumber",
                      "Tahap",
                      "Catatan",
                      "Tindakan",
                    ].map((t) => (
                      <th key={t}>{t}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((r: any) => (
                    <tr key={r.id}>
                      <td>
                        <strong>{r.name}</strong>
                        <small>{r.phone}</small>
                      </td>
                      <td>
                        {r.room
                          ? `Kamar ${r.room.number}`
                          : r.interest || "Belum dipilih"}
                        <small>
                          {r.requestedStart
                            ? tenantDate(r.requestedStart)
                            : "Tanggal belum dipilih"}
                        </small>
                      </td>
                      <td>{sources[r.source] || r.source}</td>
                      <td>
                        <span
                          className={
                            "tag " + (r.stage === "SURVEY" ? "gold" : "")
                          }
                        >
                          {stages[r.stage]}
                        </span>
                      </td>
                      <td>
                        <span className="bo-prospect-note">
                          {r.notes || "Belum ada catatan"}
                        </span>
                        <small>Tindak lanjut: {when(r.followUpAt)}</small>
                      </td>
                      <td>
                        <button
                          className="btn outline small"
                          onClick={() => {
                            setMode("new");
                            setGuestQuery("");
                            void open(r.id);
                          }}
                        >
                          Kelola
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!data.rows.length && (
              <p>
                Belum ada prospek yang sesuai. Tambahkan pertanyaan masuk untuk
                memulai tindak lanjut.
              </p>
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
                Halaman {page} · {data.total} prospek
              </small>
              <button
                className="btn outline small"
                disabled={page * 50 >= data.total}
                onClick={() => setPage(page + 1)}
              >
                Berikutnya
              </button>
            </div>
          </WorkspaceCard>
        </>
      )}
      {(creating || row) && (
        <div className="modalback">
          <section
            className="modal bo-lifecycle-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="prospect-title"
          >
            <div className="between">
              <h2 id="prospect-title">
                {creating ? "Tambah prospek" : `Prospek — ${row.name}`}
              </h2>
              <button
                className="btn outline small"
                onClick={close}
                disabled={busy}
              >
                Tutup
              </button>
            </div>
            {error && (
              <p
                className="identity-error"
                role="alert"
                ref={feedback}
                tabIndex={-1}
              >
                {error}
              </p>
            )}
            {message && (
              <p
                className="identity-notice"
                role="status"
                ref={feedback}
                tabIndex={-1}
              >
                {message}
              </p>
            )}
            {creating ? (
              <Form
                action="prospectCreate"
                label="Simpan prospek"
                onAction={act}
                busy={busy}
                confirmed="Calon penghuni telah menyetujui pencatatan kontak dan tindak lanjut untuk kebutuhan sewa ini."
              >
                <ContactFields rooms={rooms} />
                <Field
                  name="consentReference"
                  label="Referensi persetujuan kontak"
                />
                <small>
                  Contoh: permintaan WhatsApp tanggal kunjungan. Tidak ada pesan
                  yang dikirim dari formulir ini.
                </small>
              </Form>
            ) : (
              <>
                <div className="item">
                  <div>
                    <strong>{row.phone}</strong>
                    <small>
                      {row.email || "Email kontak belum diisi"} ·{" "}
                      {sources[row.source]}
                    </small>
                  </div>
                  <span className="tag">{stages[row.stage]}</span>
                </div>
                <p>{row.interest || "Kebutuhan belum dicatat"}</p>
                <small>
                  Persetujuan kontak: {row.consentReference} ·{" "}
                  {when(row.consentAt)}
                </small>
                {row.stage === "CONVERTED" ? (
                  <div className="notice">
                    <p>
                      Kamar {row.convertedStay?.room.number} ·{" "}
                      {row.convertedStay?.status === "CONFIRMED"
                        ? "Reservasi tercatat"
                        : "Masa tinggal tercatat"}
                      . Riwayat prospek tetap tersedia.
                    </p>
                    <button className="btn" onClick={onResidents}>
                      Buka Database Penghuni
                    </button>
                  </div>
                ) : (
                  <>
                    <details>
                      <summary>Kontak, minat kamar & tindak lanjut</summary>
                      <Form
                        key={row.revision + "edit"}
                        action="prospectUpdate"
                        label="Simpan perubahan"
                        extra={{ prospectId: row.id, revision: row.revision }}
                        onAction={act}
                        busy={busy}
                      >
                        <ContactFields row={row} rooms={rooms} />
                      </Form>
                    </details>
                    <h3>Tahap pipeline</h3>
                    <StageForm
                      key={row.revision + "stage"}
                      row={row}
                      onAction={act}
                      busy={busy}
                    />
                    {row.stage === "SURVEY" && (
                      <p>Jadwal survei: {when(row.surveyAt)}</p>
                    )}
                    {row.offerRent !== null && (
                      <div className="notice">
                        <strong>Penawaran sewa: {rupiah(row.offerRent)}</strong>
                        <p className="bo-prospect-terms">{row.offerTerms}</p>
                      </div>
                    )}
                    {row.stage === "LOST" && (
                      <p>Alasan tidak dilanjutkan: {row.lossReason}</p>
                    )}
                    {row.stage === "OFFER" && (
                      <details>
                        <summary>Jadikan penghuni / reservasi</summary>
                        <p>
                          Pastikan calon penghuni menyetujui kamar, tarif, dan
                          periode ini. Ini membuat masa tinggal, tanpa mengirim
                          undangan atau mencatat pembayaran.
                        </p>
                        <label>
                          Profil penghuni
                          <select
                            value={mode}
                            onChange={(e) => setMode(e.target.value)}
                          >
                            <option value="new">Buat profil baru</option>
                            <option value="existing">
                              Gunakan profil yang sudah ada
                            </option>
                          </select>
                        </label>
                        {mode === "existing" && (
                          <label>
                            Cari profil yang sudah ada
                            <input
                              value={guestQuery}
                              onChange={(e) => setGuestQuery(e.target.value)}
                              maxLength={100}
                              placeholder="Nama atau nomor WhatsApp"
                            />
                          </label>
                        )}
                        <Form
                          key={row.revision + mode}
                          action="prospectConvert"
                          label="Buat masa tinggal"
                          extra={{
                            prospectId: row.id,
                            revision: row.revision,
                            rate: row.offerRent,
                          }}
                          onAction={act}
                          busy={busy}
                          confirmed="Identitas/profil, kamar, tarif, dan periode telah diperiksa serta disetujui calon penghuni."
                        >
                          {mode === "existing" ? (
                            <label>
                              Pilih profil yang telah diperiksa
                              <select name="guestId" required defaultValue="">
                                <option value="">
                                  Pilih profil · maksimal 50 hasil pencarian
                                </option>
                                {guests.map((g) => (
                                  <option key={g.id} value={g.id}>
                                    {g.name} · {g.phone}
                                  </option>
                                ))}
                              </select>
                            </label>
                          ) : (
                            <small>
                              Nomor kontak yang sama tidak otomatis digabungkan.
                              Pilih profil lama secara eksplisit bila orangnya
                              sama.
                            </small>
                          )}
                          <label>
                            Kamar tujuan
                            <select
                              name="roomId"
                              required
                              defaultValue={row.roomId || ""}
                            >
                              <option value="">Pilih kamar</option>
                              {rooms.map((r) => (
                                <option
                                  key={r.id}
                                  value={r.id}
                                  disabled={r.operational !== "READY"}
                                >
                                  Kamar {r.number}
                                  {r.operational !== "READY"
                                    ? " · Belum siap"
                                    : ""}
                                </option>
                              ))}
                            </select>
                          </label>
                          <Field
                            name="start"
                            label="Tanggal mulai"
                            type="date"
                            min={tenantToday()}
                            value={
                              row.requestedStart &&
                              row.requestedStart >= tenantToday()
                                ? row.requestedStart
                                : tenantToday()
                            }
                          />
                          <Field
                            name="end"
                            label="Tanggal selesai"
                            type="date"
                            value={row.requestedEnd}
                            required={type === "HOTEL"}
                          />
                          <Field
                            name="billingDay"
                            label="Tanggal jatuh tempo bulanan"
                            type="number"
                            min={1}
                            max={31}
                            value={1}
                          />
                          <p>
                            Tarif sesuai penawaran:{" "}
                            <strong>{rupiah(row.offerRent)}</strong>
                          </p>
                        </Form>
                      </details>
                    )}
                    {row.stage !== "LOST" && (
                      <details>
                        <summary>Catat hasil tindak lanjut</summary>
                        <Form
                          key={row.revision + "note"}
                          action="prospectNote"
                          label="Simpan tindak lanjut"
                          extra={{ prospectId: row.id, revision: row.revision }}
                          onAction={act}
                          busy={busy}
                        >
                          <label>
                            Hasil pembicaraan
                            <textarea
                              name="note"
                              required
                              minLength={3}
                              maxLength={2000}
                            />
                          </label>
                          <Field
                            name="followUpAt"
                            label="Tindak lanjut berikutnya"
                            type="datetime-local"
                            value={localMoment(row.followUpAt)}
                            required={false}
                          />
                        </Form>
                      </details>
                    )}
                  </>
                )}
                <h3>Riwayat prospek</h3>
                <div className="bo-prospect-history">
                  {detail.activities.map((a: any) => (
                    <div className="item" key={a.id}>
                      <div>
                        <strong>{a.note}</strong>
                        <small>
                          {when(a.createdAt)} · Catatan {a.revision}
                          {a.metadata?.stage
                            ? ` · ${stages[a.metadata.stage]}`
                            : ""}
                        </small>
                        {a.kind === "STAGE_CHANGED" &&
                          a.metadata.offerTerms && (
                            <p className="bo-prospect-terms">
                              {a.metadata.offerTerms}
                            </p>
                          )}
                        {a.metadata?.lossReason && (
                          <p>{a.metadata.lossReason}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="between">
                  <button
                    className="btn outline small"
                    disabled={activityPage === 1 || busy}
                    onClick={() => void open(row.id, activityPage - 1)}
                  >
                    Riwayat sebelumnya
                  </button>
                  <small>{detail.activityTotal} catatan</small>
                  <button
                    className="btn outline small"
                    disabled={activityPage * 30 >= detail.activityTotal || busy}
                    onClick={() => void open(row.id, activityPage + 1)}
                  >
                    Riwayat berikutnya
                  </button>
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </>
  );
}
