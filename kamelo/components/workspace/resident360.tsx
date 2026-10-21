"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { WorkspaceCard } from "./card";
import { WorkspaceKpi } from "./modules";
import { identityCall } from "../identity/api";
import { useDialogFocus } from "../dialog-focus";
import { rupiah } from "@/lib/plans";
import { tenantDate, tenantToday } from "@/lib/tenant-types";
type Room = { id: string; number: string; operational: string };
const labels: Record<string, string> = {
  DRAFT: "Draf",
  ACTIVE: "Aktif",
  CLOSED: "Ditutup",
  CANCELLED: "Dibatalkan",
  SUPERSEDED: "Diganti karena pindah kamar",
  PROPOSED: "Menunggu persetujuan manual",
  AGREED: "Persetujuan manual tercatat",
  RECEIPT: "Penerimaan",
  REFUND: "Pengembalian",
  DEDUCTION: "Potongan disepakati",
  REVERSAL: "Koreksi",
  TRANSFER_IN: "Dibawa dari kamar lama",
  TRANSFER_OUT: "Dipindahkan ke kamar baru",
  DUE: "Belum diterima",
  HELD: "Ditahan",
  PARTIALLY_HELD: "Diterima sebagian",
  DEDUCTION_PENDING: "Potongan menunggu pemeriksaan",
  SETTLED: "Selesai",
  NOT_REQUIRED: "Tidak ada deposit disepakati",
  PENDING: "Menunggu pemeriksaan",
  APPROVED: "Disetujui",
  REJECTED: "Ditolak",
};
function status(v: string) {
  return labels[v] || v;
}
export function Form({
  action,
  label,
  extra = {},
  children,
  confirmed,
  onAction,
  busy,
}: {
  action: string;
  label: string;
  extra?: Record<string, unknown>;
  children?: ReactNode;
  confirmed?: string;
  onAction: (
    action: string,
    data: Record<string, unknown>,
    key: string,
  ) => Promise<void | boolean>;
  busy: boolean;
}) {
  const pending = useRef<{ body: string; key: string } | null>(null);
  return (
    <form
      className="identity-form"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = e.currentTarget,
          d = Object.fromEntries(new FormData(f));
        const body: Record<string, unknown> = { ...d, ...extra };
        for (const k of [
          "amount",
          "depositRequired",
          "revision",
          "rate",
          "billingDay",
        ])
          if (k in body) body[k] = Number(body[k]);
        for (const k of ["confirmed", "emergencyConsent"])
          body[k] = d[k] === "on";
        if (body.end === "") delete body.end;
        const serialized = JSON.stringify(body);
        if (!pending.current || pending.current.body !== serialized)
          pending.current = { body: serialized, key: crypto.randomUUID() };
        if ((await onAction(action, body, pending.current.key)) !== false) {
          pending.current = null;
          f.reset();
        }
      }}
    >
      {children}
      {confirmed && (
        <label className="checkbox">
          <input type="checkbox" name="confirmed" required disabled={busy} />
          {confirmed}
        </label>
      )}
      <button className="btn outline" disabled={busy}>
        {label}
      </button>
    </form>
  );
}
export function Field({
  name,
  label,
  type = "text",
  value,
  min,
  max,
  required = true,
}: {
  name: string;
  label: string;
  type?: string;
  value?: string | number;
  min?: string | number;
  max?: string | number;
  required?: boolean;
}) {
  return (
    <label>
      {label}
      <input
        name={name}
        type={type}
        defaultValue={value}
        required={required}
        min={min}
        max={max}
        maxLength={type === "text" ? 500 : undefined}
      />
    </label>
  );
}
export function Resident360Workspace({
  propertyId,
  view,
  rooms,
  onRooms,
  onTeam,
  onChange,
}: {
  propertyId: string;
  view: "residents" | "contracts";
  rooms: Room[];
  onRooms: () => void;
  onTeam: () => void;
  onChange: () => void;
}) {
  const [data, setData] = useState<any>(null),
    [detail, setDetail] = useState<any>(null),
    [selected, setSelected] = useState(""),
    [tab, setTab] = useState("summary"),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [search, setSearch] = useState(""),
    [q, setQ] = useState(""),
    [page, setPage] = useState(0);
  const sequence = useRef(0);
  const close = () => {
    setDetail(null);
    setSelected("");
    setError("");
    setMessage("");
  };
  useDialogFocus(Boolean(detail), close);
  async function load() {
    const n = ++sequence.current;
    try {
      const b = await identityCall(
        `/api/lifecycle?propertyId=${encodeURIComponent(propertyId)}&view=${view}&q=${encodeURIComponent(q)}&page=${page}`,
      );
      if (n === sequence.current) setData(b);
    } catch (e) {
      if (n === sequence.current)
        setError(e instanceof Error ? e.message : "Data belum dapat dimuat.");
    }
  }
  useEffect(() => {
    setData(null);
    void load();
    return () => {
      sequence.current++;
    };
  }, [propertyId, view, q, page]);
  async function open(guestId: string, stayId?: string) {
    setError("");
    setMessage("");
    try {
      const b = await identityCall(
        `/api/lifecycle?propertyId=${encodeURIComponent(propertyId)}&guestId=${encodeURIComponent(guestId)}`,
      );
      setDetail(b);
      setSelected(
        stayId ||
          b.stays.find((s: any) =>
            ["ACTIVE", "CHECKED_IN", "CONFIRMED"].includes(s.status),
          )?.id ||
          b.stays[0]?.id ||
          "",
      );
      setTab(view === "contracts" ? "contracts" : "summary");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Profil belum tersedia.");
    }
  }
  async function act(
    action: string,
    body: Record<string, unknown>,
    key: string,
  ) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const saved = await identityCall("/api/lifecycle", {
        ...body,
        action,
        propertyId,
        key,
        ...(action !== "profile" ? { stayId: selected } : {}),
      });
      const fresh = await identityCall(
        `/api/lifecycle?propertyId=${encodeURIComponent(propertyId)}&guestId=${encodeURIComponent(detail.guest.id)}`,
      );
      setDetail(fresh);
      if (["transfer", "returnStay"].includes(action) && saved.result?.stayId)
        setSelected(saved.result.stayId);
      await load();
      onChange();
      setMessage("Catatan tersimpan. Riwayat sebelumnya tetap dipertahankan.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Perubahan gagal.");
      throw e;
    } finally {
      setBusy(false);
    }
  }
  // Forms catch errors here so rejected network requests stay inside the dialog and retain their retry key.
  const action = async (a: string, b: Record<string, unknown>, key: string) => {
    try {
      await act(a, b, key);
      return true;
    } catch {
      return false;
    }
  };
  const stay = detail?.stays.find((s: any) => s.id === selected),
    contract = stay?.contract,
    latest = contract?.versions[0],
    deposit = stay?.depositAccount,
    summary = deposit?.summary;
  return (
    <>
      <div className="pagehead">
        <div>
          <h2>
            {view === "residents" ? "Database Penghuni" : "Kontrak & Deposit"}
          </h2>
          <p>
            {view === "residents"
              ? "Satu profil untuk kontak, masa tinggal, kontrak, tagihan, layanan, dan histori kamar."
              : "Kelola kontrak, perpanjangan, pindah kamar, checkout, dan penyelesaian deposit."}
          </p>
        </div>
        <button className="btn" onClick={onRooms}>
          {view === "residents" ? "Tambah penghuni" : "Buka Properti & Kamar"}
        </button>
      </div>
      {error && !detail && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {!data ? (
        <p role="status">Memuat data…</p>
      ) : (
        <>
          <div className="grid cols3">
            {view === "contracts" ? (
              <>
                <WorkspaceKpi
                  label="Kontrak aktif"
                  value={data.summary.active}
                  note="Kontrak yang disepakati"
                />
                <WorkspaceKpi
                  label="Perlu perpanjangan"
                  value={data.summary.expiring}
                  note="Berakhir dalam 30 hari"
                />
                <WorkspaceKpi
                  label="Deposit ditahan"
                  value={rupiah(data.summary.held)}
                  note="Dana titipan, bukan pendapatan sewa"
                />
              </>
            ) : (
              <>
                <WorkspaceKpi
                  label="Penghuni aktif"
                  value={data.active}
                  note="Masa tinggal aktif pada properti ini"
                />
                <WorkspaceKpi
                  label="Profil penghuni"
                  value={data.total}
                  note="Sesuai hasil pencarian"
                />
                <WorkspaceKpi
                  label="Akun terverifikasi"
                  value={data.rows.filter((r: any) => r.verified).length}
                  note="Profil pada halaman ini"
                />
              </>
            )}
          </div>
          <div className="space" />
          <WorkspaceCard
            title={view === "residents" ? "Customer 360" : "Kontrak Penghuni"}
            description={
              view === "residents"
                ? "Profil dibatasi ke properti ini; kontak yang sama tidak otomatis digabungkan."
                : "Deposit dipisahkan dari pendapatan sewa. Persetujuan dokumen dicatat secara manual."
            }
            action={
              <button className="btn outline" onClick={onTeam}>
                Undang portal
              </button>
            }
          >
            {view === "residents" && (
              <form
                className="bo-lifecycle-search"
                onSubmit={(e) => {
                  e.preventDefault();
                  setPage(0);
                  setQ(search);
                }}
              >
                <label>
                  Cari penghuni
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Nama atau nomor HP"
                    maxLength={100}
                  />
                </label>
                <button className="btn outline">Cari</button>
              </form>
            )}
            <div className="tablewrap">
              <table className="table">
                <thead>
                  <tr>
                    {(view === "residents"
                      ? [
                          "Penghuni",
                          "Kamar",
                          "Masa tinggal",
                          "Akun",
                          "Tindakan",
                        ]
                      : [
                          "Penghuni / Kamar",
                          "Periode",
                          "Sewa / bulan",
                          "Deposit",
                          "Dokumen",
                          "Tindakan",
                        ]
                    ).map((t) => (
                      <th key={t}>{t}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((r: any) =>
                    view === "residents" ? (
                      <tr key={r.id}>
                        <td>
                          <strong>{r.name}</strong>
                          <small>{r.phone}</small>
                        </td>
                        <td>{r.stays[0]?.room.number || "—"}</td>
                        <td>
                          {r.active
                            ? "Aktif"
                            : r.stays.some(
                                  (s: any) =>
                                    [
                                      "ACTIVE",
                                      "CHECKED_IN",
                                      "CONFIRMED",
                                    ].includes(s.status) &&
                                    s.start > tenantToday(),
                                )
                              ? "Mendatang"
                              : r.stays.length
                                ? "Riwayat"
                                : "Belum menginap"}
                          <small>{r.stays.length} masa tinggal</small>
                        </td>
                        <td>
                          <span className={"tag " + (r.verified ? "" : "gold")}>
                            {r.verified ? "Terverifikasi" : "Belum diaktifkan"}
                          </span>
                        </td>
                        <td>
                          <button
                            className="btn outline small"
                            onClick={() => open(r.id)}
                          >
                            Detail
                          </button>
                        </td>
                      </tr>
                    ) : (
                      <tr key={r.id}>
                        <td>
                          <strong>{r.stay.guest.name}</strong>
                          <small>
                            {r.stay.room.number} · {status(r.status)}
                          </small>
                        </td>
                        <td>
                          {tenantDate(r.stay.start)} —{" "}
                          {r.stay.end ? tenantDate(r.stay.end) : "Berjalan"}
                        </td>
                        <td>{rupiah(r.versions[0]?.rent || 0)}</td>
                        <td>{rupiah(r.held)}</td>
                        <td>
                          <span
                            className={
                              "tag " +
                              (r.versions[0]?.state === "AGREED" ? "" : "gold")
                            }
                          >
                            {status(r.versions[0]?.state)}
                          </span>
                        </td>
                        <td>
                          <button
                            className="btn outline small"
                            onClick={() => open(r.stay.guest.id, r.stayId)}
                          >
                            Kelola
                          </button>
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>
            {!data.rows.length && (
              <p>
                Belum ada{" "}
                {view === "contracts"
                  ? "kontrak. Buka profil penghuni untuk menyiapkan kontrak."
                  : "penghuni yang sesuai."}
              </p>
            )}
            <div className="between">
              <button
                className="btn outline small"
                disabled={page === 0}
                onClick={() => setPage(page - 1)}
              >
                Sebelumnya
              </button>
              <small>
                Halaman {page + 1} · {data.total} catatan
              </small>
              <button
                className="btn outline small"
                disabled={(page + 1) * 50 >= data.total}
                onClick={() => setPage(page + 1)}
              >
                Berikutnya
              </button>
            </div>
          </WorkspaceCard>
        </>
      )}
      {detail && (
        <div className="modalback">
          <section
            className="modal bo-lifecycle-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="resident360-title"
          >
            <div className="between">
              <div>
                <h2 id="resident360-title">
                  Customer 360 — {detail.guest.name}
                </h2>
                <p>
                  {detail.guest.phone} ·{" "}
                  {detail.guest.email || "Email kontak belum diisi"}
                </p>
              </div>
              <button
                className="btn outline small"
                onClick={close}
                disabled={busy}
              >
                Tutup
              </button>
            </div>
            <div className="tabs" role="tablist" aria-label="Profil penghuni">
              {[
                ["summary", "Ringkasan"],
                ["contracts", "Kontrak & Deposit"],
                ["contact", "Kontak"],
                ["history", "Riwayat"],
              ].map(([k, v]) => (
                <button
                  key={k}
                  role="tab"
                  aria-selected={tab === k}
                  className={tab === k ? "active" : ""}
                  onClick={() => setTab(k)}
                >
                  {v}
                </button>
              ))}
            </div>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            {message && (
              <p className="success" role="status">
                {message}
              </p>
            )}
            {busy && <p role="status">Menyimpan…</p>}
            {tab === "summary" && (
              <>
                <div className="grid cols2">
                  <WorkspaceKpi
                    label="Tagihan terbit"
                    value={rupiah(detail.totals.billed)}
                    note="Seluruh riwayat, tanpa draf/batal"
                  />
                  <WorkspaceKpi
                    label="Pembayaran diterima"
                    value={rupiah(detail.totals.paid)}
                    note="Pembayaran tercatat, tanpa deposit"
                  />
                </div>
                <div className="item">
                  <strong>Belum dibayar</strong>
                  <b>{rupiah(detail.totals.balance)}</b>
                </div>
                {detail.accounts.map((a: any) => (
                  <div className="item" key={a.id}>
                    <div>
                      <strong>Akun portal</strong>
                      <small>
                        {a.user.email} ·{" "}
                        {a.user.emailVerifiedAt
                          ? "Email terverifikasi"
                          : "Belum diverifikasi"}
                      </small>
                    </div>
                  </div>
                ))}
                <button className="btn outline" onClick={onTeam}>
                  Kelola undangan portal
                </button>
                <details>
                  <summary>Tambahkan masa tinggal untuk profil ini</summary>
                  <Form
                    action="returnStay"
                    label="Simpan masa tinggal baru"
                    extra={{ guestId: detail.guest.id }}
                    busy={busy}
                    onAction={action}
                  >
                    <label>
                      Kamar
                      <select name="roomId" required>
                        <option value="">Pilih kamar</option>
                        {rooms
                          .filter((r) => r.operational === "READY")
                          .map((r) => (
                            <option key={r.id} value={r.id}>
                              Kamar {r.number}
                            </option>
                          ))}
                      </select>
                    </label>
                    <Field
                      name="start"
                      label="Tanggal mulai"
                      type="date"
                      value={tenantToday()}
                    />
                    <Field
                      name="end"
                      label="Tanggal akhir (wajib untuk guest house/hotel)"
                      type="date"
                      required={false}
                    />
                    <Field
                      name="rate"
                      label="Tarif sewa (Rp)"
                      type="number"
                      min={0}
                      max={1000000000}
                    />
                    <Field
                      name="billingDay"
                      label="Hari jatuh tempo (1–31)"
                      type="number"
                      min={1}
                      max={31}
                      value={1}
                    />
                    <small>
                      Profil tetap sama. Akses portal untuk masa tinggal baru
                      harus diundang secara terpisah. Tanggal dan kesiapan kamar
                      diperiksa ulang.
                    </small>
                  </Form>
                </details>
                <h3>Masa tinggal & histori kamar</h3>
                {detail.stays.map((s: any) => (
                  <div className="item" key={s.id}>
                    <div>
                      <strong>
                        Kamar {s.room.number} · {status(s.status)}
                      </strong>
                      <small>
                        {tenantDate(s.start)} —{" "}
                        {s.end ? tenantDate(s.end) : "Berjalan"}
                      </small>
                    </div>
                    <button
                      className="btn outline small"
                      onClick={() => {
                        setSelected(s.id);
                        setTab("contracts");
                      }}
                    >
                      Kelola
                    </button>
                  </div>
                ))}
              </>
            )}
            {tab === "contact" && (
              <Form
                action="profile"
                label="Simpan kontak"
                busy={busy}
                onAction={action}
                extra={{ guestId: detail.guest.id }}
              >
                <Field
                  name="name"
                  label="Nama penghuni"
                  value={detail.guest.name}
                />
                <Field
                  name="phone"
                  label="Nomor HP penghuni"
                  value={detail.guest.phone}
                />
                <Field
                  name="email"
                  label="Email kontak (belum diverifikasi)"
                  type="email"
                  value={detail.guest.email}
                  required={false}
                />
                <label className="checkbox">
                  <input
                    type="checkbox"
                    name="emergencyConsent"
                    defaultChecked={detail.guest.emergencyConsent}
                  />
                  Penghuni telah menyetujui penyimpanan kontak darurat.
                </label>
                <Field
                  name="emergencyName"
                  label="Nama kontak darurat"
                  value={detail.guest.emergency?.name || ""}
                  required={false}
                />
                <Field
                  name="emergencyPhone"
                  label="Nomor kontak darurat"
                  value={detail.guest.emergency?.phone || ""}
                  required={false}
                />
                <small>
                  Perubahan kontak ini tidak mengubah identitas login. Mencabut
                  persetujuan menghapus kontak darurat tersimpan.
                </small>
              </Form>
            )}
            {tab === "history" && (
              <>
                <h3>Tagihan & bukti pembayaran</h3>
                <small>
                  100 tagihan terbaru; ringkasan keuangan menghitung seluruh
                  riwayat.
                </small>
                {detail.invoices.map((i: any) => (
                  <div className="item" key={i.id}>
                    <div>
                      <strong>
                        {i.number} · {rupiah(i.total)}
                      </strong>
                      <small>
                        Jatuh tempo {tenantDate(i.due)} · {i.status} ·{" "}
                        {
                          i.proofs.filter((p: any) => p.status === "PENDING")
                            .length
                        }{" "}
                        bukti menunggu
                      </small>
                      {i.payments.map((p: any) => (
                        <small key={p.id}>
                          Pembayaran {tenantDate(p.date)} · {rupiah(p.amount)} ·{" "}
                          {p.method}
                        </small>
                      ))}
                    </div>
                    <a
                      className="btn outline small"
                      href={"/app/billing/" + encodeURIComponent(i.id)}
                    >
                      Buka
                    </a>
                  </div>
                ))}
                <h3>Permintaan layanan</h3>
                <small>50 permintaan terbaru.</small>
                {detail.tickets.map((t: any) => (
                  <div className="item" key={t.id}>
                    <strong>{t.title}</strong>
                    <span className="tag">{t.status}</span>
                  </div>
                ))}
              </>
            )}
            {tab === "contracts" && (
              <>
                <label>
                  Pilih masa tinggal
                  <select
                    value={selected}
                    onChange={(e) => setSelected(e.target.value)}
                  >
                    {detail.stays.map((s: any) => (
                      <option key={s.id} value={s.id}>
                        Kamar {s.room.number} · {s.start} · {status(s.status)}
                      </option>
                    ))}
                  </select>
                </label>
                {stay && (
                  <div
                    key={
                      stay.id +
                      ":" +
                      (contract?.revision || 0) +
                      ":" +
                      (deposit?.entries.length || 0)
                    }
                  >
                    <div className="item">
                      <strong>Kamar {stay.room.number}</strong>
                      <span className="tag">{status(stay.status)}</span>
                    </div>
                    {!contract ? (
                      <>
                        <p>
                          Belum ada kontrak tersimpan untuk masa tinggal ini.
                        </p>
                        {["ACTIVE", "CHECKED_IN", "CONFIRMED"].includes(
                          stay.status,
                        ) && (
                          <Form
                            action="contractCreate"
                            label="Siapkan kontrak"
                            busy={busy}
                            onAction={action}
                          >
                            <Field
                              name="end"
                              type="date"
                              label="Tanggal akhir kontrak"
                              min={tenantToday()}
                              value={stay.end || ""}
                            />
                            <Field
                              name="depositRequired"
                              type="number"
                              label="Deposit yang diusulkan (Rp)"
                              value={0}
                              min={0}
                              max={1000000000}
                            />
                            <label>
                              Ketentuan kontrak
                              <textarea
                                name="terms"
                                required
                                minLength={10}
                                maxLength={10000}
                              />
                            </label>
                            <small>
                              Tarif mengikuti masa tinggal: {rupiah(stay.rate)}.
                              Belum dianggap ditandatangani atau dibayar.
                            </small>
                          </Form>
                        )}
                      </>
                    ) : (
                      <>
                        <div className="item">
                          <div>
                            <strong>Kontrak {contract.id}</strong>
                            <small>
                              {status(contract.status)} · revisi{" "}
                              {contract.revision}
                            </small>
                            <small>
                              Periode usulan terakhir:{" "}
                              {tenantDate(latest.start)} —{" "}
                              {tenantDate(latest.end)}
                            </small>
                            <small>
                              Sewa {rupiah(latest.rent)} · Deposit{" "}
                              {rupiah(latest.depositRequired)}
                            </small>
                          </div>
                          <span className="tag gold">
                            {status(latest.state)}
                          </span>
                        </div>
                        <p className="bo-contract-terms">{latest.terms}</p>
                        {["ACTIVE", "DRAFT"].includes(contract.status) &&
                          latest.state === "PROPOSED" && (
                            <>
                              <details>
                                <summary>Perbaiki usulan kontrak</summary>
                                <Form
                                  action="contractRevise"
                                  label="Simpan revisi usulan"
                                  extra={{ revision: contract.revision }}
                                  busy={busy}
                                  onAction={action}
                                >
                                  <Field
                                    name="end"
                                    type="date"
                                    label="Tanggal akhir usulan"
                                    value={latest.end}
                                    min={
                                      contract.status === "ACTIVE"
                                        ? stay.end || tenantToday()
                                        : tenantToday()
                                    }
                                  />
                                  <label>
                                    Ketentuan
                                    <textarea
                                      name="terms"
                                      required
                                      minLength={10}
                                      maxLength={10000}
                                      defaultValue={latest.terms}
                                    />
                                  </label>
                                  {contract.status === "DRAFT" && (
                                    <Field
                                      name="depositRequired"
                                      type="number"
                                      label="Deposit usulan (Rp)"
                                      value={latest.depositRequired}
                                      min={0}
                                      max={1000000000}
                                    />
                                  )}
                                </Form>
                              </details>
                              <Form
                                action="contractAgree"
                                label="Catat persetujuan manual"
                                extra={{ revision: contract.revision }}
                                confirmed="Saya telah memeriksa bukti persetujuan kedua pihak. Ini pencatatan manual, bukan tanda tangan elektronik."
                                busy={busy}
                                onAction={action}
                              >
                                <Field
                                  name="reference"
                                  label="Referensi dokumen / bukti persetujuan"
                                />
                                <small>
                                  Periode baru diterapkan setelah persetujuan
                                  dicatat. Tagihan terbit tetap utuh.
                                </small>
                              </Form>
                            </>
                          )}
                        {contract.status === "ACTIVE" &&
                          latest.state === "AGREED" && (
                            <Form
                              action="contractRenew"
                              label="Usulkan perpanjangan"
                              extra={{ revision: contract.revision }}
                              busy={busy}
                              onAction={action}
                            >
                              <Field
                                name="end"
                                type="date"
                                label="Perpanjang sampai"
                                min={latest.end}
                              />
                              <small>
                                Tarif dan deposit tetap. Perubahan tarif
                                terjadwal memerlukan alur revisi tersendiri.
                              </small>
                            </Form>
                          )}
                        <details>
                          <summary>Riwayat versi kontrak</summary>
                          {contract.versions.map((v: any) => (
                            <div className="item" key={v.id}>
                              <div>
                                <strong>
                                  Revisi {v.revision} · {status(v.state)}
                                </strong>
                                <small>
                                  {tenantDate(v.start)} — {tenantDate(v.end)} ·{" "}
                                  {rupiah(v.rent)}
                                </small>
                                <small>
                                  {v.signatureReference ||
                                    "Persetujuan belum dicatat"}
                                </small>
                              </div>
                            </div>
                          ))}
                        </details>
                      </>
                    )}
                    {summary && (
                      <>
                        <div className="space" />
                        <h3>Deposit penghuni</h3>
                        <div className="grid cols2">
                          <WorkspaceKpi
                            label="Dana ditahan"
                            value={rupiah(summary.balance)}
                            note={status(summary.state)}
                          />
                          <WorkspaceKpi
                            label="Dana tersedia"
                            value={rupiah(summary.available)}
                            note={`${rupiah(summary.pending)} dicadangkan untuk usulan potongan`}
                          />
                        </div>
                        <p>
                          Deposit adalah dana titipan. Mutasi di sini tidak
                          melunasi tagihan sewa atau memindahkan dana bank.
                        </p>
                        {contract?.status === "ACTIVE" &&
                          ["ACTIVE", "CHECKED_IN", "CONFIRMED"].includes(
                            stay.status,
                          ) && (
                            <Form
                              action="depositReceive"
                              label="Catat deposit diterima"
                              confirmed="Dana sudah benar-benar diterima dan referensinya telah diperiksa."
                              busy={busy}
                              onAction={action}
                            >
                              <Field
                                name="amount"
                                type="number"
                                label="Deposit diterima (Rp)"
                                min={1}
                                max={1000000000}
                              />
                              <Field
                                name="reference"
                                label="Referensi penerimaan dana"
                              />
                            </Form>
                          )}
                        {["CHECKED_OUT", "CANCELLED"].includes(stay.status) &&
                          summary.balance > 0 && (
                            <>
                              <Form
                                action="depositRefund"
                                label="Catat pengembalian deposit"
                                confirmed="Dana pengembalian sudah diberikan kepada penghuni."
                                busy={busy}
                                onAction={action}
                              >
                                <Field
                                  name="amount"
                                  type="number"
                                  label="Pengembalian (Rp)"
                                  min={1}
                                  max={summary.available}
                                />
                                <Field
                                  name="reference"
                                  label="Referensi pengembalian dana"
                                />
                              </Form>
                              {stay.status === "CHECKED_OUT" && (
                                <Form
                                  action="deductionPropose"
                                  label="Usulkan potongan deposit"
                                  busy={busy}
                                  onAction={action}
                                >
                                  <Field
                                    name="amount"
                                    type="number"
                                    label="Usulan potongan (Rp)"
                                    min={1}
                                    max={summary.available}
                                  />
                                  <Field
                                    name="reason"
                                    label="Alasan potongan"
                                  />
                                  <label>
                                    Catatan pemeriksaan kamar
                                    <textarea
                                      name="inspectionNote"
                                      required
                                      minLength={10}
                                      maxLength={2000}
                                    />
                                  </label>
                                  <small>
                                    Usulan mencadangkan dana; saldo deposit
                                    berkurang hanya setelah persetujuan dicatat.
                                    Tidak otomatis melunasi tunggakan.
                                  </small>
                                </Form>
                              )}
                            </>
                          )}
                        {deposit.adjustments.map((a: any) => (
                          <div className="bo-lifecycle-section" key={a.id}>
                            <strong>
                              {a.reason} · {rupiah(a.amount)}
                            </strong>
                            <p>{a.inspectionNote}</p>
                            <span className="tag">{status(a.status)}</span>
                            {a.status === "PENDING" && (
                              <>
                                <Form
                                  action="deductionReview"
                                  label="Setujui potongan"
                                  extra={{ adjustmentId: a.id, approved: true }}
                                  confirmed="Potongan telah diperiksa dan disepakati dengan penghuni."
                                  busy={busy}
                                  onAction={action}
                                />
                                <Form
                                  action="deductionReview"
                                  label="Tolak usulan"
                                  extra={{
                                    adjustmentId: a.id,
                                    approved: false,
                                  }}
                                  busy={busy}
                                  onAction={action}
                                />
                              </>
                            )}
                          </div>
                        ))}
                        <details>
                          <summary>Mutasi deposit · 50 catatan terbaru</summary>
                          {deposit.entries.map((e: any) => (
                            <div className="bo-lifecycle-section" key={e.id}>
                              <strong>
                                {status(e.kind)} · {rupiah(e.delta)}
                              </strong>
                              <small>
                                {tenantDate(e.date)} · {e.reference}
                              </small>
                              {["RECEIPT", "REFUND", "DEDUCTION"].includes(
                                e.kind,
                              ) &&
                                !e.reversal && (
                                  <details>
                                    <summary>Koreksi mutasi</summary>
                                    <Form
                                      action="depositReverse"
                                      label="Catat koreksi berlawanan"
                                      extra={{ entryId: e.id }}
                                      confirmed="Saya mengonfirmasi koreksi ini; mutasi lama tetap tersimpan."
                                      busy={busy}
                                      onAction={action}
                                    >
                                      <Field
                                        name="reference"
                                        label="Alasan koreksi (minimal 10 karakter)"
                                      />
                                    </Form>
                                  </details>
                                )}
                            </div>
                          ))}
                        </details>
                      </>
                    )}
                    {["ACTIVE", "CHECKED_IN"].includes(stay.status) &&
                      stay.start <= tenantToday() &&
                      (!stay.end || stay.end > tenantToday()) && (
                        <>
                          <div className="space" />
                          <details>
                            <summary>Pindah kamar</summary>
                            <Form
                              action="transfer"
                              label="Catat pindah kamar hari ini"
                              confirmed="Penghuni pindah hari ini. Deposit dan izin akun aktif dibawa ke masa tinggal baru; kontrak kamar baru menunggu persetujuan."
                              busy={busy}
                              onAction={action}
                            >
                              <label>
                                Kamar tujuan
                                <select name="roomId" required>
                                  <option value="">Pilih kamar</option>
                                  {rooms
                                    .filter(
                                      (r) =>
                                        r.id !== stay.room.id &&
                                        r.operational === "READY",
                                    )
                                    .map((r) => (
                                      <option key={r.id} value={r.id}>
                                        Kamar {r.number}
                                      </option>
                                    ))}
                                </select>
                              </label>
                              <small>
                                Ketersediaan diperiksa ulang di server. Kamar
                                lama masuk antrean kebersihan; tagihan lama
                                tetap dapat diakses.
                              </small>
                            </Form>
                          </details>
                        </>
                      )}
                    <div className="space" />
                    <button className="btn outline" onClick={onRooms}>
                      Checkout / kelola masa tinggal
                    </button>
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      )}
    </>
  );
}
export function ResidentContractPanel() {
  const [data, setData] = useState<any>(null),
    [error, setError] = useState("");
  useEffect(() => {
    identityCall("/api/lifecycle?resident=1")
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);
  return (
    <>
      <WorkspaceCard
        title="Kontrak & Deposit Saya"
        description="Riwayat persetujuan dan dana titipan untuk masa tinggal yang dipilih."
      >
        {error ? (
          <p role="alert">{error}</p>
        ) : !data ? (
          <p role="status">Memuat kontrak…</p>
        ) : (
          <>
            {data.stay.contract?.versions.length ? (
              <>
                {data.stay.contract.versions.map((v: any) => (
                  <details key={v.id}>
                    <summary>
                      Revisi {v.revision} · {tenantDate(v.start)} —{" "}
                      {tenantDate(v.end)}
                    </summary>
                    <p>
                      Sewa {rupiah(v.rent)} · Deposit disepakati{" "}
                      {rupiah(v.depositRequired)}
                    </p>
                    <p className="bo-contract-terms">{v.terms}</p>
                    <small>Persetujuan dicatat manual oleh pengelola.</small>
                  </details>
                ))}
              </>
            ) : (
              <p>
                Belum ada kontrak dengan persetujuan tercatat. Hubungi pengelola
                untuk dokumennya.
              </p>
            )}
            {data.stay.depositAccount && (
              <>
                <div className="item">
                  <strong>Deposit ditahan</strong>
                  <b>{rupiah(data.stay.depositAccount.summary.balance)}</b>
                </div>
                <p>
                  {status(data.stay.depositAccount.summary.state)} · Dana
                  titipan ini terpisah dari saldo tagihan sewa.
                </p>
                {data.stay.depositAccount.entries.map((e: any) => (
                  <div className="item" key={e.id}>
                    <div>
                      <strong>{status(e.kind)}</strong>
                      <small>{tenantDate(e.date)}</small>
                    </div>
                    <b>{rupiah(e.delta)}</b>
                  </div>
                ))}
              </>
            )}
          </>
        )}
      </WorkspaceCard>
      <div className="space" />
    </>
  );
}
