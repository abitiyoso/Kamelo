"use client";
import { useEffect, useState } from "react";
import { accountCall, identityCall } from "./api";
import { WorkspaceCard } from "../workspace/card";
import { SupportWorkspace } from "../workspace/support";
import { PrivacyWorkspace } from "../workspace/privacy";
const delivery: Record<string, string> = {
  QUEUED: "Dalam antrean",
  PROCESSING: "Sedang diproses",
  SINKED: "Tersimpan di penampung lokal; tidak dikirim ke email nyata",
  ACCEPTED: "Diterima layanan pengirim; penerimaan inbox belum dikonfirmasi",
  BLOCKED: "Pengiriman belum diaktifkan",
  FAILED: "Pengiriman gagal",
  UNKNOWN: "Hasil pengiriman belum pasti; perlu ditinjau",
  CANCELLED: "Permintaan sudah tidak aktif",
};
export function AccountSettings({ onSettings }: { onSettings?: () => void }) {
  const [data, setData] = useState<any>(null),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [help, setHelp] = useState(false),
    [privacy, setPrivacy] = useState(false);
  async function load() {
    setData(await identityCall("/api/account"));
  }
  useEffect(() => {
    void load().catch((e) => setError(e.message));
  }, []);
  async function act(action: string, body: Record<string, unknown> = {}) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const r = await accountCall(action, body);
      if (r.redirect) {
        location.href = r.redirect;
        return;
      }
      await load();
      setMessage(
        action === "changeEmail"
          ? "Permintaan perubahan email tercatat. Buka tautan verifikasi pada alamat baru; alamat lama tetap berlaku sampai diverifikasi."
          : action === "resend"
            ? "Permintaan verifikasi tercatat. Periksa status pengiriman."
            : "Perubahan berhasil disimpan.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Permintaan gagal.");
    } finally {
      setBusy(false);
    }
  }
  const p = data?.profile;
  return (
    <>
      <div className="pagehead">
        <div>
          <h2>Akun & Pengaturan</h2>
          <p>Profil, verifikasi kontak, dan keamanan akun Anda.</p>
        </div>
        <a className="btn outline" href="/workspaces">
          Ganti workspace
        </a>
      </div>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="success">
          {message}
        </p>
      )}
      {!p ? (
        <p role="status">Memuat akun…</p>
      ) : (
        <div className="grid cols2">
          <WorkspaceCard title="Profil Akun">
            <form
              className="identity-form"
              method="post"
              key={p.name + String(p.notificationsEnabled)}
              onSubmit={(e) => {
                e.preventDefault();
                const d = new FormData(e.currentTarget);
                void act("profile", {
                  name: d.get("name"),
                  notificationsEnabled: d.get("notificationsEnabled") === "on",
                });
              }}
            >
              <label>
                Nama lengkap
                <input
                  name="name"
                  defaultValue={p.name}
                  minLength={2}
                  maxLength={100}
                  required
                />
              </label>
              <label>
                Email
                <input value={p.email} readOnly />
              </label>
              <span className={"tag " + (p.emailVerifiedAt ? "" : "gold")}>
                {p.emailVerifiedAt
                  ? "Email terverifikasi"
                  : "Email belum diverifikasi"}
              </span>
              {!p.emailVerifiedAt && (
                <button
                  className="btn outline"
                  type="button"
                  disabled={busy}
                  onClick={() => act("resend")}
                >
                  Kirim tautan verifikasi
                </button>
              )}
              <label>
                Nomor HP
                <input value={p.phone} readOnly />
              </label>
              <small>
                {p.phoneVerifiedAt
                  ? "Nomor terverifikasi"
                  : "Verifikasi dan perubahan nomor HP belum tersedia sampai provider dikonfigurasi."}
              </small>
              <label className="checkbox">
                <input
                  name="notificationsEnabled"
                  type="checkbox"
                  defaultChecked={p.notificationsEnabled}
                />
                Notifikasi layanan melalui email
              </label>
              <small>
                Pesan keamanan akun tetap diperlukan. Pengaturan ini tidak
                mengaktifkan pengingat tagihan otomatis.
              </small>
              <button className="btn" disabled={busy}>
                Simpan profil
              </button>
            </form>
            {p.pendingEmail && (
              <p>Menunggu verifikasi alamat baru: {p.pendingEmail}</p>
            )}
            {data.mail && (
              <p className="bo-muted">
                Status email terakhir:{" "}
                {delivery[data.mail.status] || data.mail.status}
              </p>
            )}
          </WorkspaceCard>
          <WorkspaceCard title="Keamanan & Akses">
            <form
              className="identity-form"
              method="post"
              onSubmit={(e) => {
                e.preventDefault();
                const f = e.currentTarget,
                  d = new FormData(f);
                void act("changeEmail", {
                  email: d.get("email"),
                  password: d.get("password"),
                }).then(() => f.reset());
              }}
            >
              <h3>Ubah alamat email</h3>
              <label>
                Email baru
                <input
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                />
              </label>
              <label>
                Kata sandi saat ini
                <input
                  name="password"
                  type="password"
                  required
                  autoComplete="current-password"
                />
              </label>
              <button className="btn outline" disabled={busy}>
                Minta verifikasi alamat baru
              </button>
            </form>
            <div className="space" />
            <form
              className="identity-form"
              method="post"
              onSubmit={(e) => {
                e.preventDefault();
                const d = new FormData(e.currentTarget);
                void act("changePassword", {
                  currentPassword: d.get("currentPassword"),
                  password: d.get("password"),
                });
              }}
            >
              <h3>Ubah kata sandi</h3>
              <label>
                Kata sandi saat ini
                <input
                  name="currentPassword"
                  type="password"
                  required
                  autoComplete="current-password"
                />
              </label>
              <label>
                Kata sandi baru
                <input
                  name="password"
                  type="password"
                  required
                  minLength={10}
                  maxLength={128}
                  autoComplete="new-password"
                />
              </label>
              <small>
                Perubahan kata sandi mencabut semua sesi, termasuk sesi ini.
              </small>
              <button className="btn" disabled={busy}>
                Simpan kata sandi baru
              </button>
            </form>
            <a className="linkbtn" href="/forgot-password">
              Pemulihan kata sandi
            </a>
          </WorkspaceCard>
          <WorkspaceCard
            title="Sesi & Perangkat"
            description="Hanya sesi milik akun Anda ditampilkan."
          >
            {data.sessions.map((s: any) => (
              <div className="item" key={s.id}>
                <div>
                  <strong>{s.current ? "Sesi ini" : "Sesi lain"}</strong>
                  <small>{s.userAgent}</small>
                  <small>
                    Masuk {new Date(s.createdAt).toLocaleString("id-ID")}
                  </small>
                </div>
                <button
                  className="btn outline small"
                  disabled={busy}
                  onClick={() => act("revokeSession", { id: s.id })}
                >
                  Cabut sesi
                </button>
              </div>
            ))}
            <button
              className="btn outline"
              disabled={busy}
              onClick={() => act("revokeOthers")}
            >
              Cabut sesi lain
            </button>
          </WorkspaceCard>
          <WorkspaceCard title="Pengaturan layanan">
            {data.contexts.some(
              (c: any) => c.active && c.type === "ORG" && c.role === "OWNER",
            ) && (
              <button
                className="btn outline"
                aria-expanded={help}
                onClick={() => {
                  setHelp(!help);
                  setPrivacy(false);
                }}
              >
                Bantuan pelanggan
              </button>
            )}
            <p>
              Akses mengikuti workspace dan masa tinggal yang diberikan
              pengelola.
            </p>
            {onSettings && (
              <button className="btn" onClick={onSettings}>
                Pengaturan properti & paket
              </button>
            )}
            <a className="btn outline" href="/workspaces">
              Workspace & undangan saya
            </a>
            <button
              className="btn outline"
              disabled={!p.emailVerifiedAt}
              aria-expanded={privacy}
              onClick={() => {
                setPrivacy(!privacy);
                setHelp(false);
              }}
            >
              Privasi & salinan data
            </button>
            <a className="btn outline" href="/privacy">
              Kebijakan privasi
            </a>
            <p>
              Permintaan penutupan akun, ekspor, dan penghapusan data memerlukan
              peninjauan retensi dan kepemilikan oleh dukungan ELENIO.
            </p>
            <a className="btn outline" href="https://wa.me/6281933328899">
              Hubungi ELENIO
            </a>
          </WorkspaceCard>
        </div>
      )}
      {privacy && p?.emailVerifiedAt && <PrivacyWorkspace />}
      {help &&
        data?.contexts.some(
          (c: any) => c.active && c.type === "ORG" && c.role === "OWNER",
        ) && <SupportWorkspace />}
    </>
  );
}
