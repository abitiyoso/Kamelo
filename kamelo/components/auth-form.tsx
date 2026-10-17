"use client";
import { useState } from "react";
import Link from "next/link";
import { plans, rupiah } from "@/lib/plans";
export function AuthForm({
  mode,
  selectedPlan,
}: {
  mode: string;
  selectedPlan?: string;
}) {
  const requestedPlan = plans.find((p) => p.id === selectedPlan);
  const [error, setError] = useState(""),
    [pending, setPending] = useState(false),
    [message, setMessage] = useState("");
  const register = mode === "register",
    forgot = mode === "forgot-password",
    reset = mode === "reset-password";
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setPending(true);
    try {
      const data = Object.fromEntries(new FormData(e.currentTarget));
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          action: register
            ? "register"
            : forgot
              ? "forgot"
              : reset
                ? "reset"
                : "login",
          token: new URLSearchParams(location.search).get("token"),
          ...(register && requestedPlan
            ? { requestedPlan: requestedPlan.id }
            : {}),
        }),
      });
      const r = await response.json();
      if (!response.ok) throw new Error(r.error);
      if (forgot) setMessage(r.message);
      else location.href = reset ? "/login" : r.redirect;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Koneksi gagal. Coba kembali.");
    } finally {
      setPending(false);
    }
  }
  return (
    <main className="auth-wrap">
      <div className="auth-intro">
        <span className="eyebrow">SELAMAT DATANG DI KAMELO</span>
        <h1>
          Urus Properti
          <br />
          Jadi Gampang.
        </h1>
        <p>
          Satu tempat untuk kamar, penghuni, dan tagihan Anda. Kamelo Core siap
          digunakan tanpa perangkat pintar.
        </p>
        <div className="auth-photo">
          <img
            src="/images/properties/guesthouse.webp"
            alt="Interior kamar ilustrasi"
          />
        </div>
      </div>
      <section className="auth-card">
        <span className="pill">Kamelo by ELENIO</span>
        <h2>
          {register
            ? "Mulai langkah pertama Anda"
            : forgot
              ? "Pulihkan akun"
              : reset
                ? "Kata sandi baru"
                : "Senang bertemu kembali"}
        </h2>
        <p>
          {register
            ? "Gratis hingga 5 kamar. Tanpa kartu kredit."
            : forgot
              ? "Masukkan email yang terdaftar."
              : reset
                ? "Gunakan minimal 10 karakter."
                : "Masuk untuk mengelola properti Anda."}
        </p>
        {register && requestedPlan && requestedPlan.id !== "free" && (
          <p className="notice" role="status">
            Pilihan Anda:{" "}
            <b>
              {requestedPlan.name} · {rupiah(requestedPlan.price)}/bulan
            </b>
            . Pendaftaran mencatat permintaan upgrade. Akun dimulai pada Gratis
            (5 kamar, 1 properti, 1 pengguna) sampai aktivasi admin; tidak ada
            penagihan otomatis.
          </p>
        )}
        <form onSubmit={submit}>
          {register && (
            <>
              <label>
                Nama lengkap
                <input name="name" autoComplete="name" required minLength={2} />
              </label>
              <label>
                Nomor WhatsApp
                <input
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  placeholder="081234567890"
                  required
                  pattern="(\+62|62|0)8[0-9]{7,12}"
                />
              </label>
            </>
          )}
          {!reset && (
            <label>
              Email
              <input name="email" type="email" autoComplete="email" required />
            </label>
          )}
          {!forgot && (
            <label>
              Kata sandi
              <input
                name="password"
                type="password"
                autoComplete={
                  register || reset ? "new-password" : "current-password"
                }
                minLength={10}
                maxLength={128}
                required
              />
              <small>Minimal 10 karakter</small>
            </label>
          )}
          {register && (
            <label className="checkbox">
              <input type="checkbox" required />
              Saya menyetujui <Link href="/terms">Syarat Layanan</Link> dan{" "}
              <Link href="/privacy">Kebijakan Privasi</Link>.
            </label>
          )}
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
          <button disabled={pending}>
            {pending
              ? "Memproses…"
              : register
                ? "Buat Akun Gratis"
                : forgot
                  ? "Kirim Tautan Pemulihan"
                  : reset
                    ? "Simpan Kata Sandi"
                    : "Masuk"}
          </button>
        </form>
        {!register && !forgot && !reset && (
          <Link className="text-link" href="/forgot-password">
            Lupa kata sandi?
          </Link>
        )}
        <p>
          {register ? "Sudah punya akun? " : "Belum punya akun? "}
          <Link href={register ? "/login" : "/register"}>
            {register ? "Masuk" : "Daftar gratis"}
          </Link>
        </p>
      </section>
    </main>
  );
}
