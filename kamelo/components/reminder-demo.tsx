"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, Copy, ReceiptText, RotateCcw } from "lucide-react";
import { demoProperty } from "@/lib/demo";
import { rupiah } from "@/lib/plans";
import { tenantDate } from "@/lib/tenant-types";
import Image from "next/image";
const demoInvoices = (hotel: boolean) =>
  demoProperty(hotel)
    .invoices.map((i) => ({
      ...i,
      balance: i.total - i.payments.reduce((s, p) => s + p.amount, 0),
    }))
    .filter((i) => i.balance > 0)
    .slice(0, 3);
export function ReminderDemo({
  hotel = false,
  compact = false,
}: {
  hotel?: boolean;
  compact?: boolean;
}) {
  const invoices = demoInvoices(hotel).map((invoice, index) =>
    compact ? { ...invoice, due: `2026-10-${[20, 25, 28][index]}` } : invoice,
  );
  const [selected, setSelected] = useState(invoices[0].id),
    [prepared, setPrepared] = useState(false),
    [copied, setCopied] = useState(false),
    [error, setError] = useState("");
  const messageRef = useRef<HTMLTextAreaElement>(null),
    firstRef = useRef<HTMLButtonElement>(null),
    restoreFocus = useRef(false);
  useEffect(() => {
    if (prepared) messageRef.current?.focus();
    else if (restoreFocus.current) {
      firstRef.current?.focus();
      restoreFocus.current = false;
    }
  }, [prepared]);
  const invoice = invoices.find((i) => i.id === selected)!;
  const message = `Halo ${invoice.guest.name}, pengingat tagihan ${invoice.number} untuk kamar ${invoice.room.number}. Sisa pembayaran ${rupiah(invoice.balance)}, jatuh tempo ${tenantDate(invoice.due)}. Jika sudah membayar, silakan unggah bukti melalui tautan dari pengelola untuk diverifikasi. Terima kasih. — Kamelo by ELENIO`;
  function reset() {
    restoreFocus.current = true;
    setSelected(invoices[0].id);
    setPrepared(false);
    setCopied(false);
    setError("");
  }
  async function copy() {
    setError("");
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
    } catch {
      setError(
        "Salin otomatis belum diizinkan. Pilih pesan di bawah lalu salin secara manual.",
      );
      messageRef.current?.focus();
      messageRef.current?.select();
    }
  }
  return (
    <div
      className={"reminder-demo" + (compact ? " journal-reminder" : "")}
      id="demo-owner"
      aria-label="Demo pengingat owner"
    >
      {!compact && (
        <div className="reminder-demo-top">
          <span>
            <ReceiptText size={18} />{" "}
            {compact ? "Contoh pengingat" : "Tagihan perlu ditindaklanjuti"}
          </span>
          <span className="demo-local-badge">
            Simulasi · tidak mengirim pesan
          </span>
        </div>
      )}
      <div className="reminder-demo-body">
        {compact ? (
          <div className="journal-reminder-tenant">
            <Image
              src="/images/homepage/journal-tenant-v1.webp"
              alt=""
              width={40}
              height={40}
            />
            <div>
              <b>{invoice.guest.name}</b>
              <span>Kamar {invoice.room.number}</span>
            </div>
            <span className="journal-reminder-due">
              <small>Jatuh tempo</small>
              <b>{tenantDate(invoice.due)}</b>
            </span>
          </div>
        ) : (
          <>
            <p className="demo-instruction">
              1. Pilih penghuni · Data contoh{" "}
              {hotel ? "Guest House Harmoni" : "Kos Melati"}
            </p>
            <div
              className="demo-tenant-options"
              role="group"
              aria-label="Pilih penghuni demo"
            >
              {invoices.map((i, index) => (
                <button
                  ref={index === 0 ? firstRef : undefined}
                  key={i.id}
                  aria-pressed={selected === i.id}
                  onClick={() => {
                    setSelected(i.id);
                    setPrepared(false);
                    setCopied(false);
                    setError("");
                  }}
                >
                  <span>{i.guest.name}</span>
                  <small>Kamar {i.room.number}</small>
                </button>
              ))}
            </div>
          </>
        )}
        <div className="demo-invoice-summary" aria-live="polite">
          <div>
            <small>Sisa tagihan</small>
            <strong>{rupiah(invoice.balance)}</strong>
          </div>
          {!compact && (
            <div>
              <small>Jatuh tempo</small>
              <b>{tenantDate(invoice.due)}</b>
            </div>
          )}
        </div>
        {!prepared ? (
          <button
            ref={compact ? firstRef : undefined}
            className="demo-prepare"
            onClick={() => setPrepared(true)}
          >
            Siapkan Pengingat <ArrowRight size={17} />
          </button>
        ) : (
          <div className="demo-prepared">
            <label htmlFor="demo-reminder-message">
              2. Tinjau pesan untuk {invoice.guest.name}
            </label>
            <textarea
              id="demo-reminder-message"
              ref={messageRef}
              readOnly
              value={message}
              rows={5}
            />
            <div className="demo-copy-actions">
              <button onClick={copy}>
                {copied ? <Check size={16} /> : <Copy size={16} />}{" "}
                {copied ? "Tersalin" : "Salin Pesan"}
              </button>
              <button className="secondary" onClick={reset}>
                <RotateCcw size={15} /> Ulangi Demo
              </button>
            </div>
            <p className="demo-copy-feedback" role="status">
              {error ||
                (copied
                  ? "Pesan berhasil disalin. Tidak ada pesan terkirim atau pembayaran berubah."
                  : "Hanya menyiapkan teks. Tidak ada data disimpan ke backend.")}
            </p>
          </div>
        )}
        {compact && (
          <small className="journal-reminder-note">
            Simulasi · tidak mengirim pesan
          </small>
        )}
      </div>
    </div>
  );
}
