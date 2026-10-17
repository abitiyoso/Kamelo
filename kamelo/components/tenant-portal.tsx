"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ArrowUpRight,
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  Clock3,
  DoorOpen,
  FileCheck2,
  FileUp,
  Info,
  KeyRound,
  Loader2,
  ReceiptText,
  ShieldCheck,
} from "lucide-react";
import { Brand } from "./brand";
import { getDemoTenantData } from "@/lib/demo-tenant";
import { rupiah } from "@/lib/plans";
import {
  paymentMethodNames,
  proofStatusNames,
  tenantDate,
  tenantToday,
  type TenantData,
} from "@/lib/tenant-types";

export function TenantPortal({
  token = "",
  demo = false,
  embedded = false,
  hotel = false,
}: {
  token?: string;
  demo?: boolean;
  embedded?: boolean;
  hotel?: boolean;
}) {
  const [data, setData] = useState<TenantData | null>(
    demo ? getDemoTenantData(hotel) : null,
  );
  const [loading, setLoading] = useState(!demo);
  const [error, setError] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [success, setSuccess] = useState("");
  const [pending, setPending] = useState(false);

  const load = useCallback(async () => {
    if (demo) return;
    const response = await fetch(`/api/tenant/${encodeURIComponent(token)}`, {
      cache: "no-store",
    });
    if (response.status === 403 || response.status === 404)
      throw new Error(
        "Tautan tagihan tidak tersedia atau sudah kedaluwarsa. Hubungi pengelola untuk mendapatkan tautan baru.",
      );
    if (!response.ok)
      throw new Error("Tagihan belum dapat dimuat. Silakan coba kembali.");
    const body: TenantData = await response.json();
    setData(body);
    setError("");
  }, [token, demo]);

  useEffect(() => {
    if (demo) return;
    let active = true;
    setLoading(true);
    load()
      .catch((reason: unknown) => {
        if (active)
          setError(
            reason instanceof Error ? reason.message : "Gagal memuat tagihan.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [load, demo]);

  async function uploadProof(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !data) return;
    const form = event.currentTarget;
    const body = new FormData(form);
    const file = body.get("file");
    setUploadError("");
    setSuccess("");
    if (!(file instanceof File) || !file.size) {
      setUploadError("Pilih foto atau PDF bukti pembayaran terlebih dahulu.");
      return;
    }
    if (
      !["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(
        file.type,
      )
    ) {
      setUploadError("Gunakan berkas JPG, PNG, WebP, atau PDF.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setUploadError("Ukuran berkas maksimal 5 MB.");
      return;
    }
    const amount = Number(body.get("amount"));
    if (
      !Number.isInteger(amount) ||
      amount < 1 ||
      amount > data.invoice.balance
    ) {
      setUploadError(
        "Nominal pembayaran harus lebih dari nol dan tidak melebihi sisa tagihan.",
      );
      return;
    }
    setPending(true);
    if (demo) {
      const proof = {
        id: "local-demo-proof",
        amount,
        date: String(body.get("date")),
        method: String(body.get("method")),
        reference: String(body.get("reference") || ""),
        status: "PENDING",
        uploadedAt: "2026-10-13T00:00:00Z",
      };
      setData((current) =>
        current
          ? { ...current, invoice: { ...current.invoice, proofs: [proof] } }
          : current,
      );
      setSuccess(
        "Simulasi selesai: bukti ditambahkan hanya pada tampilan ini. Saldo tetap; tidak ada berkas diunggah atau pembayaran dicatat.",
      );
      form.reset();
      setPending(false);
      return;
    }
    try {
      const response = await fetch(
        `/api/tenant/${encodeURIComponent(token)}/proof`,
        {
          method: "POST",
          body,
        },
      );
      const result = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(
          response.status === 403 || response.status === 404
            ? "Tautan ini sudah tidak tersedia. Minta tautan baru kepada pengelola."
            : result.error || "Bukti belum dapat diunggah. Silakan coba lagi.",
        );
      form.reset();
      setSuccess(
        "Bukti berhasil diunggah. Pengelola akan memverifikasi pembayaran Anda; saldo belum berubah sampai disetujui.",
      );
      try {
        await load();
      } catch {
        setUploadError(
          "Bukti sudah diterima, tetapi tagihan belum dapat diperbarui. Muat ulang halaman untuk melihat status terbaru.",
        );
      }
    } catch (reason) {
      setUploadError(
        reason instanceof Error
          ? reason.message
          : "Gagal mengunggah bukti pembayaran.",
      );
    } finally {
      setPending(false);
    }
  }

  const invoice = data?.invoice;
  const overdue =
    invoice && invoice.balance > 0 && invoice.due.slice(0, 10) < tenantToday();
  const payable =
    invoice &&
    invoice.balance > 0 &&
    !["DRAFT", "VOID"].includes(invoice.status);
  const pendingProofs =
    invoice?.proofs.filter((proof) => proof.status === "PENDING") || [];

  return (
    <main
      className={"tenant-shell" + (demo && embedded ? " tenant-embedded" : "")}
    >
      <header className="tenant-header">
        <Brand />
        <span className="tenant-secure">
          <ShieldCheck size={16} aria-hidden="true" /> Portal penghuni
        </span>
      </header>
      {demo && (
        <aside className="tenant-notice tenant-demo-notice">
          <Info size={18} />
          <p>
            {embedded ? (
              <b>Contoh penghuni · Simulasi lokal.</b>
            ) : (
              <>
                <b>Contoh portal penghuni · Simulasi lokal.</b> Penghuni
                menerima tautan dari pengelola, tanpa pendaftaran. Tidak ada
                data pelanggan, token akses, unggahan server atau kunci nyata.{" "}
                <a href="/demo/owner">Lihat demo owner →</a>
              </>
            )}
          </p>
        </aside>
      )}
      {loading ? (
        <section className="panel tenant-state" role="status">
          <Loader2 className="tenant-spinner" size={28} aria-hidden="true" />
          <h1>Memuat tagihan Anda…</h1>
          <p>Menyiapkan rincian pembayaran.</p>
        </section>
      ) : error || !invoice ? (
        <section className="panel tenant-state" role="alert">
          <ReceiptText size={32} aria-hidden="true" />
          <h1>Tagihan belum tersedia</h1>
          <p>
            {error || "Hubungi pengelola untuk mendapatkan tautan tagihan."}
          </p>
          <button
            className="secondary"
            onClick={() => {
              setLoading(true);
              load()
                .catch((reason) => setError(reason.message))
                .finally(() => setLoading(false));
            }}
          >
            Coba kembali
          </button>
        </section>
      ) : (
        <>
          <div className="tenant-heading">
            <span className="eyebrow">TAGIHAN PENGHUNI</span>
            <h1>Halo, {invoice.customerName.split(" ")[0]}.</h1>
            <p>Rincian tagihan dan bukti pembayaran Anda di satu tempat.</p>
          </div>
          <div className="tenant-grid">
            <section
              className="panel tenant-invoice"
              aria-labelledby="tenant-invoice-title"
            >
              <div className="panel-title">
                <h2 id="tenant-invoice-title">
                  <ReceiptText size={21} aria-hidden="true" /> {invoice.number}
                </h2>
                <span
                  className={`tenant-status ${invoice.balance === 0 ? "paid" : overdue ? "overdue" : "unpaid"}`}
                >
                  {invoice.status === "VOID"
                    ? "Dibatalkan"
                    : invoice.balance === 0
                      ? "Lunas"
                      : overdue
                        ? "Lewat jatuh tempo"
                        : invoice.paid > 0
                          ? "Terbayar sebagian"
                          : "Belum lunas"}
                </span>
              </div>
              <div className="tenant-property">
                <span className="tenant-room-icon">
                  <DoorOpen size={23} aria-hidden="true" />
                </span>
                <div>
                  <h3>{invoice.propertyName}</h3>
                  <p>
                    Kamar {invoice.roomNumber} · {invoice.customerName}
                  </p>
                </div>
              </div>
              <dl className="tenant-dates">
                <div>
                  <dt>Tanggal tagihan</dt>
                  <dd>{tenantDate(invoice.date)}</dd>
                </div>
                <div>
                  <dt>
                    <CalendarDays size={14} aria-hidden="true" /> Jatuh tempo
                    Anda
                  </dt>
                  <dd>
                    <time dateTime={invoice.due}>
                      {tenantDate(invoice.due)}
                    </time>
                  </dd>
                </div>
              </dl>
              <div className="tenant-items">
                {invoice.items.map((item, index) => (
                  <div className="tenant-item" key={index}>
                    <span>{item.label}</span>
                    <strong>{rupiah(item.amount)}</strong>
                  </div>
                ))}
              </div>
              <dl className="tenant-totals">
                <div>
                  <dt>Total tagihan</dt>
                  <dd>{rupiah(invoice.total)}</dd>
                </div>
                <div>
                  <dt>Pembayaran terverifikasi</dt>
                  <dd>{rupiah(invoice.paid)}</dd>
                </div>
                <div className="tenant-balance">
                  <dt>Sisa tagihan</dt>
                  <dd>{rupiah(invoice.balance)}</dd>
                </div>
              </dl>
              <div className="tenant-notice">
                <Info size={18} aria-hidden="true" />
                <p>
                  Untuk nomor rekening atau petunjuk transfer, hubungi pengelola
                  properti Anda.
                </p>
              </div>
            </section>

            <section
              className="panel tenant-upload"
              aria-labelledby="tenant-upload-title"
            >
              <div className="tenant-section-icon">
                <FileUp size={24} aria-hidden="true" />
              </div>
              <h2 id="tenant-upload-title">Sudah bayar?</h2>
              <p>Unggah bukti pembayaran agar pengelola dapat memeriksanya.</p>
              {success && (
                <div className="tenant-feedback success" role="status">
                  <CheckCircle2 size={18} aria-hidden="true" />
                  <span>{success}</span>
                </div>
              )}
              {uploadError && (
                <div className="tenant-feedback error" role="alert">
                  {uploadError}
                </div>
              )}
              {payable ? (
                <form onSubmit={uploadProof} className="tenant-proof-form">
                  {pendingProofs.length > 0 && (
                    <div className="tenant-notice">
                      <Clock3 size={18} aria-hidden="true" />
                      <p>
                        {pendingProofs.length} bukti sedang diperiksa. Unggah
                        lagi hanya untuk pembayaran yang berbeda.
                      </p>
                    </div>
                  )}
                  <label className="tenant-field">
                    Nominal yang dibayar (Rp)
                    <input
                      name="amount"
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={invoice.balance}
                      step={1}
                      required
                      defaultValue={invoice.balance}
                      disabled={pending}
                    />
                  </label>
                  <div className="form-row">
                    <label className="tenant-field">
                      Tanggal pembayaran
                      <input
                        name="date"
                        type="date"
                        required
                        defaultValue={tenantToday()}
                        max={tenantToday()}
                        disabled={pending}
                      />
                    </label>
                    <label className="tenant-field">
                      Metode pembayaran
                      <select
                        name="method"
                        defaultValue="TRANSFER"
                        disabled={pending}
                      >
                        {Object.entries(paymentMethodNames).map(
                          ([value, label]) => (
                            <option value={value} key={value}>
                              {label}
                            </option>
                          ),
                        )}
                      </select>
                    </label>
                  </div>
                  <label className="tenant-field">
                    Referensi / catatan (opsional)
                    <input
                      name="reference"
                      maxLength={200}
                      placeholder="Contoh: transfer BCA, a.n. Rina"
                      disabled={pending}
                    />
                  </label>
                  <label className="tenant-field tenant-file-label">
                    Berkas bukti pembayaran
                    <input
                      name="file"
                      type="file"
                      accept="image/jpeg,image/png,image/webp,application/pdf"
                      required
                      disabled={pending}
                    />
                    <small>
                      JPG, PNG, WebP, atau PDF · maksimal 5 MB. Pastikan nominal
                      dan tanggal terbaca.
                    </small>
                  </label>
                  <div className="tenant-notice">
                    <ShieldCheck size={18} aria-hidden="true" />
                    <p>
                      Unggahan belum berarti tagihan lunas. Pembayaran dicatat
                      setelah disetujui pengelola.
                    </p>
                  </div>
                  <button disabled={pending} type="submit">
                    {pending ? (
                      <Loader2
                        className="tenant-spinner"
                        size={18}
                        aria-hidden="true"
                      />
                    ) : (
                      <FileUp size={18} aria-hidden="true" />
                    )}
                    {pending ? "Mengunggah…" : "Kirim bukti pembayaran"}
                  </button>
                </form>
              ) : (
                <div className="tenant-settled">
                  <BadgeCheck size={36} aria-hidden="true" />
                  <h3>
                    {invoice.status === "VOID"
                      ? "Tagihan dibatalkan"
                      : "Pembayaran sudah lengkap"}
                  </h3>
                  <p>
                    {invoice.status === "VOID"
                      ? "Hubungi pengelola jika Anda memerlukan rincian lebih lanjut."
                      : "Terima kasih. Seluruh pembayaran tagihan ini sudah terverifikasi."}
                  </p>
                </div>
              )}
            </section>

            {invoice.proofs.length > 0 && (
              <section
                className="panel tenant-proof-history"
                aria-labelledby="tenant-proof-history-title"
              >
                <div className="panel-title">
                  <h2 id="tenant-proof-history-title">
                    <FileCheck2 size={21} aria-hidden="true" /> Riwayat bukti
                    pembayaran
                  </h2>
                </div>
                <div className="tenant-proof-list">
                  {invoice.proofs.map((proof) => (
                    <article className="tenant-proof" key={proof.id}>
                      <div>
                        <strong>{rupiah(proof.amount)}</strong>
                        <p>
                          {tenantDate(proof.date)} ·{" "}
                          {paymentMethodNames[proof.method] || proof.method}
                        </p>
                        {proof.reference && (
                          <p className="tenant-reference">{proof.reference}</p>
                        )}
                      </div>
                      <div className="tenant-proof-actions">
                        <span
                          className={`tenant-status proof-${proof.status.toLowerCase()}`}
                        >
                          {proofStatusNames[proof.status] || proof.status}
                        </span>
                        {demo ? (
                          <span>Bukti contoh · hanya lokal</span>
                        ) : (
                          <a
                            href={`/api/proofs/${encodeURIComponent(proof.id)}?token=${encodeURIComponent(token)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Lihat bukti{" "}
                            <ArrowUpRight size={14} aria-hidden="true" />
                          </a>
                        )}
                      </div>
                      {proof.reviewNote && (
                        <p className="tenant-review-note">
                          Catatan pengelola: {proof.reviewNote}
                        </p>
                      )}
                    </article>
                  ))}
                </div>
              </section>
            )}

            {data?.access && (
              <section
                className="panel tenant-access"
                aria-labelledby="tenant-access-title"
              >
                <div className="panel-title">
                  <h2 id="tenant-access-title">
                    <KeyRound size={21} aria-hidden="true" /> Akses kamar
                    digital
                  </h2>
                  <span className="tenant-status unpaid">Simulasi</span>
                </div>
                <p>
                  {data.access.status === "ACTIVE"
                    ? "Akses simulasi Anda aktif selama masa tinggal."
                    : data.access.status === "REVOKED"
                      ? "Akses simulasi telah berakhir."
                      : "Akses simulasi menunggu aktivasi dari pengelola."}
                </p>
                {data.access.status === "ACTIVE" && data.access.pin && (
                  <div className="tenant-pin">
                    <span>PIN simulasi</span>
                    <strong>{data.access.pin}</strong>
                  </div>
                )}
                <p className="tenant-access-dates">
                  Mulai {tenantDate(data.access.validFrom)}
                  {data.access.validUntil &&
                    ` · Sampai ${tenantDate(data.access.validUntil)}`}
                </p>
                <div className="tenant-notice">
                  <Info size={18} aria-hidden="true" />
                  <p>
                    Fitur ini masih simulasi. PIN ini belum dapat membuka kunci
                    fisik.
                  </p>
                </div>
              </section>
            )}
          </div>
          <footer className="tenant-footer">
            <ShieldCheck size={15} aria-hidden="true" />{" "}
            {demo
              ? "Contoh publik · data simulasi."
              : "Tautan ini bersifat pribadi. Jangan bagikan kepada orang lain."}
            <span>Kamelo by ELENIO</span>
          </footer>
        </>
      )}
    </main>
  );
}
