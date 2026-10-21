"use client";
import type { ReactNode } from "react";
import { WorkspaceShell } from "./shell";
import { UnavailableModule, WorkspaceAccount, WorkspaceCard } from "./modules";
import assets from "@/lib/workspace/assets.json";
import { ClipboardList, Inbox } from "lucide-react";
import { tenantDate, tenantToday } from "@/lib/tenant-types";
import { rupiah } from "@/lib/plans";
export function ResidentWorkspace({
  name,
  property,
  room,
  kind,
  view,
  onNavigate,
  children,
  balance,
  due,
  demo = false,
  embedded = false,
}: {
  name: string;
  property: string;
  room: string;
  kind: "stay" | "invoice";
  view: string;
  onNavigate: (v: string) => void;
  children: ReactNode;
  balance?: number;
  due?: string;
  demo?: boolean;
  embedded?: boolean;
}) {
  if (embedded) return <>{children}</>;
  const allowedContent =
    kind === "invoice" ? view === "bills" : ["room", "services"].includes(view);
  return (
    <WorkspaceShell
      role="tenant"
      page={view}
      onNavigate={onNavigate}
      name={name}
      context={property}
      demo={demo}
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
              <small style={{ color: "#d1e6dc" }}>
                Selamat datang, {name.split(" ")[0] || "Penghuni"}
              </small>
              <h2>Kamar {room || "Anda"}</h2>
              <p>Semua kebutuhan tinggal Anda tersedia di satu tempat.</p>
              <button className="btn" onClick={() => onNavigate("room")}>
                Lihat kamar saya
              </button>
            </div>
          </section>
          <div className="space" />
          <div className="grid cols2">
            <WorkspaceCard title="Tagihan berikutnya">
              <div className="between">
                <div>
                  <div style={{ fontSize: 26, fontWeight: 800 }}>
                    {kind === "invoice" ? rupiah(balance || 0) : "—"}
                  </div>
                  <small>
                    {kind === "invoice"
                      ? `Jatuh tempo ${due ? tenantDate(due) : "sesuai tagihan"}`
                      : "Minta tautan tagihan pribadi dari pengelola."}
                  </small>
                </div>
                {kind === "invoice" && (
                  <span
                    className={
                      "tag " +
                      (balance === 0
                        ? ""
                        : due && due < tenantToday()
                          ? "red"
                          : "gold")
                    }
                  >
                    {balance === 0
                      ? "Lunas"
                      : due && due < tenantToday()
                        ? "Lewat jatuh tempo"
                        : "Belum dibayar"}
                  </span>
                )}
              </div>
              <div className="space" />
              <button className="btn" onClick={() => onNavigate("bills")}>
                Lihat tagihan
              </button>
            </WorkspaceCard>
            <WorkspaceCard title="Layanan & Bantuan">
              <div className="item">
                <div className="left">
                  <span className="glyph">
                    <ClipboardList size={18} />
                  </span>
                  <div>
                    <strong>Perbaikan kamar</strong>
                    <small>Laporkan masalah dan pantau progres</small>
                  </div>
                </div>
                <button className="btn" onClick={() => onNavigate("services")}>
                  Buat laporan
                </button>
              </div>
              <div className="item">
                <div className="left">
                  <span className="glyph">
                    <Inbox size={18} />
                  </span>
                  <div>
                    <strong>Penerimaan paket</strong>
                    <small>Layanan tamu dan paket belum diaktifkan</small>
                  </div>
                </div>
                <span className="tag gray">Belum tersedia</span>
              </div>
            </WorkspaceCard>
          </div>
          <div className="space" />
          <WorkspaceCard title="Pengumuman Pengelola">
            <p>
              Pengumuman belum tersedia. Layanan komunikasi pengelola belum
              diaktifkan.
            </p>
          </WorkspaceCard>
          <p className="bo-muted">
            Tautan pribadi memiliki cakupan terbatas dan tidak menggantikan akun
            penghuni terverifikasi. Jangan bagikan tautan Anda.
          </p>
        </>
      )}
      {view === "account" && (
        <WorkspaceAccount name={name} role="Penghuni" context={property} />
      )}
      {view === "messages" && (
        <UnavailableModule
          title="Pesan"
          description="Kotak masuk penghuni memerlukan akun terverifikasi. Hubungi pengelola melalui kontak pada panduan tinggal."
        />
      )}
      {!allowedContent && !["home", "account", "messages"].includes(view) && (
        <UnavailableModule
          title={
            view === "bills"
              ? "Tagihan Saya"
              : view === "room"
                ? "Kamar Saya"
                : "Layanan Penghuni"
          }
          description={
            kind === "stay"
              ? "Minta tautan tagihan pribadi kepada pengelola. Tautan masa tinggal ini tidak memberikan akses ke tagihan."
              : "Minta tautan layanan masa tinggal kepada pengelola. Tautan tagihan hanya membuka rincian dan bukti pembayaran tagihan ini."
          }
        />
      )}
      <div hidden={!allowedContent} data-tenant-view={view}>
        {children}
      </div>
    </WorkspaceShell>
  );
}
