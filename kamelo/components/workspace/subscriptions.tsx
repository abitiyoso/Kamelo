"use client";
import { useEffect, useRef, useState } from "react";
import { WorkspaceCard } from "./card";
import { WorkspaceKpi } from "./modules";
import { Form, Field } from "./resident360";
import { identityCall } from "../identity/api";
import { useDialogFocus } from "../dialog-focus";
import { plans, rupiah } from "@/lib/plans";
import { tenantDate, tenantToday } from "@/lib/tenant-types";
const labels: Record<string, string> = {
  ACTIVE: "Aktif",
  PAID: "Lunas",
  PARTIAL: "Dibayar sebagian",
  PARTIAL_OVERDUE: "Sebagian · lewat jatuh tempo",
  OVERDUE: "Lewat jatuh tempo",
  UNPAID: "Belum dibayar",
  VOID: "Dibatalkan",
  REFUNDED_OR_CORRECTED: "Dikembalikan / dikoreksi",
  RECEIPT: "Penerimaan",
  REFUND: "Pengembalian",
  REVERSAL: "Koreksi",
  REQUESTED: "Menunggu peninjauan",
  ACTIVATED: "Diaktifkan",
};
const planName = (p: string) => plans.find((x) => x.id === p)?.name || p;
const serviceState = (r: any) =>
  r.plan === "free"
    ? "Gratis"
    : r.subscriptionStatus === "ACTIVE" &&
        r.planExpiresAt &&
        new Date(r.planExpiresAt) <= new Date()
      ? "Masa berlaku berakhir"
      : labels[r.subscriptionStatus] || r.subscriptionStatus;
const dateTime = (v: string) =>
  new Date(v).toLocaleString("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  });
export function CustomerBillingWorkspace({
  own = false,
  subscriptions = false,
}: {
  own?: boolean;
  subscriptions?: boolean;
}) {
  const [data, setData] = useState<any>(null),
    [detail, setDetail] = useState<any>(null),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [search, setSearch] = useState(""),
    [q, setQ] = useState(""),
    [plan, setPlan] = useState(""),
    [page, setPage] = useState(1),
    [invoicePage, setInvoicePage] = useState(1),
    [eventPage, setEventPage] = useState(1),
    [entryPage, setEntryPage] = useState(1),
    [invoiceId, setInvoiceId] = useState(""),
    [entryData, setEntryData] = useState<any>(null),
    [onboarding, setOnboarding] = useState(false);
  const sequence = useRef(0),
    busyRef = useRef(false),
    feedback = useRef<HTMLParagraphElement>(null);
  const invoiceFocus = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (invoiceId) invoiceFocus.current?.focus();
  }, [invoiceId]);
  const close = () => {
    if (!busyRef.current) {
      setDetail(null);
      setOnboarding(false);
    }
  };
  useDialogFocus(Boolean(detail || onboarding), close);
  useEffect(() => {
    if (message || error) feedback.current?.focus();
  }, [message, error]);
  const detailPath = (id: string, ip = invoicePage, ep = eventPage) =>
    `/api/subscriptions?${own ? "own=1&" : ""}organizationId=${encodeURIComponent(id)}&invoicePage=${ip}&eventPage=${ep}`;
  async function load() {
    const n = ++sequence.current;
    try {
      const b = await identityCall(
        own
          ? "/api/subscriptions?own=1"
          : `/api/subscriptions?q=${encodeURIComponent(q)}&plan=${plan}&page=${page}`,
      );
      if (sequence.current === n) setData(b);
    } catch (e) {
      if (sequence.current === n)
        setError(e instanceof Error ? e.message : "Data belum dapat dimuat.");
    }
  }
  useEffect(() => {
    setData(null);
    void load();
    return () => {
      sequence.current++;
    };
  }, [own, q, plan, page]);
  async function open(id: string, ip = 1, ep = 1) {
    setError("");
    setMessage("");
    try {
      const b = await identityCall(detailPath(id, ip, ep));
      setDetail(b);
      setInvoicePage(ip);
      setEventPage(ep);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Pelanggan belum dapat dimuat.",
      );
    }
  }
  useEffect(() => {
    let ignore = false;
    setEntryData(null);
    if (!detail || !invoiceId) return;
    identityCall(
      `${detailPath(detail.organization.id)}&invoiceId=${invoiceId}&entryPage=${entryPage}`,
    )
      .then((b) => {
        if (!ignore) setEntryData(b);
      })
      .catch((e) => {
        if (!ignore) setError(e.message);
      });
    return () => {
      ignore = true;
    };
  }, [detail?.organization.id, detail?.events[0]?.id, invoiceId, entryPage]);
  async function act(
    action: string,
    raw: Record<string, unknown>,
    key: string,
  ) {
    setBusy(true);
    busyRef.current = true;
    setError("");
    setMessage("");
    try {
      const body = { ...raw };
      if ("months" in body) body.months = Number(body.months);
      for (const k of ["clearTaxId", "replaceLegacy"])
        body[k] = body[k] === "on" || body[k] === true;
      const b = await identityCall("/api/subscriptions", {
        ...body,
        action,
        key,
        organizationId: detail.organization.id,
      });
      await open(
        b.result.organizationId,
        action === "subscriptionIssue" ? 1 : invoicePage,
        1,
      );
      if (b.result.invoiceId) {
        setInvoiceId(b.result.invoiceId);
        setEntryPage(1);
      }
      await load();
      setMessage(
        action === "subscriptionActivate"
          ? "Paket dan masa berlaku berhasil diperbarui."
          : "Catatan penagihan tersimpan.",
      );
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Perubahan gagal.");
      return false;
    } finally {
      setBusy(false);
      busyRef.current = false;
    }
  }
  const invoice = detail?.invoices.find((r: any) => r.id === invoiceId),
    profile = detail?.billingProfile;
  return (
    <>
      {!own && (
        <div className="pagehead">
          <div>
            <h2>
              {subscriptions
                ? "Subscription & Billing Kamelo"
                : "Database Pelanggan Kamelo"}
            </h2>
            <p>
              Organisasi, kontak penagihan, paket layanan, dan riwayat biaya
              Kamelo.
            </p>
          </div>
          {!subscriptions && (
            <button
              className="btn"
              onClick={() => {
                setError("");
                setMessage("");
                setOnboarding(true);
              }}
            >
              Tambah pelanggan
            </button>
          )}
        </div>
      )}
      {error && !detail && !onboarding && (
        <p role="alert" className="identity-error">
          {error}
        </p>
      )}
      {!data ? (
        error ? (
          <button
            className="btn outline"
            onClick={() => {
              setError("");
              void load();
            }}
          >
            Coba muat ulang
          </button>
        ) : (
          <p>Memuat penagihan Kamelo…</p>
        )
      ) : own ? (
        <WorkspaceCard
          title="Langganan & Penagihan Kamelo"
          description="Biaya layanan organisasi Anda, terpisah dari tagihan sewa penghuni."
        >
          <p>
            Paket tercatat: <strong>{planName(data.organization.plan)}</strong>{" "}
            ·{" "}
            {data.organization.planExpiresAt
              ? `Berlaku sampai ${dateTime(data.organization.planExpiresAt)}`
              : "Batas waktu belum tercatat"}
          </p>
          <p>
            Sisa tagihan layanan:{" "}
            <strong>{rupiah(data.summary.balance)}</strong>
          </p>
          <button
            className="btn outline"
            onClick={() => {
              setInvoiceId("");
              void open(data.organization.id);
            }}
          >
            Profil, tagihan & riwayat langganan
          </button>
        </WorkspaceCard>
      ) : (
        <>
          <div className="grid cols3">
            <WorkspaceKpi
              label="Organisasi terdaftar"
              value={data.organizations}
              note="Total pelanggan SaaS"
            />
            <WorkspaceKpi
              label="Langganan berbayar aktif"
              value={data.active}
              note="Paket aktif dalam masa berlaku"
            />
            <WorkspaceKpi
              label="Butuh tindak lanjut"
              value={data.summary.dueCustomers}
              note={`${data.requested} permintaan upgrade menunggu peninjauan`}
            />
          </div>
          <div className="space" />
          <WorkspaceCard
            title={
              subscriptions
                ? "Status Langganan"
                : "Customer 360 — Pelanggan ELENIO"
            }
            description="Database pelanggan SaaS terpisah dari direktori penghuni tiap organisasi."
          >
            <form
              className="bo-prospect-filters"
              onSubmit={(e) => {
                e.preventDefault();
                setPage(1);
                setQ(search);
              }}
            >
              <label>
                Cari pelanggan
                <input
                  maxLength={100}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Nama organisasi atau nama legal"
                />
              </label>
              <label>
                Paket
                <select
                  value={plan}
                  onChange={(e) => {
                    setPage(1);
                    setPlan(e.target.value);
                  }}
                >
                  <option value="">Semua paket</option>
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <button className="btn outline">Cari</button>
            </form>
            <div className="tablewrap">
              <table>
                <thead>
                  <tr>
                    {[
                      "Organisasi",
                      "Kontak utama",
                      "Paket",
                      "Kamar",
                      "Subscription",
                      "Tindakan",
                    ].map((t) => (
                      <th key={t}>{t}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((r: any) => (
                    <tr key={r.id}>
                      <td>
                        <strong>{r.name}</strong>
                        <small>
                          {r.propertyCount} properti
                          {r.billingProfile
                            ? ` · ${r.billingProfile.legalName}`
                            : ""}
                        </small>
                      </td>
                      <td>
                        {r.primaryOwner?.name || "Owner belum tercatat"}
                        <small>
                          {r.primaryOwner?.email || "Kontak belum tercatat"}
                        </small>
                      </td>
                      <td>{planName(r.plan)}</td>
                      <td>{r.roomCount}</td>
                      <td>
                        <span className="tag">{serviceState(r)}</span>
                        <small>
                          {r.planExpiresAt
                            ? dateTime(r.planExpiresAt)
                            : "Batas waktu belum tercatat"}
                        </small>
                      </td>
                      <td>
                        <button
                          className="btn outline small"
                          onClick={() => {
                            setInvoiceId("");
                            void open(r.id);
                          }}
                        >
                          {subscriptions ? "Tinjau" : "Detail"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!data.rows.length && <p>Belum ada pelanggan yang sesuai.</p>}
            <div className="between">
              <button
                className="btn outline small"
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
              >
                Sebelumnya
              </button>
              <small>
                Halaman {page} · {data.total} pelanggan
              </small>
              <button
                className="btn outline small"
                disabled={page * 50 >= data.total}
                onClick={() => setPage(page + 1)}
              >
                Berikutnya
              </button>
            </div>
          </WorkspaceCard>
        </>
      )}
      {onboarding && (
        <div className="modalback">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="customer-onboarding"
            className="modal bo-lifecycle-dialog bo-subscription-dialog"
          >
            <div className="between">
              <h2 id="customer-onboarding">Tambah pelanggan Kamelo</h2>
              <button className="btn outline small" onClick={close}>
                Tutup
              </button>
            </div>
            <p>
              Pemilik membuat dan memverifikasi akun melalui halaman pendaftaran
              Kamelo. Organisasinya otomatis masuk ke database pelanggan ini.
            </p>
            <p>
              Setelah itu, tinjau organisasi yang benar dan lengkapi profil
              penagihan. Admin tidak membuat atau membagikan kata sandi
              pelanggan.
            </p>
            <a
              className="btn outline"
              href="/register"
              target="_blank"
              rel="noreferrer"
            >
              Buka halaman pendaftaran
            </a>
          </section>
        </div>
      )}
      {detail && (
        <div className="modalback">
          <section
            className="modal bo-lifecycle-dialog bo-subscription-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="saas-customer-title"
          >
            <div className="between">
              <h2 id="saas-customer-title">
                Customer 360 — {detail.organization.name}
              </h2>
              <button
                className="btn outline small"
                disabled={busy}
                onClick={close}
              >
                Tutup
              </button>
            </div>
            {error && (
              <p
                ref={feedback}
                tabIndex={-1}
                role="alert"
                className="identity-error"
              >
                {error}
              </p>
            )}
            {message && (
              <p
                ref={feedback}
                tabIndex={-1}
                role="status"
                className="identity-notice"
              >
                {message}
              </p>
            )}
            <div className="item">
              <div>
                <strong>
                  {planName(detail.organization.plan)} ·{" "}
                  {serviceState(detail.organization)}
                </strong>
                <small>
                  {detail.propertyCount} properti · {detail.roomCount} kamar
                </small>
                <small>
                  {detail.organization.planExpiresAt
                    ? `Batas layanan: ${dateTime(detail.organization.planExpiresAt)}`
                    : "Batas layanan belum tercatat; bukan bukti pembayaran."}
                </small>
              </div>
            </div>
            <p>
              Owner utama: {detail.primaryOwner?.name || "Belum tercatat"} ·{" "}
              {detail.primaryOwner?.email || "Email belum tercatat"}
            </p>
            <div className="grid cols2">
              <WorkspaceKpi
                label="Tagihan layanan"
                value={rupiah(detail.summary.billed)}
                note="Seluruh riwayat, tanpa tagihan batal"
              />
              <WorkspaceKpi
                label="Penerimaan bersih"
                value={rupiah(detail.summary.paid)}
                note="Setelah pengembalian dan koreksi"
              />
            </div>
            <p>
              Belum dibayar: <strong>{rupiah(detail.summary.balance)}</strong>
            </p>
            <details>
              <summary>Profil penagihan organisasi</summary>
              {profile && (
                <p>
                  {profile.legalName}
                  <br />
                  {profile.address}
                  <br />
                  {profile.contactName} · {profile.contactEmail}
                  <br />
                  Identitas pajak: {profile.maskedTaxId || "Belum dicatat"}
                </p>
              )}
              <Form
                key={"profile" + (profile?.revision || 0)}
                action="billingProfile"
                label="Simpan profil penagihan"
                extra={{ revision: profile?.revision || 0 }}
                onAction={act}
                busy={busy}
                confirmed="Data penagihan diperiksa dan diberikan atau disetujui oleh pelanggan."
              >
                <Field
                  name="legalName"
                  label="Nama legal / nama penagihan"
                  value={profile?.legalName || detail.organization.name}
                />
                <label>
                  Alamat penagihan
                  <textarea
                    name="address"
                    required
                    minLength={5}
                    maxLength={1000}
                    defaultValue={profile?.address || ""}
                  />
                </label>
                <Field
                  name="contactName"
                  label="Nama kontak penagihan"
                  value={profile?.contactName || detail.primaryOwner?.name}
                />
                <Field
                  name="contactEmail"
                  label="Email kontak penagihan"
                  type="email"
                  value={profile?.contactEmail || detail.primaryOwner?.email}
                />
                <Field
                  name="taxId"
                  label="Identitas pajak baru (opsional, kosongkan untuk mempertahankan)"
                  required={false}
                />
                <label className="checkbox">
                  <input type="checkbox" name="clearTaxId" />
                  Hapus identitas pajak yang tersimpan
                </label>
                <Field
                  name="reference"
                  label="Referensi data penagihan dari pelanggan"
                  value={profile?.reference}
                />
                <small>
                  Identitas pajak disimpan terenkripsi. Kontak penagihan tidak
                  mengganti email login atau penerima undangan.
                </small>
              </Form>
            </details>
            <h3>Tagihan subscription</h3>
            <p>
              Biaya Kamelo sesuai katalog. Penerbitan tagihan belum mengaktifkan
              paket dan tidak mengirim email.
            </p>
            {!own && (
              <details>
                <summary>Terbitkan tagihan layanan</summary>
                <Form
                  action="subscriptionIssue"
                  label="Terbitkan tagihan"
                  onAction={act}
                  busy={busy}
                  confirmed="Paket, periode, dan kontak penagihan sudah ditinjau bersama pelanggan."
                >
                  <label>
                    Paket layanan
                    <select name="plan" defaultValue="starter">
                      {plans
                        .filter((p) => p.id !== "free")
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} · {rupiah(p.price)} / bulan
                          </option>
                        ))}
                    </select>
                  </label>
                  <Field
                    name="months"
                    label="Jumlah bulan"
                    type="number"
                    min={1}
                    max={12}
                    value={1}
                  />
                  <Field
                    name="periodStart"
                    label="Mulai periode layanan"
                    type="date"
                    value={tenantToday()}
                  />
                  <Field
                    name="due"
                    label="Jatuh tempo pembayaran"
                    type="date"
                    value={tenantToday()}
                  />
                  <small>
                    Akhir periode mengikuti bulan kalender, disesuaikan ke akhir
                    bulan bila diperlukan. Periode bertumpang tindih ditolak.
                  </small>
                </Form>
              </details>
            )}
            <div className="tablewrap">
              <table className="bo-subscription-table">
                <thead>
                  <tr>
                    {[
                      "Tagihan / paket",
                      "Periode",
                      "Total / sisa",
                      "Status",
                    ].map((t) => (
                      <th key={t}>{t}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {detail.invoices.map((r: any) => (
                    <tr key={r.id}>
                      <td data-label="Tagihan / paket">
                        <strong className="bo-subscription-id">
                          {r.number}
                        </strong>
                        <small>
                          {planName(r.plan)} · {r.months} bulan
                        </small>
                        <button
                          className="btn outline small"
                          onClick={() => {
                            if (invoiceId === r.id)
                              invoiceFocus.current?.focus();
                            setInvoiceId(r.id);
                            setEntryPage(1);
                            setError("");
                            setMessage("");
                          }}
                        >
                          Mutasi & detail
                        </button>
                      </td>
                      <td data-label="Periode">
                        {tenantDate(r.periodStart)} — {tenantDate(r.periodEnd)}
                        <small>Jatuh tempo {tenantDate(r.due)}</small>
                      </td>
                      <td data-label="Total / sisa">
                        {rupiah(r.total)}
                        <small>Sisa {rupiah(r.balance)}</small>
                      </td>
                      <td data-label="Status">
                        <span className="tag">{labels[r.financialStatus]}</span>
                        <small>
                          {r.activatedAt
                            ? "Aktivasi tercatat"
                            : "Belum diaktifkan dari tagihan ini"}
                        </small>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!detail.invoices.length && (
              <p>
                Belum ada tagihan layanan. Status paket lama tidak dianggap
                sebagai riwayat pembayaran.
              </p>
            )}
            <div className="between">
              <button
                className="btn outline small"
                disabled={invoicePage === 1 || busy}
                onClick={() => {
                  setInvoiceId("");
                  void open(detail.organization.id, invoicePage - 1, eventPage);
                }}
              >
                Tagihan sebelumnya
              </button>
              <small>{detail.invoiceTotal} tagihan</small>
              <button
                className="btn outline small"
                disabled={invoicePage * 25 >= detail.invoiceTotal || busy}
                onClick={() => {
                  setInvoiceId("");
                  void open(detail.organization.id, invoicePage + 1, eventPage);
                }}
              >
                Tagihan berikutnya
              </button>
            </div>
            {invoice && (
              <div className="bo-lifecycle-section">
                <h3 tabIndex={-1} ref={invoiceFocus}>
                  Detail tagihan {planName(invoice.plan)}
                </h3>
                <p className="bo-subscription-id">{invoice.number}</p>
                <p>
                  Ditagihkan kepada {invoice.billingSnapshot.legalName} ·{" "}
                  {invoice.billingSnapshot.contactEmail}
                  <br />
                  {invoice.billingSnapshot.address}
                  <br />
                  {invoice.billingSnapshot.maskedTaxId}
                </p>
                <p>
                  Total {rupiah(invoice.total)} · diterima bersih{" "}
                  {rupiah(invoice.paid)} · sisa {rupiah(invoice.balance)}
                </p>
                {invoice.status === "VOID" && (
                  <p>Alasan pembatalan: {invoice.voidReason}</p>
                )}
                {!own && invoice.status !== "VOID" && (
                  <>
                    <details>
                      <summary>Catat penerimaan layanan</summary>
                      <Form
                        action="subscriptionReceipt"
                        label="Catat penerimaan"
                        extra={{ invoiceId: invoice.id }}
                        onAction={act}
                        busy={busy}
                        confirmed="Dana benar-benar diterima dan referensi penerimaan sudah diperiksa."
                      >
                        <Field
                          name="amount"
                          label="Nominal diterima (Rp)"
                          type="number"
                          min={1}
                          max={invoice.balance}
                        />
                        <Field
                          name="date"
                          label="Tanggal penerimaan"
                          type="date"
                          value={tenantToday()}
                          max={tenantToday()}
                        />
                        <Field name="reference" label="Referensi penerimaan" />
                        <Field name="note" label="Catatan rekonsiliasi" />
                      </Form>
                    </details>
                    <details>
                      <summary>Catat pengembalian dana layanan</summary>
                      <p>
                        Hak paket tidak diubah otomatis setelah pengembalian dan
                        perlu ditinjau secara terpisah.
                      </p>
                      <Form
                        key={invoice.id + entryPage + "refund"}
                        action="subscriptionRefund"
                        label="Catat pengembalian"
                        extra={{ invoiceId: invoice.id }}
                        onAction={act}
                        busy={busy}
                        confirmed="Dana benar-benar dikembalikan dan penerimaan asal telah diperiksa."
                      >
                        <label>
                          Penerimaan asal pada halaman mutasi ini
                          <select name="receiptId" required defaultValue="">
                            <option value="">Pilih penerimaan asal</option>
                            {entryData?.entries
                              .filter(
                                (e: any) => e.kind === "RECEIPT" && !e.reversal,
                              )
                              .map((e: any) => (
                                <option key={e.id} value={e.id}>
                                  {e.reference} · {rupiah(e.delta)}
                                </option>
                              ))}
                          </select>
                        </label>
                        <Field
                          name="amount"
                          label="Nominal dikembalikan (Rp)"
                          type="number"
                          min={1}
                          max={invoice.paid}
                        />
                        <Field
                          name="date"
                          label="Tanggal pengembalian"
                          type="date"
                          value={tenantToday()}
                          max={tenantToday()}
                        />
                        <Field
                          name="reference"
                          label="Referensi pengembalian"
                        />
                        <Field name="note" label="Alasan pengembalian" />
                      </Form>
                    </details>
                    {!invoice.activatedAt && (
                      <details>
                        <summary>Aktivasi paket dari pembayaran</summary>
                        <Form
                          action="subscriptionActivate"
                          label="Aktifkan periode layanan"
                          extra={{ invoiceId: invoice.id }}
                          onAction={act}
                          busy={busy}
                          confirmed="Penerimaan bersih lunas, periode layanan berlaku, dan perubahan hak paket telah ditinjau."
                        >
                          <Field
                            name="note"
                            label="Referensi peninjauan aktivasi"
                          />
                          <label className="checkbox">
                            <input type="checkbox" name="replaceLegacy" />
                            Ganti paket manual lama tanpa batas waktu dengan
                            periode terbatas ini, bila diperlukan.
                          </label>
                          <small>
                            Tidak dapat mengaktifkan periode mendatang atau
                            memperpendek masa berlaku yang sudah tercatat.
                          </small>
                        </Form>
                      </details>
                    )}
                    {!invoice.activatedAt && invoice.paid === 0 && (
                      <details>
                        <summary>Batalkan tagihan</summary>
                        <Form
                          action="subscriptionVoid"
                          label="Batalkan tagihan layanan"
                          extra={{ invoiceId: invoice.id }}
                          onAction={act}
                          busy={busy}
                          confirmed="Tagihan ini tidak diperlukan dan saldo penerimaan bersihnya nol."
                        >
                          <Field
                            name="note"
                            label="Alasan pembatalan (minimal 10 karakter)"
                          />
                        </Form>
                      </details>
                    )}
                  </>
                )}
                <h3>Mutasi layanan</h3>
                {!entryData ? (
                  <p>Memuat mutasi…</p>
                ) : (
                  <>
                    {!entryData.entries.length && (
                      <p>Belum ada mutasi layanan pada tagihan ini.</p>
                    )}
                    {entryData.entries.map((e: any) => (
                      <div className="bo-lifecycle-section" key={e.id}>
                        <strong>
                          {labels[e.kind]} · {rupiah(e.delta)}
                        </strong>
                        <small>
                          {tenantDate(e.date)} · {e.reference}
                        </small>
                        <p>
                          {e.note}
                          {e.reversal ? " · Sudah dikoreksi" : ""}
                        </p>
                        {!own &&
                          invoice.status !== "VOID" &&
                          e.kind !== "REVERSAL" &&
                          !e.reversal && (
                            <details>
                              <summary>Koreksi pencatatan ini</summary>
                              <Form
                                action="subscriptionCorrect"
                                label="Tambahkan koreksi"
                                extra={{ invoiceId: invoice.id, entryId: e.id }}
                                onAction={act}
                                busy={busy}
                                confirmed="Ini koreksi kesalahan catatan, bukan perpindahan dana; riwayat asli tetap dipertahankan."
                              >
                                <Field
                                  name="note"
                                  label="Alasan koreksi (minimal 10 karakter)"
                                />
                              </Form>
                            </details>
                          )}
                      </div>
                    ))}
                    <div className="between">
                      <button
                        className="btn outline small"
                        disabled={entryPage === 1 || busy}
                        onClick={() => setEntryPage(entryPage - 1)}
                      >
                        Mutasi sebelumnya
                      </button>
                      <small>{entryData.entryTotal} mutasi</small>
                      <button
                        className="btn outline small"
                        disabled={
                          entryPage * 30 >= entryData.entryTotal || busy
                        }
                        onClick={() => setEntryPage(entryPage + 1)}
                      >
                        Mutasi berikutnya
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
            <h3>Permintaan paket</h3>
            {detail.requests.length ? (
              detail.requests.map((r: any) => (
                <p key={r.id}>
                  {planName(r.plan)} · {labels[r.status] || r.status} ·{" "}
                  {dateTime(r.createdAt)}
                </p>
              ))
            ) : (
              <p>Belum ada permintaan paket.</p>
            )}
            <small>Maksimal 20 permintaan terbaru.</small>
            <h3>Riwayat layanan & penagihan</h3>
            {detail.events.length ? (
              detail.events.map((e: any) => (
                <div className="item" key={e.id}>
                  <div>
                    <strong>{e.note}</strong>
                    <small>{dateTime(e.createdAt)}</small>
                  </div>
                </div>
              ))
            ) : (
              <p>Belum ada riwayat layanan tercatat.</p>
            )}
            <div className="between">
              <button
                className="btn outline small"
                disabled={eventPage === 1 || busy}
                onClick={() =>
                  void open(detail.organization.id, invoicePage, eventPage - 1)
                }
              >
                Riwayat sebelumnya
              </button>
              <small>{detail.eventTotal} catatan</small>
              <button
                className="btn outline small"
                disabled={eventPage * 30 >= detail.eventTotal || busy}
                onClick={() =>
                  void open(detail.organization.id, invoicePage, eventPage + 1)
                }
              >
                Riwayat berikutnya
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
