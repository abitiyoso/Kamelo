"use client";
import { useState } from "react";
import {
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Wallet,
  BedDouble,
  ReceiptText,
  ClipboardCheck,
  ArrowRight,
  CircleAlert,
  Sparkles,
  CheckCircle2,
  RefreshCw,
} from "lucide-react";
import { PaymentTrend } from "./payment-trend";
import { Mascot } from "./mascot";
import { rupiah } from "@/lib/plans";
import { roomStatus } from "@/lib/domain.mjs";
import type { DashboardInsightSummary } from "./dashboard-insights";
import type { OperationTicket } from "./operations-hub";
type Room = {
  id: string;
  number: string;
  operational: string;
  stays: { status: string; start: string; end: string | null }[];
};
type Summary = DashboardInsightSummary & {
  income: number;
  outstanding: number;
  trend?: { month: string; amount: number }[];
};
type LeoResult = {
  summary: string;
  items: string[];
  next: string;
  module: string;
};
const labels: Record<string, string> = {
  OCCUPIED: "Terisi",
  AVAILABLE: "Siap huni",
  RESERVED: "Dipesan",
  CLEANING: "Bersihkan",
  MAINTENANCE: "Perawatan",
};
export function OwnerDashboard({
  propertyId,
  name,
  summary,
  rooms,
  tickets,
  proofCount,
  today,
  demo,
  onNavigate,
  onRoom,
  onOverdue,
  invoiceTable,
}: {
  propertyId: string;
  name: string;
  summary: Summary;
  rooms: Room[];
  tickets: OperationTicket[];
  proofCount: number;
  today: string;
  demo: boolean;
  onNavigate: (module: string) => void;
  onRoom: (id: string) => void;
  onOverdue: () => void;
  invoiceTable: React.ReactNode;
}) {
  const [topic, setTopic] = useState("briefing"),
    [leo, setLeo] = useState<LeoResult | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const open = tickets.filter((t) => t.status !== "RESOLVED"),
    urgent = open.filter((t) => t.priority === "URGENT").length;
  const cleaning = rooms.filter((r) =>
    ["CLEANING", "MAINTENANCE"].includes(roomStatus(r, r.stays, today)),
  ).length;
  const Direction =
    summary.incomeDirection === "up"
      ? ArrowUpRight
      : summary.incomeDirection === "down"
        ? ArrowDownRight
        : Minus;
  async function ask(next: string) {
    setTopic(next);
    setBusy(true);
    setError("");
    try {
      if (demo) {
        const insight = summary.insights.find(
          (i) => i.kind === (next === "rooms" ? "occupancy" : next),
        );
        setLeo({
          summary:
            next === "tasks"
              ? "Contoh demo ini belum memiliki tiket pekerjaan."
              : insight?.text ||
                `${summary.occupiedCount}/${summary.roomCount} kamar terisi; ${summary.overdueCount} tagihan lewat tempo.`,
          items: [
            `Pemasukan ${rupiah(summary.income)}`,
            `Saldo lewat tempo ${rupiah(summary.overdueBalance)}`,
          ],
          next: "Lihat data contoh pada modul terkait. Daftar untuk menggunakan data properti Anda.",
          module:
            next === "tasks" ? "tasks" : next === "rooms" ? "rooms" : "billing",
        });
      } else {
        const r = await fetch("/api/leo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ propertyId, topic: next }),
        });
        const b = await r.json();
        if (!r.ok) throw new Error(b.error);
        setLeo(b);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ringkasan gagal dimuat.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="owner-overview">
      <section className="overview-hero">
        <div>
          <span className="eyebrow">PUSAT KENDALI OWNER</span>
          <h2>Hari ini lebih terkendali.</h2>
          <p>
            {name} ·{" "}
            {new Intl.DateTimeFormat("id-ID", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
              timeZone: "UTC",
            }).format(new Date(today + "T00:00:00Z"))}
          </p>
          <div className="overview-pulse">
            <span>
              <i /> {demo ? "Data contoh" : "Data properti Anda"}
            </span>
            <span>
              {rooms.length} kamar · {summary.occupancyPercent}% terisi
            </span>
          </div>
        </div>
        <Mascot pose="welcome" size={125} />
      </section>
      <div className="overview-kpis">
        <article className="overview-kpi blue">
          <span>
            <Wallet size={20} /> Pemasukan bulan ini
          </span>
          <b>{rupiah(summary.income)}</b>
          <small className={"metric-direction " + summary.incomeDirection}>
            <Direction size={15} />
            {summary.incomeChangePercent === null
              ? "Belum ada basis pembanding"
              : `${Math.abs(summary.incomeChangePercent).toLocaleString("id-ID")}% ${summary.incomeDirection === "up" ? "naik" : summary.incomeDirection === "down" ? "turun" : "sama"}`}
          </small>
          <p>Dibanding tanggal setara bulan lalu</p>
        </article>
        <button className="overview-kpi amber" onClick={onOverdue}>
          <span>
            <ReceiptText size={20} /> Lewat jatuh tempo
          </span>
          <b>{rupiah(summary.overdueBalance)}</b>
          <small>
            {summary.overdueCount} tagihan perlu ditindaklanjuti{" "}
            <ArrowUpRight size={15} />
          </small>
          <p>Saldo tagihan terbit yang belum lunas</p>
        </button>
        <button
          className="overview-kpi teal"
          onClick={() => onNavigate("rooms")}
        >
          <span>
            <BedDouble size={20} /> Kamar terisi
          </span>
          <b>
            {summary.occupiedCount}
            <em> / {rooms.length}</em>
          </b>
          <small>{summary.occupancyPercent}% okupansi hari ini</small>
          <div className="overview-progress">
            <i style={{ width: summary.occupancyPercent + "%" }} />
          </div>
        </button>
        <button
          className="overview-kpi violet"
          onClick={() => onNavigate("tasks")}
        >
          <span>
            <ClipboardCheck size={20} /> Pekerjaan terbuka
          </span>
          <b>{open.length}</b>
          <small>
            {urgent
              ? `${urgent} perlu diprioritaskan`
              : "Pantau pekerjaan & komplain"}{" "}
            <ArrowUpRight size={15} />
          </small>
          <p>
            {open.length
              ? "Tindak lanjuti hingga selesai"
              : "Belum ada pekerjaan yang tertunda"}
          </p>
        </button>
      </div>
      <div className="overview-columns">
        <div className="overview-main">
          <PaymentTrend trend={summary.trend || []} />
          <section className="panel overview-room-panel">
            <div className="panel-title">
              <div>
                <span className="eyebrow">KONDISI PROPERTI</span>
                <h2>Kamar dalam satu pandangan</h2>
              </div>
              <button className="text-link" onClick={() => onNavigate("rooms")}>
                Kelola <ArrowRight size={16} />
              </button>
            </div>
            <div className="overview-room-map">
              {rooms.map((r) => {
                const status = roomStatus(r, r.stays, today);
                return (
                  <button
                    key={r.id}
                    onClick={() => onRoom(r.id)}
                    className={status.toLowerCase()}
                    aria-label={`Kamar ${r.number}: ${labels[status] || status}`}
                  >
                    <BedDouble size={19} />
                    <b>{r.number}</b>
                    <small>{labels[status] || status}</small>
                  </button>
                );
              })}
            </div>
            {!rooms.length && (
              <p>Tambahkan kamar untuk mulai memantau properti.</p>
            )}
            <div className="overview-room-legend">
              {Object.entries(labels).map(([k, v]) => (
                <span key={k}>
                  <i className={k.toLowerCase()} />
                  {v}
                </span>
              ))}
            </div>
          </section>
        </div>
        <aside className="overview-side">
          <section className="panel priority-panel">
            <span className="eyebrow">LANGKAH BERIKUTNYA</span>
            <h2>Perlu perhatian</h2>
            {[
              {
                title: "Verifikasi bukti bayar",
                count: proofCount,
                desc: "Cocokkan dengan mutasi rekening",
                module: "billing",
                Icon: ReceiptText,
              },
              {
                title: "Tagihan lewat tempo",
                count: summary.overdueCount,
                desc: "Siapkan pengingat untuk penghuni",
                module: "overdue",
                Icon: CircleAlert,
              },
              {
                title: "Kesiapan kamar",
                count: cleaning,
                desc: "Kebersihan dan perawatan",
                module: "rooms",
                Icon: BedDouble,
              },
              {
                title: "Pekerjaan mendesak",
                count: urgent,
                desc: "Periksa penanggung jawab",
                module: "tasks",
                Icon: ClipboardCheck,
              },
            ].map(({ title, count, desc, module, Icon }) => (
              <button
                key={title}
                className="priority-item"
                onClick={() =>
                  module === "overdue" ? onOverdue() : onNavigate(module)
                }
              >
                <Icon size={19} />
                <span>
                  <b>{title}</b>
                  <small>{desc}</small>
                </span>
                <strong>{count}</strong>
                <ArrowRight size={15} />
              </button>
            ))}
            {!proofCount && !summary.overdueCount && !cleaning && !urgent && (
              <p className="overview-clear">
                <CheckCircle2 size={17} /> Tidak ada prioritas mendesak yang
                tercatat.
              </p>
            )}
          </section>
          <section className="panel leo-operational">
            <div className="panel-title">
              <div>
                <span className="eyebrow">LEO OPERASIONAL</span>
                <h2>
                  <Sparkles size={19} /> Baca kondisi hari ini
                </h2>
              </div>
              <Mascot pose="help" size={60} />
            </div>
            <p>
              Ringkasan berbasis aturan dari{" "}
              {demo ? "data contoh" : "data properti"}. Layanan AI belum
              terhubung.
            </p>
            <div className="leo-question-grid">
              {[
                ["briefing", "Ringkasan hari ini"],
                ["income", "Pemasukan naik / turun?"],
                ["overdue", "Tagihan mana tertunda?"],
                ["tasks", "Pekerjaan staf?"],
                ["rooms", "Kondisi kamar?"],
              ].map(([k, v]) => (
                <button
                  key={k}
                  className={topic === k && leo ? "active" : "secondary"}
                  disabled={busy}
                  onClick={() => void ask(k)}
                >
                  {v}
                </button>
              ))}
            </div>
            {busy && (
              <p role="status">
                <RefreshCw size={16} /> Menyusun ringkasan…
              </p>
            )}
            {error && <p role="alert">{error}</p>}
            {leo && (
              <div className="leo-answer" aria-live="polite">
                <b>{leo.summary}</b>
                <ul>
                  {leo.items.map((v) => (
                    <li key={v}>{v}</li>
                  ))}
                </ul>
                <p>{leo.next}</p>
                <button
                  className="text-link"
                  onClick={() =>
                    topic === "overdue" ? onOverdue() : onNavigate(leo.module)
                  }
                >
                  Lihat & tindak lanjuti <ArrowRight size={16} />
                </button>
              </div>
            )}
          </section>
          <section className="panel collection-panel">
            <span className="eyebrow">TAGIHAN TERBIT BULAN INI</span>
            <h2>Tingkat pelunasan</h2>
            <b>
              {summary.collectionRate === null
                ? "—"
                : summary.collectionRate.toLocaleString("id-ID") + "%"}
            </b>
            <div className="overview-progress">
              <i
                style={{
                  width: Math.min(100, summary.collectionRate || 0) + "%",
                }}
              />
            </div>
            <p>
              {rupiah(summary.collectionPaid)} dibayar dari{" "}
              {rupiah(summary.collectionTotal)} tagihan bulan ini.
            </p>
            <small>
              Total saldo seluruh tagihan {rupiah(summary.outstanding)}
            </small>
          </section>
        </aside>
      </div>
      <section className="panel">
        <div className="panel-title">
          <h2>Tagihan terbaru</h2>
          <button className="text-link" onClick={() => onNavigate("billing")}>
            Lihat semua <ArrowRight size={16} />
          </button>
        </div>
        {invoiceTable}
      </section>
    </div>
  );
}
