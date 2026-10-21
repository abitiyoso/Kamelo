"use client";
import { useEffect, useState } from "react";
import { identityCall } from "./api";
import { WorkspaceCard } from "../workspace/card";
export function InviteCenter({
  properties,
  stays,
  onChange,
}: {
  properties: { id: string; name: string }[];
  stays: { id: string; name: string; room: string; propertyId: string }[];
  onChange?: () => void;
}) {
  const [data, setData] = useState<any>(null),
    [kind, setKind] = useState("STAFF"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  async function load() {
    setData(await identityCall("/api/invitations"));
  }
  useEffect(() => {
    void load().catch((e) => setError(e.message));
  }, []);
  async function act(body: Record<string, unknown>) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await identityCall("/api/invitations", body);
      await load();
      onChange?.();
      setMessage(
        body.action === "create" || body.action === "resend"
          ? "Undangan tercatat. Pengiriman mengikuti antrean dan konfigurasi email server."
          : "Akses diperbarui.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Undangan gagal.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <WorkspaceCard
      title="Undangan & Akses"
      description="Undang pengguna dengan email miliknya sendiri. Akses aktif setelah email diverifikasi dan undangan diterima."
    >
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
      <form
        className="identity-form"
        method="post"
        onSubmit={(e) => {
          e.preventDefault();
          const d = new FormData(e.currentTarget),
            stay = stays.find((s) => s.id === d.get("stayId"));
          void act({
            action: "create",
            email: d.get("email"),
            kind,
            propertyIds:
              kind === "TENANT"
                ? stay
                  ? [stay.propertyId]
                  : []
                : d.getAll("propertyIds"),
            stayId: kind === "TENANT" ? d.get("stayId") : undefined,
            canRecordPayments: d.get("canRecordPayments") === "on",
            canControlDevices: d.get("canControlDevices") === "on",
            includeAccess: d.get("includeAccess") === "on",
          });
        }}
      >
        <div className="formgrid">
          <label>
            Jenis undangan
            <select value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="STAFF">Staf</option>
              <option value="TENANT">
                Penghuni pada masa tinggal yang tercatat
              </option>
            </select>
          </label>
          <label>
            Email penerima
            <input name="email" type="email" required />
          </label>
        </div>
        {kind === "STAFF" ? (
          <>
            <span>Properti yang ditugaskan</span>
            {properties.map((p) => (
              <label className="checkbox" key={p.id}>
                <input name="propertyIds" type="checkbox" value={p.id} />
                {p.name}
              </label>
            ))}
            <label className="checkbox">
              <input name="canRecordPayments" type="checkbox" />
              Izinkan akses & pencatatan pembayaran
            </label>
          </>
        ) : (
          <label>
            Masa tinggal
            <select name="stayId" required>
              <option value="">Pilih penghuni dan kamar</option>
              {stays.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} · Kamar {s.room}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="checkbox">
          <input name="canControlDevices" type="checkbox" />
          Izinkan kontrol perangkat yang ditetapkan
        </label>
        {kind === "TENANT" && (
          <label className="checkbox">
            <input name="includeAccess" type="checkbox" />
            Izinkan akses digital selama masa tinggal aktif (provider simulasi)
          </label>
        )}
        <small>
          Pemilik harus memverifikasi email sebelum membuat undangan. Batas
          pengguna paket tetap berlaku untuk staf; penghuni tidak menjadi
          anggota organisasi.
        </small>
        <button className="btn" disabled={busy}>
          Kirim undangan
        </button>
      </form>
      <div className="space" />
      <h3>Riwayat undangan</h3>
      {data?.invitations.map((i: any) => (
        <div className="item" key={i.id}>
          <div>
            <strong>{i.recipientEmail}</strong>
            <small>
              {i.kind} · {i.state} · Berakhir{" "}
              {new Date(i.expiresAt).toLocaleString("id-ID")}
            </small>
          </div>
          <div className="bo-leo-questions">
            {["PENDING", "REVOKED"].includes(i.state) && (
              <button
                className="btn outline small"
                disabled={busy}
                onClick={() => act({ action: "resend", id: i.id })}
              >
                Kirim ulang
              </button>
            )}
            {i.state !== "REVOKED" && (
              <button
                className="btn outline small"
                disabled={busy}
                onClick={() => act({ action: "revoke", id: i.id })}
              >
                Cabut
              </button>
            )}
          </div>
        </div>
      ))}
      {data && !data.invitations.length && <p>Belum ada undangan.</p>}
      <div className="space" />
      <h3>Staf aktif</h3>
      {data?.members.map((m: any) => (
        <div className="item" key={m.userId}>
          <div>
            <strong>{m.user.name}</strong>
            <small>{m.user.email}</small>
          </div>
          <button
            className="btn outline small"
            disabled={busy}
            onClick={() => act({ action: "revokeMember", userId: m.userId })}
          >
            Cabut akses staf
          </button>
        </div>
      ))}
      <div className="space" />
      <h3>Akses penghuni</h3>
      {data?.occupants.map((g: any) => (
        <div className="item" key={g.id}>
          <div>
            <strong>{g.user.name}</strong>
            <small>
              {g.user.email} · Kamar {g.stay.room.number} · {g.status}
            </small>
          </div>
          {g.status === "ACTIVE" && (
            <button
              className="btn outline small"
              disabled={busy}
              onClick={() => act({ action: "revokeOccupant", id: g.id })}
            >
              Cabut akses
            </button>
          )}
        </div>
      ))}
    </WorkspaceCard>
  );
}
