"use client";
import { useEffect, useId, useRef, useState } from "react";
import { WorkspaceCard } from "./card";
import { OpeningBalanceRegistry } from "./opening-balances";
import { FinancialDocuments } from "./financial-documents";
import { WorkspaceKpi } from "./modules";
import { Form, Field } from "./resident360";
import { identityCall } from "../identity/api";
import { useDialogFocus } from "../dialog-focus";
import { rupiah } from "@/lib/plans";
import { tenantDate, tenantToday } from "@/lib/tenant-types";
const categories: Record<string, string> = {
  UTILITY: "Utilitas",
  MAINTENANCE: "Maintenance",
  STAFF: "Tenaga kerja",
  OTHER: "Lainnya",
};
const kinds: Record<string, string> = {
  PAYMENT: "Pembayaran biaya",
  REFUND: "Pengembalian biaya",
  REVERSAL: "Koreksi catatan",
  RENT_RECEIPT: "Pembayaran sewa",
  OPENING_RECEIPT: "Penerimaan piutang awal",
  OPENING_REFUND: "Refund piutang awal",
};
export function CashChart({ rows }: { rows: any[] }) {
  const title = useId(),
    series = [
      { key: "income", name: "Kas sewa", color: "#1e5849" },
      { key: "outflow", name: "Biaya dibayar bersih", color: "#a5833c" },
      { key: "surplus", name: "Surplus kas", color: "#35423b" },
    ];
  const values = rows.flatMap((r) => series.map((s) => r[s.key])),
    low = Math.min(0, ...values),
    high = Math.max(1, ...values),
    y = (v: number) => 190 - ((v - low) / (high - low)) * 160,
    x = (i: number) =>
      rows.length < 2 ? 380 : 70 + (i * 620) / (rows.length - 1);
  return (
    <>
      <div className="bo-finance-legend">
        {series.map((s) => (
          <span key={s.key}>
            <i style={{ background: s.color }} />
            {s.name}
          </span>
        ))}
      </div>
      <svg
        className="bo-finance-chart"
        viewBox="0 0 760 235"
        role="img"
        aria-labelledby={title}
      >
        <title id={title}>
          Arus kas tercatat dalam periode pilihan. Nilai persis tersedia pada
          mutasi dan ringkasan bulanan.
        </title>
        {[low, 0, high]
          .filter((v, i, a) => a.indexOf(v) === i)
          .map((v) => (
            <g key={v}>
              <line x1="65" x2="710" y1={y(v)} y2={y(v)} stroke="#dce5dd" />
              <text x="60" y={y(v) + 4} textAnchor="end">
                {new Intl.NumberFormat("id-ID", {
                  notation: "compact",
                  maximumFractionDigits: 1,
                }).format(v)}
              </text>
            </g>
          ))}
        {series.map((s) => (
          <g key={s.key}>
            <polyline
              fill="none"
              stroke={s.color}
              strokeWidth="2.5"
              strokeDasharray={s.key === "surplus" ? "5 4" : undefined}
              points={rows.map((r, i) => `${x(i)},${y(r[s.key])}`).join(" ")}
            />
            {rows.map((r, i) => (
              <circle
                key={r.bucket}
                cx={x(i)}
                cy={y(r[s.key])}
                r="4"
                fill={s.color}
              >
                <title>
                  {r.bucket} · {s.name}: {rupiah(r[s.key])}
                </title>
              </circle>
            ))}
          </g>
        ))}
        {rows.map(
          (r, i) =>
            (i % Math.ceil(rows.length / 8) === 0 || i === rows.length - 1) && (
              <text key={r.bucket} x={x(i)} y="220" textAnchor="middle">
                {r.bucket.length === 10
                  ? new Date(r.bucket + "T00:00:00Z").toLocaleDateString(
                      "id-ID",
                      { day: "2-digit", month: "short" },
                    )
                  : new Date(r.bucket + "-01T00:00:00Z").toLocaleDateString(
                      "id-ID",
                      { month: "short", year: "2-digit" },
                    )}
              </text>
            ),
        )}
      </svg>
    </>
  );
}
function CashFields({ today, min }: { today: string; min?: string }) {
  return (
    <>
      <Field
        name="amount"
        label="Nominal (Rp)"
        type="number"
        min={1}
        max={1000000000}
      />
      <Field
        name="date"
        label="Tanggal dana sebenarnya"
        type="date"
        value={today}
        min={min}
        max={today}
      />
      <Field name="reference" label="Referensi mutasi" />
      <Field name="note" label="Catatan pemeriksaan (minimal 10 karakter)" />
    </>
  );
}
export function FinanceWorkspace({
  propertyId,
  properties,
  onBilling,
}: {
  propertyId: string;
  properties: { id: string; name: string }[];
  onBilling: () => void;
}) {
  const [openingRevision, setOpeningRevision] = useState(0);
  const today = tenantToday(),
    [scope, setScope] = useState(propertyId),
    [from, setFrom] = useState(today.slice(0, 7) + "-01"),
    [to, setTo] = useState(today),
    [draftScope, setDraftScope] = useState(propertyId),
    [draftFrom, setDraftFrom] = useState(from),
    [draftTo, setDraftTo] = useState(to),
    [view, setView] = useState("expenses"),
    [page, setPage] = useState(1),
    [search, setSearch] = useState(""),
    [q, setQ] = useState(""),
    [category, setCategory] = useState(""),
    [data, setData] = useState<any>(null),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [exporting, setExporting] = useState(false),
    [creating, setCreating] = useState(false),
    [detail, setDetail] = useState<any>(null),
    [entryPage, setEntryPage] = useState(1),
    [movement, setMovement] = useState<any>(null),
    [matchData, setMatchData] = useState<any>(null),
    [matchPage, setMatchPage] = useState(1);
  const sequence = useRef(0),
    busyRef = useRef(false),
    feedback = useRef<HTMLParagraphElement>(null);
  const close = () => {
    if (!busyRef.current) {
      setCreating(false);
      setDetail(null);
      setMovement(null);
    }
  };
  useDialogFocus(Boolean(creating || detail || movement), close);
  useEffect(() => {
    if (message || error) feedback.current?.focus();
  }, [message, error]);
  function url(extra: Record<string, string> = {}) {
    return (
      "/api/finance?" +
      new URLSearchParams({
        propertyId: scope,
        from,
        to,
        view,
        page: String(page),
        q,
        category,
        ...extra,
      })
    );
  }
  async function load() {
    const n = ++sequence.current;
    try {
      const b = await identityCall(url());
      if (n === sequence.current) setData(b);
    } catch (e) {
      if (n === sequence.current)
        setError(
          e instanceof Error ? e.message : "Laporan belum dapat dimuat.",
        );
    }
  }
  useEffect(() => {
    setData(null);
    setError("");
    setMessage("");
    void load();
    return () => {
      sequence.current++;
    };
  }, [scope, from, to, view, page, q, category, openingRevision]);
  async function openExpense(id: string, ep = 1) {
    setError("");
    setMessage("");
    try {
      setDetail(
        await identityCall(url({ expenseId: id, entryPage: String(ep) })),
      );
      setEntryPage(ep);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Biaya belum dapat dimuat.");
    }
  }
  async function readMatches(r: any, mp = 1) {
    setMatchData(
      await identityCall(
        url({ entryId: r.id, source: r.source, matchPage: String(mp) }),
      ),
    );
    setMatchPage(mp);
  }
  async function openMovement(r: any) {
    setError("");
    setMessage("");
    setMovement(r);
    setMatchData(null);
    try {
      await readMatches(r);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Riwayat pencocokan belum dapat dimuat.",
      );
    }
  }
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
      if (body.due === "") body.due = null;
      const target = String(
        body.propertyId ||
          detail?.expense.propertyId ||
          movement?.propertyId ||
          propertyId,
      );
      const b = await identityCall("/api/lifecycle", {
        ...body,
        propertyId: target,
        action,
        key,
      });
      if (b.result.expenseId) {
        setCreating(false);
        await openExpense(b.result.expenseId);
      }
      if (movement) await readMatches(movement);
      await load();
      setMessage(
        action === "financeMatch"
          ? "Pencocokan manual tercatat. Belum diverifikasi oleh koneksi bank."
          : "Catatan keuangan tersimpan. Laporan mengikuti periode yang dipilih.",
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
  async function download(kind: string) {
    setError("");
    setExporting(true);
    try {
      const r = await fetch(url({ view: kind, format: "csv" }));
      if (!r.ok) throw Error((await r.json()).error);
      const href = URL.createObjectURL(await r.blob()),
        a = document.createElement("a");
      a.href = href;
      a.download = `kamelo-${kind}-${from}-${to}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(href), 1000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ekspor gagal.");
    } finally {
      setExporting(false);
    }
  }
  const expense = detail?.expense,
    modal = Boolean(creating || detail || movement),
    s = data?.summary,
    activeMatch = matchData?.activeMatch;
  return (
    <>
      <OpeningBalanceRegistry
        key={scope}
        propertyId={scope}
        onChange={() => setOpeningRevision((n) => n + 1)}
      />
      <FinancialDocuments key={scope + openingRevision} propertyId={scope} />
      <div className="pagehead">
        <div>
          <h2>Keuangan & Pengeluaran</h2>
          <p>Rekonsiliasi penerimaan dan biaya operasional per properti.</p>
        </div>
        <button
          className="btn"
          onClick={() => {
            setDetail(null);
            setMovement(null);
            setCreating(true);
            setError("");
            setMessage("");
          }}
        >
          Catat pengeluaran
        </button>
      </div>
      <form
        className="bo-finance-filters"
        onSubmit={(e) => {
          e.preventDefault();
          setScope(draftScope);
          setFrom(draftFrom);
          setTo(draftTo);
          setPage(1);
        }}
      >
        <label>
          Properti
          <select
            value={draftScope}
            onChange={(e) => setDraftScope(e.target.value)}
          >
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
            <option value="all">Semua properti organisasi</option>
          </select>
        </label>
        <label>
          Dari
          <input
            type="date"
            required
            value={draftFrom}
            max={today}
            onChange={(e) => setDraftFrom(e.target.value)}
          />
        </label>
        <label>
          Sampai
          <input
            type="date"
            required
            value={draftTo}
            max={today}
            min={draftFrom}
            onChange={(e) => setDraftTo(e.target.value)}
          />
        </label>
        <button className="btn outline">Tampilkan laporan</button>
      </form>
      {error && !modal && (
        <p className="identity-error" role="alert">
          {error}
        </p>
      )}
      {message && !modal && (
        <p className="identity-notice" role="status">
          {message}
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
          <p>Memuat laporan keuangan…</p>
        )
      ) : (
        <>
          <div className="grid cols3">
            <WorkspaceKpi
              label="Kas diterima"
              value={rupiah(s.rentReceived)}
              note="Pembayaran sewa tercatat pada periode ini"
            />
            <WorkspaceKpi
              label="Pengeluaran"
              value={rupiah(s.expenseCashOut)}
              note="Pembayaran biaya setelah refund dan koreksi"
            />
            <WorkspaceKpi
              label="Surplus kas"
              value={rupiah(s.surplus)}
              note="Kas sewa dikurangi pengeluaran; deposit terpisah"
            />
          </div>
          <div className="space" />
          <WorkspaceCard
            title="Arus kas operasional"
            description={`${tenantDate(from)} — ${tenantDate(to)} · ${scope === "all" ? "Semua properti organisasi" : properties.find((p) => p.id === scope)?.name || ""}`}
          >
            <small>
              Grafik {s.chartResolution === "DAILY" ? "harian" : "bulanan"} ·
              rupiah
            </small>
            <CashChart rows={s.chart} />
            <p className="bo-finance-insight">
              {s.change === 0
                ? "Surplus kas sama dengan periode pembanding."
                : `Surplus kas ${s.change > 0 ? "naik" : "turun"} ${rupiah(Math.abs(s.change))} dibanding periode pembanding.`}{" "}
              <small>
                {tenantDate(s.comparison.from)} — {tenantDate(s.comparison.to)}{" "}
                · {s.comparison.days} hari.
              </small>
            </p>
            <div className="grid cols2">
              <div className="item">
                <div>
                  <strong>{rupiah(s.bookedExpenses)}</strong>
                  <small>
                    Biaya tercatat pada periode ini; belum tentu dibayarkan.
                  </small>
                </div>
              </div>
              <div className="item">
                <div>
                  <strong>{rupiah(s.unpaidExpenses)}</strong>
                  <small>
                    Sisa biaya terbuka sampai akhir periode, termasuk biaya
                    sebelumnya.
                  </small>
                </div>
              </div>
            </div>
            <button className="btn outline small" onClick={onBilling}>
              Buka transaksi tagihan sewa
            </button>
          </WorkspaceCard>
          <div className="space" />
          <WorkspaceCard
            title="Deposit & batas laporan"
            description="Dana titipan penghuni adalah kewajiban, bukan pendapatan."
          >
            <div className="grid cols2">
              <WorkspaceKpi
                label="Deposit ditahan"
                value={rupiah(s.depositLiability)}
                note="Saldo catatan sampai akhir periode"
              />
              <WorkspaceKpi
                label="Mutasi kas deposit"
                value={rupiah(s.depositCashMovement)}
                note="Penerimaan dikurangi pengembalian dan koreksinya"
              />
            </div>
            <p>
              Potongan deposit disepakati:{" "}
              <strong>{rupiah(s.depositDeductions)}</strong> · perubahan
              kewajiban tanpa perpindahan kas.
            </p>
            <p>
              Perubahan kas tercatat, termasuk deposit:{" "}
              <strong>{rupiah(s.recordedCashMovement)}</strong>.
            </p>
            <small>
              Arus kas berbeda dengan laba akuntansi dan saldo rekening. Tidak
              termasuk saldo awal, pendanaan, atau alokasi otomatis subscription
              Kamelo. Laporan mengikuti catatan terkini; koreksi dapat
              memperbarui periode lalu dan tidak menutup buku.
            </small>
          </WorkspaceCard>
          <div className="space" />
          <div className="bo-finance-toolbar">
            <div
              className="bo-lifecycle-tabs"
              role="tablist"
              aria-label="Laporan keuangan"
            >
              {[
                ["expenses", "Daftar pengeluaran"],
                ["movements", "Mutasi & pencocokan"],
                ["monthly", "Ringkasan bulanan"],
              ].map(([k, v]) => (
                <button
                  key={k}
                  role="tab"
                  aria-selected={view === k}
                  onClick={() => {
                    if (view === k) return;
                    setData(null);
                    setView(k);
                    setPage(1);
                  }}
                >
                  {v}
                </button>
              ))}
            </div>
            <button
              className="btn outline small"
              disabled={exporting}
              onClick={() => void download(view)}
            >
              {exporting ? "Menyiapkan CSV…" : "Ekspor CSV"}
            </button>
          </div>
          <WorkspaceCard
            title={
              view === "expenses"
                ? "Daftar Pengeluaran"
                : view === "movements"
                  ? "Mutasi & Pencocokan Manual"
                  : "Ringkasan Bulanan"
            }
            description={
              view === "movements"
                ? `${s.matched} dicocokkan manual · ${s.unmatched} belum dicocokkan pada periode ini. Tidak ada koneksi bank otomatis.`
                : "Saldo pembayaran biaya dihitung sampai akhir periode. Detail biaya menampilkan saldo catatan saat ini."
            }
          >
            {view === "expenses" && (
              <form
                className="bo-prospect-filters"
                onSubmit={(e) => {
                  e.preventDefault();
                  setQ(search);
                  setPage(1);
                }}
              >
                <label>
                  Cari biaya
                  <input
                    maxLength={100}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Keterangan, penerima, atau referensi"
                  />
                </label>
                <label>
                  Kategori
                  <select
                    value={category}
                    onChange={(e) => {
                      setCategory(e.target.value);
                      setPage(1);
                    }}
                  >
                    <option value="">Semua kategori</option>
                    {Object.entries(categories).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </label>
                <button className="btn outline">Cari</button>
              </form>
            )}
            <div className="tablewrap">
              <table>
                <thead>
                  <tr>
                    {(view === "expenses"
                      ? [
                          "Tanggal",
                          "Keterangan",
                          "Kategori",
                          "Jumlah / sisa",
                          "Tindakan",
                        ]
                      : view === "movements"
                        ? [
                            "Tanggal",
                            "Mutasi",
                            "Kas masuk (+) / keluar (-)",
                            "Pencocokan",
                            "Tindakan",
                          ]
                        : [
                            "Bulan",
                            "Kas sewa",
                            "Biaya dibayar bersih",
                            "Surplus kas",
                          ]
                    ).map((t) => (
                      <th key={t}>{t}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((r: any) =>
                    view === "expenses" ? (
                      <tr key={r.id}>
                        <td>{tenantDate(r.incurredOn)}</td>
                        <td>
                          <strong>{r.description}</strong>
                          <small>
                            {r.property.name} · {r.payee}
                          </small>
                          <small>{r.reference}</small>
                        </td>
                        <td>
                          {categories[r.category]}
                          <small>
                            {r.status === "VOID"
                              ? "Dibatalkan"
                              : r.balance === 0
                                ? "Dibayar"
                                : r.paid > 0
                                  ? "Dibayar sebagian"
                                  : "Belum dibayar"}
                          </small>
                        </td>
                        <td>
                          {rupiah(r.amount)}
                          <small>Sisa {rupiah(r.balance)}</small>
                        </td>
                        <td>
                          <button
                            className="btn outline small"
                            onClick={() => void openExpense(r.id)}
                          >
                            Detail
                          </button>
                        </td>
                      </tr>
                    ) : view === "movements" ? (
                      <tr key={r.source + r.id}>
                        <td>{tenantDate(r.date)}</td>
                        <td>
                          <strong>{r.description}</strong>
                          <small>
                            {r.propertyName} · {kinds[r.kind]}
                          </small>
                          <small>{r.reference}</small>
                        </td>
                        <td>{rupiah(r.cashAmount)}</td>
                        <td>
                          {r.reversed
                            ? "Sudah dikoreksi"
                            : r.kind === "REVERSAL"
                              ? "Koreksi non-bank"
                              : r.matchId
                                ? "Dicocokkan manual"
                                : "Belum dicocokkan"}
                        </td>
                        <td>
                          <button
                            className="btn outline small"
                            onClick={() => void openMovement(r)}
                          >
                            Tinjau
                          </button>
                        </td>
                      </tr>
                    ) : (
                      <tr key={r.month}>
                        <td>{r.month}</td>
                        <td>{rupiah(r.income)}</td>
                        <td>{rupiah(r.outflow)}</td>
                        <td>{rupiah(r.surplus)}</td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>
            {!data.rows.length && (
              <p>Belum ada catatan yang sesuai pada periode ini.</p>
            )}
            {view !== "monthly" && (
              <div className="between">
                <button
                  className="btn outline small"
                  disabled={page === 1}
                  onClick={() => setPage(page - 1)}
                >
                  Sebelumnya
                </button>
                <small>
                  Halaman {page} · {data.total} catatan
                </small>
                <button
                  className="btn outline small"
                  disabled={page * 50 >= data.total}
                  onClick={() => setPage(page + 1)}
                >
                  Berikutnya
                </button>
              </div>
            )}
          </WorkspaceCard>
        </>
      )}
      {modal && (
        <div className="modalback">
          <section
            className="modal bo-lifecycle-dialog bo-finance-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="finance-title"
          >
            <div className="between">
              <h2 id="finance-title">
                {creating
                  ? "Catat Pengeluaran"
                  : expense
                    ? "Detail Pengeluaran"
                    : "Pencocokan Manual"}
              </h2>
              <button
                className="btn outline small"
                onClick={close}
                disabled={busy}
              >
                Tutup
              </button>
            </div>
            {error && (
              <p
                className="identity-error"
                role="alert"
                ref={feedback}
                tabIndex={-1}
              >
                {error}
              </p>
            )}
            {message && (
              <p
                className="identity-notice"
                role="status"
                ref={feedback}
                tabIndex={-1}
              >
                {message}
              </p>
            )}
            {creating && (
              <Form
                action="financeExpenseCreate"
                label="Simpan biaya"
                onAction={act}
                busy={busy}
                confirmed="Biaya dan referensi sumber telah diperiksa. Ini belum mencatat pembayaran."
              >
                <label>
                  Properti
                  <select
                    name="propertyId"
                    required
                    defaultValue={scope === "all" ? propertyId : scope}
                  >
                    {properties.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>
                <Field name="description" label="Keterangan biaya" />
                <Field
                  name="amount"
                  label="Jumlah biaya (Rp)"
                  type="number"
                  min={1}
                  max={1000000000}
                />
                <label>
                  Kategori
                  <select name="category" defaultValue="UTILITY">
                    {Object.entries(categories).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </label>
                <Field
                  name="incurredOn"
                  label="Tanggal biaya"
                  type="date"
                  value={today}
                  max={today}
                />
                <Field
                  name="due"
                  label="Jatuh tempo (opsional)"
                  type="date"
                  required={false}
                />
                <Field name="payee" label="Penerima / pemasok" />
                <Field
                  name="reference"
                  label="Referensi tagihan biaya (opsional)"
                  required={false}
                />
                <label>
                  Catatan
                  <textarea name="note" maxLength={1000} />
                </label>
              </Form>
            )}
            {expense && (
              <>
                <div className="item">
                  <div>
                    <strong>{expense.description}</strong>
                    <small>
                      {expense.property.name} · {categories[expense.category]}
                    </small>
                    <small>
                      {expense.payee} ·{" "}
                      {expense.reference || "Referensi belum dicatat"}
                    </small>
                  </div>
                  <span className="tag">
                    {expense.status === "VOID"
                      ? "Dibatalkan"
                      : expense.balance === 0
                        ? "Dibayar"
                        : expense.paid > 0
                          ? "Dibayar sebagian"
                          : "Belum dibayar"}
                  </span>
                </div>
                <p>
                  Tanggal biaya: {tenantDate(expense.incurredOn)}
                  {expense.due
                    ? ` · Jatuh tempo ${tenantDate(expense.due)}`
                    : ""}
                </p>
                <div className="grid cols2">
                  <WorkspaceKpi
                    label="Jumlah biaya"
                    value={rupiah(expense.amount)}
                    note="Sumber biaya tidak ditimpa"
                  />
                  <WorkspaceKpi
                    label="Pembayaran bersih"
                    value={rupiah(expense.paid)}
                    note="Seluruh riwayat sampai saat ini"
                  />
                </div>
                <p>
                  Sisa catatan saat ini:{" "}
                  <strong>{rupiah(expense.balance)}</strong>
                </p>
                <p>{expense.note}</p>
                {expense.status === "VOID" ? (
                  <p>Alasan pembatalan: {expense.voidReason}</p>
                ) : (
                  <>
                    <details>
                      <summary>Catat pembayaran biaya</summary>
                      <Form
                        action="financeExpensePay"
                        label="Catat pembayaran"
                        extra={{ expenseId: expense.id }}
                        onAction={act}
                        busy={busy}
                        confirmed="Dana sudah benar-benar dibayarkan dan referensinya telah diperiksa."
                      >
                        <CashFields today={today} min={expense.incurredOn} />
                      </Form>
                    </details>
                    <details>
                      <summary>Catat pengembalian dari pemasok</summary>
                      <Form
                        key={"refund" + entryPage}
                        action="financeExpenseRefund"
                        label="Catat pengembalian"
                        extra={{ expenseId: expense.id }}
                        onAction={act}
                        busy={busy}
                        confirmed="Dana benar-benar dikembalikan oleh pemasok dan sumbernya telah diperiksa."
                      >
                        <label>
                          Pembayaran asal pada halaman mutasi ini
                          <select name="paymentId" required defaultValue="">
                            <option value="">Pilih pembayaran</option>
                            {detail.entries
                              .filter(
                                (e: any) => e.kind === "PAYMENT" && !e.reversal,
                              )
                              .map((e: any) => (
                                <option key={e.id} value={e.id}>
                                  {e.reference} · {rupiah(e.delta)}
                                </option>
                              ))}
                          </select>
                        </label>
                        <CashFields today={today} min={expense.incurredOn} />
                      </Form>
                    </details>
                    {expense.paid === 0 && (
                      <details>
                        <summary>Batalkan catatan biaya</summary>
                        <Form
                          action="financeExpenseVoid"
                          label="Batalkan biaya"
                          extra={{ expenseId: expense.id }}
                          onAction={act}
                          busy={busy}
                          confirmed="Saldo pembayaran bersih nol dan catatan biaya ini dibatalkan. Riwayat mutasi tetap disimpan."
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
                <h3>Riwayat mutasi biaya</h3>
                <small>
                  Koreksi membalik nilai pada tanggal catatan asal. Pembayaran
                  baru dan refund mengikuti tanggal dana sebenarnya.
                </small>
                {!detail.entries.length && (
                  <p>Belum ada pembayaran atau pengembalian.</p>
                )}
                {detail.entries.map((e: any) => (
                  <div className="bo-lifecycle-section" key={e.id}>
                    <strong>
                      {kinds[e.kind]} · {rupiah(e.delta)}
                    </strong>
                    <small>
                      {tenantDate(e.date)} · {e.reference}
                    </small>
                    <p>
                      {e.note}
                      {e.reversal ? " · Sudah dikoreksi" : ""}
                    </p>
                    {e.financeMatches.length > 0 && (
                      <p>
                        Dicocokkan manual:{" "}
                        {e.financeMatches[0].statementReference}. Batalkan
                        pencocokan melalui Mutasi & Pencocokan sebelum melakukan
                        koreksi.
                      </p>
                    )}
                    {expense.status !== "VOID" &&
                      e.kind !== "REVERSAL" &&
                      !e.reversal &&
                      !e.financeMatches.length && (
                        <details>
                          <summary>Koreksi catatan ini</summary>
                          <Form
                            action="financeExpenseCorrect"
                            label="Tambahkan koreksi"
                            extra={{ expenseId: expense.id, entryId: e.id }}
                            onAction={act}
                            busy={busy}
                            confirmed="Ini koreksi kesalahan pencatatan, bukan transaksi bank baru. Catatan asli dipertahankan."
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
                    onClick={() => void openExpense(expense.id, entryPage - 1)}
                  >
                    Mutasi sebelumnya
                  </button>
                  <small>{detail.entryTotal} mutasi</small>
                  <button
                    className="btn outline small"
                    disabled={entryPage * 30 >= detail.entryTotal || busy}
                    onClick={() => void openExpense(expense.id, entryPage + 1)}
                  >
                    Mutasi berikutnya
                  </button>
                </div>
              </>
            )}
            {movement && (
              <>
                <div className="item">
                  <div>
                    <strong>{movement.description}</strong>
                    <small>
                      {movement.propertyName} · {kinds[movement.kind]} ·{" "}
                      {tenantDate(movement.date)}
                    </small>
                  </div>
                </div>
                <p>
                  Kas tercatat: <strong>{rupiah(movement.cashAmount)}</strong>
                </p>
                <p>
                  Pencocokan adalah pemeriksaan manual owner terhadap rekening.
                  Satu baris mutasi untuk satu catatan pembayaran; pemisahan
                  transaksi gabungan belum tersedia.
                </p>
                {!matchData ? (
                  <p>Memuat riwayat pencocokan…</p>
                ) : (
                  <>
                    {activeMatch ? (
                      <>
                        <p>
                          Dicocokkan manual ke{" "}
                          <strong>{activeMatch.statementReference}</strong> ·{" "}
                          {tenantDate(activeMatch.statementDate)}
                        </p>
                        <Form
                          action="financeUnmatch"
                          label="Batalkan pencocokan"
                          extra={{ matchId: activeMatch.id }}
                          onAction={act}
                          busy={busy}
                          confirmed="Pencocokan manual ini dibatalkan untuk diperiksa kembali; catatan pembayaran tidak dihapus."
                        >
                          <Field
                            name="note"
                            label="Alasan pembatalan (minimal 10 karakter)"
                          />
                        </Form>
                      </>
                    ) : movement.reversed || movement.kind === "REVERSAL" ? (
                      <p>
                        Catatan yang dikoreksi dan pembalikannya tidak
                        dicocokkan sebagai transaksi bank baru.
                      </p>
                    ) : (
                      <Form
                        action="financeMatch"
                        label="Catat pencocokan manual"
                        extra={{
                          source: movement.source,
                          entryId: movement.id,
                        }}
                        onAction={act}
                        busy={busy}
                        confirmed="Nominal, arah dana, tanggal, dan referensi telah dibandingkan dengan mutasi rekening sebenarnya."
                      >
                        <Field
                          name="amount"
                          label="Nominal pada mutasi rekening (Rp)"
                          type="number"
                          min={1}
                          max={1000000000}
                          value={Math.abs(movement.cashAmount)}
                        />
                        <label>
                          Arah dana
                          <select
                            name="direction"
                            defaultValue={
                              movement.cashAmount > 0 ? "IN" : "OUT"
                            }
                          >
                            <option value="IN">Masuk</option>
                            <option value="OUT">Keluar</option>
                          </select>
                        </label>
                        <Field
                          name="statementDate"
                          label="Tanggal mutasi rekening"
                          type="date"
                          value={movement.date}
                          max={today}
                        />
                        <Field
                          name="statementReference"
                          label="Referensi baris mutasi rekening"
                        />
                        <Field
                          name="note"
                          label="Catatan pemeriksaan (minimal 10 karakter)"
                        />
                      </Form>
                    )}
                    <h3>Riwayat pencocokan</h3>
                    {!matchData.matches.length && (
                      <p>Belum ada pencocokan manual.</p>
                    )}
                    {matchData.matches.map((r: any) => (
                      <div className="item" key={r.id}>
                        <div>
                          <strong>
                            {r.statementReference} · {rupiah(r.amount)}
                          </strong>
                          <small>
                            {tenantDate(r.statementDate)} ·{" "}
                            {r.revokedAt ? "Dibatalkan" : "Dicocokkan manual"}
                          </small>
                          <p>
                            {r.note}
                            {r.revokeReason
                              ? ` · Pembatalan: ${r.revokeReason}`
                              : ""}
                          </p>
                        </div>
                      </div>
                    ))}
                    <div className="between">
                      <button
                        className="btn outline small"
                        disabled={matchPage === 1 || busy}
                        onClick={() =>
                          void readMatches(movement, matchPage - 1).catch((e) =>
                            setError(e.message),
                          )
                        }
                      >
                        Riwayat sebelumnya
                      </button>
                      <small>{matchData.matchTotal} catatan</small>
                      <button
                        className="btn outline small"
                        disabled={
                          matchPage * 30 >= matchData.matchTotal || busy
                        }
                        onClick={() =>
                          void readMatches(movement, matchPage + 1).catch((e) =>
                            setError(e.message),
                          )
                        }
                      >
                        Riwayat berikutnya
                      </button>
                    </div>
                  </>
                )}
              </>
            )}
          </section>
        </div>
      )}
    </>
  );
}
