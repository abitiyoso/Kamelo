"use client";
import { AccountSettings } from "../identity/account-settings";
import { useState, type ReactNode } from "react";
import {
  ShieldCheck,
  ReceiptText,
  ClipboardList,
  Camera,
  KeyRound,
  MessageSquare,
  Settings,
} from "lucide-react";
import assets from "@/lib/workspace/assets.json";
import { rupiah } from "@/lib/plans";
export { WorkspaceCard } from "./card";
import { WorkspaceCard } from "./card";
export function WorkspaceKpi({
  label,
  value,
  note,
}: {
  label: string;
  value: ReactNode;
  note: string;
}) {
  return (
    <article className="kpi">
      <div className="label">{label}</div>
      <div className="num money">{value}</div>
      <small>{note}</small>
    </article>
  );
}
export function UnavailableModule({
  title,
  description,
  requirements,
}: {
  title: string;
  description: string;
  requirements?: string[];
}) {
  return (
    <>
      <div className="pagehead">
        <div>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
      </div>
      <WorkspaceCard
        title="Layanan belum tersedia"
        description="Akses akan dibuka setelah backend dan izin layanan siap."
      >
        <div className="item">
          <div className="left">
            <span className="glyph">
              <ShieldCheck size={19} />
            </span>
            <div>
              <strong>Belum diaktifkan</strong>
              <small>Tidak ada tindakan atau data layanan yang dibuat.</small>
            </div>
          </div>
          <span className="tag gold">Perlu penyiapan</span>
        </div>
        {requirements && (
          <ul className="bo-requirements">
            {requirements.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        )}
        <a className="btn outline" href="https://wa.me/6281933328899">
          Hubungi ELENIO
        </a>
      </WorkspaceCard>
    </>
  );
}
export function WorkspaceAccount({
  enabled = false,
  name,
  email,
  phone,
  role,
  context,
  onSettings,
  onLogout,
}: {
  enabled?: boolean;
  name: string;
  email?: string;
  phone?: string;
  role: string;
  context: string;
  onSettings?: () => void;
  onLogout?: () => void;
}) {
  if (enabled) return <AccountSettings onSettings={onSettings} />;
  return (
    <>
      <div className="pagehead">
        <div>
          <h1>Akun & Pengaturan</h1>
          <p>Informasi akun, keamanan, dan akses Anda.</p>
        </div>
      </div>
      <div className="grid cols2">
        <WorkspaceCard title="Profil Akun">
          <dl className="bo-profile-fields">
            <dt>Nama lengkap</dt>
            <dd>{name || "Memuat akun…"}</dd>
            <dt>Email</dt>
            <dd>{email || "Tidak tersedia pada akses ini"}</dd>
            <dt>Nomor HP</dt>
            <dd>{phone || "Belum tersedia"}</dd>
          </dl>
          <p className="bo-muted">
            Perubahan profil dan verifikasi kontak belum diaktifkan.
          </p>
        </WorkspaceCard>
        <WorkspaceCard title="Keamanan & Akses">
          <div className="item">
            <div>
              <strong>Konteks aktif</strong>
              <small>
                {role} · {context}
              </small>
            </div>
            <ShieldCheck size={19} />
          </div>
          <p>
            Pengelolaan sesi, undangan, dan pergantian workspace memerlukan
            layanan identitas terverifikasi.
          </p>
          {role !== "Penghuni" && (
            <a className="btn outline" href="/forgot-password">
              Pemulihan kata sandi
            </a>
          )}
          {onLogout && (
            <button className="btn outline" onClick={onLogout}>
              Keluar dari akun
            </button>
          )}
        </WorkspaceCard>
        <WorkspaceCard title="Pengaturan layanan">
          <p>Hak akses mengikuti akun dan properti yang diberikan pengelola.</p>
          {onSettings ? (
            <button className="btn" onClick={onSettings}>
              <Settings size={16} />
              Pengaturan properti & paket
            </button>
          ) : (
            <p>Perubahan akses dikelola oleh pengelola properti.</p>
          )}
        </WorkspaceCard>
        <WorkspaceCard title="Kebijakan Data">
          <p>
            Riwayat masa tinggal dan pembayaran tetap disimpan saat akses
            berakhir.
          </p>
          <a className="btn outline" href="/privacy">
            Kebijakan privasi
          </a>
          <a className="btn outline" href="https://wa.me/6281933328899">
            Bantuan pelanggan
          </a>
        </WorkspaceCard>
      </div>
    </>
  );
}
export function CctvReadiness() {
  return (
    <>
      <div className="pagehead">
        <div>
          <h1>CCTV & Video Analytics</h1>
          <p>
            Pantau kamera area bersama, tinjau peristiwa AI, dan kelola tindak
            lanjut.
          </p>
        </div>
      </div>
      <div className="grid cols3">
        <WorkspaceKpi
          label="Koneksi VMS"
          value="Belum terhubung"
          note="Gateway belum dikonfigurasi"
        />
        <WorkspaceKpi
          label="Peristiwa terverifikasi"
          value="—"
          note="Memerlukan sumber kamera aktual"
        />
        <WorkspaceKpi
          label="Tugas insiden"
          value="—"
          note="Tidak ada event provider yang disinkronkan"
        />
      </div>
      <div className="space" />
      <WorkspaceCard
        title="Cakupan kamera area bersama"
        description="Referensi area; bukan kamera atau lokasi yang terdaftar pada properti Anda."
      >
        <div className="grid cols2">
          {[
            ["lobby", "Lobby Utama"],
            ["corridor", "Koridor"],
            ["parking", "Area Parkir"],
            ["emergency", "Tangga Darurat"],
          ].map(([key, label]) => (
            <figure className="bo-camera" key={key}>
              <img
                src={assets[key as keyof typeof assets]}
                alt={"Referensi area bersama: " + label}
              />
              <figcaption>
                <strong>{label}</strong>
                <small>Belum dipetakan · belum terhubung</small>
              </figcaption>
            </figure>
          ))}
        </div>
      </WorkspaceCard>
      <div className="space" />
      <UnavailableModule
        title="Peristiwa & tindak lanjut"
        description="Event harus berasal dari kamera berizin dan melalui pemeriksaan manusia."
        requirements={[
          "Kredensial VMS dan pemetaan zona area bersama",
          "Izin petugas, retensi rekaman, dan kebijakan privasi",
          "Event terverifikasi sebelum membuat tugas insiden",
        ]}
      />
    </>
  );
}
export function LeoWorkspace({
  propertyId,
  demo = false,
}: {
  propertyId: string;
  demo?: boolean;
}) {
  const [result, setResult] = useState<{
      summary: string;
      items: string[];
      next: string;
    } | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <>
      <div className="pagehead">
        <div>
          <h1>LEO Insights</h1>
          <p>
            Ringkasan berbasis aturan dari data properti. AI generatif belum
            terhubung.
          </p>
        </div>
      </div>
      <WorkspaceCard title="Prioritas operasional">
        <div className="bo-leo-questions">
          {[
            ["briefing", "Ringkasan hari ini"],
            ["income", "Penerimaan"],
            ["overdue", "Tunggakan"],
            ["rooms", "Kamar"],
            ["tasks", "Pekerjaan"],
          ].map(([topic, label]) => (
            <button
              className="btn outline"
              disabled={busy || demo}
              key={topic}
              onClick={async () => {
                setBusy(true);
                setError("");
                try {
                  const r = await fetch("/api/leo", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ propertyId, topic }),
                  });
                  const b = await r.json();
                  if (!r.ok) throw Error(b.error);
                  setResult(b);
                } catch (e) {
                  setError(
                    e instanceof Error
                      ? e.message
                      : "Ringkasan belum tersedia.",
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              {label}
            </button>
          ))}
        </div>
        {demo && (
          <p>Ringkasan aktual tersedia setelah masuk ke properti Anda.</p>
        )}
        {busy && <p role="status">Memuat ringkasan…</p>}
        {error && <p role="alert">{error}</p>}
        {result && (
          <div className="bo-leo-result">
            <h3>{result.summary}</h3>
            <ul>
              {result.items.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
            <p>{result.next}</p>
            <small>
              Berbasis aturan · tidak menjalankan tindakan otomatis.
            </small>
          </div>
        )}
      </WorkspaceCard>
    </>
  );
}
export function ResidentDirectory({
  rows,
  onOpen,
}: {
  rows: {
    id: string;
    name: string;
    phone: string;
    room: string;
    status: string;
    start: string;
    end: string | null;
  }[];
  onOpen: (id: string) => void;
}) {
  const [search, setSearch] = useState("");
  return (
    <>
      <div className="pagehead">
        <div>
          <h1>Database Penghuni</h1>
          <p>Kontak dan masa tinggal yang tercatat pada properti aktif.</p>
        </div>
      </div>
      <WorkspaceCard
        title="Penghuni & riwayat masa tinggal"
        description="Customer 360 lintas properti, kontrak, dan klaim akun belum diaktifkan."
      >
        <label className="bo-search-label">
          Cari penghuni
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nama atau kamar"
          />
        </label>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Penghuni</th>
                <th>Kamar</th>
                <th>Masa tinggal</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows
                .filter((r) =>
                  (r.name + " " + r.room)
                    .toLowerCase()
                    .includes(search.toLowerCase()),
                )
                .map((r) => (
                  <tr key={r.id}>
                    <td>
                      <strong>{r.name}</strong>
                      <small>{r.phone || "Kontak belum diisi"}</small>
                    </td>
                    <td>{r.room}</td>
                    <td>
                      {r.start} — {r.end || "Berjalan"}
                    </td>
                    <td>{r.status}</td>
                    <td>
                      <button
                        className="btn outline"
                        onClick={() => onOpen(r.id)}
                      >
                        Detail
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        {!rows.length && (
          <p>
            Belum ada penghuni. Tambahkan masa tinggal melalui Properti & Kamar.
          </p>
        )}
      </WorkspaceCard>
    </>
  );
}
