"use client";

import {
  CalendarClock,
  CheckCircle2,
  KeyRound,
  RefreshCw,
  ShieldCheck,
  WifiOff,
} from "lucide-react";

type Props = {
  device: {
    id: string;
    name: string;
    kind: string;
    roomId: string | null;
    online: boolean;
    automationEnabled: boolean;
    accesses?: {
      id: string;
      stayId: string;
      status: string;
      validFrom: string;
      validUntil: string | null;
    }[];
  };
  demo: boolean;
  canConfigure: boolean;
  pending: boolean;
  mutate: (action: string, data: Record<string, unknown>) => Promise<void>;
};

export function SmartAccessPanel({
  device,
  demo,
  canConfigure,
  pending,
  mutate,
}: Props) {
  if (device.kind !== "LOCK") return null;
  const accesses = device.accesses ?? [];
  const active = accesses.filter((access) => access.status === "ACTIVE").length;
  const scheduled = accesses.filter(
    (access) => access.status === "SCHEDULED",
  ).length;
  const waiting = accesses.filter(
    (access) => access.status === "PENDING",
  ).length;
  const revoked = accesses.filter(
    (access) => access.status === "REVOKED",
  ).length;
  return (
    <div
      className="smart-access-panel"
      style={{
        marginTop: 18,
        paddingTop: 18,
        borderTop: "1px solid var(--border, #e5eaf2)",
      }}
    >
      <div className="panel-title" style={{ gap: 10 }}>
        <KeyRound size={21} color="#6d4ce9" />
        <strong>Akses kamar otomatis</strong>
      </div>
      <span className="badge blue">Simulasi kunci digital</span>
      <p
        style={{
          fontSize: 13,
          lineHeight: 1.6,
          color: "var(--muted, #64748b)",
          margin: "12px 0",
        }}
      >
        PIN simulasi mengikuti tanggal tinggal. Akses hotel aktif setelah
        check-in dan dicabut saat checkout atau pembatalan.
      </p>
      <label
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
        }}
      >
        <span>Aktifkan otomatisasi kamar</span>
        <input
          type="checkbox"
          checked={device.automationEnabled}
          style={{ width: 19, height: 19, accentColor: "#6d4ce9" }}
          disabled={demo || !canConfigure || pending || !device.roomId}
          onChange={(event) =>
            void mutate("automation", {
              deviceId: device.id,
              enabled: event.target.checked,
            })
          }
        />
      </label>
      {!device.roomId && (
        <small>Petakan kunci ke kamar untuk mengaktifkan otomatisasi.</small>
      )}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: 9,
          margin: "14px 0",
        }}
      >
        {[
          {
            label: "Aktif",
            count: active,
            icon: CheckCircle2,
            color: "#079669",
          },
          {
            label: "Terjadwal",
            count: scheduled,
            icon: CalendarClock,
            color: "#6d4ce9",
          },
          {
            label: "Menunggu",
            count: waiting,
            icon: RefreshCw,
            color: "#c47b08",
          },
          {
            label: "Dicabut",
            count: revoked,
            icon: ShieldCheck,
            color: "#64748b",
          },
        ].map(({ label, count, icon: Icon, color }) => (
          <div
            key={label}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              padding: "9px 10px",
              background: "#f7f9fd",
              borderRadius: 10,
              fontSize: 12,
            }}
          >
            <Icon size={16} color={color} />
            <span>{label}</span>
            <strong style={{ marginLeft: "auto", color }}>{count}</strong>
          </div>
        ))}
      </div>
      {!device.online && (
        <p
          style={{
            display: "flex",
            gap: 8,
            alignItems: "flex-start",
            fontSize: 12,
            lineHeight: 1.6,
            color: "#a86508",
          }}
        >
          <WifiOff size={17} style={{ flexShrink: 0, marginTop: 2 }} />
          Perangkat offline. Perubahan akses menunggu konfirmasi; PIN aktif
          disembunyikan dari portal tenant.
        </p>
      )}
      <button
        type="button"
        className="secondary"
        disabled={demo || !canConfigure || pending}
        onClick={() => void mutate("syncAccess", { deviceId: device.id })}
      >
        <RefreshCw size={16} />{" "}
        {pending ? "Menunggu konfirmasi…" : "Sinkronkan akses"}
      </button>
      <small style={{ display: "block", marginTop: 10, lineHeight: 1.6 }}>
        {device.automationEnabled
          ? "Otomatisasi mengikuti masa tinggal, tanpa memblokir tenant karena tagihan."
          : "Otomatisasi belum aktif."}{" "}
        Simulasi ini belum mengendalikan kunci nyata.
      </small>
    </div>
  );
}
