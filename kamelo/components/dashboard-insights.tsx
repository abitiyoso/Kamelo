"use client";

import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CircleCheck,
  Clock3,
  DoorOpen,
  Minus,
  TrendingUp,
} from "lucide-react";
import { rupiah } from "@/lib/plans";

export type DashboardInsightSummary = {
  income: number;
  previousMonthIncome: number;
  incomeChange: number;
  incomeChangePercent: number | null;
  incomeDirection: "up" | "down" | "flat";
  currentStart: string;
  currentEnd: string;
  comparisonStart: string;
  comparisonEnd: string;
  roomCount: number;
  occupiedCount: number;
  occupancyPercent: number;
  overdueBalance: number;
  overdueCount: number;
  collectionTotal: number;
  collectionPaid: number;
  collectionRate: number | null;
  insights: { kind: string; text: string }[];
};

const dateLabel = (value: string) =>
  new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(value + "T00:00:00Z"));

export function DashboardInsights({
  summary,
  onOverdue,
}: {
  summary: DashboardInsightSummary;
  onOverdue?: () => void;
}) {
  const direction = summary.incomeDirection;
  const DirectionIcon =
    direction === "up"
      ? ArrowUpRight
      : direction === "down"
        ? ArrowDownRight
        : Minus;
  const directionColor =
    direction === "up"
      ? "#0f766e"
      : direction === "down"
        ? "#b45309"
        : "#64748b";
  const changeLabel =
    summary.incomeChangePercent === null
      ? "Mulai tercatat"
      : direction === "flat"
        ? "Tetap"
        : `${direction === "up" ? "Naik" : "Turun"} ${Math.abs(summary.incomeChangePercent).toLocaleString("id-ID", { maximumFractionDigits: 1 })}%`;
  const notes = new Map(
    summary.insights.map((insight) => [insight.kind, insight.text]),
  );
  const currentPeriod = `${dateLabel(summary.currentStart)}–${dateLabel(summary.currentEnd)}`;
  const previousPeriod = `${dateLabel(summary.comparisonStart)}–${dateLabel(summary.comparisonEnd)}`;
  const cards = [
    {
      kind: "occupancy",
      label: "Okupansi hari ini",
      value: `${summary.occupancyPercent}%`,
      description: `${summary.occupiedCount} dari ${summary.roomCount} kamar terisi`,
      icon: DoorOpen,
      color: "#2563eb",
      background: "#eff6ff",
    },
    {
      kind: "overdue",
      label: "Perlu ditindaklanjuti",
      value: rupiah(summary.overdueBalance),
      description: `${summary.overdueCount} tagihan melewati jatuh tempo`,
      icon: Clock3,
      color: "#b45309",
      background: "#fffbeb",
    },
    {
      kind: "collection",
      label: "Pelunasan tagihan bulan ini",
      value:
        summary.collectionRate === null
          ? "Belum ada tagihan"
          : `${summary.collectionRate.toLocaleString("id-ID", { maximumFractionDigits: 1 })}%`,
      description: `${rupiah(summary.collectionPaid)} dari ${rupiah(summary.collectionTotal)}`,
      icon: CircleCheck,
      color: "#7c3aed",
      background: "#f5f3ff",
    },
  ];
  return (
    <section
      aria-label="Insight operasional properti"
      style={{ marginBottom: 24 }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 14,
        }}
      >
        <h2 style={{ fontSize: 17, letterSpacing: "-0.4px" }}>
          Insight properti
        </h2>
        <span style={{ fontSize: 11, color: "var(--muted)" }}>
          Berdasarkan catatan properti
        </span>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(min(100%, 230px), 1fr))",
          gap: 14,
        }}
      >
        <article
          className="panel"
          style={{
            padding: 20,
            background: "linear-gradient(135deg, #f0fdfa, #ffffff)",
            borderColor: "#cce9e3",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 14,
            }}
          >
            <span
              aria-hidden="true"
              style={{
                display: "inline-flex",
                borderRadius: 12,
                padding: 10,
                color: "#0f766e",
                background: "#ccfbf1",
              }}
            >
              <TrendingUp size={20} />
            </span>
            <h3 style={{ fontSize: 12, letterSpacing: 0 }}>
              Pemasukan bulan berjalan
            </h3>
          </div>
          <strong
            style={{
              display: "block",
              fontSize: 23,
              lineHeight: 1.3,
              letterSpacing: "-0.6px",
            }}
          >
            {rupiah(summary.income)}
          </strong>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              marginTop: 10,
              color: directionColor,
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            <DirectionIcon size={16} aria-hidden="true" />
            {changeLabel}
          </span>
          <p style={{ fontSize: 11, marginTop: 8 }}>
            {currentPeriod} dibanding {previousPeriod} (
            {rupiah(summary.previousMonthIncome)}).
          </p>
          <p style={{ fontSize: 11, marginTop: 8 }}>{notes.get("income")}</p>
        </article>
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <article className="panel" key={card.kind} style={{ padding: 20 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  marginBottom: 14,
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    display: "inline-flex",
                    borderRadius: 12,
                    padding: 10,
                    color: card.color,
                    background: card.background,
                  }}
                >
                  <Icon size={20} />
                </span>
                <h3 style={{ fontSize: 12, letterSpacing: 0 }}>{card.label}</h3>
              </div>
              <strong
                style={{
                  display: "block",
                  fontSize:
                    card.kind === "collection" &&
                    summary.collectionRate === null
                      ? 18
                      : 23,
                  lineHeight: 1.3,
                  letterSpacing: "-0.6px",
                }}
              >
                {card.value}
              </strong>
              <span
                style={{
                  display: "block",
                  marginTop: 10,
                  color: "var(--muted)",
                  fontSize: 12,
                }}
              >
                {card.description}
              </span>
              {card.kind === "occupancy" && (
                <div
                  role="meter"
                  aria-label="Persentase kamar terisi"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={summary.occupancyPercent}
                  style={{
                    height: 6,
                    background: card.background,
                    borderRadius: 6,
                    marginTop: 14,
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${summary.occupancyPercent}%`,
                      background: card.color,
                      borderRadius: 6,
                    }}
                  />
                </div>
              )}
              {card.kind === "collection" && (
                <p style={{ fontSize: 11, marginTop: 10 }}>
                  Menghitung pembayaran untuk tagihan yang terbit bulan ini
                  hingga hari ini.
                </p>
              )}
              {card.kind === "overdue" &&
                onOverdue &&
                summary.overdueCount > 0 && (
                  <button
                    className="text-link"
                    onClick={onOverdue}
                    style={{ fontSize: 12, marginTop: 10 }}
                  >
                    Lihat tagihan <ArrowRight size={14} aria-hidden="true" />
                  </button>
                )}
              {card.kind === "overdue" && summary.overdueCount === 0 && (
                <p style={{ fontSize: 11, marginTop: 10 }}>
                  {notes.get("overdue")}
                </p>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
