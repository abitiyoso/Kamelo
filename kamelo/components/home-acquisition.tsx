"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, ChevronDown } from "lucide-react";
import { plans, rupiah } from "@/lib/plans";
import { coreConsultUrl } from "@/lib/commercial";

export function PlanFinder({ compact = false }: { compact?: boolean }) {
  const [rooms, setRooms] = useState(compact ? "20" : "5");
  const [properties, setProperties] = useState("1");
  const [users, setUsers] = useState("1");
  const [recurring, setRecurring] = useState(false);
  const values = [rooms, properties, users].map(Number);
  const valid = values.every((n) => Number.isInteger(n) && n >= 1 && n <= 1000);
  const recommended = valid
    ? plans.find(
        (p) =>
          p.rooms >= values[0] &&
          p.properties >= values[1] &&
          p.users >= values[2] &&
          (!recurring || p.recurring),
      )
    : undefined;
  const numberInput = (
    label: string,
    value: string,
    set: (value: string) => void,
  ) => (
    <label>
      {label}
      <input
        type="number"
        inputMode="numeric"
        min={1}
        max={1000}
        step={1}
        value={value}
        onChange={(event) => set(event.target.value)}
      />
    </label>
  );
  const advanced = (
    <>
      {numberInput("Jumlah properti", properties, setProperties)}
      {numberInput("Akun owner & staf", users, setUsers)}
      <label className="plan-recurring">
        <input
          type="checkbox"
          checked={recurring}
          onChange={(event) => setRecurring(event.target.checked)}
        />
        Butuh tagihan kos berulang
      </label>
    </>
  );
  return (
    <div className={"plan-finder" + (compact ? " journal-plan-finder" : "")}>
      <div>
        <span className="eyebrow">BANTU PILIH PAKET</span>
        <h3>
          {compact ? "Bantu pilih paket." : "Mulai dari ukuran properti Anda."}
        </h3>
        <p>
          {compact
            ? "Berapa total kamar Anda?"
            : "Rekomendasi berdasarkan kamar, properti, akun owner/staf dan tagihan berulang."}
        </p>
      </div>
      <div className="plan-finder-inputs">
        {numberInput("Total kamar", rooms, setRooms)}
        {compact ? (
          <details className="journal-finder-advanced">
            <summary>
              Properti, staf & tagihan <ChevronDown size={15} />
            </summary>
            <div>{advanced}</div>
          </details>
        ) : (
          advanced
        )}
      </div>
      <div className="plan-finder-result" aria-live="polite" aria-atomic="true">
        {!valid ? (
          <>
            <b>Periksa jumlah kebutuhan Anda.</b>
            <p>Isi angka bulat antara 1 dan 1.000 pada setiap kolom.</p>
          </>
        ) : recommended ? (
          <>
            <small>REKOMENDASI</small>
            <h3>
              {recommended.name}
              <span>{rupiah(recommended.price)}/bulan</span>
            </h3>
            <p>
              {recommended.rooms} kamar total · {recommended.properties}{" "}
              properti · {recommended.users} akun
            </p>
            <Link
              className={compact ? "text-link" : "button"}
              href={"/register?plan=" + recommended.id}
            >
              {recommended.id === "free"
                ? "Mulai Gratis"
                : "Ajukan " + recommended.name}
              <ArrowUpRight size={16} />
            </Link>
            {recommended.id !== "free" && !compact && (
              <small className="plan-finder-activation">
                Akun mulai di Gratis; menunggu aktivasi admin.
              </small>
            )}
          </>
        ) : (
          <>
            <b>Kebutuhan di atas paket Plus.</b>
            <p>Tambahan kapasitas belum tersedia untuk aktivasi mandiri.</p>
            <a
              className="text-link"
              href={coreConsultUrl}
              target="_blank"
              rel="noreferrer"
            >
              Diskusikan kebutuhan <ArrowUpRight size={16} />
            </a>
          </>
        )}
      </div>
    </div>
  );
}
