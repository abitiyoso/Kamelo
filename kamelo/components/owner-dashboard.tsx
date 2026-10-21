"use client";
import { useEffect, useRef, useState } from "react";
import { CashChart } from "./workspace/finance";
import type { dashboardRead } from "@/lib/dashboard";
import {
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  ReceiptText,
  ClipboardCheck,
  Camera,
  Zap,
} from "lucide-react";
import { rupiah } from "@/lib/plans";
import { roomStatus } from "@/lib/domain.mjs";
import type { DashboardInsightSummary } from "./dashboard-insights";
import type { OperationTicket } from "./operations-hub";
import { WorkspaceCard, WorkspaceKpi } from "./workspace/modules";
import assets from "@/lib/workspace/assets.json";
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
export function OwnerDashboard({
  propertyId,
  name,
  summary: invoiceSummary,
  rooms,
  tickets,
  proofCount,
  contractExpiring,
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
  contractExpiring?: number;
  today: string;
  demo: boolean;
  onNavigate: (module: string) => void;
  onRoom: (id: string) => void;
  onOverdue: () => void;
  invoiceTable: React.ReactNode;
}) {
  const [live, setLive] = useState<Awaited<
      ReturnType<typeof dashboardRead>
    > | null>(null),
    [page, setPage] = useState(1),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const sequence = useRef(0),
    overdueRef = useRef<HTMLDivElement>(null);
  async function refresh() {
    const n = ++sequence.current;
    setBusy(true);
    setError("");
    try {
      const r = await fetch(
          "/api/dashboard?" +
            new URLSearchParams({ propertyId, page: String(page) }),
          { cache: "no-store" },
        ),
        d = await r.json();
      if (!r.ok) throw Error(d.error);
      if (n === sequence.current) setLive(d);
    } catch (e) {
      if (n === sequence.current) {
        setLive(null);
        setError(e instanceof Error ? e.message : "Ringkasan belum tersedia.");
      }
    } finally {
      if (n === sequence.current) setBusy(false);
    }
  }
  useEffect(() => {
    if (demo) return;
    void refresh();
    return () => {
      sequence.current++;
    };
  }, [propertyId, demo, page]);
  const ready = demo || Boolean(live);
  const summary =
    !demo && live
      ? {
          ...invoiceSummary,
          income: live.income,
          outstanding: live.outstanding,
          overdueCount: live.overdueCount,
          overdueBalance: live.overdueBalance,
          incomeDirection: live.incomeDirection,
          incomeChangePercent: live.incomeChangePercent,
        }
      : invoiceSummary;
  const proofTotal = demo ? proofCount : live?.proofCount;
  const open = tickets.filter((t) => t.status !== "RESOLVED");
  const cleaning = rooms.filter((r) =>
    ["CLEANING", "MAINTENANCE"].includes(roomStatus(r, r.stays, today)),
  ).length;
  const Direction =
    summary.incomeDirection === "up"
      ? ArrowUpRight
      : summary.incomeDirection === "down"
        ? ArrowDownRight
        : Minus;
  const trend = summary.trend || [],
    max = Math.max(...trend.map((t) => t.amount), 1);
  return (
    <>
      <div className="grid cols2">
        <section className="hero">
          <img
            className="herobg"
            src={assets.building}
            alt="Referensi properti Kamelo"
          />
          <div className="herocopy">
            <small style={{ color: "#c8dbd0" }}>{name}</small>
            <h2>Operasional properti, lebih terkendali.</h2>
            <p>
              Pantau penerimaan, penghuni, pekerjaan, keamanan, dan perangkat.
            </p>
            <button className="btn" onClick={() => onNavigate("rooms")}>
              Buka kamar
            </button>
          </div>
        </section>
        <WorkspaceCard title="Prioritas hari ini">
          <div className="list">
            {[
              {
                title: ready
                  ? `${summary.overdueCount} ${demo ? "tagihan" : "catatan"} lewat jatuh tempo`
                  : "Ringkasan piutang belum dimuat",
                note: ready
                  ? `${rupiah(summary.overdueBalance)} perlu ditagih${!demo ? " · invoice + saldo awal" : ""}`
                  : "Muat ringkasan terbaru untuk melihat prioritas",
                action: demo
                  ? onOverdue
                  : () => {
                      overdueRef.current?.focus();
                      overdueRef.current?.scrollIntoView({
                        behavior: "smooth",
                        block: "start",
                      });
                    },
                Icon: ReceiptText,
              },
              {
                title:
                  proofTotal === undefined
                    ? "Antrean bukti belum dimuat"
                    : `${proofTotal} bukti menunggu verifikasi`,
                note: demo
                  ? "Periksa penerimaan dana sebelum menyetujui"
                  : "Invoice + saldo awal · periksa dana sebelum menyetujui",
                action: () => {
                  onNavigate(demo ? "billing" : "proofs");
                },
                Icon: ReceiptText,
              },
              {
                title: "Peristiwa CCTV perlu review",
                note: "Belum terhubung ke sumber kamera",
                action: () => onNavigate("cctv"),
                Icon: Camera,
              },
              {
                title: "Kontrak mendekati akhir",
                note:
                  contractExpiring === undefined
                    ? "Kontrak belum tercatat pada contoh ini"
                    : `${contractExpiring} kontrak berakhir dalam 30 hari`,
                action: () => onNavigate("contracts"),
                Icon: ReceiptText,
              },
              {
                title: "Tugas menunggu penanganan",
                note: `${open.length} pekerjaan terbuka · ${cleaning} kamar perlu disiapkan`,
                action: () => onNavigate("tasks"),
                Icon: ClipboardCheck,
              },
            ].map(({ title, note, action, Icon }, i) => (
              <div className="item" key={title}>
                <div className="left">
                  <span
                    className={
                      "glyph " +
                      (i === 0 ? "red" : i === 2 || i === 3 ? "gold" : "")
                    }
                  >
                    <Icon size={18} />
                  </span>
                  <div>
                    <strong>{title}</strong>
                    <small>{note}</small>
                  </div>
                </div>
                <button className="btn small" onClick={action}>
                  {i === 4 ? "Buka" : "Tinjau"}
                </button>
              </div>
            ))}
          </div>
        </WorkspaceCard>
      </div>
      {!demo && (
        <div className="bo-import-history">
          <button
            className="btn outline"
            disabled={busy}
            onClick={() => void refresh()}
          >
            Perbarui ringkasan dashboard
          </button>
          <p role="status">
            {error ||
              (live
                ? `Saldo terkini per ${live.asOf}. Kas periode ${live.currentStart} sampai ${live.currentEnd}; pembanding ${live.comparisonStart} sampai ${live.comparisonEnd}.`
                : "Memuat ringkasan gabungan…")}
          </p>
        </div>
      )}
      <div className="space" />
      <div className="grid cols4">
        <WorkspaceKpi
          label="Pembayaran diterima"
          value={ready ? rupiah(summary.income) : "—"}
          note={
            !ready
              ? "Ringkasan kas belum tersedia"
              : summary.incomeChangePercent === null
                ? demo
                  ? "Belum ada pembanding bulan sebelumnya"
                  : "Kas periode pembanding Rp0; persentase tidak dihitung"
                : `${summary.incomeChangePercent}% dibanding periode sebelumnya`
          }
        />
        <WorkspaceKpi
          label="Belum tertagih"
          value={ready ? rupiah(summary.outstanding) : "—"}
          note={
            ready
              ? `${summary.overdueCount} ${demo ? "tagihan" : "catatan invoice + saldo awal"} melewati jatuh tempo`
              : "Piutang gabungan belum tersedia"
          }
        />
        <WorkspaceKpi
          label="Kamar terisi"
          value={`${summary.occupancyPercent}%`}
          note={`${summary.occupiedCount} dari ${summary.roomCount} kamar terisi`}
        />
        <WorkspaceKpi
          label="Surplus kas"
          value={!demo && live ? rupiah(live.surplus) : "—"}
          note={
            !demo && live
              ? `Biaya dibayar bersih ${rupiah(live.expense)}; surplus ${live.surplusChange > 0 ? "naik" : live.surplusChange < 0 ? "turun" : "stabil"} ${rupiah(Math.abs(live.surplusChange))} terhadap pembanding. Deposit terpisah.`
              : "Lihat laporan periode di menu Keuangan"
          }
        />
      </div>
      <div className="space" />
      {!demo && (
        <>
          <div ref={overdueRef} tabIndex={-1}>
            <WorkspaceCard
              title="Piutang gabungan & tindak lanjut"
              description="Saldo invoice dan saldo sebelum Kamelo, bukan tambahan kas. Piutang hari ini tidak membentuk riwayat piutang bulanan."
            >
              <div className="bo-import-body">
                {live ? (
                  <>
                    <div className="billing-summary">
                      {live.sources.map((s) => (
                        <div key={s.source}>
                          <small>
                            {s.source === "INVOICE" ? "Invoice" : "Saldo awal"}
                          </small>
                          <b>{rupiah(s.outstanding)}</b>
                          <small>
                            {s.count} belum lunas · lewat tempo{" "}
                            {rupiah(s.overdue)} · {s.pendingProofs} bukti
                            menunggu
                          </small>
                        </div>
                      ))}
                    </div>
                    <p>
                      Kas masuk mencakup pembayaran invoice dan penerimaan saldo
                      awal setelah koreksi, tanpa deposit. Belum tertagih
                      mencakup saldo aktif sampai hari ini. Pembanding memakai
                      tanggal setara bulan sebelumnya; bulan berjalan pada
                      grafik belum penuh.
                    </p>
                    <div
                      className="bo-import-table"
                      role="region"
                      aria-label="Piutang gabungan lewat tempo"
                      tabIndex={0}
                    >
                      <table>
                        <thead>
                          <tr>
                            <th>Sumber / referensi</th>
                            <th>Penghuni / jatuh tempo</th>
                            <th>Sisa / tindak lanjut</th>
                          </tr>
                        </thead>
                        <tbody>
                          {live.overdue.rows.map((r: any) => (
                            <tr key={r.source + r.id}>
                              <td>
                                {r.source === "INVOICE"
                                  ? "Invoice"
                                  : "Saldo awal"}{" "}
                                · {r.reference}
                              </td>
                              <td>
                                {r.guestName}
                                <br />
                                {r.due}
                              </td>
                              <td>
                                {rupiah(r.remaining)}
                                <br />
                                <button
                                  className="btn outline small"
                                  onClick={() =>
                                    onNavigate(
                                      r.source === "INVOICE"
                                        ? "billing"
                                        : "finance",
                                    )
                                  }
                                >
                                  {r.source === "INVOICE"
                                    ? "Buka Tagihan"
                                    : "Buka Keuangan"}
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {!live.overdue.total && (
                      <p>Tidak ada piutang aktif yang melewati jatuh tempo.</p>
                    )}
                    <div className="bo-import-history">
                      <button
                        className="btn outline"
                        disabled={busy || page <= 1}
                        onClick={() => setPage(page - 1)}
                      >
                        Piutang sebelumnya
                      </button>
                      <span>
                        Halaman {live.overdue.page} · {live.overdue.total}{" "}
                        catatan lewat tempo
                      </span>
                      <button
                        className="btn outline"
                        disabled={busy || page * 10 >= live.overdue.total}
                        onClick={() => setPage(page + 1)}
                      >
                        Piutang berikutnya
                      </button>
                    </div>
                  </>
                ) : (
                  <p>
                    Rincian piutang gabungan belum tersedia. Gunakan tombol
                    perbarui di atas.
                  </p>
                )}
              </div>
            </WorkspaceCard>
          </div>
          <div className="space" />
        </>
      )}
      <div className="grid split">
        <WorkspaceCard
          title="Pendapatan & tunggakan"
          description={
            demo
              ? "Pembayaran yang tercatat selama enam bulan terakhir."
              : "Kas masuk, biaya dibayar bersih dan surplus enam bulan terakhir; bulan berjalan sampai hari ini."
          }
          action={
            <span className="tag">
              <Direction size={12} />
              {!ready
                ? "Belum dimuat"
                : summary.incomeDirection === "up"
                  ? "Naik"
                  : summary.incomeDirection === "down"
                    ? "Turun"
                    : "Stabil"}
            </span>
          }
        >
          {!demo ? (
            live ? (
              <>
                <CashChart rows={live.trend} />
                <details>
                  <summary>Lihat angka grafik</summary>
                  <div
                    className="bo-import-table"
                    role="region"
                    aria-label="Angka arus kas dashboard"
                    tabIndex={0}
                  >
                    <table>
                      <thead>
                        <tr>
                          <th>Bulan</th>
                          <th>Kas masuk</th>
                          <th>Biaya bersih</th>
                          <th>Surplus</th>
                        </tr>
                      </thead>
                      <tbody>
                        {live.trend.map((t) => (
                          <tr key={t.month}>
                            <td>{t.month}</td>
                            <td>{rupiah(t.income)}</td>
                            <td>{rupiah(t.outflow)}</td>
                            <td>{rupiah(t.surplus)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              </>
            ) : (
              <p>Grafik gabungan belum tersedia.</p>
            )
          ) : (
            <>
              <div
                className="bargraph"
                role="img"
                aria-label={trend
                  .map((t) => `${t.month}: ${rupiah(t.amount)}`)
                  .join("; ")}
              >
                {trend.map((t) => (
                  <div className="barset" key={t.month}>
                    <div className="bars">
                      <span
                        title={rupiah(t.amount)}
                        style={{
                          height: Math.max(2, (t.amount / max) * 140) + "px",
                        }}
                      />
                    </div>
                    <span>
                      {new Intl.DateTimeFormat("id-ID", {
                        month: "short",
                        timeZone: "UTC",
                      }).format(new Date(t.month + "-01T00:00:00Z"))}
                    </span>
                  </div>
                ))}
              </div>
              <div className="space" />
              <div className="legend">
                <span>
                  <i className="dot" />
                  Penerimaan tercatat
                </span>
              </div>
              <p className="bo-muted">
                Riwayat saldo piutang bulanan belum tersedia.
              </p>
            </>
          )}
        </WorkspaceCard>
        <WorkspaceCard
          title="ELENIO Intelligence"
          description="Tindak lanjut insiden dan utilitas"
        >
          <div className="grid cols2">
            <button
              className="bo-photo-button"
              onClick={() => onNavigate("cctv")}
            >
              <img
                className="photo"
                src={assets.lobby}
                alt="Referensi lobby area bersama"
              />
              <strong>
                <Camera size={15} /> CCTV & AI
              </strong>
              <small>Belum terhubung</small>
            </button>
            <button
              className="bo-photo-button"
              onClick={() => onNavigate("iot")}
            >
              <img
                className="photo"
                src={assets.room}
                alt="Referensi kamar pintar"
              />
              <strong>
                <Zap size={15} /> Smart Room
              </strong>
              <small>Periksa status provider</small>
            </button>
          </div>
          <div className="bo-leo-questions">
            <button className="btn outline" onClick={() => onNavigate("cctv")}>
              CCTV & AI
            </button>
            <button className="btn light" onClick={() => onNavigate("iot")}>
              Smart Room
            </button>
            <button className="btn outline" onClick={() => onNavigate("leo")}>
              LEO Insight
            </button>
          </div>
        </WorkspaceCard>
      </div>
      <div className="space" />
      <WorkspaceCard
        title="Pekerjaan & aktivitas"
        description="Tindak lanjut yang tercatat pada properti aktif."
        action={
          <button
            className="btn outline small"
            onClick={() => onNavigate("tasks")}
          >
            Lihat tugas
          </button>
        }
      >
        {open.slice(0, 4).map((t) => (
          <div className="item" key={t.id}>
            <div className="left">
              <span className="glyph">
                <ClipboardCheck size={18} />
              </span>
              <div>
                <strong>{t.title}</strong>
                <small>
                  {t.stay ? `Kamar ${t.stay.room.number} · ` : ""}
                  {t.assignee?.name || "Belum ditugaskan"}
                </small>
              </div>
            </div>
            <span className="tag gold">
              {t.status === "OPEN" ? "Baru" : "Dikerjakan"}
            </span>
          </div>
        ))}
        {!open.length && <p>Tidak ada pekerjaan terbuka.</p>}
      </WorkspaceCard>
    </>
  );
}
