"use client";
import { useState } from "react";
export function AdminPanel({
  requests,
}: {
  requests: { id: string; plan: string; organization: { name: string } }[];
}) {
  const [error, setError] = useState(""),
    [pending, setPending] = useState(false);
  async function activate(id: string) {
    if (!confirm("Aktifkan paket ini? Pastikan permintaan telah diverifikasi."))
      return;
    setPending(true);
    try {
      const r = await fetch("/api/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "activate", requestId: id }),
      });
      const b = await r.json();
      if (!r.ok) throw new Error(b.error);
      location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Koneksi gagal.");
    } finally {
      setPending(false);
    }
  }
  return (
    <section className="panel settings-panel">
      <h2>Permintaan upgrade</h2>
      {error && <p className="error">{error}</p>}
      {requests.length ? (
        requests.map((r) => (
          <div className="stay-detail" key={r.id}>
            <span>
              {r.organization.name} → <b>{r.plan}</b>
            </span>
            <button disabled={pending} onClick={() => activate(r.id)}>
              Aktifkan Paket
            </button>
          </div>
        ))
      ) : (
        <p>Tidak ada permintaan menunggu.</p>
      )}
    </section>
  );
}
