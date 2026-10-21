"use client";
import { useEffect, useRef, useState } from "react";
import { WorkspaceCard } from "../workspace/card";
import { identityCall } from "./api";
import { rupiah } from "@/lib/plans";
export function ResidentReminders({ onBills }: { onBills: () => void }) {
  const [data, setData] = useState<any>(null),
    [error, setError] = useState(""),
    [page, setPage] = useState(1),
    [expanded, setExpanded] = useState(false),
    [loading, setLoading] = useState(false),
    [refresh, setRefresh] = useState(0);
  const seq = useRef(0);
  useEffect(() => {
    const n = ++seq.current;
    setLoading(true);
    setError("");
    void identityCall(`/api/resident-reminders?page=${page}`)
      .then((d) => {
        if (n === seq.current) setData(d);
      })
      .catch((e) => {
        if (n === seq.current) {
          setData(null);
          setError(e.message);
        }
      })
      .finally(() => {
        if (n === seq.current) setLoading(false);
      });
    return () => {
      seq.current++;
    };
  }, [page, refresh]);
  return (
    <WorkspaceCard
      title="Pengingat dari pengelola"
      description="Riwayat pengingat otomatis untuk akses tagihan Anda."
    >
      <p>
        Nominal di bawah adalah catatan saat pengingat dibuat. Buka tagihan
        untuk saldo terkini dan status pemeriksaan bukti bayar.
      </p>
      {error && <p role="status">{error}</p>}
      {!data && !error && <p role="status">Memuat pengingat…</p>}
      {data &&
        (data.rows.length ? (
          (expanded ? data.rows : data.rows.slice(0, 3)).map((r: any) => (
            <article
              className="item"
              key={r.id}
              style={{ flexWrap: "wrap", gap: 8 }}
            >
              <div style={{ overflowWrap: "anywhere", minWidth: 0 }}>
                <strong>
                  {r.invoiceId ? "Invoice" : "Saldo awal"} {r.reference}
                </strong>
                <p>
                  {rupiah(r.amount)} · jatuh tempo {r.due}
                </p>
                <small>
                  {new Date(r.createdAt).toLocaleString("id-ID", {
                    timeZone: "Asia/Jakarta",
                  })}{" "}
                  WIB
                </small>
              </div>
            </article>
          ))
        ) : (
          <p>Belum ada pengingat otomatis.</p>
        ))}
      <div
        style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 16 }}
      >
        <button className="btn" onClick={onBills}>
          Periksa tagihan saya
        </button>
        <button
          className="btn outline"
          disabled={loading}
          onClick={() => setRefresh((n) => n + 1)}
        >
          Perbarui pengingat
        </button>
      </div>
      {data && !expanded && data.total > 3 && (
        <button
          className="btn outline"
          style={{ marginTop: 16 }}
          onClick={() => setExpanded(true)}
        >
          Lihat riwayat pengingat ({data.total})
        </button>
      )}
      {data && expanded && data.total > 20 && (
        <div
          style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 16 }}
        >
          <button
            className="btn outline"
            disabled={loading || page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Pengingat sebelumnya
          </button>
          <span>
            Halaman {data.page} dari {Math.ceil(data.total / 20)}
          </span>
          <button
            className="btn outline"
            disabled={loading || page * 20 >= data.total}
            onClick={() => setPage((p) => p + 1)}
          >
            Pengingat berikutnya
          </button>
        </div>
      )}
    </WorkspaceCard>
  );
}
