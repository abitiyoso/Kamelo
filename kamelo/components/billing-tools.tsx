"use client";

import { useMemo, useState } from "react";
import {
  ArrowUpRight,
  BellRing,
  CheckCircle2,
  Copy,
  FileCheck2,
  Link2,
  Loader2,
  MessageCircle,
  X,
} from "lucide-react";
import { rupiah } from "@/lib/plans";
import {
  paymentMethodNames,
  tenantDate,
  tenantToday,
  type PaymentProof,
} from "@/lib/tenant-types";

export type BillingToolInvoice = {
  id: string;
  number: string;
  guest: { name: string; phone: string };
  room: { number: string };
  due: string;
  total: number;
  status: string;
  payments: { amount: number }[];
  proofs?: PaymentProof[];
};

type TenantLink = { url: string; expiresAt: string };

function whatsappNumber(value: string) {
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("0")) digits = "62" + digits.slice(1);
  return /^[1-9]\d{7,14}$/.test(digits) ? digits : null;
}

export function BillingTools({
  invoices,
  propertyId,
  demo,
  canReview,
  mutate,
  showProofQueue = true,
}: {
  invoices: BillingToolInvoice[];
  propertyId: string;
  demo: boolean;
  canReview: boolean;
  showProofQueue?: boolean;
  mutate: (action: string, data: Record<string, unknown>) => Promise<void>;
}) {
  const [links, setLinks] = useState<Record<string, TenantLink>>({});
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [reviewing, setReviewing] = useState<{
    proofId: string;
    decision: "APPROVE" | "REJECT";
  } | null>(null);
  const [showAll, setShowAll] = useState(false);
  const today = tenantToday();

  const unpaid = useMemo(
    () =>
      invoices
        .filter((invoice) => !["DRAFT", "VOID"].includes(invoice.status))
        .map((invoice) => ({
          ...invoice,
          balance: Math.max(
            0,
            invoice.total -
              invoice.payments.reduce(
                (sum, payment) => sum + payment.amount,
                0,
              ),
          ),
        }))
        .filter((invoice) => invoice.balance > 0)
        .sort((a, b) => a.due.localeCompare(b.due)),
    [invoices],
  );
  const overdueCount = unpaid.filter(
    (invoice) => invoice.due.slice(0, 10) < today,
  ).length;
  const proofs = invoices.flatMap((invoice) =>
    (invoice.proofs || [])
      .filter((proof) => proof.status === "PENDING")
      .map((proof) => ({ proof, invoice })),
  );
  const visible = showAll ? unpaid : unpaid.slice(0, 4);

  async function createLink(invoiceId: string) {
    if (demo || pending) return;
    setPending(invoiceId);
    setError("");
    setSuccess("");
    try {
      const response = await fetch("/api/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "tenantLink", propertyId, invoiceId }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(result.error || "Tautan penghuni belum dapat dibuat.");
      if (!result.result?.url)
        throw new Error("Tautan penghuni belum tersedia. Coba kembali.");
      setLinks((current) => ({ ...current, [invoiceId]: result.result }));
      setSuccess(
        "Tautan dibuat. Salin tautan atau buka WhatsApp untuk menyiapkan pengingat.",
      );
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Gagal membuat tautan penghuni.",
      );
    } finally {
      setPending(null);
    }
  }

  async function copyLink(link: string) {
    setError("");
    try {
      await navigator.clipboard.writeText(link);
      setSuccess(
        "Tautan tagihan disalin. Bagikan hanya kepada penghuni yang bersangkutan.",
      );
    } catch {
      setError(
        "Tautan belum dapat disalin otomatis. Pilih dan salin alamat pada kolom tautan.",
      );
    }
  }

  async function reviewProof(
    event: React.FormEvent<HTMLFormElement>,
    proofId: string,
  ) {
    event.preventDefault();
    if (demo || !canReview || !reviewing || pending) return;
    const form = new FormData(event.currentTarget);
    const reviewNote = String(form.get("reviewNote") || "").trim();
    if (reviewing.decision === "APPROVE" && form.get("confirmed") !== "on")
      return;
    if (reviewing.decision === "REJECT" && reviewNote.length < 3) {
      setError(
        "Isi alasan penolakan agar penghuni dapat memperbaiki buktinya.",
      );
      return;
    }
    setPending(proofId);
    setError("");
    setSuccess("");
    try {
      await mutate("reviewProof", {
        propertyId,
        proofId,
        decision: reviewing.decision,
        reviewNote,
        confirmed:
          reviewing.decision === "APPROVE" && form.get("confirmed") === "on",
      });
      setSuccess(
        reviewing.decision === "APPROVE"
          ? "Bukti disetujui dan pembayaran dicatat."
          : "Bukti ditolak. Catatan dapat dilihat penghuni.",
      );
      setReviewing(null);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Verifikasi bukti belum dapat disimpan.",
      );
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="billing-tools">
      {error && (
        <div className="tenant-feedback error" role="alert">
          {error}
        </div>
      )}
      {success && (
        <div className="tenant-feedback success" role="status">
          <CheckCircle2 size={18} aria-hidden="true" />
          <span>{success}</span>
        </div>
      )}
      <section
        className="panel billing-reminders"
        aria-labelledby="billing-reminder-title"
      >
        <div className="panel-title">
          <h2 id="billing-reminder-title">
            <BellRing size={21} aria-hidden="true" /> Pengingat pembayaran
          </h2>
          <span className="tenant-status overdue">
            {overdueCount} lewat tempo
          </span>
        </div>
        <p className="billing-intro">
          Jatuh tempo mengikuti masing-masing tagihan penghuni. Siapkan pesan
          WhatsApp dan tautan unggah bukti; Anda yang menekan kirim.
        </p>
        {demo && (
          <div className="tenant-notice">
            <MessageCircle size={18} aria-hidden="true" />
            <p>
              Mode demo: pengingat dan tautan penghuni hanya pratinjau. Tidak
              ada pesan yang dikirim.
            </p>
          </div>
        )}
        {!unpaid.length ? (
          <div className="billing-empty">
            <CheckCircle2 size={28} aria-hidden="true" />
            <div>
              <strong>Semua tagihan di halaman ini sudah lunas.</strong>
              <p>Tagihan draf dan yang dibatalkan tidak masuk pengingat.</p>
            </div>
          </div>
        ) : (
          <>
            <div className="billing-reminder-list">
              {visible.map((invoice) => {
                const link = links[invoice.id];
                const phone = whatsappNumber(invoice.guest.phone);
                const isOverdue = invoice.due.slice(0, 10) < today;
                const message = `Halo ${invoice.guest.name}, pengingat tagihan ${invoice.number} untuk kamar ${invoice.room.number}. Sisa pembayaran ${rupiah(invoice.balance)}, jatuh tempo ${tenantDate(invoice.due)}. Rincian tagihan dan unggah bukti pembayaran: ${link?.url || ""}. Jika sudah membayar, silakan unggah bukti untuk diverifikasi. Terima kasih. — Kamelo by ELENIO`;
                return (
                  <article className="billing-reminder" key={invoice.id}>
                    <span
                      className={`billing-reminder-icon ${isOverdue ? "overdue" : "upcoming"}`}
                    >
                      <BellRing size={19} aria-hidden="true" />
                    </span>
                    <div className="billing-reminder-info">
                      <strong>
                        {invoice.guest.name}
                        <span> · Kamar {invoice.room.number}</span>
                      </strong>
                      <p>
                        {invoice.number} · Jatuh tempo{" "}
                        <time dateTime={invoice.due}>
                          {tenantDate(invoice.due)}
                        </time>
                        {isOverdue && (
                          <b className="billing-overdue-label"> · Terlambat</b>
                        )}
                      </p>
                      <b>{rupiah(invoice.balance)}</b>
                    </div>
                    <div className="billing-inline-actions">
                      <button
                        className="secondary small"
                        type="button"
                        disabled={demo || !!pending}
                        onClick={() => createLink(invoice.id)}
                      >
                        {pending === invoice.id ? (
                          <Loader2
                            className="tenant-spinner"
                            size={16}
                            aria-hidden="true"
                          />
                        ) : (
                          <Link2 size={16} aria-hidden="true" />
                        )}
                        {link ? "Buat ulang tautan" : "Siapkan pengingat"}
                      </button>
                    </div>
                    {link && (
                      <div className="billing-link-box">
                        <label>
                          Tautan pribadi penghuni
                          <input
                            readOnly
                            value={link.url}
                            onFocus={(event) => event.currentTarget.select()}
                          />
                        </label>
                        <div className="billing-inline-actions">
                          <button
                            type="button"
                            className="secondary"
                            onClick={() => copyLink(link.url)}
                          >
                            <Copy size={15} aria-hidden="true" /> Salin tautan
                          </button>
                          <a
                            className="button secondary"
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Lihat portal{" "}
                            <ArrowUpRight size={15} aria-hidden="true" />
                          </a>
                          {phone ? (
                            <a
                              className="button"
                              href={`https://wa.me/${phone}?text=${encodeURIComponent(message)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <MessageCircle size={16} aria-hidden="true" />{" "}
                              Buka WhatsApp
                            </a>
                          ) : (
                            <span className="billing-phone-error">
                              Nomor WhatsApp belum valid. Salin tautan untuk
                              dibagikan secara manual.
                            </span>
                          )}
                        </div>
                        <small>
                          Berlaku sampai {tenantDate(link.expiresAt)}. Membuka
                          WhatsApp hanya menyiapkan pesan, belum mengirimkannya.
                        </small>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
            {unpaid.length > 4 && (
              <button
                type="button"
                className="secondary billing-show-all"
                onClick={() => setShowAll((value) => !value)}
              >
                {showAll
                  ? "Ringkas daftar"
                  : `Lihat ${unpaid.length} tagihan belum lunas`}
              </button>
            )}
            <p className="billing-page-note">
              Menampilkan tagihan pada halaman ini. Periksa halaman berikutnya
              untuk tagihan lainnya.
            </p>
          </>
        )}
      </section>

      {showProofQueue && (
        <section
          className="panel billing-proof-queue"
          aria-labelledby="billing-proof-title"
        >
          <div className="panel-title">
            <h2 id="billing-proof-title">
              <FileCheck2 size={21} aria-hidden="true" /> Verifikasi bukti bayar
            </h2>
            <span className="tenant-status unpaid">
              {proofs.length} menunggu
            </span>
          </div>
          <p className="billing-intro">
            Cocokkan bukti dengan mutasi rekening sebelum menyetujui. Unggahan
            penghuni belum dihitung sebagai pembayaran.
          </p>
          {!canReview && !demo && (
            <div className="tenant-notice">
              <FileCheck2 size={18} aria-hidden="true" />
              <p>
                Akun Anda belum memiliki izin mencatat pembayaran. Hubungi
                pemilik untuk verifikasi.
              </p>
            </div>
          )}
          {demo && (
            <div className="tenant-notice">
              <FileCheck2 size={18} aria-hidden="true" />
              <p>
                Contoh bukti dalam mode demo. Verifikasi pembayaran tersedia
                pada akun properti.
              </p>
            </div>
          )}
          {!proofs.length ? (
            <div className="billing-empty">
              <FileCheck2 size={28} aria-hidden="true" />
              <div>
                <strong>Belum ada bukti yang perlu diperiksa.</strong>
                <p>
                  Penghuni dapat mengunggah bukti melalui tautan tagihan
                  pribadi.
                </p>
              </div>
            </div>
          ) : (
            <div className="billing-proof-list">
              {proofs.map(({ proof, invoice }) => (
                <article className="billing-proof" key={proof.id}>
                  <div className="billing-proof-info">
                    <strong>
                      {invoice.guest.name}{" "}
                      <span>· Kamar {invoice.room.number}</span>
                    </strong>
                    <p>
                      {invoice.number} · {tenantDate(proof.date)} ·{" "}
                      {paymentMethodNames[proof.method] || proof.method}
                    </p>
                    <b>{rupiah(proof.amount)}</b>
                    {proof.reference && (
                      <p className="tenant-reference">{proof.reference}</p>
                    )}
                  </div>
                  <div className="billing-inline-actions">
                    {!demo && (
                      <a
                        className="button secondary"
                        href={`/api/proofs/${encodeURIComponent(proof.id)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Lihat bukti{" "}
                        <ArrowUpRight size={15} aria-hidden="true" />
                      </a>
                    )}
                    <button
                      className="secondary"
                      type="button"
                      disabled={demo || !canReview || !!pending}
                      onClick={() => {
                        setError("");
                        setReviewing({ proofId: proof.id, decision: "REJECT" });
                      }}
                    >
                      Tolak
                    </button>
                    <button
                      type="button"
                      disabled={demo || !canReview || !!pending}
                      onClick={() => {
                        setError("");
                        setReviewing({
                          proofId: proof.id,
                          decision: "APPROVE",
                        });
                      }}
                    >
                      <CheckCircle2 size={16} aria-hidden="true" /> Verifikasi
                    </button>
                  </div>
                  {reviewing?.proofId === proof.id && (
                    <form
                      className="billing-confirm"
                      onSubmit={(event) => reviewProof(event, proof.id)}
                    >
                      <div className="panel-title">
                        <h3>
                          {reviewing.decision === "APPROVE"
                            ? "Setujui pembayaran?"
                            : "Tolak bukti pembayaran?"}
                        </h3>
                        <button
                          className="secondary billing-close"
                          type="button"
                          aria-label="Batal verifikasi"
                          disabled={!!pending}
                          onClick={() => setReviewing(null)}
                        >
                          <X size={16} aria-hidden="true" />
                        </button>
                      </div>
                      <p>
                        {reviewing.decision === "APPROVE"
                          ? `Persetujuan akan mencatat pembayaran ${rupiah(proof.amount)} pada tagihan ${invoice.number}.`
                          : "Tagihan tetap belum lunas. Penghuni dapat melihat alasan dan mengunggah bukti yang benar."}
                      </p>
                      <label>
                        Catatan{" "}
                        {reviewing.decision === "REJECT"
                          ? "penolakan"
                          : "(opsional)"}
                        <textarea
                          name="reviewNote"
                          required={reviewing.decision === "REJECT"}
                          minLength={
                            reviewing.decision === "REJECT" ? 3 : undefined
                          }
                          maxLength={500}
                          rows={2}
                          disabled={!!pending}
                          placeholder={
                            reviewing.decision === "REJECT"
                              ? "Contoh: nominal pada bukti tidak terbaca"
                              : "Contoh: sesuai mutasi rekening"
                          }
                        />
                      </label>
                      {reviewing.decision === "APPROVE" && (
                        <label className="checkbox">
                          <input
                            type="checkbox"
                            name="confirmed"
                            required
                            disabled={!!pending}
                          />
                          Saya sudah memeriksa penerimaan dana sebesar{" "}
                          {rupiah(proof.amount)}.
                        </label>
                      )}
                      <button type="submit" disabled={!!pending}>
                        {pending === proof.id && (
                          <Loader2
                            className="tenant-spinner"
                            size={16}
                            aria-hidden="true"
                          />
                        )}
                        {reviewing.decision === "APPROVE"
                          ? "Setujui & catat pembayaran"
                          : "Simpan penolakan"}
                      </button>
                    </form>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
