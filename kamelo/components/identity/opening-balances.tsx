"use client";
import { useEffect, useRef, useState } from "react";
import { WorkspaceCard } from "@/components/workspace/modules";
import { rupiah } from "@/lib/plans";
import { tenantToday } from "@/lib/tenant-types";
export function TenantOpeningBalances() {
  const [list, setList] = useState<any>(null),
    [detail, setDetail] = useState<any>(null),
    [selected, setSelected] = useState(""),
    [page, setPage] = useState(1),
    [proofPage, setProofPage] = useState(1),
    [reminderPage, setReminderPage] = useState(1),
    [amount, setAmount] = useState(""),
    [date, setDate] = useState(tenantToday()),
    [method, setMethod] = useState("TRANSFER"),
    [reference, setReference] = useState(""),
    [note, setNote] = useState(""),
    [file, setFile] = useState<File | null>(null),
    [confirmed, setConfirmed] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const seq = useRef(0),
    active = useRef(false),
    key = useRef(""),
    feedback = useRef<HTMLParagraphElement>(null),
    fileInput = useRef<HTMLInputElement>(null),
    heading = useRef<HTMLHeadingElement>(null);
  async function get(url: string) {
    const r = await fetch(url, { cache: "no-store" }),
      d = await r.json();
    if (!r.ok) throw Error(d.error);
    return d;
  }
  async function load() {
    const n = ++seq.current,
      l = await get("/api/opening-tenant?page=" + page),
      d = selected
        ? await get(
            "/api/opening-tenant?receivableId=" +
              encodeURIComponent(selected) +
              "&page=" +
              proofPage +
              "&reminderPage=" +
              reminderPage,
          )
        : null;
    if (n === seq.current) {
      setList(l);
      setDetail(d?.detail || null);
    }
  }
  useEffect(() => {
    void load().catch((e) => setMessage(e.message));
    return () => {
      seq.current++;
    };
  }, [selected, page, proofPage, reminderPage]);
  useEffect(() => {
    if (detail?.id) heading.current?.focus();
  }, [detail?.id]);
  function change() {
    key.current = "";
    setConfirmed(false);
  }
  async function refresh() {
    if (active.current) return;
    active.current = true;
    setBusy(true);
    setConfirmed(false);
    try {
      await load();
      setMessage("Status saldo diperbarui.");
    } catch (e) {
      setDetail(null);
      setMessage(e instanceof Error ? e.message : "Status belum dimuat.");
    } finally {
      active.current = false;
      setBusy(false);
      requestAnimationFrame(() => feedback.current?.focus());
    }
  }
  async function upload() {
    if (active.current || !file) return;
    active.current = true;
    setBusy(true);
    setMessage("");
    try {
      if (!key.current) key.current = crypto.randomUUID();
      const form = new FormData();
      for (const [k, v] of Object.entries({
        receivableId: selected,
        key: key.current,
        amount,
        date,
        method,
        reference,
        note,
      }))
        form.set(k, v);
      form.set("file", file);
      const r = await fetch("/api/opening-tenant", {
          method: "POST",
          body: form,
        }),
        d = await r.json();
      if (!r.ok) throw Error(d.error);
      setConfirmed(false);
      setAmount("");
      setReference("");
      setNote("");
      setFile(null);
      if (fileInput.current) fileInput.current.value = "";
      key.current = "";
      setMessage(
        "Bukti diterima untuk diperiksa pengelola. Unggahan belum mengurangi saldo atau menambah kas.",
      );
      try {
        await load();
      } catch {
        setMessage(
          "Bukti tersimpan. Muat ulang halaman untuk melihat status pemeriksaannya.",
        );
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Bukti belum tersimpan.");
    } finally {
      active.current = false;
      setBusy(false);
      requestAnimationFrame(() => feedback.current?.focus());
    }
  }
  return (
    <WorkspaceCard title="Saldo sebelum Kamelo">
      <div className="bo-import-body">
        <p>
          Saldo lama yang dibagikan pengelola secara khusus ke akun dan masa
          tinggal Anda. Saldo ini terpisah dari invoice Kamelo. Bukti unggahan
          menunggu pemeriksaan, bukan konfirmasi dana masuk.
        </p>
        {list?.rows.map((r: any) => (
          <div className="bo-import-history" key={r.id}>
            <span>
              {r.reference} · jatuh tempo {r.due} · sisa {rupiah(r.remaining)}
              {r.status === "VOID" ? " · dibatalkan" : ""}
            </span>
            <button
              className="btn outline"
              disabled={busy}
              onClick={() => {
                if (selected === r.id) {
                  void refresh();
                  return;
                }
                setSelected(r.id);
                setDetail(null);
                setProofPage(1);
                setReminderPage(1);
                change();
                setFile(null);
                setAmount("");
                setReference("");
                setNote("");
              }}
            >
              Rincian saldo {r.reference}
            </button>
          </div>
        ))}
        {list && !list.rows.length && (
          <p>Belum ada saldo awal yang dibagikan pada halaman ini.</p>
        )}
        {list && (
          <div className="bo-import-history">
            <button
              className="btn outline"
              disabled={busy || page === 1}
              onClick={() => {
                setPage(page - 1);
                setSelected("");
                setDetail(null);
              }}
            >
              Saldo sebelumnya
            </button>
            <span>
              Halaman {page} · {list.total} saldo
            </span>
            <button
              className="btn outline"
              disabled={busy || page * 20 >= list.total}
              onClick={() => {
                setPage(page + 1);
                setSelected("");
                setDetail(null);
              }}
            >
              Saldo berikutnya
            </button>
          </div>
        )}
        {detail && (
          <>
            <h3 ref={heading} tabIndex={-1}>
              Rincian saldo {detail.reference}
            </h3>
            <button
              className="btn outline"
              disabled={busy}
              onClick={() => void refresh()}
            >
              Perbarui status saldo
            </button>
            <p>
              Saldo per {detail.asOf}: {rupiah(detail.amount)} · pembayaran
              tercatat {rupiah(detail.paid)} ·{" "}
              <strong>sisa {rupiah(detail.remaining)}</strong>.
            </p>
            <h3>Pengingat dari pengelola</h3>
            <p>
              Riwayat berikut merekam saldo saat pengingat diterbitkan. Gunakan
              sisa saldo terbaru di atas; pengingat lama bukan tagihan baru atau
              konfirmasi dana masuk.
            </p>
            <div
              className="bo-import-table"
              role="region"
              aria-label="Pengingat saldo awal saya"
              tabIndex={0}
            >
              {detail.reminders?.rows.map((r: any) => (
                <p key={r.id}>
                  {new Date(r.createdAt).toLocaleString("id-ID")} ·{" "}
                  {r.reference}: saldo sebelum Kamelo masih tercatat{" "}
                  {rupiah(r.amount)}, jatuh tempo {r.due}. Jika sudah membayar,
                  unggah bukti atau hubungi pengelola untuk pemeriksaan.
                </p>
              ))}
            </div>
            {!detail.reminders?.total && (
              <p>Belum ada pengingat untuk akun ini.</p>
            )}
            <div className="bo-import-actions">
              <button
                className="btn outline"
                disabled={busy || reminderPage <= 1}
                onClick={() => setReminderPage(reminderPage - 1)}
              >
                Riwayat pengingat sebelumnya
              </button>
              <span>
                Halaman {reminderPage} · {detail.reminders?.total || 0}{" "}
                pengingat
              </span>
              <button
                className="btn outline"
                disabled={
                  busy || reminderPage * 20 >= (detail.reminders?.total || 0)
                }
                onClick={() => setReminderPage(reminderPage + 1)}
              >
                Riwayat pengingat berikutnya
              </button>
            </div>
            {detail.remaining > 0 && detail.status === "OPEN" ? (
              <>
                <h3>Ajukan bukti pembayaran</h3>
                <p>
                  Unggah JPG, PNG, WebP atau PDF maksimal 5 MB. Pastikan tujuan
                  pembayaran kepada pengelola melalui saluran yang Anda kenal.
                  Halaman ini tidak menarik dana. Jika dana sudah dicatat
                  manual, hubungi pengelola sebelum mengajukan bukti lagi.
                </p>
                <label>
                  Nominal bukti saldo awal (Rp)
                  <input
                    type="number"
                    min={1}
                    max={detail.remaining}
                    value={amount}
                    disabled={busy}
                    onChange={(e) => {
                      setAmount(e.target.value);
                      change();
                    }}
                  />
                </label>
                <label>
                  Tanggal pembayaran saldo awal
                  <input
                    type="date"
                    min={detail.asOf}
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
                  Metode pembayaran saldo awal
                  <select
                    value={method}
                    disabled={busy}
                    onChange={(e) => {
                      setMethod(e.target.value);
                      change();
                    }}
                  >
                    <option value="TRANSFER">Transfer</option>
                    <option value="QRIS">QRIS</option>
                    <option value="CASH">Tunai</option>
                    <option value="OTHER">Lainnya</option>
                  </select>
                </label>
                <label>
                  Referensi bukti saldo awal
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
                <label>
                  Catatan untuk pengelola
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
                <label>
                  File bukti saldo awal
                  <input
                    ref={fileInput}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,application/pdf"
                    disabled={busy}
                    onChange={(e) => {
                      setFile(e.target.files?.[0] || null);
                      change();
                    }}
                  />
                </label>
                <label className="bo-import-confirm">
                  <input
                    type="checkbox"
                    checked={confirmed}
                    disabled={busy}
                    onChange={(e) => setConfirmed(e.target.checked)}
                  />
                  Bukti dan nominal sesuai pembayaran saya. Saya memahami saldo
                  berubah setelah diperiksa pengelola.
                </label>
                <button
                  className="btn"
                  disabled={
                    busy ||
                    !confirmed ||
                    !file ||
                    Number(amount) < 1 ||
                    !Number.isInteger(Number(amount)) ||
                    Number(amount) > detail.remaining ||
                    reference.trim().length < 3 ||
                    !date
                  }
                  onClick={() => void upload()}
                >
                  Unggah bukti saldo awal
                </button>
              </>
            ) : (
              <p>
                Saldo sudah lunas atau dibatalkan; unggahan baru tidak tersedia.
              </p>
            )}
            <p role="status" aria-live="polite" tabIndex={-1} ref={feedback}>
              {busy ? "Mengunggah / memuat status…" : message}
            </p>
            <h3>Status bukti saya</h3>
            <div
              className="bo-import-table"
              role="region"
              aria-label="Daftar bukti saya"
              tabIndex={0}
            >
              {detail.proofs.map((p: any) => (
                <div className="bo-import-history" key={p.id}>
                  <span>
                    {p.reference} · {rupiah(p.amount)} · {p.date} ·{" "}
                    {p.status === "PENDING"
                      ? "Menunggu pemeriksaan"
                      : p.status === "APPROVED"
                        ? "Disetujui"
                        : "Ditolak"}
                    {p.receiptCorrected
                      ? " · catatan penerimaan telah dikoreksi; hubungi pengelola"
                      : ""}
                    <br />
                    {p.reviewNote}
                  </span>
                  <a
                    href={"/api/opening-proofs/" + p.id}
                    target="_blank"
                    rel="noreferrer"
                    className="text-link"
                  >
                    Unduh bukti saya {p.reference}
                  </a>
                </div>
              ))}
              {!detail.proofs.length && (
                <p>Belum ada bukti pada halaman ini.</p>
              )}
            </div>
            <div className="bo-import-history">
              <button
                className="btn outline"
                disabled={busy || proofPage === 1}
                onClick={() => setProofPage(proofPage - 1)}
              >
                Bukti saya sebelumnya
              </button>
              <span>
                Halaman {proofPage} · {detail.totalProofs} bukti
              </span>
              <button
                className="btn outline"
                disabled={busy || proofPage * 20 >= detail.totalProofs}
                onClick={() => setProofPage(proofPage + 1)}
              >
                Bukti saya berikutnya
              </button>
            </div>
          </>
        )}
        {!detail && (
          <p role="status" aria-live="polite" tabIndex={-1} ref={feedback}>
            {busy ? "Mengunggah bukti…" : message}
          </p>
        )}
      </div>
    </WorkspaceCard>
  );
}
