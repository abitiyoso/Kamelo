"use client";
import { useEffect, useRef, useState } from "react";
import { BellRing } from "lucide-react";
import { WorkspaceCard } from "./card";
import { rupiah } from "@/lib/plans";
const defaults = {
  enabled: false,
  emailEnabled: false,
  hour: 9,
  leadDays: 0,
  intervalDays: 3,
  revision: 0,
};
export const reminderStatus = (s: string) =>
  ({
    PUBLISHED: "Tersedia di portal",
    QUEUED: "Dalam antrean",
    PROCESSING: "Sedang diproses",
    SINKED: "Tercatat di sink lokal",
    ACCEPTED: "Diterima server email",
    CANCELLED: "Dibatalkan",
    BLOCKED: "Pengiriman diblokir",
    FAILED: "Gagal dikirim",
    UNKNOWN: "Perlu pemeriksaan operator",
  })[s] || s;
export function ReminderAutomation({ propertyId }: { propertyId: string }) {
  const [data, setData] = useState<any>(null),
    [draft, setDraft] = useState(defaults),
    [confirmed, setConfirmed] = useState(false),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(false),
    [message, setMessage] = useState(""),
    [page, setPage] = useState(1);
  const seq = useRef(0),
    active = useRef(false),
    command = useRef<{ signature: string; key: string } | null>(null);
  const call = async (url: string, body?: unknown) => {
    const r = await fetch(url, {
      cache: "no-store",
      ...(body
        ? {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          }
        : {}),
    });
    const d = await r.json();
    if (!r.ok) throw Error(d.error);
    return d;
  };
  async function load(reset = true) {
    const n = ++seq.current;
    setLoading(true);
    try {
      const d = await call(
        `/api/reminder-automation?propertyId=${encodeURIComponent(propertyId)}&page=${page}`,
      );
      if (n === seq.current) {
        setData(d);
        if (reset) {
          setDraft(d.policy);
          setConfirmed(false);
        }
      }
    } finally {
      if (n === seq.current) setLoading(false);
    }
  }
  useEffect(() => {
    setMessage("");
    if (propertyId === "all") return;
    void load().catch((e) => setMessage(e.message));
    return () => {
      seq.current++;
    };
  }, [propertyId, page]);
  async function submit(action: "save" | "run") {
    if (active.current) return;
    active.current = true;
    setBusy(true);
    setMessage("");
    const body = {
        action,
        propertyId,
        confirmed: true,
        ...(action === "save" ? draft : {}),
      },
      signature = JSON.stringify(body);
    if (command.current?.signature !== signature)
      command.current = { signature, key: crypto.randomUUID() };
    try {
      const d = await call("/api/reminder-automation", {
        ...body,
        key: command.current.key,
      });
      command.current = null;
      await load();
      setMessage(
        action === "save"
          ? "Jadwal tersimpan. Pastikan worker pengingat berjalan di server."
          : `${d.result.portal} pengingat portal diterbitkan; ${d.result.email} email masuk antrean. Jadwal dan jeda tetap berlaku.`,
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Pengingat belum diproses.");
    } finally {
      active.current = false;
      setBusy(false);
    }
  }
  if (propertyId === "all")
    return (
      <WorkspaceCard title="Pengingat otomatis">
        <p>Pilih satu properti untuk mengatur jadwal pengingat.</p>
      </WorkspaceCard>
    );
  const change = (field: string, value: unknown) => {
    setDraft((d) => ({ ...d, [field]: value }));
    setConfirmed(false);
  };
  return (
    <section
      aria-label="Pengingat otomatis"
      style={{ marginBottom: 24, minWidth: 0 }}
    >
      <WorkspaceCard
        title="Pengingat otomatis"
        description="Tagihan yang tepat, untuk penghuni yang tepat."
      >
        <p>
          <BellRing size={16} aria-hidden="true" /> Jadwal memakai WIB
          (Jakarta). Hanya akun terverifikasi dengan izin tagihan aktif yang
          menerima pengingat. Saldo awal harus dibagikan secara eksplisit.
        </p>
        {message && (
          <p role="status" style={{ overflowWrap: "anywhere" }}>
            {message}
          </p>
        )}
        {!data ? (
          message ? (
            <button
              className="btn outline"
              onClick={() => {
                setMessage("");
                void load().catch((e) => setMessage(e.message));
              }}
            >
              Coba muat jadwal lagi
            </button>
          ) : (
            <p role="status">Memuat jadwal…</p>
          )
        ) : (
          <>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void submit("save");
              }}
            >
              <fieldset
                disabled={busy || loading}
                style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}
              >
                <label
                  style={{
                    display: "flex",
                    flexDirection: "row",
                    gap: 10,
                    alignItems: "center",
                    marginBottom: 14,
                  }}
                >
                  <input
                    type="checkbox"
                    style={{ width: 18, height: 18, margin: 0, flexShrink: 0 }}
                    checked={draft.enabled}
                    onChange={(e) => change("enabled", e.target.checked)}
                  />
                  Aktifkan pengingat portal otomatis
                </label>
                <div className="grid cols3" style={{ marginBottom: 18 }}>
                  <label>
                    Jam mulai (WIB)
                    <input
                      type="number"
                      min="0"
                      max="23"
                      required
                      value={draft.hour}
                      onChange={(e) => change("hour", Number(e.target.value))}
                    />
                  </label>
                  <label>
                    Hari sebelum jatuh tempo
                    <input
                      type="number"
                      min="0"
                      max="30"
                      required
                      value={draft.leadDays}
                      onChange={(e) =>
                        change("leadDays", Number(e.target.value))
                      }
                    />
                  </label>
                  <label>
                    Jeda pengulangan (hari)
                    <input
                      type="number"
                      min="1"
                      max="30"
                      required
                      value={draft.intervalDays}
                      onChange={(e) =>
                        change("intervalDays", Number(e.target.value))
                      }
                    />
                  </label>
                </div>
                <label
                  style={{
                    display: "flex",
                    flexDirection: "row",
                    gap: 10,
                    alignItems: "center",
                  }}
                >
                  <input
                    type="checkbox"
                    style={{ width: 18, height: 18, margin: 0, flexShrink: 0 }}
                    checked={draft.emailEnabled}
                    onChange={(e) => change("emailEnabled", e.target.checked)}
                  />
                  Tambahkan pengingat melalui email
                </label>
                <p>
                  Kanal email:{" "}
                  {data.transport === "sink"
                    ? "sink lokal untuk pengujian"
                    : data.transport === "disabled"
                      ? "belum diaktifkan"
                      : "SMTP dengan pembatasan pengiriman"}
                  . Email mengarahkan penghuni ke saldo terbaru di portal.
                  Status diterima server belum berarti masuk inbox atau dibaca.
                </p>
                <p>
                  Pengingat dilewati bila lunas, dibatalkan, belum masuk jadwal,
                  bukti bayar menunggu, atau akses tidak aktif. Maksimal 20 per
                  kanal dalam satu putaran; worker melanjutkan sisanya pada
                  putaran berikutnya.
                </p>
                <label
                  style={{
                    display: "flex",
                    flexDirection: "row",
                    gap: 10,
                    alignItems: "center",
                    marginBottom: 16,
                  }}
                >
                  <input
                    type="checkbox"
                    style={{ width: 18, height: 18, margin: 0, flexShrink: 0 }}
                    required
                    checked={confirmed}
                    onChange={(e) => setConfirmed(e.target.checked)}
                  />
                  Saya sudah meninjau jadwal dan kanal pengingat ini.
                </label>
                <button
                  className="btn"
                  type="submit"
                  disabled={!confirmed || busy || loading}
                >
                  Simpan jadwal
                </button>{" "}
                <button
                  className="btn outline"
                  type="button"
                  disabled={
                    busy ||
                    loading ||
                    !data.policy.enabled ||
                    JSON.stringify(draft) !== JSON.stringify(data.policy)
                  }
                  onClick={() => void submit("run")}
                >
                  Jalankan jadwal sekarang
                </button>
              </fieldset>
            </form>
            <p>
              Putaran terakhir:{" "}
              {data.policy.lastRunAt
                ? new Date(data.policy.lastRunAt).toLocaleString("id-ID", {
                    timeZone: "Asia/Jakarta",
                  }) + " WIB"
                : "belum dijalankan"}
              . Tidak mengirim WhatsApp.
            </p>
            <details>
              <summary>
                Kandidat portal saat ini ({data.candidates.length}
                {data.candidates.length === 20 ? "+" : ""})
              </summary>
              {data.candidates.length ? (
                data.candidates.map((r: any, i: number) => (
                  <p key={i}>
                    {r.source === "INVOICE" ? "Invoice" : "Saldo awal"} ·{" "}
                    {r.reference} · {rupiah(r.amount)} · {r.due}
                  </p>
                ))
              ) : (
                <p>Belum ada kandidat yang memenuhi jadwal dan ketentuan.</p>
              )}
            </details>
            <details style={{ marginTop: 16 }}>
              <summary>Riwayat pengingat ({data.total})</summary>
              <div>
                {data.history.length ? (
                  data.history.map((r: any) => (
                    <article
                      key={r.id}
                      className="item"
                      style={{ flexWrap: "wrap", gap: 8 }}
                    >
                      <div style={{ minWidth: 0, overflowWrap: "anywhere" }}>
                        <strong>{r.reference}</strong>
                        <p>
                          {rupiah(r.amount)} · jatuh tempo {r.due}
                        </p>
                        <small>
                          {new Date(r.createdAt).toLocaleString("id-ID", {
                            timeZone: "Asia/Jakarta",
                          })}{" "}
                          WIB · {r.channel === "PORTAL" ? "Portal" : "Email"}
                        </small>
                      </div>
                      <div>
                        <span className="tag">
                          {reminderStatus(
                            r.status === "CANCELLED"
                              ? r.status
                              : r.emailOutbox?.status || r.status,
                          )}
                        </span>
                        {r.reason && (
                          <small style={{ display: "block" }}>
                            Sumber atau konfigurasi berubah; pengingat
                            dibatalkan.
                          </small>
                        )}
                      </div>
                    </article>
                  ))
                ) : (
                  <p>Belum ada pengingat otomatis.</p>
                )}
              </div>
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
                  Riwayat sebelumnya
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
                  Riwayat berikutnya
                </button>
              </div>
            </details>
            <button
              style={{ marginTop: 16 }}
              className="btn outline"
              disabled={busy || loading}
              onClick={() => {
                setMessage("");
                void load().catch((e) => setMessage(e.message));
              }}
            >
              Perbarui jadwal
            </button>
          </>
        )}
      </WorkspaceCard>
    </section>
  );
}
