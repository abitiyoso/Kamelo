"use client";
import { useEffect, useRef, useState } from "react";
import { rupiah } from "@/lib/plans";
export function OpeningReminders({
  id,
  propertyId,
}: {
  id: string;
  propertyId: string;
}) {
  const [data, setData] = useState<any>(null),
    [page, setPage] = useState(1),
    [confirmed, setConfirmed] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const seq = useRef(0),
    active = useRef(false),
    keys = useRef(new Map<string, string>()),
    feedback = useRef<HTMLParagraphElement>(null);
  async function load() {
    const n = ++seq.current,
      r = await fetch(
        `/api/opening-balances?propertyId=${encodeURIComponent(propertyId)}&receivableId=${encodeURIComponent(id)}&reminders=1&page=${page}`,
        { cache: "no-store" },
      ),
      d = await r.json();
    if (!r.ok) throw Error(d.error);
    if (n === seq.current) {
      setData(d.reminders);
      setConfirmed(false);
    }
  }
  useEffect(() => {
    setData(null);
    setConfirmed(false);
    void load().catch((e) => setMessage(e.message));
    return () => {
      seq.current++;
    };
  }, [id, propertyId, page]);
  async function run(publish: boolean) {
    if (active.current) return;
    active.current = true;
    setBusy(true);
    setMessage("");
    try {
      if (publish) {
        const digest = data?.preview.digest;
        let key = keys.current.get(digest);
        if (!key) {
          key = crypto.randomUUID();
          keys.current.set(digest, key);
        }
        const r = await fetch("/api/opening-balances", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "remindOpening",
              receivableId: id,
              digest,
              confirmed,
              key,
            }),
          }),
          d = await r.json();
        if (!r.ok) throw Error(d.error);
        setConfirmed(false);
        setMessage(
          "Pengingat tersedia di portal penghuni. Tidak ada email atau WhatsApp yang dikirim.",
        );
      }
      try {
        await load();
        if (!publish) setMessage("Pratinjau pengingat diperbarui.");
      } catch (e) {
        setData(null);
        throw e;
      }
    } catch (e) {
      setConfirmed(false);
      setMessage(e instanceof Error ? e.message : "Pengingat belum tersimpan.");
    } finally {
      active.current = false;
      setBusy(false);
      requestAnimationFrame(() => feedback.current?.focus());
    }
  }
  return (
    <section className="bo-import-body" aria-label="Pengingat saldo awal">
      <h3>Pengingat di portal penghuni</h3>
      <p>
        Untuk saldo yang sudah jatuh tempo. Pengingat tampil saat penghuni
        membuka rincian saldo; ini bukan bukti pesan telah dibaca. Maksimal
        sekali per 24 jam, tanpa pengiriman email atau WhatsApp.
      </p>
      <button
        className="btn outline"
        disabled={busy}
        onClick={() => void run(false)}
      >
        Perbarui pratinjau pengingat
      </button>
      {data && (
        <>
          <p>
            Referensi <strong>{data.preview.reference}</strong> · sisa saat ini{" "}
            <strong>{rupiah(data.preview.remaining)}</strong> · jatuh tempo{" "}
            {data.preview.due}.
          </p>
          {data.preview.target && (
            <p>
              Penerima: {data.preview.target.name} · {data.preview.target.email}
            </p>
          )}
          <p>
            Isi pengingat: saldo sebelum Kamelo masih tercatat{" "}
            {rupiah(data.preview.remaining)}, jatuh tempo {data.preview.due}.
            Jika sudah membayar, unggah bukti atau hubungi pengelola untuk
            pemeriksaan.
          </p>
          {!data.preview.eligible && <p role="status">{data.preview.reason}</p>}
          {data.preview.nextAt && (
            <p>
              Jadwal paling awal berikutnya:{" "}
              {new Date(data.preview.nextAt).toLocaleString("id-ID")}.
            </p>
          )}
          <label className="bo-import-confirm">
            <input
              type="checkbox"
              checked={confirmed}
              disabled={busy || !data.preview.eligible}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            Saya telah memeriksa akun penerima dan saldo terbaru untuk pengingat
            di portal ini.
          </label>
          <button
            className="btn primary"
            disabled={busy || !confirmed || !data.preview.eligible}
            onClick={() => void run(true)}
          >
            Terbitkan pengingat di portal
          </button>
          <p ref={feedback} tabIndex={-1} role="status">
            {message}
          </p>
          <h4>Riwayat pengingat portal</h4>
          <div
            className="bo-import-table"
            role="region"
            aria-label="Riwayat pengingat saldo awal"
            tabIndex={0}
          >
            {data.history.map((r: any) => (
              <p key={r.id}>
                {new Date(r.createdAt).toLocaleString("id-ID")} · {r.reference}{" "}
                · {rupiah(r.amount)} · jatuh tempo {r.due} · dicatat di portal,
                status baca tidak dilacak.
              </p>
            ))}
          </div>
          {!data.total && <p>Belum ada pengingat portal.</p>}
          <div className="bo-import-actions">
            <button
              className="btn outline"
              disabled={busy || page <= 1}
              onClick={() => setPage(page - 1)}
            >
              Pengingat sebelumnya
            </button>
            <span>
              Halaman {page} · {data.total} pengingat
            </span>
            <button
              className="btn outline"
              disabled={busy || page * 20 >= data.total}
              onClick={() => setPage(page + 1)}
            >
              Pengingat berikutnya
            </button>
          </div>
        </>
      )}
      {!data && message && <p role="status">{message}</p>}
    </section>
  );
}
