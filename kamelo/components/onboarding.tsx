"use client";
import { useState } from "react";
import { Mascot } from "./mascot";
import { Brand } from "./brand";
import { DoorOpen, Building2, ArrowRight } from "lucide-react";
import { coreConsultUrl } from "@/lib/commercial";
export function Onboarding({
  roomLimit = 5,
  remainingRooms = 5,
  planName = "Gratis",
  requestedPlanName,
}: {
  roomLimit?: number;
  remainingRooms?: number;
  planName?: string;
  requestedPlanName?: string;
}) {
  const [type, setType] = useState("KOS"),
    [step, setStep] = useState(1),
    [error, setError] = useState(""),
    [pending, setPending] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setPending(true);
    const d = Object.fromEntries(new FormData(e.currentTarget));
    if (Number(d.count) > remainingRooms) {
      setError(
        `Batas paket ${planName} tercapai. Tersisa ${remainingRooms} kamar. Lihat Paket sebelum menambah kamar.`,
      );
      setPending(false);
      return;
    }
    try {
      const r = await fetch("/api/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...d,
          action: "property",
          type,
          count: Number(d.count),
          rate: Number(d.rate),
        }),
      });
      const b = await r.json();
      if (!r.ok) throw new Error(b.error);
      setStep(3);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Koneksi gagal.");
    } finally {
      setPending(false);
    }
  }
  return (
    <>
      <header className="onboarding-header">
        <Brand />
        <span>Penyiapan properti · {step}/3</span>
      </header>
      <main className="onboarding">
        {requestedPlanName && (
          <p className="notice" role="status">
            Permintaan paket <b>{requestedPlanName}</b> sudah dicatat dan
            menunggu aktivasi admin. Saat ini batas paket {planName} berlaku:{" "}
            {roomLimit} kamar total.{" "}
            <a href={coreConsultUrl} target="_blank" rel="noreferrer">
              Hubungi ELENIO untuk aktivasi.
            </a>
          </p>
        )}
        <Mascot pose={step === 3 ? "success" : "onboarding"} size={100} />
        <span className="eyebrow">SELAMAT DATANG DI KAMELO 👋</span>
        <h1>
          {step === 1
            ? "Properti apa yang Anda kelola?"
            : step === 2
              ? "Ceritakan tentang properti Anda."
              : "Properti berhasil dibuat!"}
        </h1>
        <p>
          {step === 1
            ? "Pilih jenis properti. LEO Stay menemani penyiapan awal Anda; akun Tuya tidak diperlukan."
            : step === 2
              ? "Kamar dibuat sekaligus, jadi Anda tidak perlu menambah satu per satu."
              : "Yuk, tambahkan penghuni pertama. Anda juga bisa melakukannya nanti."}
        </p>
        {step === 1 ? (
          <>
            <div className="type-grid">
              {[
                ["KOS", "Kos", "Sewa bulanan & tagihan berulang", DoorOpen],
                [
                  "HOTEL",
                  "Hotel / Guest House",
                  "Reservasi harian & check-in",
                  Building2,
                ],
              ].map(([v, t, d, Icon]) => {
                const C = Icon as typeof DoorOpen;
                return (
                  <button
                    className={"type-card " + (type === v ? "selected" : "")}
                    key={String(v)}
                    onClick={() => setType(String(v))}
                  >
                    <C size={30} />
                    <b>{String(t)}</b>
                    <span>{String(d)}</span>
                  </button>
                );
              })}
            </div>
            <button onClick={() => setStep(2)}>
              Lanjutkan <ArrowRight size={17} />
            </button>
          </>
        ) : step === 2 ? (
          <form onSubmit={submit}>
            <label>
              Nama properti
              <input
                name="name"
                required
                minLength={2}
                placeholder="Contoh: Kos Melati"
              />
            </label>
            <label>
              Kota
              <input name="city" placeholder="Yogyakarta" />
            </label>
            <div className="form-row">
              <label>
                Jumlah kamar
                <input
                  type="number"
                  name="count"
                  min="1"
                  max="50"
                  defaultValue="5"
                  required
                />
              </label>
              <label>
                Tarif dasar (Rp){type === "KOS" ? " / bulan" : " / malam"}
                <input
                  type="number"
                  name="rate"
                  min="0"
                  max="1000000000"
                  step="1"
                  defaultValue={type === "KOS" ? 1500000 : 350000}
                  required
                />
              </label>
            </div>
            <p className="notice">
              Paket {planName}: hingga {roomLimit} kamar total, tersisa{" "}
              {remainingRooms}. Jika membutuhkan lebih banyak,{" "}
              <a href="/app/settings/subscription">
                lihat paket dan ajukan upgrade
              </a>{" "}
              sebelum membuat properti.
            </p>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <button disabled={pending}>
              {pending ? "Membuat properti…" : "Buat Properti & Kamar"}
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => setStep(1)}
            >
              Kembali
            </button>
          </form>
        ) : (
          <div className="setup-success">
            <span className="success-check">✓</span>
            <a className="button" href="/app/rooms">
              Tambahkan Penghuni Pertama <ArrowRight size={17} />
            </a>
            <a href="/app/dashboard">Lihat dashboard dulu</a>
          </div>
        )}
      </main>
    </>
  );
}
