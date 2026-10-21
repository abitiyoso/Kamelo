"use client";
import { useEffect, useRef, useState } from "react";
import { rupiah } from "@/lib/plans";
import { tenantToday } from "@/lib/tenant-types";
import { OpeningEvidence } from "./opening-evidence";
export function OpeningReceipts({
  id,
  propertyId,
  onChange,
}: {
  id: string;
  propertyId: string;
  onChange: () => void;
}) {
  const [data, setData] = useState<any>(null),
    [page, setPage] = useState(1),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [amount, setAmount] = useState(""),
    [date, setDate] = useState(tenantToday()),
    [method, setMethod] = useState("TRANSFER"),
    [reference, setReference] = useState(""),
    [note, setNote] = useState(""),
    [confirmed, setConfirmed] = useState(false),
    [reverseId, setReverseId] = useState(""),
    [refund, setRefund] = useState<any>(null);
  const active = useRef(false),
    heading = useRef<HTMLHeadingElement>(null),
    keys = useRef(new Map<string, string>()),
    feedback = useRef<HTMLParagraphElement>(null),
    sequence = useRef(0);
  async function load() {
    const n = ++sequence.current,
      r = await fetch(
        `/api/opening-balances?propertyId=${encodeURIComponent(propertyId)}&receivableId=${encodeURIComponent(id)}&page=${page}`,
        { cache: "no-store" },
      ),
      d = await r.json();
    if (!r.ok) throw Error(d.error);
    if (n === sequence.current) setData(d.receipt);
  }
  useEffect(() => {
    void load().catch((e) => setMessage(e.message));
    return () => {
      sequence.current++;
    };
  }, [id, page, propertyId]);
  useEffect(() => {
    if (data?.id) heading.current?.focus();
  }, [data?.id]);
  async function send() {
    if (active.current) return;
    active.current = true;
    setBusy(true);
    setMessage("");
    try {
      const body = reverseId
          ? {
              action: "reverseReceipt",
              receivableId: id,
              entryId: reverseId,
              note,
              confirmed,
            }
          : {
              action: refund ? "refundReceipt" : "receipt",
              ...(refund ? { entryId: refund.id } : {}),
              receivableId: id,
              amount: Number(amount),
              date,
              method,
              reference,
              note,
              confirmed,
            },
        fingerprint = JSON.stringify(body);
      let key = keys.current.get(fingerprint);
      if (!key) {
        key = crypto.randomUUID();
        keys.current.set(fingerprint, key);
      }
      const r = await fetch("/api/opening-balances", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...body, key }),
        }),
        d = await r.json();
      if (!r.ok) throw Error(d.error);
      setMessage(
        reverseId
          ? "Catatan dibalik pada tanggal asal; riwayat tetap tersimpan."
          : refund
            ? "Refund tercatat pada tanggal dana dikembalikan; saldo piutang terbuka kembali. Tidak memindahkan uang."
            : "Penerimaan tercatat. Sisa piutang dan laporan kas diperbarui.",
      );
      setAmount("");
      setReference("");
      setNote("");
      setConfirmed(false);
      setReverseId("");
      setRefund(null);
      try {
        if (page === 1) await load();
        else setPage(1);
      } catch {
        setMessage(
          "Perubahan tersimpan. Muat ulang riwayat untuk melihat saldo terbaru.",
        );
      }
      onChange();
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : "Penerimaan belum tersimpan.",
      );
    } finally {
      active.current = false;
      setBusy(false);
      requestAnimationFrame(() => feedback.current?.focus());
    }
  }
  function change() {
    setConfirmed(false);
  }
  return (
    <section className="bo-import-body" aria-label="Penerimaan saldo awal">
      <h3 ref={heading} tabIndex={-1}>
        Penerimaan piutang awal
      </h3>
      {data && (
        <>
          <p>
            {data.guest.name} · {data.reference}. Saldo sumber{" "}
            {rupiah(data.amount)} · diterima bersih {rupiah(data.paid)} ·{" "}
            <strong>sisa {rupiah(data.remaining)}</strong>.
          </p>
          <p>
            Catat dana yang sudah benar-benar diterima. Ini pencatatan manual,
            tanpa menarik dana atau mengirim pesan. Saldo awal tetap terpisah
            dari invoice; penerimaannya masuk satu kali ke laporan kas.
          </p>
          {data.status === "OPEN" && data.batch.status === "OPEN" && (
            <>
              {reverseId ? (
                <p>
                  Koreksi catatan salah input, tanpa pengembalian dana.
                  Pembalikan memakai tanggal, metode, referensi, dan nominal
                  asal. Gunakan pencatatan refund untuk dana yang benar-benar
                  dikembalikan.
                </p>
              ) : (
                <>
                  <label>
                    {refund
                      ? `Nominal refund dari ${refund.reference} (Rp)`
                      : "Nominal penerimaan (Rp)"}
                    <input
                      type="number"
                      min={1}
                      max={refund ? refund.available : data.remaining}
                      value={amount}
                      disabled={busy}
                      onChange={(e) => {
                        setAmount(e.target.value);
                        change();
                      }}
                    />
                  </label>
                  <label>
                    {refund
                      ? "Tanggal dana dikembalikan"
                      : "Tanggal dana diterima"}
                    <input
                      type="date"
                      min={refund ? refund.date : data.batch.asOf}
                      max={tenantToday()}
                      value={date}
                      disabled={busy}
                      onChange={(e) => {
                        setDate(e.target.value);
                        change();
                      }}
                    />
                  </label>
                  <label>
                    Metode {refund ? "pengembalian" : "penerimaan"}
                    <select
                      value={method}
                      disabled={busy}
                      onChange={(e) => {
                        setMethod(e.target.value);
                        change();
                      }}
                    >
                      <option value="TRANSFER">Transfer</option>
                      <option value="CASH">Tunai</option>
                      <option value="QRIS">QRIS</option>
                      <option value="OTHER">Lainnya</option>
                    </select>
                  </label>
                  <label>
                    Referensi {refund ? "refund" : "penerimaan"}
                    <input
                      maxLength={100}
                      value={reference}
                      disabled={busy}
                      onChange={(e) => {
                        setReference(e.target.value);
                        change();
                      }}
                    />
                  </label>
                  <p>
                    Referensi harus unik pada saldo ini, termasuk catatan yang
                    dikoreksi. Periksa mutasi agar dana yang sama tidak dicatat
                    juga pada invoice atau saldo lain.
                  </p>
                </>
              )}
              <label>
                {reverseId ? "Alasan koreksi" : "Catatan pemeriksaan"} (minimal
                10 karakter)
                <textarea
                  maxLength={1000}
                  value={note}
                  disabled={busy}
                  onChange={(e) => {
                    setNote(e.target.value);
                    change();
                  }}
                />
              </label>
              <label className="bo-import-confirm">
                <input
                  type="checkbox"
                  disabled={busy}
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                />
                {reverseId
                  ? "Saya memastikan ini pembatalan catatan salah input, bukan pengembalian dana."
                  : refund
                    ? "Dana sudah benar-benar dikembalikan. Ini hanya pencatatan refund, bukan perintah transfer; sisa piutang akan bertambah."
                    : "Dana sudah diterima, nominal/tanggal/referensi sudah diperiksa, dan dana ini belum dicatat pada invoice atau saldo lain."}
              </label>
              <button
                className="btn"
                disabled={
                  busy ||
                  !confirmed ||
                  note.trim().length < 10 ||
                  (!reverseId &&
                    (!Number.isInteger(Number(amount)) ||
                      Number(amount) < 1 ||
                      Number(amount) >
                        (refund ? refund.available : data.remaining) ||
                      reference.trim().length < 3 ||
                      !date))
                }
                onClick={() => void send()}
              >
                {reverseId
                  ? "Balik catatan penerimaan"
                  : refund
                    ? "Catat refund saldo awal"
                    : "Catat penerimaan saldo awal"}
              </button>
              {(reverseId || refund) && (
                <button
                  className="btn outline"
                  disabled={busy}
                  onClick={() => {
                    setReverseId("");
                    setRefund(null);
                    setNote("");
                    change();
                  }}
                >
                  Batal tindakan
                </button>
              )}
            </>
          )}
          <p ref={feedback} tabIndex={-1} role="status" aria-live="polite">
            {busy ? "Menyimpan catatan…" : message}
          </p>
          <div
            className="bo-import-table"
            role="region"
            aria-label="Riwayat penerimaan saldo awal"
            tabIndex={0}
          >
            <table>
              <thead>
                <tr>
                  <th>Tanggal / metode</th>
                  <th>Nominal</th>
                  <th>Referensi / catatan</th>
                  <th>Status / tindakan</th>
                </tr>
              </thead>
              <tbody>
                {data.entries.map((e: any) => (
                  <tr key={e.id}>
                    <td>
                      {e.date}
                      <br />
                      {e.method}
                    </td>
                    <td>{rupiah(e.delta)}</td>
                    <td>
                      {e.reference}
                      <br />
                      {e.note}
                    </td>
                    <td>
                      {e.kind === "REVERSAL"
                        ? "Pembalikan catatan"
                        : e.reversal
                          ? "Dikoreksi"
                          : e.matches.length
                            ? "Dicocokkan manual"
                            : e.kind === "REFUND"
                              ? "Refund tercatat"
                              : e.refunds
                                    .filter((r: any) => !r.reversal)
                                    .reduce(
                                      (s: number, r: any) => s - r.delta,
                                      0,
                                    ) === e.delta
                                ? "Sudah direfund penuh"
                                : e.refunds.some((r: any) => !r.reversal)
                                  ? "Direfund sebagian"
                                  : "Penerimaan aktif"}
                      {["RECEIPT", "REFUND"].includes(e.kind) &&
                        !e.reversal &&
                        !e.matches.length &&
                        !e.refunds.some((r: any) => !r.reversal) && (
                          <button
                            className="btn outline"
                            disabled={busy}
                            onClick={() => {
                              setReverseId(e.id);
                              setRefund(null);
                              setNote("");
                              change();
                            }}
                          >
                            Koreksi {e.reference}
                          </button>
                        )}
                      {e.kind === "RECEIPT" &&
                        !e.reversal &&
                        e.delta +
                          e.refunds
                            .filter((r: any) => !r.reversal)
                            .reduce((s: number, r: any) => s + r.delta, 0) >
                          0 && (
                          <button
                            className="btn outline"
                            disabled={busy}
                            onClick={() => {
                              setRefund({
                                id: e.id,
                                date: e.date,
                                reference: e.reference,
                                available:
                                  e.delta +
                                  e.refunds
                                    .filter((r: any) => !r.reversal)
                                    .reduce(
                                      (s: number, r: any) => s + r.delta,
                                      0,
                                    ),
                              });
                              setReverseId("");
                              setAmount("");
                              setReference("");
                              setNote("");
                              change();
                              heading.current?.focus();
                            }}
                          >
                            Catat refund {e.reference}
                          </button>
                        )}
                      {!!e.matches.length && (
                        <small>
                          Batalkan pencocokan di Mutasi & pencocokan sebelum
                          koreksi.
                        </small>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <OpeningEvidence
            id={id}
            propertyId={propertyId}
            onChange={() => {
              void load();
              onChange();
            }}
          />
          <div className="bo-import-history">
            <button
              className="btn outline"
              disabled={busy || page === 1}
              onClick={() => setPage(page - 1)}
            >
              Penerimaan sebelumnya
            </button>
            <span>
              Halaman {page} · {data.totalEntries} catatan
            </span>
            <button
              className="btn outline"
              disabled={busy || page * 20 >= data.totalEntries}
              onClick={() => setPage(page + 1)}
            >
              Penerimaan berikutnya
            </button>
          </div>
        </>
      )}
      {!data && <p role="status">{message || "Memuat penerimaan…"}</p>}
    </section>
  );
}
