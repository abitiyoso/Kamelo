"use client";
import { useEffect, useState } from "react";
import {
  Wifi,
  DoorOpen,
  LifeBuoy,
  ClipboardList,
  Lightbulb,
  CheckCircle2,
} from "lucide-react";
import { Brand } from "./brand";
import { Mascot } from "./mascot";
type StayData = {
  property: string;
  room: string;
  guest: string;
  start: string;
  end: string | null;
  wifiSsid: string;
  wifiQr: string | null;
  wifiPassword: string;
  instructions: string;
  supportPhone: string;
  access: { status: string; pin?: string } | null;
  devices: {
    id: string;
    name: string;
    online: boolean;
    state: Record<string, boolean | number>;
    capabilities: Record<string, { type: string; min?: number; max?: number }>;
  }[];
  tickets: {
    id: string;
    title: string;
    status: string;
    updates: { note: string; status: string; createdAt: string }[];
  }[];
};
export function StayPortal({ token }: { token: string }) {
  const [data, setData] = useState<StayData | null>(null),
    [error, setError] = useState(""),
    [pending, setPending] = useState(false),
    [success, setSuccess] = useState("");
  async function load() {
    const r = await fetch("/api/stay/" + token, { cache: "no-store" });
    const b = await r.json();
    if (!r.ok) throw new Error(b.error);
    setData(b);
  }
  useEffect(() => {
    void load().catch((e) => setError(e.message));
  }, [token]);
  async function act(body: Record<string, unknown>) {
    setPending(true);
    setError("");
    setSuccess("");
    try {
      const r = await fetch("/api/stay/" + token, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const b = await r.json();
      if (!r.ok) throw new Error(b.error);
      await load();
      setSuccess(
        body.action === "ticket"
          ? "Permintaan sudah diterima pengelola."
          : "Status simulasi diperbarui.",
      );
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Koneksi gagal.");
      return false;
    } finally {
      setPending(false);
    }
  }
  return (
    <main className="stay-portal">
      <header>
        <Brand />
        <span className="badge blue">Portal penghuni</span>
      </header>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {success && (
        <p role="status" className="success">
          {success}
        </p>
      )}
      {!data ? (
        <section className="panel">
          <h1>{error ? "Tautan tidak tersedia" : "Memuat layanan…"}</h1>
          <p>
            {error
              ? "Minta tautan baru kepada pengelola."
              : "Sebentar, kami menyiapkan informasi kamar Anda."}
          </p>
        </section>
      ) : (
        <>
          <section className="stay-welcome">
            <div>
              <span className="eyebrow">
                {data.property} · KAMAR {data.room}
              </span>
              <h1>Selamat datang, {data.guest}.</h1>
              <p>Semua kebutuhan selama tinggal, dalam satu tempat.</p>
              <small>
                {data.start} — {data.end || "Sampai masa tinggal berakhir"}
              </small>
            </div>
            <Mascot pose="welcome" size={120} />
          </section>
          <div className="stay-grid">
            <section className="panel">
              <Wifi className="service-icon" />
              <h2>Wi-Fi kamar</h2>
              {data.wifiSsid ? (
                <>
                  {data.wifiQr && (
                    <img
                      src={data.wifiQr}
                      width={180}
                      height={180}
                      className="wifi-qr"
                      alt="QR untuk bergabung ke Wi-Fi kamar"
                    />
                  )}
                  <p>
                    Jaringan <b>{data.wifiSsid}</b>
                  </p>
                  <p>
                    Kata sandi{" "}
                    <code>{data.wifiPassword || "Tanpa kata sandi"}</code>
                  </p>
                  <button
                    className="secondary"
                    onClick={() =>
                      void navigator.clipboard
                        .writeText(data.wifiPassword)
                        .then(() => setSuccess("Kata sandi disalin."))
                        .catch(() =>
                          setError("Salin kata sandi secara manual."),
                        )
                    }
                  >
                    Salin kata sandi
                  </button>
                </>
              ) : (
                <p>Informasi Wi-Fi belum diisi pengelola.</p>
              )}
            </section>
            <section className="panel">
              <DoorOpen className="service-icon" />
              <h2>Akses kamar</h2>
              <span className="badge orange">Simulasi kunci digital</span>
              <p>
                {data.access?.pin ? (
                  <>
                    PIN contoh <strong>{data.access.pin}</strong>
                  </>
                ) : (
                  "Akses digital belum diaktifkan atau masih menunggu konfirmasi simulasi."
                )}
              </p>
              <small>
                Kunci fisik belum terhubung. Hubungi pengelola untuk akses
                kamar.
              </small>
            </section>
          </div>
          <section className="panel">
            <h2>Panduan selama tinggal</h2>
            <p className="preserve-lines">
              {data.instructions ||
                "Panduan belum ditambahkan. Silakan hubungi pengelola jika memerlukan bantuan."}
            </p>
            {data.supportPhone && (
              <a
                className="button secondary"
                href={
                  "https://wa.me/" +
                  data.supportPhone.replace(/^0/, "62").replace(/\D/g, "")
                }
                target="_blank"
                rel="noreferrer"
              >
                <LifeBuoy size={18} /> Hubungi pengelola
              </a>
            )}
          </section>
          {data.devices.length > 0 && (
            <section className="panel">
              <h2>
                <Lightbulb size={20} /> Kontrol kamar
              </h2>
              <p>
                Simulasi · hanya perangkat yang diizinkan pengelola untuk kamar
                Anda.
              </p>
              {data.devices.map((d) => (
                <div className="guest-device" key={d.id}>
                  <b>
                    {d.name} <small>{d.online ? "Online" : "Offline"}</small>
                  </b>
                  {Object.entries(d.capabilities).map(([code, cap]) =>
                    cap.type === "boolean" ? (
                      <button
                        key={code}
                        disabled={pending || !d.online}
                        className="secondary"
                        onClick={() =>
                          void act({
                            action: "device",
                            deviceId: d.id,
                            code,
                            value: !d.state[code],
                          })
                        }
                      >
                        {code} · {d.state[code] ? "ON" : "OFF"}
                      </button>
                    ) : cap.type === "integer" ? (
                      <label key={code}>
                        {code}
                        <select
                          value={Number(d.state[code] ?? cap.min ?? 16)}
                          disabled={pending || !d.online}
                          onChange={(e) =>
                            void act({
                              action: "device",
                              deviceId: d.id,
                              code,
                              value: Number(e.target.value),
                            })
                          }
                        >
                          {Array.from(
                            {
                              length: Math.min(
                                100,
                                (cap.max ?? 30) - (cap.min ?? 16) + 1,
                              ),
                            },
                            (_, i) => (cap.min ?? 16) + i,
                          ).map((v) => (
                            <option key={v}>{v}</option>
                          ))}
                        </select>
                      </label>
                    ) : null,
                  )}
                </div>
              ))}
            </section>
          )}
          <section className="panel">
            <h2>
              <ClipboardList size={20} /> Butuh bantuan?
            </h2>
            <p>
              Kirim permintaan kebersihan, perawatan, atau komplain. Pantau
              progresnya di bawah.
            </p>
            <form
              className="ops-form"
              onSubmit={async (e) => {
                e.preventDefault();
                const form = e.currentTarget;
                if (
                  await act({
                    action: "ticket",
                    ...Object.fromEntries(new FormData(form)),
                  })
                )
                  form.reset();
              }}
            >
              <label>
                Judul
                <input name="title" required minLength={3} maxLength={120} />
              </label>
              <label>
                Kategori
                <select name="category">
                  <option value="COMPLAINT">Komplain</option>
                  <option value="MAINTENANCE">Perawatan</option>
                  <option value="CLEANING">Kebersihan</option>
                  <option value="OTHER">Lainnya</option>
                </select>
              </label>
              <label>
                Ceritakan kebutuhan Anda
                <textarea
                  name="description"
                  required
                  minLength={3}
                  maxLength={2000}
                />
              </label>
              <button disabled={pending}>Kirim permintaan</button>
            </form>
          </section>
          <section className="panel">
            <h2>Permintaan Anda</h2>
            {!data.tickets.length ? (
              <p>Belum ada permintaan. Semoga masa tinggal Anda nyaman.</p>
            ) : (
              data.tickets.map((t) => (
                <article className="guest-ticket" key={t.id}>
                  <h3>{t.title}</h3>
                  <span className="badge blue">
                    {{
                      OPEN: "Diterima",
                      IN_PROGRESS: "Dikerjakan",
                      RESOLVED: "Selesai",
                    }[t.status] || t.status}
                  </span>
                  {t.updates.map((u, i) => (
                    <p key={i}>
                      <CheckCircle2 size={14} /> {u.note}
                      <small>
                        {new Date(u.createdAt).toLocaleString("id-ID")}
                      </small>
                    </p>
                  ))}
                </article>
              ))
            )}
          </section>
          <footer>
            Tautan pribadi · berlaku selama masa tinggal aktif. Jangan bagikan
            kepada orang lain.
          </footer>
        </>
      )}
    </main>
  );
}
