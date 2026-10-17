"use client";

import { useId } from "react";
import { ChartNoAxesCombined } from "lucide-react";
import { rupiah } from "@/lib/plans";

export type PaymentTrendPoint = { month: string; amount: number };

const monthLabel = (month: string) =>
  new Intl.DateTimeFormat("id-ID", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(month + "-01T00:00:00Z"));

const compactMoney = (value: number) =>
  new Intl.NumberFormat("id-ID", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);

export function PaymentTrend({ trend }: { trend: PaymentTrendPoint[] }) {
  const id = useId().replace(/:/g, "");
  const maximum = Math.max(1, ...trend.map((point) => point.amount));
  const hasPayments = trend.some((point) => point.amount > 0);
  const left = 66;
  const right = 612;
  const top = 24;
  const bottom = 180;
  const points = trend.map((point, index) => ({
    ...point,
    x:
      trend.length < 2
        ? (left + right) / 2
        : left + (index / (trend.length - 1)) * (right - left),
    y: bottom - (Math.max(0, point.amount) / maximum) * (bottom - top),
  }));
  const line = points
    .map((point, index) => `${index ? "L" : "M"} ${point.x} ${point.y}`)
    .join(" ");
  const area = points.length
    ? `${line} L ${points.at(-1)!.x} ${bottom} L ${points[0].x} ${bottom} Z`
    : "";
  const total = trend.reduce((sum, point) => sum + point.amount, 0);
  return (
    <section
      className="panel"
      aria-label="Tren pembayaran enam bulan terakhir"
      style={{ marginTop: 24 }}
    >
      <div className="panel-title" style={{ flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span
            aria-hidden="true"
            style={{
              display: "inline-flex",
              padding: 10,
              borderRadius: 12,
              background: "#eef4ff",
              color: "#2563eb",
            }}
          >
            <ChartNoAxesCombined size={21} />
          </span>
          <div>
            <h2>Tren pemasukan</h2>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>
              6 bulan terakhir · bulan berjalan hingga hari ini
            </span>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <small
            style={{ display: "block", color: "var(--muted)", fontSize: 11 }}
          >
            Total periode
          </small>
          <strong style={{ fontSize: 18 }}>{rupiah(total)}</strong>
        </div>
      </div>
      <figure style={{ margin: 0 }}>
        <svg
          viewBox="0 0 640 224"
          role="img"
          aria-labelledby={`${id}-title ${id}-description`}
          style={{ display: "block", width: "100%", overflow: "visible" }}
        >
          <title id={`${id}-title`}>Pembayaran diterima per bulan</title>
          <desc id={`${id}-description`}>
            {trend
              .map(
                (point) =>
                  `${monthLabel(point.month)}: ${rupiah(point.amount)}`,
              )
              .join(". ") || "Belum ada data pembayaran."}
          </desc>
          <defs>
            <linearGradient id={`${id}-area`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.02" />
            </linearGradient>
          </defs>
          {(hasPayments ? [0, 0.5, 1] : [0]).map((step) => {
            const y = bottom - step * (bottom - top);
            return (
              <g key={step}>
                <line
                  x1={left}
                  y1={y}
                  x2={right}
                  y2={y}
                  stroke="#e5ebf4"
                  strokeDasharray={step ? "4 5" : undefined}
                />
                <text
                  x={left - 12}
                  y={y + 4}
                  textAnchor="end"
                  fill="#64748b"
                  fontSize="11"
                >
                  {compactMoney(hasPayments ? maximum * step : 0)}
                </text>
              </g>
            );
          })}
          {area && <path d={area} fill={`url(#${id}-area)`} />}
          {line && (
            <path
              d={line}
              fill="none"
              stroke={hasPayments ? "#2563eb" : "#94a3b8"}
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
          {points.map((point) => (
            <g key={point.month}>
              <circle
                cx={point.x}
                cy={point.y}
                r="5"
                fill="white"
                stroke={hasPayments ? "#2563eb" : "#94a3b8"}
                strokeWidth="2.5"
              >
                <title>
                  {`${monthLabel(point.month)}: ${rupiah(point.amount)}`}
                </title>
              </circle>
              <text
                x={point.x}
                y={208}
                textAnchor="middle"
                fill="#64748b"
                fontSize="11"
              >
                {monthLabel(point.month)}
              </text>
            </g>
          ))}
        </svg>
        <figcaption
          style={{ color: "var(--muted)", fontSize: 12, marginTop: 8 }}
        >
          {hasPayments
            ? "Pembayaran yang sudah dicatat berdasarkan tanggal pembayaran, termasuk pembayaran sebagian."
            : "Belum ada pembayaran tercatat dalam enam bulan ini."}
        </figcaption>
      </figure>
      <ol
        style={{
          listStyle: "none",
          padding: 0,
          margin: "18px 0 0",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))",
          gap: 10,
          borderTop: "1px solid var(--line)",
          paddingTop: 16,
        }}
      >
        {trend.map((point) => (
          <li key={point.month} style={{ fontSize: 12 }}>
            <time
              dateTime={point.month}
              style={{ display: "block", color: "var(--muted)" }}
            >
              {monthLabel(point.month)}
            </time>
            <strong style={{ display: "block", fontSize: 13 }}>
              {rupiah(point.amount)}
            </strong>
          </li>
        ))}
      </ol>
    </section>
  );
}
