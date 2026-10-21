"use client";
import { useEffect, useRef, useState } from "react";
import { identityCall } from "../identity/api";
import { WorkspaceCard } from "./card";
const states: Record<string, string> = {
  DISABLED: "Belum diaktifkan",
  LOCAL_ONLY: "QA lokal",
  UNVERIFIED: "Belum diverifikasi",
  BLOCKED: "Pengiriman dibatasi",
  NEEDS_SETUP: "Perlu setup",
  NOT_CONNECTED: "Belum terhubung",
  SIMULATION_ONLY: "Simulasi",
  RULE_BASED: "Berbasis aturan",
};
const mailStates: Record<string, string> = {
  QUEUED: "Dalam antrean",
  PROCESSING: "Sedang diproses",
  SINKED: "Penampung lokal",
  ACCEPTED: "Diterima layanan pengirim",
  BLOCKED: "Dibatasi",
  FAILED: "Gagal",
  UNKNOWN: "Hasil belum pasti",
  CANCELLED: "Dibatalkan",
};
export function PlatformHealthWorkspace() {
  const [data, setData] = useState<any>(null),
    [page, setPage] = useState(1),
    [domain, setDomain] = useState("all"),
    [error, setError] = useState("");
  const seq = useRef(0);
  async function load() {
    const n = ++seq.current;
    setError("");
    try {
      const d = await identityCall(
        "/api/platform-health?" +
          new URLSearchParams({ page: String(page), domain }),
      );
      if (n === seq.current) setData(d);
    } catch (e) {
      if (n === seq.current) {
        setData(null);
        setError(e instanceof Error ? e.message : "Status belum dapat dimuat.");
      }
    }
  }
  useEffect(() => {
    setData(null);
    void load();
    return () => {
      seq.current++;
    };
  }, [page, domain]);
  return (
    <>
      <div className="pagehead">
        <div>
          <h2>Integrasi & Audit</h2>
          <p>Kesehatan layanan dan aktivitas terotorisasi pelanggan.</p>
        </div>
        <button className="btn outline" onClick={() => void load()}>
          Muat ulang status
        </button>
      </div>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {!data ? (
        <p role="status">Memuat status layanan…</p>
      ) : (
        <>
          <p>
            Snapshot{" "}
            {new Date(data.checkedAt).toLocaleString("id-ID", {
              timeZone: "Asia/Jakarta",
            })}{" "}
            WIB · Kesiapan konfigurasi, bukan bukti koneksi layanan.
          </p>
          <div className="grid cols2">
            <WorkspaceCard title="Status Integrasi">
              {data.readiness.map((r: any) => (
                <div key={r.key} className="item bo-support-row">
                  <div>
                    <strong>{r.name}</strong>
                    <small>{r.description}</small>
                    <span className="tag gold">
                      {states[r.state] || r.state}
                    </span>
                  </div>
                </div>
              ))}
            </WorkspaceCard>
            <WorkspaceCard
              title="Antrean email"
              description="Jumlah seluruh platform. Penerima, isi pesan, token dan error privat tidak ditampilkan."
            >
              {data.mailQueue.map((r: any) => (
                <div className="item" key={r.status}>
                  <span>{mailStates[r.status] || "Status lainnya"}</span>
                  <strong>{r._count._all}</strong>
                </div>
              ))}
              {!data.mailQueue.length && <p>Belum ada catatan pengiriman.</p>}
              <small>
                Diterima layanan pengirim belum memastikan email masuk inbox.
                Panel ini tidak mengirim, mencoba ulang, atau mengubah
                pengaturan.
              </small>
            </WorkspaceCard>
          </div>
          <div className="space" />
          {data.preflight && (
            <WorkspaceCard
              title="Persiapan pengujian layanan nyata"
              description="Tinjauan konfigurasi lokal; belum menguji koneksi provider."
            >
              <p>
                Worker:{" "}
                {data.preflight.application.worker === "CONFIGURED_UNVERIFIED"
                  ? "konfigurasi tersedia, proses belum diverifikasi"
                  : "perlu konfigurasi"}
                . Enkripsi:{" "}
                {data.preflight.application.encryption ===
                "CONFIGURED_UNVERIFIED"
                  ? "kunci tersedia"
                  : "perlu konfigurasi"}
                . Koneksi jaringan pada pemeriksaan ini: 0.
              </p>
              <details>
                <summary>Kebutuhan penerimaan tiap layanan</summary>
                {data.preflight.services.map((s: any) => (
                  <div
                    key={s.key}
                    className="item"
                    style={{ display: "block" }}
                  >
                    <h3>{s.name}</h3>
                    <p>
                      {states[s.state] || s.state} · uji layanan nyata belum
                      dilakukan.
                    </p>
                    <ul>
                      {s.requirements.map((r: string) => (
                        <li key={r}>{r}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </details>
              <details style={{ marginTop: 16 }}>
                <summary>Persiapan operasional rilis</summary>
                <ul>
                  {data.preflight.releaseDependencies.map((r: string) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </details>
            </WorkspaceCard>
          )}
          <div className="space" />
          <WorkspaceCard
            title="Audit Akses & Tindak Lanjut"
            description={data.scope}
          >
            <label>
              Lingkup audit
              <select
                value={domain}
                onChange={(e) => {
                  setDomain(e.target.value);
                  setPage(1);
                }}
              >
                <option value="all">Support dan subscription</option>
                <option value="support">Support</option>
                <option value="subscription">Subscription</option>
              </select>
            </label>
            {data.audits.map((a: any) => (
              <div className="item bo-support-row" key={a.id}>
                <div>
                  <strong>{a.action.replaceAll("_", " ")}</strong>
                  <small>
                    {a.organization.name} ·{" "}
                    {new Date(a.createdAt).toLocaleString("id-ID", {
                      timeZone: "Asia/Jakarta",
                    })}{" "}
                    WIB
                  </small>
                  <small>Referensi {a.targetId}</small>
                </div>
              </div>
            ))}
            {!data.audits.length && (
              <p>Belum ada aktivitas pada lingkup ini.</p>
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
                Halaman {page} · {data.total} catatan
              </small>
              <button
                className="btn outline small"
                disabled={page * 30 >= data.total}
                onClick={() => setPage(page + 1)}
              >
                Berikutnya
              </button>
            </div>
          </WorkspaceCard>
        </>
      )}
    </>
  );
}
