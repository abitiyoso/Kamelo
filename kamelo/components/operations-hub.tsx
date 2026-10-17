"use client";
import { useState } from "react";
import {
  ClipboardList,
  Plus,
  CircleCheck,
  Clock3,
  ExternalLink,
  Copy,
} from "lucide-react";
export type OperationTicket = {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  assigneeId: string | null;
  assignee: { name: string } | null;
  stay: { room: { number: string }; guest: { name: string } } | null;
  updates: { id: string; note: string; status: string; createdAt: string }[];
};
export type OperationStay = {
  id: string;
  name: string;
  room: string;
  start: string;
  end: string | null;
  status: string;
};
const statusLabel: Record<string, string> = {
  OPEN: "Baru",
  IN_PROGRESS: "Dikerjakan",
  RESOLVED: "Selesai",
};
type Mutate = (
  action: string,
  values: Record<string, unknown>,
) => Promise<unknown>;
export function OperationsHub({
  tickets,
  stays,
  team,
  owner,
  demo,
  mutate,
  pending,
}: {
  tickets: OperationTicket[];
  stays: OperationStay[];
  team: { id: string; name: string }[];
  owner: boolean;
  demo: boolean;
  mutate: Mutate;
  pending: boolean;
}) {
  const [view, setView] = useState("OPEN"),
    [creating, setCreating] = useState(false),
    [selected, setSelected] = useState<string | null>(null),
    [error, setError] = useState("");
  const ticket = tickets.find((t) => t.id === selected);
  async function submit(e: React.FormEvent<HTMLFormElement>, action: string) {
    e.preventDefault();
    setError("");
    const form = e.currentTarget;
    try {
      await mutate(action, Object.fromEntries(new FormData(form)));
      setCreating(false);
      setSelected(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menyimpan.");
    }
  }
  return (
    <section className="panel operations-hub" id="operations">
      <div className="panel-title">
        <div>
          <span className="eyebrow">OPERASIONAL HARIAN</span>
          <h2>
            <ClipboardList size={20} /> Pekerjaan & komplain
          </h2>
        </div>
        <button
          className="secondary"
          disabled={demo || pending}
          onClick={() => {
            setCreating(!creating);
            setSelected(null);
          }}
        >
          <Plus size={17} /> Buat tiket
        </button>
      </div>
      <p>
        Catat permintaan, tetapkan penanggung jawab, dan pantau progres tanpa
        kehilangan riwayat.
      </p>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <div className="ops-tabs" role="group" aria-label="Filter pekerjaan">
        {["OPEN", "IN_PROGRESS", "RESOLVED", "ALL"].map((s) => (
          <button
            key={s}
            className={view === s ? "active" : "secondary"}
            onClick={() => setView(s)}
          >
            {statusLabel[s] || "Semua"}{" "}
            <small>
              {tickets.filter((t) => s === "ALL" || t.status === s).length}
            </small>
          </button>
        ))}
      </div>
      {creating && (
        <form
          className="ops-form"
          onSubmit={(e) => void submit(e, "ticketCreate")}
        >
          <label>
            Judul pekerjaan
            <input
              name="title"
              required
              minLength={3}
              maxLength={120}
              placeholder="Contoh: AC kamar 02 perlu diperiksa"
            />
          </label>
          <label>
            Detail
            <textarea
              name="description"
              required
              minLength={3}
              maxLength={2000}
            />
          </label>
          <div className="ops-form-grid">
            <label>
              Kategori
              <select name="category">
                <option value="MAINTENANCE">Perawatan</option>
                <option value="COMPLAINT">Komplain</option>
                <option value="CLEANING">Kebersihan</option>
                <option value="OTHER">Lainnya</option>
              </select>
            </label>
            <label>
              Prioritas
              <select name="priority">
                <option value="NORMAL">Normal</option>
                <option value="URGENT">Mendesak</option>
                <option value="LOW">Rendah</option>
              </select>
            </label>
            <label>
              Penghuni terkait
              <select name="stayId">
                <option value="">Umum / area bersama</option>
                {stays.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.room} · {s.name}
                  </option>
                ))}
              </select>
            </label>
            {owner && (
              <label>
                Penanggung jawab
                <select name="assigneeId">
                  <option value="">Belum ditugaskan</option>
                  {team.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          <button disabled={pending}>Simpan tiket</button>
        </form>
      )}
      <div className="ops-list">
        {tickets
          .filter((t) => view === "ALL" || t.status === view)
          .map((t) => (
            <button
              key={t.id}
              className="ops-ticket"
              onClick={() => {
                setSelected(selected === t.id ? null : t.id);
                setCreating(false);
              }}
            >
              <span className={`ops-ticket-icon ${t.status.toLowerCase()}`}>
                {t.status === "RESOLVED" ? (
                  <CircleCheck size={20} />
                ) : (
                  <Clock3 size={20} />
                )}
              </span>
              <span>
                <b>{t.title}</b>
                <small>
                  {t.stay
                    ? `Kamar ${t.stay.room.number} · `
                    : "Area bersama · "}
                  {t.assignee?.name || "Belum ditugaskan"}
                </small>
              </span>
              <span
                className={
                  "badge " + (t.priority === "URGENT" ? "orange" : "blue")
                }
              >
                {t.priority === "URGENT" ? "Mendesak · " : ""}
                {statusLabel[t.status]}
              </span>
            </button>
          ))}
      </div>
      {!tickets.some((t) => view === "ALL" || t.status === view) && (
        <div className="ops-empty">
          <CircleCheck size={28} />
          <b>
            Tidak ada pekerjaan{" "}
            {view === "ALL"
              ? "tercatat"
              : (statusLabel[view] || "").toLowerCase()}
            .
          </b>
          <p>Tiket dari portal penghuni juga akan masuk ke sini.</p>
        </div>
      )}
      {ticket && (
        <div className="ops-detail">
          <h3>{ticket.title}</h3>
          <p className="preserve-lines">{ticket.description}</p>
          <ol>
            {ticket.updates.map((u) => (
              <li key={u.id}>
                <b>{statusLabel[u.status]}</b> · {u.note}
                <small>{new Date(u.createdAt).toLocaleString("id-ID")}</small>
              </li>
            ))}
          </ol>
          <form
            className="ops-form"
            onSubmit={(e) => void submit(e, "ticketUpdate")}
          >
            <input type="hidden" name="ticketId" value={ticket.id} />
            <div className="ops-form-grid">
              <label>
                Status
                <select name="status" defaultValue={ticket.status}>
                  {Object.entries(statusLabel).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
              {owner && (
                <label>
                  Penanggung jawab
                  <select
                    name="assigneeId"
                    defaultValue={ticket.assigneeId || ""}
                  >
                    <option value="">Belum ditugaskan</option>
                    {team.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
            <label>
              Catatan progres (terlihat oleh penghuni terkait)
              <textarea name="note" required minLength={3} maxLength={2000} />
            </label>
            <button disabled={demo || pending}>
              Simpan progres{!owner ? " & ambil tugas" : ""}
            </button>
          </form>
        </div>
      )}
    </section>
  );
}

export function StayShare({
  stayId,
  propertyId,
  demo,
}: {
  stayId: string;
  propertyId: string;
  demo: boolean;
}) {
  const [url, setUrl] = useState(""),
    [message, setMessage] = useState(""),
    [pending, setPending] = useState(false);
  async function create() {
    setPending(true);
    setMessage("");
    try {
      const r = await fetch("/api/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "stayLink", propertyId, stayId }),
      });
      const b = await r.json();
      if (!r.ok) throw new Error(b.error);
      setUrl(b.url);
      setMessage(
        "Berlaku maksimal 14 hari selama masa tinggal aktif. Tautan sebelumnya dicabut.",
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Gagal membuat tautan.");
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="stay-share">
      <button
        className="secondary"
        disabled={demo || pending}
        onClick={() => void create()}
      >
        <ExternalLink size={16} />{" "}
        {url ? "Perbarui tautan layanan" : "Bagikan portal layanan"}
      </button>
      {url && (
        <div>
          <input
            aria-label="Tautan portal layanan"
            readOnly
            value={url}
            onFocus={(e) => e.currentTarget.select()}
          />
          <button
            className="secondary"
            onClick={() =>
              void navigator.clipboard
                .writeText(url)
                .then(() => setMessage("Tautan disalin."))
                .catch(() =>
                  setMessage("Pilih tautan lalu salin secara manual."),
                )
            }
          >
            <Copy size={16} /> Salin
          </button>
        </div>
      )}
      {message && <small role="status">{message}</small>}
    </div>
  );
}

export function GuestSettings({
  property,
  owner,
  demo,
  pending,
  mutate,
}: {
  property: {
    wifiSsid?: string;
    hasWifiPassword?: boolean;
    guestInstructions?: string;
    supportPhone?: string;
  };
  owner: boolean;
  demo: boolean;
  pending: boolean;
  mutate: Mutate;
}) {
  const [message, setMessage] = useState("");
  return (
    <section className="panel settings-panel">
      <span className="eyebrow">SMART STAY</span>
      <h2>Panduan & layanan penghuni</h2>
      <p>
        Bagikan portal layanan dari detail kamar saat penghuni sudah aktif. Kata
        sandi Wi-Fi disimpan terenkripsi dan hanya ditampilkan pada tautan masa
        tinggal aktif.
      </p>
      <form
        className="ops-form"
        onSubmit={async (e) => {
          e.preventDefault();
          const form = e.currentTarget;
          setMessage("");
          try {
            await mutate(
              "guestSettings",
              Object.fromEntries(new FormData(form)),
            );
            form.reset();
            setMessage("Pengaturan layanan tersimpan.");
          } catch (e) {
            setMessage(e instanceof Error ? e.message : "Gagal menyimpan.");
          }
        }}
      >
        <div className="ops-form-grid">
          <label>
            Nama Wi-Fi
            <input
              name="wifiSsid"
              defaultValue={property.wifiSsid || ""}
              maxLength={100}
              disabled={!owner || demo}
            />
          </label>
          <label>
            Kata sandi Wi-Fi
            <input
              type="password"
              autoComplete="new-password"
              name="wifiPassword"
              maxLength={128}
              placeholder={
                property.hasWifiPassword
                  ? "Sudah tersimpan · kosongkan untuk mempertahankan"
                  : "Masukkan kata sandi"
              }
              disabled={!owner || demo}
            />
          </label>
        </div>
        <label>
          WhatsApp bantuan
          <input
            name="supportPhone"
            defaultValue={property.supportPhone || ""}
            placeholder="62812…"
            pattern="[+]?[0-9]{8,16}"
            disabled={!owner || demo}
          />
        </label>
        <label>
          Panduan kamar
          <textarea
            name="guestInstructions"
            defaultValue={property.guestInstructions || ""}
            maxLength={5000}
            placeholder="Jam tenang, petunjuk check-out, dan panduan fasilitas…"
            disabled={!owner || demo}
          />
        </label>
        <button disabled={!owner || demo || pending}>
          Simpan layanan penghuni
        </button>
        {message && <p role="status">{message}</p>}
      </form>
    </section>
  );
}
