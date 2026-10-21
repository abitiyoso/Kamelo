"use client";
import { useEffect, useRef, useState } from "react";
import { WorkspaceShell } from "@/components/workspace/shell";
import {
  WorkspaceCard,
  UnavailableModule,
} from "@/components/workspace/modules";
import { AccountSettings } from "./account-settings";
import { StayPortal } from "@/components/stay-portal";
import { TenantPortal } from "@/components/tenant-portal";
import { identityCall } from "./api";
import { rupiah } from "@/lib/plans";
import { tenantDate } from "@/lib/tenant-types";
import { ResidentContractPanel } from "../workspace/resident360";
import assets from "@/lib/workspace/assets.json";
import { MessagesWorkspace } from "../workspace/messages";
import { TenantOpeningBalances } from "./opening-balances";
import { ResidentReminders } from "./resident-reminders";
import { FinancialDocuments } from "../workspace/financial-documents";
type Summary = {
  name: string;
  property: string;
  room: string;
  active: boolean;
  canViewBilling: boolean;
  billingSummary: {
    invoice: number;
    opening: number;
    outstanding: number;
    overdue: number;
    asOf: string;
    next: {
      source: string;
      reference: string;
      due: string;
      remaining: number;
    } | null;
  } | null;
  invoices: {
    id: string;
    number: string;
    due: string;
    status: string;
    balance: number;
  }[];
};
export function ResidentPortal() {
  const [data, setData] = useState<Summary | null>(null),
    [view, setView] = useState("home"),
    [selected, setSelected] = useState(""),
    [error, setError] = useState(""),
    [refreshing, setRefreshing] = useState(false);
  const loadSequence = useRef(0);
  async function refresh() {
    const n = ++loadSequence.current;
    setRefreshing(true);
    setError("");
    try {
      const d = await identityCall("/api/resident");
      if (n === loadSequence.current) setData(d);
    } catch (e) {
      if (n === loadSequence.current) {
        setData(null);
        setError(e instanceof Error ? e.message : "Ringkasan belum tersedia.");
      }
    } finally {
      if (n === loadSequence.current) setRefreshing(false);
    }
  }
  useEffect(() => {
    if (view === "home") void refresh();
    return () => {
      loadSequence.current++;
    };
  }, [view]);
  if (!data)
    return (
      <div className="bo-root">
        <p role="status">{error || "Memuat akses penghuni…"}</p>
        <a href="/workspaces">Pilih workspace</a>
      </div>
    );
  async function logout() {
    await identityCall("/api/auth", { action: "logout" });
    location.href = "/login";
  }
  return (
    <WorkspaceShell
      role="tenant"
      page={view}
      onNavigate={setView}
      name={data.name}
      context={data.property}
      onLogout={logout}
    >
      {view === "home" && (
        <>
          <section className="hero" style={{ minHeight: 180 }}>
            <img
              className="herobg"
              src={assets.room}
              alt="Referensi kamar Kamelo"
            />
            <div className="herocopy">
              <small>Selamat datang, {data.name.split(" ")[0]}</small>
              <h2>Kamar {data.room}</h2>
              <p>
                {data.active
                  ? "Kebutuhan tinggal Anda dalam satu tempat."
                  : "Masa tinggal telah selesai. Riwayat tagihan tetap tersedia."}
              </p>
              <button
                className="btn"
                onClick={() => setView(data.active ? "room" : "bills")}
              >
                {data.active ? "Lihat kamar saya" : "Riwayat tagihan"}
              </button>
            </div>
          </section>
          <div className="space" />
          <div className="grid cols2">
            <WorkspaceCard title="Tagihan & saldo awal saya">
              <h2>
                {data.billingSummary
                  ? rupiah(data.billingSummary.outstanding)
                  : "Akses tagihan belum dibagikan"}
              </h2>
              <p>
                {data.billingSummary
                  ? `Invoice ${rupiah(data.billingSummary.invoice)} · saldo awal yang dibagikan ${rupiah(data.billingSummary.opening)} · lewat tempo ${rupiah(data.billingSummary.overdue)}.`
                  : "Hubungi pengelola untuk izin melihat tagihan."}
              </p>
              {data.billingSummary?.next && (
                <p>
                  Jatuh tempo terdekat:{" "}
                  {tenantDate(data.billingSummary.next.due)} ·{" "}
                  {data.billingSummary.next.source === "INVOICE"
                    ? "Invoice"
                    : "Saldo awal"}{" "}
                  {data.billingSummary.next.reference}.
                </p>
              )}
              {data.billingSummary && (
                <p>
                  Saldo per {data.billingSummary.asOf}; bukti unggahan belum
                  dihitung sebagai pembayaran sampai diperiksa.
                </p>
              )}
              <button
                className="btn outline"
                disabled={refreshing}
                onClick={() => void refresh()}
              >
                Perbarui ringkasan saya
              </button>
              <button className="btn" onClick={() => setView("bills")}>
                Lihat tagihan
              </button>
            </WorkspaceCard>
            <WorkspaceCard title="Layanan & Bantuan">
              <p>Laporkan masalah kamar dan pantau tindak lanjut pengelola.</p>
              <button className="btn" onClick={() => setView("services")}>
                Layanan penghuni
              </button>
            </WorkspaceCard>
          </div>
          {data.canViewBilling && (
            <>
              <div className="space" />
              <ResidentReminders onBills={() => setView("bills")} />
            </>
          )}
        </>
      )}
      {view === "account" && <AccountSettings />}
      {view === "messages" && <MessagesWorkspace canStart={data.active} />}
      {view === "bills" && (
        <>
          <WorkspaceCard title="Tagihan Saya">
            <p>
              Tagihan dan bukti pembayaran khusus masa tinggal yang Anda pilih.
            </p>
            {data.invoices.length ? (
              data.invoices.map((i) => (
                <div className="item" key={i.id}>
                  <div>
                    <strong>{i.number}</strong>
                    <small>
                      {tenantDate(i.due)} · {i.status}
                    </small>
                  </div>
                  <div>
                    <strong>{rupiah(i.balance)}</strong>
                    <button
                      className="btn outline"
                      onClick={() => setSelected(i.id)}
                    >
                      Rincian & bukti
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <p>Belum ada tagihan yang dibagikan untuk masa tinggal ini.</p>
            )}
          </WorkspaceCard>
          <TenantOpeningBalances />
          {data.canViewBilling && <FinancialDocuments tenant />}
          {selected && (
            <TenantPortal
              key={selected}
              token={"account:" + selected}
              embedded
            />
          )}
        </>
      )}
      {view === "room" && <ResidentContractPanel />}
      {["room", "services"].includes(view) &&
        (data.active ? (
          <StayPortal token="account" embedded viewOverride={view} />
        ) : (
          <UnavailableModule
            title="Masa tinggal selesai"
            description="Layanan kamar dan kontrol perangkat berakhir saat masa tinggal selesai. Riwayat tagihan tetap dapat dibuka."
          />
        ))}
    </WorkspaceShell>
  );
}
