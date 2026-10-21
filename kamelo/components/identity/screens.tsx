"use client";
import { useEffect, useState } from "react";
import { IdentityFrame } from "./frame";
import { accountCall, identityCall } from "./api";
export function IdentityScreen({ mode }: { mode: string }) {
  const [token, setToken] = useState(""),
    [data, setData] = useState<any>(null),
    [profile, setProfile] = useState<any>(null),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function load() {
    try {
      const a = await identityCall("/api/account");
      setProfile({ ...a.profile, mail: a.mail });
      if (mode === "workspaces") setData(a);
    } catch {
      setProfile(null);
    }
  }
  useEffect(() => {
    const t = new URLSearchParams(location.hash.slice(1)).get("token") || "";
    setToken(t);
    void load();
    if (mode === "invite" && t)
      void identityCall("/api/invitations", { action: "preview", token: t })
        .then(setData)
        .catch((e) => setError(e.message));
  }, [mode]);
  async function act(fn: () => Promise<any>) {
    setBusy(true);
    setError("");
    try {
      const b = await fn();
      if (b.redirect) location.href = b.redirect;
      else {
        setMessage("Permintaan tercatat.");
        await load();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Permintaan gagal.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <IdentityFrame>
      {mode === "verify-email" ? (
        <>
          <div className="stepper">
            <i className="active" />
            <i className="active" />
            <i />
          </div>
          <h1>Verifikasi email Anda</h1>
          <p>
            Gunakan tautan pribadi dari email. Masa berlaku tercantum di email
            dan tautan hanya dapat dipakai sekali. Masuk dengan akun yang sedang
            diverifikasi.
          </p>
          {profile && (
            <p>
              <strong>{profile.email}</strong> ·{" "}
              {profile.emailVerifiedAt
                ? "Email terverifikasi"
                : "Menunggu verifikasi"}
            </p>
          )}
          {profile?.emailVerifiedAt && !token ? (
            <a className="btn wide" href="/workspaces">
              Lanjut ke workspace
            </a>
          ) : (
            <button
              className="btn wide"
              disabled={busy || !token || !profile}
              onClick={() => act(() => accountCall("verify", { token }))}
            >
              Verifikasi email
            </button>
          )}
          <button
            className="btn outline wide"
            disabled={busy || !profile}
            onClick={() => act(() => accountCall("resend"))}
          >
            Kirim ulang tautan
          </button>
          <p className="bo-muted">
            {process.env.NODE_ENV === "development"
              ? "Pengiriman mengikuti konfigurasi server."
              : "Status pengiriman mengikuti layanan server; antrean bukan konfirmasi email sudah diterima."}
          </p>
          {profile && (
            <p>
              Status:{" "}
              {profile.mail?.status === "SINKED"
                ? "Tersimpan di penampung pengujian lokal; tidak dikirim ke email."
                : profile.mail?.status === "BLOCKED"
                  ? "Pengiriman belum diaktifkan. Hubungi pengelola."
                  : profile.mail?.status === "ACCEPTED"
                    ? "Diterima penyedia email; periksa kotak masuk dan spam."
                    : profile.mail?.status === "QUEUED"
                      ? "Menunggu pengiriman."
                      : "Periksa status pengiriman di halaman akun."}
            </p>
          )}
          <a className="linkbtn" href="/login">
            Masuk ke akun saya
          </a>
        </>
      ) : mode === "invite" ? (
        <>
          <h1>Tinjau undangan</h1>
          {data ? (
            <>
              <p>
                Anda diundang ke <strong>{data.organization}</strong> sebagai{" "}
                {data.kind === "TENANT" ? "Penghuni" : "Staf"}.
              </p>
              <p>
                Tujuan: {data.recipientHint}. Berlaku sampai{" "}
                {new Date(data.expiresAt).toLocaleString("id-ID")}.
              </p>
              <p>
                Verifikasi email tujuan sebelum menerima akses. Akun dan kata
                sandi tetap milik Anda sendiri.
              </p>
              {profile ? (
                <button
                  className="btn wide"
                  disabled={busy || !profile.emailVerifiedAt}
                  onClick={() =>
                    act(() =>
                      identityCall("/api/invitations", {
                        action: "accept",
                        token,
                      }),
                    )
                  }
                >
                  Terima undangan
                </button>
              ) : (
                <>
                  <a className="btn wide" href="/login">
                    Masuk dengan akun yang sudah ada
                  </a>
                  <a
                    className="btn outline wide"
                    href={"/invite-register#token=" + encodeURIComponent(token)}
                  >
                    Buat akun untuk undangan ini
                  </a>
                </>
              )}
              {profile && !profile.emailVerifiedAt && (
                <a className="btn outline" href="/verify-email">
                  Verifikasi email dahulu
                </a>
              )}
              {profile?.emailVerifiedAt && (
                <button
                  className="btn outline wide"
                  disabled={busy}
                  onClick={() =>
                    act(async () => {
                      await identityCall("/api/invitations", {
                        action: "decline",
                        token,
                      });
                      return { redirect: "/workspaces" };
                    })
                  }
                >
                  Tolak undangan
                </button>
              )}
              <a className="linkbtn" href="/workspaces">
                Buka workspace saya
              </a>
            </>
          ) : !error ? (
            <p role="status">Memuat undangan…</p>
          ) : null}
        </>
      ) : (
        <>
          <h1>Pilih Workspace</h1>
          <p>Akses yang telah diberikan kepada akun Anda.</p>
          {data?.contexts.map((c: any) => (
            <button
              className="identity-context"
              key={c.id}
              disabled={busy}
              onClick={() =>
                act(() => accountCall("switch", { id: c.id, type: c.type }))
              }
            >
              <strong>{c.label}</strong>
              <small>
                {c.role}
                {c.active ? " · Aktif" : ""}
              </small>
            </button>
          ))}
          {data?.pendingInvitations.map((i: any) => (
            <div className="card" key={i.id}>
              <h2>Undangan {i.kind === "TENANT" ? "Penghuni" : "Staf"}</h2>
              <p>{i.label}</p>
              <button
                className="btn"
                disabled={busy}
                onClick={() =>
                  act(() =>
                    identityCall("/api/invitations", {
                      action: "accept",
                      id: i.id,
                    }),
                  )
                }
              >
                Terima undangan
              </button>
              <button
                className="btn outline"
                disabled={busy}
                onClick={() =>
                  act(() =>
                    identityCall("/api/invitations", {
                      action: "decline",
                      id: i.id,
                    }),
                  )
                }
              >
                Tolak undangan
              </button>
            </div>
          ))}
          {data && !data.contexts.length && !data.pendingInvitations.length && (
            <p>
              Belum ada workspace aktif. Minta undangan dari pemilik, atau
              selesaikan verifikasi akun bisnis Anda.
            </p>
          )}
          <a className="btn outline wide" href="/account">
            Akun & keamanan
          </a>
          <button
            className="linkbtn"
            onClick={() =>
              act(async () => {
                await identityCall("/api/auth", { action: "logout" });
                return { redirect: "/login" };
              })
            }
          >
            Keluar
          </button>
        </>
      )}
      {busy && <p role="status">Memproses…</p>}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="success" role="status">
          {message}
        </p>
      )}
    </IdentityFrame>
  );
}
