"use client";
import { MessagesWorkspace } from "./workspace/messages";
import { Resident360Workspace } from "./workspace/resident360";
import { ProspectsWorkspace } from "./workspace/prospects";
import { CustomerBillingWorkspace } from "./workspace/subscriptions";
import { FinanceWorkspace } from "./workspace/finance";
import { InviteCenter } from "./identity/invite-center";
import { StaffTasks, StaffRooms } from "./workspace/staff";
import { RoomImportCenter } from "./workspace/room-import";
import { ResidentImportCenter } from "./workspace/resident-import";
import { WorkspaceShell } from "./workspace/shell";
import {
  CctvReadiness,
  LeoWorkspace,
  ResidentDirectory,
  UnavailableModule,
  WorkspaceAccount,
  WorkspaceCard,
} from "./workspace/modules";
import { workspaceNavigation } from "@/lib/workspace/navigation";
import { OwnerDashboard } from "./owner-dashboard";
import {
  OperationsHub,
  GuestSettings,
  StayShare,
  type OperationTicket,
} from "./operations-hub";
import { useEffect, useRef, useState } from "react";
import { Mascot } from "./mascot";
import { useDialogFocus } from "./dialog-focus";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard,
  DoorOpen,
  ReceiptText,
  Wifi,
  Settings,
  Plus,
  ArrowUpRight,
  Search,
  LogOut,
  ChevronDown,
  ArrowRight,
  Users,
  CheckCircle2,
  ShieldCheck,
  Building2,
  BedDouble,
  Banknote,
  Wallet,
  KeyRound,
  CalendarClock,
  Pencil,
  Lightbulb,
  ClipboardCheck,
} from "lucide-react";
import { Brand } from "./brand";
import { PaymentTrend } from "./payment-trend";
import { Team } from "./team";
import { plans, rupiah } from "@/lib/plans";
import { demoProperty } from "@/lib/demo";
import { roomStatus } from "@/lib/domain.mjs";
import { BillingTools } from "./billing-tools";
import { ProofQueue } from "./workspace/proof-queue";
import { ReminderAutomation } from "./workspace/reminder-automation";
import {
  DashboardInsights,
  type DashboardInsightSummary,
} from "./dashboard-insights";
import { SmartAccessPanel } from "./smart-access-panel";
import type { PaymentProof } from "@/lib/tenant-types";
type Guest = { id: string; name: string; phone: string };
type Stay = {
  id: string;
  status: string;
  start: string;
  end: string | null;
  rate: number;
  billingDay: number;
  guest: Guest;
};
type Room = {
  id: string;
  number: string;
  rate: number;
  operational: string;
  stays: Stay[];
};
type Invoice = {
  id: string;
  number: string;
  room: Room;
  guest: Guest;
  stayId: string;
  date: string;
  due: string;
  total: number;
  status: string;
  items: { label: string; amount: number }[];
  payments: { id: string; amount: number; date: string; method: string }[];
  proofs?: PaymentProof[];
};
type Device = {
  id: string;
  name: string;
  roomId: string | null;
  online: boolean;
  provider: string;
  kind: string;
  automationEnabled: boolean;
  guestControllable?: boolean;
  accesses?: {
    id: string;
    stayId: string;
    status: string;
    validFrom: string;
    validUntil: string | null;
  }[];
  state: Record<string, boolean | number>;
  capabilities: Record<string, { type: string; min?: number; max?: number }>;
  syncedAt: string;
};
type Property = {
  contractExpiring?: number;
  id: string;
  name: string;
  type: string;
  city: string;
  billingAutomation?: boolean;
  operationsLastRunAt?: string | null;
  wifiSsid?: string;
  hasWifiPassword?: boolean;
  guestInstructions?: string;
  supportPhone?: string;
  tickets?: OperationTicket[];
  rooms: Room[];
  guests: Guest[];
  invoices: Invoice[];
  pendingProofInvoices?: Invoice[];
  devices: Device[];
  summary?: DashboardInsightSummary & {
    total: number;
    paid: number;
    income: number;
    outstanding: number;
    invoiceCount: number;
    trend: { month: string; amount: number }[];
  };
};
const modules = [
  ["dashboard", "Dashboard", LayoutDashboard],
  ["rooms", "Kamar & Tamu", DoorOpen],
  ["billing", "Tagihan", ReceiptText],
  ["iot", "Smart IoT", Wifi],
  ["settings", "Pengaturan", Settings],
] as const;
const statusNames: Record<string, string> = {
  AVAILABLE: "Kosong",
  OCCUPIED: "Terisi",
  RESERVED: "Dipesan",
  CLEANING: "Perlu dibersihkan",
  MAINTENANCE: "Perawatan",
  ACTIVE: "Aktif",
  CONFIRMED: "Dipesan",
  CHECKED_IN: "Check-in",
  CHECKED_OUT: "Selesai",
  CANCELLED: "Dibatalkan",
};
const localDate = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
export function Portal({
  demo = false,
  initialRole = "OWNER",
}: {
  demo?: boolean;
  initialRole?: string;
}) {
  const path = usePathname();
  const raw = path.split("/")[2] || "dashboard";
  const initial = ["guests", "bookings"].includes(raw) ? "rooms" : raw;
  const [tab, setTab] = useState(initial),
    [hotel, setHotel] = useState(false),
    [data, setData] = useState<{
      properties: Property[];
      plan: string;
      user: {
        name: string;
        email?: string;
        phone?: string;
        role: string;
        platformAdmin: boolean;
        canRecordPayments: boolean;
        canControlDevices: boolean;
      };
      upgrades: { id: string; plan: string; status: string }[];
      team: {
        id: string;
        name: string;
        email: string;
        role: string;
        propertyIds: string[];
        canRecordPayments: boolean;
        canControlDevices: boolean;
      }[];
    } | null>(null),
    [propertyId, setPropertyId] = useState(""),
    [error, setError] = useState(""),
    [success, setSuccess] = useState(""),
    [loading, setLoading] = useState(!demo),
    [pending, setPending] = useState(false),
    [invoicePage, setInvoicePage] = useState(0),
    [query, setQuery] = useState(""),
    [filter, setFilter] = useState("ALL"),
    [modal, setModal] = useState(""),
    [selectedRoom, setSelectedRoom] = useState<Room | null>(null),
    [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null),
    [selectedStay, setSelectedStay] = useState<Stay | null>(null);
  const [roomsView, setRoomsView] = useState("rooms");
  const loadSequence = useRef(0);
  const [focusProofQueue, setFocusProofQueue] = useState(false);
  useDialogFocus(Boolean(modal), () => setModal(""));
  async function load(background = false) {
    const requestId = ++loadSequence.current;
    try {
      if (!background) setLoading(true);
      const r = await fetch(
        "/api/manage?page=" +
          invoicePage +
          (filter === "OVERDUE" ? "&filter=OVERDUE" : "") +
          (selectedRoom
            ? "&roomId=" + encodeURIComponent(selectedRoom.id)
            : "") +
          (path.split("/")[2] === "billing" && path.split("/")[3]
            ? "&invoiceId=" + encodeURIComponent(path.split("/")[3])
            : ""),
      );
      const b = await r.json();
      if (requestId !== loadSequence.current) return;
      if (!r.ok) throw new Error(b.error);
      setData(b);
      const linkedProperty =
        path.split("/")[2] === "rooms" && path.split("/")[3]
          ? b.properties.find((p: Property) =>
              p.rooms.some((r) => r.id === path.split("/")[3]),
            )
          : null;
      if (linkedProperty) {
        setSelectedRoom(
          linkedProperty.rooms.find((r: Room) => r.id === path.split("/")[3]),
        );
        setPropertyId(linkedProperty.id);
      } else if (b.selectedInvoice) {
        setPropertyId(b.selectedInvoice.propertyId);
        setSelectedInvoice(b.selectedInvoice);
        setModal("detail");
      } else setPropertyId((prev) => prev || b.properties[0]?.id || "");
    } catch (e) {
      if (requestId === loadSequence.current)
        setError(e instanceof Error ? e.message : "Koneksi gagal.");
    } finally {
      if (requestId === loadSequence.current) setLoading(false);
    }
  }
  useEffect(() => {
    if (!demo) void load();
  }, [demo, invoicePage, selectedRoom?.id, filter]);
  useEffect(() => {
    if (demo) {
      const requested = new URLSearchParams(location.search).get("tab");
      if (requested === "tasks") {
        setTab("rooms");
        setRoomsView("tasks");
      } else if (
        requested &&
        workspaceNavigation.owner.some((m) => m[0] === requested)
      )
        setTab(requested);
      setHotel(
        new URLSearchParams(location.search).get("property") === "hotel",
      );
    }
  }, [demo]);
  const rawDemo = demo ? demoProperty(hotel) : null;
  const variedDemoRooms = rawDemo?.rooms.map((room, index) => ({
    ...room,
    stays: room.stays.map((stay) => ({
      ...stay,
      billingDay: hotel ? stay.billingDay : [1, 5, 10, 12, 15, 20][index % 6],
    })),
  }));
  const demoData =
    rawDemo && variedDemoRooms
      ? {
          ...rawDemo,
          rooms: variedDemoRooms,
          invoices: rawDemo.invoices.map((invoice) => ({
            ...invoice,
            room:
              variedDemoRooms.find((room) => room.id === invoice.room.id) ??
              invoice.room,
            due: hotel
              ? invoice.due
              : `2026-10-${String(variedDemoRooms.find((room) => room.id === invoice.room.id)?.stays[0]?.billingDay ?? 10).padStart(2, "0")}`,
          })),
        }
      : null;
  const property = (
    demoData
      ? {
          ...demoData,
          devices: [
            ...demoData.devices.map((device) => ({
              ...device,
              kind: "SWITCH",
              automationEnabled: false,
              accesses: [],
            })),
            {
              id: "demo-lock",
              name: "Kunci digital kamar 01",
              roomId: demoData.rooms[0].id,
              online: true,
              provider: "MOCK",
              kind: "LOCK",
              automationEnabled: true,
              state: { locked: true },
              capabilities: {},
              syncedAt: "2026-10-13T02:00:00Z",
              accesses: [
                {
                  id: "demo-access",
                  stayId: demoData.rooms[0].stays[0].id,
                  status: "ACTIVE",
                  validFrom: demoData.rooms[0].stays[0].start,
                  validUntil: demoData.rooms[0].stays[0].end,
                },
              ],
            },
          ],
        }
      : data?.properties.find((p) => p.id === propertyId)
  ) as Property | undefined;
  const plan =
    plans.find((p) => p.id === (demo ? "starter" : data?.plan)) ?? plans[0];
  const owner = demo || (data?.user.role ?? initialRole) === "OWNER";
  const canPay = owner || data?.user.canRecordPayments;
  const canControl = owner || data?.user.canControlDevices;
  const today = demo ? "2026-10-13" : localDate();
  const invoices = property?.invoices ?? [],
    rooms = property?.rooms ?? [];
  const paid = (i: Invoice) => i.payments.reduce((s, p) => s + p.amount, 0);
  const balance = (i: Invoice) =>
    ["VOID", "DRAFT"].includes(i.status) ? 0 : i.total - paid(i);
  const invoiceStatus = (i: Invoice) =>
    i.status === "DRAFT"
      ? "Draft"
      : i.status === "VOID"
        ? "Dibatalkan"
        : balance(i) === 0
          ? "Lunas"
          : i.due < today
            ? "Jatuh tempo"
            : paid(i) > 0
              ? "Dibayar sebagian"
              : "Belum dibayar";
  const occupied = rooms.filter(
    (r) => roomStatus(r, r.stays, today) === "OCCUPIED",
  ).length;
  const available = rooms.filter(
    (r) => roomStatus(r, r.stays, today) === "AVAILABLE",
  ).length;
  const income =
    property?.summary?.income ??
    invoices
      .filter((i) => !["VOID", "DRAFT"].includes(i.status))
      .flatMap((i) => i.payments)
      .filter((p) => p.date.slice(0, 7) === today.slice(0, 7))
      .reduce((s, p) => s + p.amount, 0);
  const outstanding =
    property?.summary?.outstanding ??
    invoices.reduce((s, i) => s + balance(i), 0);
  // Demo comparisons use only recorded demo payments, never invented history.
  const issuedInvoices = invoices.filter(
    (invoice) => !["VOID", "DRAFT"].includes(invoice.status),
  );
  const [metricYear, metricMonth, metricDay] = today.split("-").map(Number);
  const currentStart = today.slice(0, 7) + "-01";
  const comparisonStart = new Date(Date.UTC(metricYear, metricMonth - 2, 1))
    .toISOString()
    .slice(0, 10);
  const previousLastDay = new Date(
    Date.UTC(metricYear, metricMonth - 1, 0),
  ).getUTCDate();
  const comparisonEnd = new Date(
    Date.UTC(metricYear, metricMonth - 2, Math.min(metricDay, previousLastDay)),
  )
    .toISOString()
    .slice(0, 10);
  const recordedPayments = issuedInvoices.flatMap(
    (invoice) => invoice.payments,
  );
  const currentIncome = recordedPayments
    .filter((payment) => payment.date >= currentStart && payment.date <= today)
    .reduce((sum, payment) => sum + payment.amount, 0);
  const previousMonthIncome = recordedPayments
    .filter(
      (payment) =>
        payment.date >= comparisonStart && payment.date <= comparisonEnd,
    )
    .reduce((sum, payment) => sum + payment.amount, 0);
  const cohort = issuedInvoices.filter(
    (invoice) => invoice.date >= currentStart && invoice.date <= today,
  );
  const collectionTotal = cohort.reduce(
    (sum, invoice) => sum + invoice.total,
    0,
  );
  const collectionPaid = cohort
    .flatMap((invoice) => invoice.payments)
    .filter((payment) => payment.date <= today)
    .reduce((sum, payment) => sum + payment.amount, 0);
  const overdueInvoices = issuedInvoices.filter(
    (invoice) => invoice.due < today && balance(invoice) > 0,
  );
  const fallbackSummary: DashboardInsightSummary = {
    income: currentIncome,
    previousMonthIncome,
    incomeChange: currentIncome - previousMonthIncome,
    incomeChangePercent:
      previousMonthIncome > 0
        ? Math.round(
            ((currentIncome - previousMonthIncome) / previousMonthIncome) *
              1000,
          ) / 10
        : currentIncome === 0
          ? 0
          : null,
    incomeDirection:
      currentIncome > previousMonthIncome
        ? "up"
        : currentIncome < previousMonthIncome
          ? "down"
          : "flat",
    currentStart,
    currentEnd: today,
    comparisonStart,
    comparisonEnd,
    roomCount: rooms.length,
    occupiedCount: occupied,
    occupancyPercent: rooms.length
      ? Math.round((occupied / rooms.length) * 100)
      : 0,
    overdueBalance: overdueInvoices.reduce(
      (sum, invoice) => sum + balance(invoice),
      0,
    ),
    overdueCount: overdueInvoices.length,
    collectionTotal,
    collectionPaid,
    collectionRate: collectionTotal
      ? Math.round((collectionPaid / collectionTotal) * 1000) / 10
      : null,
    insights: [
      {
        kind: "income",
        text:
          previousMonthIncome === 0 && currentIncome > 0
            ? "Pemasukan mulai tercatat bulan ini. Belum ada pembayaran pada periode pembanding bulan lalu."
            : currentIncome === previousMonthIncome
              ? "Pemasukan sama dengan periode pembanding bulan lalu."
              : `Pemasukan ${currentIncome > previousMonthIncome ? "naik" : "turun"} ${rupiah(Math.abs(currentIncome - previousMonthIncome))} dibanding periode pembanding bulan lalu.`,
      },
      {
        kind: "overdue",
        text: overdueInvoices.length
          ? `${overdueInvoices.length} tagihan memiliki saldo lewat jatuh tempo.`
          : "Tidak ada tagihan bersaldo yang melewati jatuh tempo.",
      },
    ],
  };
  const summary = property?.summary ?? fallbackSummary;
  const billingInvoices = Array.from(
    new Map(
      [...invoices, ...(property?.pendingProofInvoices ?? [])].map(
        (invoice) => [invoice.id, invoice],
      ),
    ).values(),
  );
  async function mutate(action: string, values: Record<string, unknown>) {
    if (demo) {
      setError(
        "Demo hanya-baca. Daftar gratis untuk menyimpan data properti Anda.",
      );
      return;
    }
    setPending(true);
    setError("");
    setSuccess("");
    try {
      const r = await fetch("/api/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, action, propertyId }),
      });
      const b = await r.json();
      if (!r.ok) throw new Error(b.error);
      if (b.result?.commandError) throw new Error(b.result.commandError);
      setModal("");
      setSelectedInvoice(null);
      setSelectedRoom(null);
      setSuccess("Perubahan berhasil disimpan.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Koneksi gagal. Coba kembali.");
      if (
        [
          "reviewProof",
          "ticketCreate",
          "ticketUpdate",
          "guestSettings",
          "roomReadiness",
        ].includes(action)
      )
        throw e;
    } finally {
      setPending(false);
    }
  }
  function navigate(next: string) {
    setFocusProofQueue(false);
    setRoomsView("rooms");
    setInvoicePage(0);
    setTab(next);
    setSelectedRoom(null);
    setQuery("");
    setFilter("ALL");
    if (!demo) history.replaceState(null, "", "/app/" + next);
  }
  function open(next: string, room: Room | null = null) {
    setError("");
    setSelectedRoom(room);
    setModal(next);
  }
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.currentTarget));
    if (modal === "room") await mutate("room", { ...d, rate: Number(d.rate) });
    if (modal === "roomUpdate")
      await mutate("roomUpdate", {
        ...d,
        roomId: selectedRoom?.id,
        rate: Number(d.rate),
      });
    if (modal === "stay")
      await mutate("stay", {
        ...d,
        end: d.end || undefined,
        rate: Number(d.rate),
        billingDay: Number(d.billingDay || 1),
      });
    if (modal === "invoice" || modal === "draftEdit")
      await mutate(modal === "invoice" ? "invoice" : "draftEdit", {
        ...d,
        invoiceId: selectedInvoice?.id,
        draft: d.draft === "on",
        items: [
          { label: d.label, amount: Number(d.amount) },
          ...(Number(d.extra) > 0
            ? [{ label: "Biaya tambahan", amount: Number(d.extra) }]
            : []),
          ...(Number(d.discount) > 0
            ? [{ label: "Diskon", amount: -Number(d.discount) }]
            : []),
        ],
      });
    if (modal === "propertyUpdate") await mutate("propertyUpdate", d);
    if (modal === "tenantSettings")
      await mutate("tenantSettings", {
        ...d,
        stayId: selectedStay?.id,
        rate: Number(d.rate),
        billingDay: Number(d.billingDay),
      });
    if (modal === "mockLock") await mutate("mockLock", d);
    if (modal === "recurring")
      await mutate("recurring", {
        ...d,
        due: today,
        items: [{ label: "Sewa", amount: 1 }],
      });
    if (modal === "payment")
      await mutate("payment", {
        ...d,
        invoiceId: selectedInvoice?.id,
        amount: Number(d.amount),
        confirmed: d.confirmed === "on",
      });
    if (modal === "void")
      await mutate("void", { ...d, invoiceId: selectedInvoice?.id });
  }
  const roomSelect = (
    <label>
      Kamar
      <select name="roomId" defaultValue={selectedRoom?.id} required>
        {rooms.map((r) => (
          <option key={r.id} value={r.id}>
            Kamar {r.number}
          </option>
        ))}
      </select>
    </label>
  );
  const staySelect = (
    <label>
      Penghuni / tamu
      <select name="stayId" required>
        {rooms.flatMap((r) =>
          r.stays
            .filter((s) =>
              ["ACTIVE", "CHECKED_IN", "CONFIRMED"].includes(s.status),
            )
            .map((s) => (
              <option key={s.id} value={s.id}>
                Kamar {r.number} · {s.guest.name}
              </option>
            )),
        )}
      </select>
    </label>
  );
  const invoiceTable = (list: Invoice[]) => (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Tagihan / penghuni</th>
            <th>Kamar</th>
            <th>Jatuh tempo</th>
            <th>Sisa tagihan</th>
            <th>Status</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {list.map((i) => (
            <tr key={i.id}>
              <td>
                <button
                  className="plain"
                  onClick={() => {
                    setSelectedInvoice(i);
                    setModal("detail");
                  }}
                >
                  {i.guest.name}
                  <small>{i.number}</small>
                </button>
              </td>
              <td>{i.room.number}</td>
              <td>{i.due}</td>
              <td>
                <b>{rupiah(balance(i))}</b>
              </td>
              <td>
                <span
                  className={
                    "badge " +
                    (balance(i) === 0
                      ? "green"
                      : i.due < today
                        ? "red"
                        : "orange")
                  }
                >
                  {invoiceStatus(i)}
                </span>
              </td>
              <td>
                <button
                  className="icon-button"
                  aria-label={"Lihat tagihan " + i.number}
                  onClick={() => {
                    setSelectedInvoice(i);
                    setModal("detail");
                  }}
                >
                  <ArrowUpRight size={17} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!list.length && (
        <div className="empty">
          <Mascot pose="empty" size={86} />
          <h3>Belum ada tagihan.</h3>
          <p>Buat tagihan pertama untuk mulai mencatat pembayaran.</p>
        </div>
      )}
    </div>
  );
  return (
    <WorkspaceShell
      role={owner ? "owner" : "staff"}
      page={tab}
      onNavigate={navigate}
      name={demo ? "Pengunjung Demo" : data?.user.name || "Memuat akun"}
      context={property?.name || "Properti Anda"}
      plan={plan.name}
      demo={demo}
      onLogout={async () => {
        if (demo) {
          location.href = "/";
          return;
        }
        await fetch("/api/auth", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "logout" }),
        });
        location.href = "/login";
      }}
      propertyPicker={
        <select
          hidden={!demo && (data?.properties.length ?? 0) < 2}
          aria-label="Pilih properti"
          value={demo ? (hotel ? "hotel" : "kos") : propertyId}
          onChange={(e) => {
            if (demo) setHotel(e.target.value === "hotel");
            else setPropertyId(e.target.value);
            setSelectedRoom(null);
            setSelectedInvoice(null);
            setModal("");
            setInvoicePage(0);
          }}
        >
          {demo ? (
            <>
              <option value="kos">Kos Melati</option>
              <option value="hotel">Guest House Harmoni</option>
            </>
          ) : (
            data?.properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))
          )}
        </select>
      }
    >
      <main className="bo-main">
        {error && (
          <div className="error" role="alert">
            {error}{" "}
            <button className="plain" onClick={() => setError("")}>
              Tutup
            </button>
          </div>
        )}
        {success && (
          <div className="success" role="status">
            {success}
          </div>
        )}
        {loading ? (
          <div className="empty" role="status">
            Memuat properti…
          </div>
        ) : !property ? (
          <div className="empty">
            <DoorOpen size={40} />
            <h1>
              {error ? "Properti belum dapat dimuat" : "Belum ada properti."}
            </h1>
            <p>Siapkan properti pertama Anda untuk mulai mengelola.</p>
            {error ? (
              <button onClick={() => load()}>Coba kembali</button>
            ) : (
              <a className="button" href="/onboarding">
                Tambahkan Properti
              </a>
            )}
            <div className="settings-plans">
              {plans
                .filter((p) => p.id !== "free")
                .map((p) => (
                  <article key={p.id}>
                    <h3>{p.name}</h3>
                    <p>
                      {p.rooms} kamar · {rupiah(p.price)} / bulan
                    </p>
                    <button
                      disabled={demo || pending || !owner}
                      onClick={() => mutate("upgrade", { plan: p.id })}
                    >
                      Ajukan Upgrade
                    </button>
                  </article>
                ))}
            </div>
            <p>Upgrade ditinjau admin. Data tetap disimpan.</p>
          </div>
        ) : (
          <>
            <div
              className="page-heading"
              hidden={
                !["rooms", "billing", "iot", "settings"].includes(tab) || !owner
              }
            >
              <div>
                <span className="eyebrow">
                  {property.name.toUpperCase()} · {property.city || "INDONESIA"}
                </span>
                <h1>
                  {tab === "dashboard"
                    ? "Selamat datang" + (demo ? ", Pak Andi." : ".")
                    : tab === "rooms"
                      ? "Kamar & Tamu"
                      : tab === "billing"
                        ? "Tagihan"
                        : tab === "iot"
                          ? "Smart IoT"
                          : "Pengaturan"}
                </h1>
                <p>
                  {tab === "dashboard"
                    ? "Lihat keadaan properti Anda hari ini."
                    : tab === "rooms"
                      ? "Setiap kamar dan penghuninya, tersusun rapi."
                      : tab === "billing"
                        ? "Pantau tagihan dan catat pembayaran dengan mudah."
                        : tab === "iot"
                          ? "Perangkat pintar bersifat opsional."
                          : "Sesuaikan properti dan paket dengan kebutuhan Anda."}
                </p>
              </div>
              {tab === "dashboard" ? (
                <button
                  onClick={() => {
                    navigate("billing");
                    open("invoice");
                  }}
                  disabled={demo}
                >
                  <Plus size={18} /> Buat Tagihan
                </button>
              ) : tab === "rooms" ? (
                <button disabled={demo || !owner} onClick={() => open("room")}>
                  <Plus size={18} /> Tambah Kamar
                </button>
              ) : tab === "billing" ? (
                <button disabled={demo} onClick={() => open("invoice")}>
                  <Plus size={18} /> Buat Tagihan
                </button>
              ) : null}
            </div>
            {tab === "rooms" && owner && (
              <div
                className="room-subnav"
                role="group"
                aria-label="Tampilan kamar dan pekerjaan"
              >
                <button
                  className={roomsView === "rooms" ? "active" : "secondary"}
                  onClick={() => setRoomsView("rooms")}
                >
                  <BedDouble size={16} /> Kamar & penghuni
                </button>
                <button
                  className={roomsView === "tasks" ? "active" : "secondary"}
                  onClick={() => setRoomsView("tasks")}
                >
                  <ClipboardCheck size={16} /> Pekerjaan & komplain{" "}
                  <span>
                    {
                      (property.tickets || []).filter(
                        (t) => t.status !== "RESOLVED",
                      ).length
                    }
                  </span>
                </button>
              </div>
            )}
            {tab === "dashboard" && owner && (
              <OwnerDashboard
                key={property.id}
                propertyId={property.id}
                contractExpiring={property.contractExpiring}
                name={property.name}
                summary={{
                  ...summary,
                  outstanding,
                  trend:
                    property.summary?.trend ||
                    Array.from({ length: 6 }, (_, i) => {
                      const d = new Date(today + "T00:00:00Z");
                      d.setUTCDate(1);
                      d.setUTCMonth(d.getUTCMonth() - 5 + i);
                      const month = d.toISOString().slice(0, 7);
                      return {
                        month,
                        amount: invoices
                          .flatMap((i) => i.payments)
                          .filter(
                            (p) => p.date.startsWith(month) && p.date <= today,
                          )
                          .reduce((s, p) => s + p.amount, 0),
                      };
                    }),
                }}
                rooms={rooms}
                tickets={property.tickets || []}
                proofCount={
                  billingInvoices
                    .flatMap((i) => i.proofs || [])
                    .filter((p) => p.status === "PENDING").length
                }
                today={today}
                demo={demo}
                onNavigate={(next) => {
                  if (next === "proofs") {
                    navigate("billing");
                    setFocusProofQueue(true);
                  } else navigate(next);
                }}
                onRoom={(id) => {
                  navigate("rooms");
                  setSelectedRoom(rooms.find((r) => r.id === id) || null);
                }}
                onOverdue={() => {
                  navigate("billing");
                  setFilter("OVERDUE");
                }}
                invoiceTable={invoiceTable(
                  demo ? invoices.slice(-5).reverse() : invoices.slice(0, 5),
                )}
              />
            )}
            {tab === "rooms" && owner && roomsView === "rooms" && (
              <>
                {!demo && (
                  <RoomImportCenter
                    key={property.id}
                    propertyId={property.id}
                    onChange={() => void load(true)}
                  />
                )}
                {!demo && (
                  <ResidentImportCenter
                    key={property.id + "residents"}
                    propertyId={property.id}
                    onChange={() => void load(true)}
                  />
                )}
                <div className="toolbar">
                  <div className="search">
                    <Search size={18} />
                    <input
                      placeholder="Cari kamar atau nama penghuni…"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      aria-label="Cari kamar"
                    />
                  </div>
                  <select
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    aria-label="Filter status kamar"
                  >
                    <option value="ALL">Semua status</option>
                    {[
                      "AVAILABLE",
                      "OCCUPIED",
                      "RESERVED",
                      "CLEANING",
                      "MAINTENANCE",
                    ].map((s) => (
                      <option key={s} value={s}>
                        {statusNames[s]}
                      </option>
                    ))}
                  </select>
                  <span>{rooms.length} kamar</span>
                </div>
                {selectedRoom ? (
                  <section className="panel room-detail">
                    <button
                      className="text-link"
                      onClick={() => setSelectedRoom(null)}
                    >
                      ← Semua kamar
                    </button>
                    <h2>Kamar {selectedRoom.number}</h2>
                    <p>
                      {rupiah(selectedRoom.rate)} /{" "}
                      {property.type === "KOS" ? "bulan" : "malam"} ·{" "}
                      {
                        statusNames[
                          roomStatus(selectedRoom, selectedRoom.stays, today)
                        ]
                      }
                    </p>
                    <button
                      disabled={demo || !owner}
                      onClick={() => open("roomUpdate", selectedRoom)}
                    >
                      Edit Kamar
                    </button>
                    {selectedRoom.operational !== "READY" && (
                      <button
                        className="secondary"
                        disabled={demo || pending}
                        onClick={() =>
                          mutate("roomReadiness", {
                            roomId: selectedRoom.id,
                            operational: "READY",
                          })
                        }
                      >
                        Tandai Kamar Siap
                      </button>
                    )}
                    <h3>Riwayat penghuni & reservasi</h3>
                    {selectedRoom.stays.map((s) => (
                      <article className="stay-detail" key={s.id}>
                        <div>
                          <b>{s.guest.name}</b>
                          <p>
                            {s.start} → {s.end ?? "Tanpa tanggal akhir"} ·{" "}
                            {statusNames[s.status]}
                          </p>
                          <small>{s.guest.phone}</small>
                          {property.type === "KOS" && (
                            <p>
                              <CalendarClock size={14} aria-hidden="true" />{" "}
                              Jatuh tempo berulang tanggal {s.billingDay} setiap
                              bulan · Tarif {rupiah(s.rate)}
                            </p>
                          )}
                        </div>
                        <div>
                          {property.type === "KOS" && s.status === "ACTIVE" && (
                            <button
                              className="secondary"
                              disabled={demo || !owner || pending}
                              onClick={() => {
                                setSelectedStay(s);
                                open("tenantSettings", selectedRoom);
                              }}
                            >
                              <Pencil size={15} aria-hidden="true" /> Atur
                              penghuni & jatuh tempo
                            </button>
                          )}
                          {["ACTIVE", "CHECKED_IN"].includes(s.status) &&
                            s.start <= today &&
                            (!s.end || s.end > today) && (
                              <StayShare
                                stayId={s.id}
                                propertyId={property.id}
                                demo={demo}
                              />
                            )}
                          {property.type === "KOS" &&
                            s.status === "ACTIVE" &&
                            s.start > today && (
                              <button
                                disabled={demo}
                                className="secondary"
                                onClick={() =>
                                  void mutate("transition", {
                                    stayId: s.id,
                                    status: "CANCELLED",
                                  })
                                }
                              >
                                Batalkan masa tinggal
                              </button>
                            )}
                          {s.status === "CONFIRMED" && (
                            <>
                              <button
                                disabled={demo}
                                onClick={() =>
                                  mutate("transition", {
                                    stayId: s.id,
                                    status: "CHECKED_IN",
                                  })
                                }
                              >
                                Check-in
                              </button>
                              <button
                                className="secondary"
                                disabled={demo}
                                onClick={() =>
                                  mutate("transition", {
                                    stayId: s.id,
                                    status: "CANCELLED",
                                  })
                                }
                              >
                                Batalkan
                              </button>
                            </>
                          )}
                          {["ACTIVE", "CHECKED_IN"].includes(s.status) &&
                            s.start <= today && (
                              <button
                                disabled={demo}
                                onClick={() => {
                                  if (
                                    confirm(
                                      "Konfirmasi check-out penghuni ini?",
                                    )
                                  )
                                    void mutate("transition", {
                                      stayId: s.id,
                                      status: "CHECKED_OUT",
                                    });
                                }}
                              >
                                Check-out
                              </button>
                            )}
                        </div>
                      </article>
                    ))}
                    {!selectedRoom.stays.length && (
                      <p>Belum ada penghuni atau tamu.</p>
                    )}
                    <button
                      className="secondary"
                      disabled={demo}
                      onClick={() => open("stay", selectedRoom)}
                    >
                      <Plus size={17} />
                      {property.type === "KOS"
                        ? "Tambah penghuni"
                        : "Tambah reservasi"}
                    </button>
                    <h3>Tagihan kamar</h3>
                    {invoiceTable(
                      invoices.filter((i) => i.room.id === selectedRoom.id),
                    )}
                    {!demo && (
                      <div className="pagination">
                        <button
                          className="secondary"
                          disabled={invoicePage === 0}
                          onClick={() => setInvoicePage((p) => p - 1)}
                        >
                          Sebelumnya
                        </button>
                        <span>Halaman {invoicePage + 1}</span>
                        <button
                          className="secondary"
                          disabled={
                            (invoicePage + 1) * 50 >=
                            (property.summary?.invoiceCount ?? 0)
                          }
                          onClick={() => setInvoicePage((p) => p + 1)}
                        >
                          Berikutnya
                        </button>
                      </div>
                    )}
                    <h3>Perangkat terhubung</h3>
                    {property.devices
                      .filter((d) => d.roomId === selectedRoom.id)
                      .map((d) => (
                        <p key={d.id}>
                          {d.name} · Simulasi ·{" "}
                          {d.online ? "Online" : "Offline"}
                        </p>
                      ))}
                  </section>
                ) : (
                  <div className="room-grid">
                    {rooms
                      .filter(
                        (r) =>
                          (filter === "ALL" ||
                            roomStatus(r, r.stays, today) === filter) &&
                          `${r.number} ${r.stays.map((s) => s.guest.name).join(" ")}`
                            .toLowerCase()
                            .includes(query.toLowerCase()),
                      )
                      .map((r) => {
                        const status = roomStatus(r, r.stays, today);
                        const stay = r.stays.find((s) =>
                          ["ACTIVE", "CHECKED_IN", "CONFIRMED"].includes(
                            s.status,
                          ),
                        );
                        return (
                          <article className="room-card" key={r.id}>
                            <div>
                              <span className="room-icon">
                                <DoorOpen size={23} />
                              </span>
                              <span
                                className={
                                  "badge " +
                                  (status === "OCCUPIED"
                                    ? "blue"
                                    : status === "AVAILABLE"
                                      ? "green"
                                      : "orange")
                                }
                              >
                                {statusNames[status]}
                              </span>
                            </div>
                            <h3>Kamar {r.number}</h3>
                            <p>{stay?.guest.name ?? "Belum ada penghuni"}</p>
                            <small>
                              {rupiah(r.rate)} /{" "}
                              {property.type === "KOS" ? "bulan" : "malam"}
                            </small>
                            <div className="room-card-footer">
                              <button
                                className="text-link"
                                onClick={() => setSelectedRoom(r)}
                              >
                                Lihat detail <ArrowUpRight size={16} />
                              </button>
                              {status === "AVAILABLE" && (
                                <button
                                  className="icon-button"
                                  disabled={demo}
                                  aria-label={
                                    "Tambah penghuni kamar " + r.number
                                  }
                                  onClick={() => open("stay", r)}
                                >
                                  <Plus size={17} />
                                </button>
                              )}
                            </div>
                          </article>
                        );
                      })}
                  </div>
                )}
              </>
            )}
            {(tab === "tasks" ||
              (tab === "dashboard" && !owner) ||
              (tab === "rooms" && roomsView === "tasks")) &&
              (!owner ? (
                <StaffTasks
                  property={property.name}
                  tickets={property.tickets || []}
                  pending={pending}
                  mutate={mutate}
                />
              ) : (
                <OperationsHub
                  key={property.id}
                  tickets={property.tickets || []}
                  stays={rooms.flatMap((r) =>
                    r.stays.map((s) => ({
                      id: s.id,
                      name: s.guest.name,
                      room: r.number,
                      start: s.start,
                      end: s.end,
                      status: s.status,
                    })),
                  )}
                  team={(data?.team || []).filter(
                    (u) =>
                      u.role === "OWNER" || u.propertyIds.includes(property.id),
                  )}
                  owner={Boolean(owner)}
                  demo={demo}
                  mutate={mutate}
                  pending={pending}
                />
              ))}

            {tab === "rooms" && !owner && (
              <StaffRooms
                rooms={rooms}
                today={today}
                pending={pending}
                mutate={mutate}
              />
            )}
            {tab === "account" && (
              <WorkspaceAccount
                enabled={!demo}
                name={demo ? "Pengunjung Demo" : data?.user.name || ""}
                email={data?.user.email}
                phone={data?.user.phone}
                role={owner ? "Pemilik" : "Staf"}
                context={property.name}
                onSettings={owner ? () => navigate("settings") : undefined}
              />
            )}
            {tab === "team" &&
              owner &&
              (data ? (
                <Team
                  members={data.team}
                  properties={data.properties}
                  disabled={pending}
                  mutate={mutate}
                />
              ) : (
                <UnavailableModule
                  title="Tim & Akses"
                  description="Masuk untuk mengelola akses staf."
                />
              ))}
            {tab === "team" && owner && !demo && data && (
              <InviteCenter
                properties={data.properties}
                stays={data.properties.flatMap((p) =>
                  p.rooms.flatMap((r) =>
                    r.stays
                      .filter((s) =>
                        [
                          "ACTIVE",
                          "CONFIRMED",
                          "RESERVED",
                          "CHECKED_IN",
                        ].includes(s.status),
                      )
                      .map((s) => ({
                        id: s.id,
                        name: s.guest.name,
                        room: r.number,
                        propertyId: p.id,
                      })),
                  ),
                )}
                onChange={() => void load()}
              />
            )}
            {tab === "residents" &&
              owner &&
              (!demo ? (
                <Resident360Workspace
                  key={property.id + tab}
                  propertyId={property.id}
                  view="residents"
                  rooms={rooms}
                  onRooms={() => navigate("rooms")}
                  onTeam={() => navigate("team")}
                  onChange={() => void load(true)}
                />
              ) : (
                <ResidentDirectory
                  rows={rooms.flatMap((r) =>
                    r.stays.map((s) => ({
                      id: s.id,
                      name: s.guest.name,
                      phone: s.guest.phone,
                      room: r.number,
                      status: s.status,
                      start: s.start,
                      end: s.end,
                    })),
                  )}
                  onOpen={(id) => {
                    const room = rooms.find((r) =>
                      r.stays.some((s) => s.id === id),
                    );
                    navigate("rooms");
                    setSelectedRoom(room || null);
                  }}
                />
              ))}
            {tab === "contracts" &&
              owner &&
              (!demo ? (
                <Resident360Workspace
                  key={property.id + tab}
                  propertyId={property.id}
                  view="contracts"
                  rooms={rooms}
                  onRooms={() => navigate("rooms")}
                  onTeam={() => navigate("team")}
                  onChange={() => void load(true)}
                />
              ) : (
                <UnavailableModule
                  title="Kontrak & Deposit"
                  description="Masuk ke workspace untuk menyiapkan kontrak dan mencatat deposit properti Anda."
                />
              ))}
            {tab === "cctv" && owner && <CctvReadiness />}
            {tab === "leo" && owner && (
              <LeoWorkspace propertyId={property.id} demo={demo} />
            )}
            {tab === "finance" &&
              owner &&
              (!demo ? (
                <FinanceWorkspace
                  key={property.id + tab}
                  propertyId={property.id}
                  properties={data?.properties || []}
                  onBilling={() => navigate("billing")}
                />
              ) : (
                <>
                  <WorkspaceCard
                    title="Keuangan"
                    description="Penerimaan dan piutang berasal dari catatan pembayaran properti."
                  >
                    <div className="grid cols2">
                      <article className="kpi">
                        <small>Penerimaan bulan ini</small>
                        <h2>{rupiah(summary.income)}</h2>
                      </article>
                      <article className="kpi">
                        <small>Belum dibayar</small>
                        <h2>{rupiah(outstanding)}</h2>
                      </article>
                    </div>
                    <button
                      className="btn outline"
                      onClick={() => navigate("billing")}
                    >
                      Buka transaksi tagihan
                    </button>
                  </WorkspaceCard>
                  <div className="space" />
                  <UnavailableModule
                    title="Pengeluaran & surplus"
                    description="Pencatatan pengeluaran dan ledger kas belum tersedia. Surplus tidak dihitung tanpa data biaya."
                  />
                </>
              ))}
            {tab === "leads" &&
              owner &&
              (!demo ? (
                <ProspectsWorkspace
                  key={property.id + tab}
                  propertyId={property.id}
                  type={property.type}
                  rooms={rooms}
                  onResidents={() => navigate("residents")}
                  onChange={() => void load(true)}
                />
              ) : (
                <UnavailableModule
                  title="Prospek & Penyewaan"
                  description="Masuk ke workspace untuk mencatat prospek dan membuat masa tinggal properti Anda."
                />
              ))}
            {tab === "messages" && !demo && (
              <MessagesWorkspace key={property.id} propertyId={property.id} />
            )}
            {(demo
              ? ["messages", "visitors", "alerts"]
              : ["visitors", "alerts"]
            ).includes(tab) && (
              <UnavailableModule
                title={
                  workspaceNavigation[owner ? "owner" : "staff"].find(
                    (n) => n[0] === tab,
                  )?.[1] || "Layanan"
                }
                description="Modul ini memerlukan backend, izin, dan alur verifikasi sebelum dapat digunakan."
                requirements={
                  tab === "contracts"
                    ? [
                        "Kontrak berversi dan persetujuan para pihak",
                        "Ledger deposit terpisah dari pembayaran sewa",
                      ]
                    : undefined
                }
              />
            )}
            {tab === "billing" && (
              <>
                <div className="billing-summary">
                  <div>
                    <small>Total tagihan aktif</small>
                    <b>
                      {rupiah(
                        property.summary?.total ??
                          invoices
                            .filter(
                              (i) => !["VOID", "DRAFT"].includes(i.status),
                            )
                            .reduce((s, i) => s + i.total, 0),
                      )}
                    </b>
                  </div>
                  <div>
                    <small>Pembayaran diterima</small>
                    <b>
                      {rupiah(
                        property.summary?.paid ??
                          invoices
                            .filter(
                              (i) => !["VOID", "DRAFT"].includes(i.status),
                            )
                            .reduce((s, i) => s + paid(i), 0),
                      )}
                    </b>
                  </div>
                  <div>
                    <small>Belum dibayar</small>
                    <b>{rupiah(outstanding)}</b>
                  </div>
                </div>
                <div className="toolbar">
                  <div className="search">
                    <Search size={17} />
                    <input
                      aria-label="Cari tagihan"
                      placeholder="Cari pada halaman ini…"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                  </div>
                  <select
                    aria-label="Filter tagihan"
                    value={filter}
                    onChange={(e) => {
                      setInvoicePage(0);
                      setFilter(e.target.value);
                    }}
                  >
                    <option value="ALL">Semua tagihan</option>
                    <option value="UNPAID">Belum lunas</option>
                    <option value="OVERDUE">Lewat jatuh tempo</option>
                    <option value="PAID">Lunas</option>
                  </select>
                  {property.type === "KOS" && (
                    <button
                      className="secondary"
                      disabled={demo || !plan.recurring}
                      onClick={() => open("recurring")}
                    >
                      Tagihan Berulang
                    </button>
                  )}
                  <a className="button secondary" href="#billing-tools">
                    Pengingat & bukti bayar
                  </a>
                </div>
                <section className="panel">
                  {invoiceTable(
                    invoices.filter(
                      (i) =>
                        `${i.number} ${i.guest.name}`
                          .toLowerCase()
                          .includes(query.toLowerCase()) &&
                        (filter === "ALL" ||
                          (filter === "UNPAID" && balance(i) > 0) ||
                          (filter === "OVERDUE" &&
                            balance(i) > 0 &&
                            i.due < today) ||
                          (filter === "PAID" &&
                            i.status === "UNPAID" &&
                            balance(i) === 0)),
                    ),
                  )}
                </section>
                {!demo && (
                  <div className="pagination">
                    <button
                      className="secondary"
                      disabled={invoicePage === 0 || loading}
                      onClick={() => setInvoicePage((p) => p - 1)}
                    >
                      Sebelumnya
                    </button>
                    <span>
                      Halaman {invoicePage + 1} ·{" "}
                      {property.summary?.invoiceCount ?? invoices.length}{" "}
                      tagihan total
                    </span>
                    <button
                      className="secondary"
                      disabled={
                        (invoicePage + 1) * 50 >=
                          (property.summary?.invoiceCount ?? 0) || loading
                      }
                      onClick={() => setInvoicePage((p) => p + 1)}
                    >
                      Berikutnya
                    </button>
                  </div>
                )}
                <div id="billing-tools">
                  {!demo && owner && (
                    <ReminderAutomation
                      key={property.id + "reminders"}
                      propertyId={property.id}
                    />
                  )}
                  {!demo && owner && (
                    <ProofQueue
                      key={property.id + "proof-queue"}
                      propertyId={property.id}
                      focusOnMount={focusProofQueue && !loading}
                      onChange={() => void load(true)}
                    />
                  )}
                  <BillingTools
                    key={property.id}
                    invoices={billingInvoices}
                    propertyId={property.id}
                    demo={demo}
                    canReview={Boolean(canPay)}
                    showProofQueue={demo || !owner}
                    mutate={mutate}
                  />
                </div>
              </>
            )}
            {tab === "iot" && (
              <>
                <div className="notice">
                  <b>Mode simulasi · Tuya live belum tersedia</b>
                  <p>
                    Kamelo tetap bisa digunakan tanpa IoT. Perangkat simulasi
                    tidak mengendalikan perangkat nyata. Hubungi ELENIO untuk
                    penyiapan Tuya terbantu.
                  </p>
                  <a href="https://wa.me/6281933328899">
                    Minta bantuan penyiapan ↗
                  </a>
                </div>
                <button
                  className="secondary"
                  disabled={demo || !owner}
                  onClick={() => mutate("mockDevice", {})}
                >
                  <Plus size={17} /> Tambah perangkat simulasi
                </button>
                <button
                  className="secondary"
                  disabled={demo || !owner || !rooms.length}
                  onClick={() => open("mockLock")}
                >
                  <KeyRound size={17} aria-hidden="true" /> Tambah kunci digital
                  simulasi
                </button>
                <div className="device-grid">
                  {property.devices.map((d) => (
                    <article className="panel device" key={d.id}>
                      <div className="panel-title">
                        {d.kind === "LOCK" ? (
                          <KeyRound
                            size={24}
                            color="#7c3aed"
                            aria-hidden="true"
                          />
                        ) : (
                          <Lightbulb
                            size={24}
                            color="#d97706"
                            aria-hidden="true"
                          />
                        )}
                        <span
                          className={"badge " + (d.online ? "green" : "red")}
                        >
                          {d.online ? "Online" : "Offline"}
                        </span>
                      </div>
                      <h3>{d.name}</h3>
                      <span className="badge blue">Simulasi</span>
                      <label>
                        Petakan ke kamar
                        <select
                          disabled={demo || !owner || pending}
                          value={d.roomId ?? ""}
                          onChange={(e) =>
                            mutate("mapDevice", {
                              deviceId: d.id,
                              roomId: e.target.value,
                            })
                          }
                        >
                          <option value="" disabled>
                            Belum dipetakan
                          </option>
                          {rooms.map((r) => (
                            <option value={r.id} key={r.id}>
                              Kamar {r.number}
                            </option>
                          ))}
                        </select>
                      </label>
                      <small>
                        Sinkronisasi:{" "}
                        {new Date(d.syncedAt).toLocaleString("id-ID", {
                          timeZone: "Asia/Jakarta",
                        })}
                      </small>
                      {d.kind !== "LOCK" &&
                        Object.entries(d.capabilities).map(([code, cap]) =>
                          cap.type === "boolean" ? (
                            <button
                              className={d.state[code] ? "" : "secondary"}
                              disabled={
                                demo || !canControl || !d.online || pending
                              }
                              key={code}
                              onClick={() =>
                                mutate("device", {
                                  deviceId: d.id,
                                  command: { code, value: !d.state[code] },
                                })
                              }
                            >
                              {pending
                                ? "Menunggu konfirmasi…"
                                : d.state[code]
                                  ? "Matikan"
                                  : "Nyalakan"}{" "}
                              {code}
                            </button>
                          ) : (
                            <label key={code}>
                              {code}
                              <input
                                type="number"
                                min={cap.min}
                                max={cap.max}
                                defaultValue={Number(d.state[code])}
                                disabled={
                                  demo || !canControl || !d.online || pending
                                }
                                onBlur={(e) =>
                                  mutate("device", {
                                    deviceId: d.id,
                                    command: {
                                      code,
                                      value: Number(e.target.value),
                                    },
                                  })
                                }
                              />
                            </label>
                          ),
                        )}
                      {d.kind !== "LOCK" && (
                        <label className="guest-control-setting">
                          <input
                            type="checkbox"
                            checked={Boolean(d.guestControllable)}
                            disabled={demo || !owner || pending || !d.roomId}
                            onChange={(e) =>
                              void mutate("guestDeviceConfig", {
                                deviceId: d.id,
                                enabled: e.target.checked,
                              })
                            }
                          />{" "}
                          Autorisasi kontrol di portal penghuni (simulasi)
                        </label>
                      )}
                      <SmartAccessPanel
                        device={{
                          ...d,
                          kind: d.kind || "SWITCH",
                          automationEnabled: d.automationEnabled ?? false,
                        }}
                        demo={demo}
                        canConfigure={Boolean(owner)}
                        pending={pending}
                        mutate={mutate}
                      />
                      {!d.online && (
                        <p className="error">
                          Perangkat sedang offline. Periksa koneksi sebelum
                          mencoba kembali.
                        </p>
                      )}
                    </article>
                  ))}
                </div>
                {!property.devices.length && (
                  <div className="empty">
                    <Wifi />
                    <h3>Belum menghubungkan perangkat pintar.</h3>
                    <p>Kamelo tetap bisa digunakan tanpa IoT.</p>
                  </div>
                )}
              </>
            )}
            {tab === "settings" && (
              <>
                <section className="panel settings-panel">
                  <span className="eyebrow">OTOMASI OPERASIONAL</span>
                  <h2>Tagihan rutin & sinkronisasi akses</h2>
                  <p>
                    Tagihan kos dibuat saat tanggal jatuh tempo masing-masing
                    penghuni tercapai. Satu tagihan per penghuni per periode;
                    bulan pendek mengikuti tanggal terakhir. Pengiriman WhatsApp
                    tetap manual.
                  </p>
                  <label className="guest-control-setting">
                    <input
                      type="checkbox"
                      checked={Boolean(property.billingAutomation)}
                      disabled={
                        demo ||
                        !owner ||
                        pending ||
                        !plan.recurring ||
                        property.type !== "KOS"
                      }
                      onChange={(e) =>
                        void mutate("operationsConfig", {
                          enabled: e.target.checked,
                        })
                      }
                    />{" "}
                    Aktifkan penerbitan tagihan kos otomatis (paket berbayar)
                  </label>
                  <p>
                    Terakhir dijalankan:{" "}
                    {property.operationsLastRunAt
                      ? new Date(property.operationsLastRunAt).toLocaleString(
                          "id-ID",
                          { timeZone: "Asia/Jakarta" },
                        )
                      : "Belum pernah"}
                    . Worker perlu tetap berjalan agar jadwal otomatis diproses.
                  </p>
                  <button
                    className="secondary"
                    disabled={demo || !owner || pending}
                    onClick={() => void mutate("operationsRun", {})}
                  >
                    Jalankan sekarang
                  </button>
                </section>
                <GuestSettings
                  key={property.id}
                  property={property}
                  owner={Boolean(owner)}
                  demo={demo}
                  pending={pending}
                  mutate={mutate}
                />
                <section className="panel settings-panel">
                  <h2>Informasi properti</h2>
                  <p>
                    <b>{property.name}</b> ·{" "}
                    {property.type === "KOS" ? "Kos" : "Hotel / Guest House"} ·{" "}
                    {property.city}
                  </p>
                  <div className="modal-actions">
                    <button
                      className="secondary"
                      disabled={demo || !owner}
                      onClick={() => open("propertyUpdate")}
                    >
                      Edit Properti
                    </button>
                    <a className="button secondary" href="/onboarding">
                      Tambah Properti
                    </a>
                  </div>
                </section>
                <section className="panel settings-panel">
                  <span className="eyebrow">LANGGANAN</span>
                  <h2>Paket {plan.name}</h2>
                  <p>
                    {rooms.length} kamar pada properti ini · batas total
                    organisasi {plan.rooms} kamar · {plan.properties} properti ·{" "}
                    {plan.users} pengguna
                  </p>
                  <p>
                    Perubahan paket tidak menghapus catatan keuangan dan data
                    lama.
                  </p>
                  <div className="settings-plans">
                    {plans
                      .filter((p) => p.id !== "free")
                      .map((p) => (
                        <article key={p.id}>
                          <h3>{p.name}</h3>
                          <b>{rupiah(p.price)} / bulan</b>
                          <p>
                            {p.rooms} kamar · {p.properties} properti ·{" "}
                            {p.users} akun
                          </p>
                          <button
                            disabled={
                              demo || !owner || pending || plan.id === p.id
                            }
                            onClick={() => mutate("upgrade", { plan: p.id })}
                          >
                            {plan.id === p.id
                              ? "Paket aktif"
                              : "Ajukan Upgrade"}
                          </button>
                        </article>
                      ))}
                  </div>
                  <p className="notice">
                    Permintaan akan ditinjau admin. Tidak ada pembayaran
                    otomatis atau konfirmasi pembayaran palsu.
                  </p>
                  {data?.upgrades.map((u) => (
                    <p key={u.id}>
                      Permintaan {u.plan}: <b>{u.status}</b>
                    </p>
                  ))}
                </section>
                {!demo && owner && data && <CustomerBillingWorkspace own />}
                {!demo && owner && data && (
                  <Team
                    members={data.team}
                    properties={data.properties}
                    disabled={pending}
                    mutate={mutate}
                  />
                )}
                <section className="panel settings-panel">
                  <h2>Keamanan & bantuan</h2>
                  <p>
                    Akses staf dibatasi oleh penugasan properti di server.
                    Pemilik dapat mengubah penugasan staf melalui Pengguna &
                    Staf.
                  </p>
                  <Link href="/forgot-password">Pulihkan kata sandi</Link> ·{" "}
                  <a href="https://wa.me/6281933328899">Hubungi ELENIO</a>
                  {data?.user.platformAdmin && (
                    <p>
                      <a href="/admin">Buka administrasi platform</a>
                    </p>
                  )}
                </section>
              </>
            )}
          </>
        )}
      </main>
      {modal && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setModal("");
          }}
        >
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
          >
            <div className="panel-title">
              <h2 id="modal-title">
                {
                  (
                    {
                      room: "Tambah Kamar",
                      roomUpdate: "Edit Kamar",
                      stay:
                        property?.type === "KOS"
                          ? "Tambah Penghuni"
                          : "Tambah Reservasi",
                      invoice: "Buat Tagihan",
                      payment: "Catat Pembayaran",
                      detail: "Detail Tagihan",
                      recurring: "Tagihan Berulang",
                      void: "Batalkan Tagihan",
                      draftEdit: "Edit Draft",
                      propertyUpdate: "Informasi Properti",
                      tenantSettings: "Penghuni & Jatuh Tempo",
                      mockLock: "Tambah Kunci Digital Simulasi",
                    } as Record<string, string>
                  )[modal]
                }
              </h2>
              <button
                className="icon-button"
                onClick={() => setModal("")}
                aria-label="Tutup dialog"
              >
                ✕
              </button>
            </div>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            {modal === "detail" && selectedInvoice ? (
              <div className="invoice-detail">
                <span className="eyebrow">KAMELO · BY ELENIO</span>
                <h3>{selectedInvoice.number}</h3>
                <p>
                  {selectedInvoice.guest.name} · Kamar{" "}
                  {selectedInvoice.room.number}
                </p>
                <p>
                  Terbit {selectedInvoice.date} · Jatuh tempo{" "}
                  {selectedInvoice.due}
                </p>
                {selectedInvoice.items.map((item, i) => (
                  <div className="invoice-line" key={i}>
                    <span>{item.label}</span>
                    <b>{rupiah(item.amount)}</b>
                  </div>
                ))}
                <div className="invoice-line">
                  <b>Total</b>
                  <b>{rupiah(selectedInvoice.total)}</b>
                </div>
                <div className="invoice-line">
                  <span>Dibayar</span>
                  <b>{rupiah(paid(selectedInvoice))}</b>
                </div>
                <div className="invoice-line">
                  <b>Sisa tagihan</b>
                  <b>{rupiah(balance(selectedInvoice))}</b>
                </div>
                <h3>Riwayat pembayaran</h3>
                {selectedInvoice.payments.map((p) => (
                  <p key={p.id}>
                    {p.date} · {p.method} · {rupiah(p.amount)}
                  </p>
                ))}
                {!selectedInvoice.payments.length && (
                  <p>Belum ada pembayaran.</p>
                )}
                <div className="modal-actions">
                  {selectedInvoice.status === "DRAFT" && (
                    <>
                      <button
                        disabled={demo || pending}
                        onClick={() =>
                          mutate("issue", { invoiceId: selectedInvoice.id })
                        }
                      >
                        Terbitkan
                      </button>
                      <button
                        className="secondary"
                        disabled={demo}
                        onClick={() => setModal("draftEdit")}
                      >
                        Edit Draft
                      </button>
                    </>
                  )}
                  <button
                    disabled={demo || !canPay || balance(selectedInvoice) <= 0}
                    onClick={() => setModal("payment")}
                  >
                    Catat Pembayaran
                  </button>
                  <button className="secondary" onClick={() => window.print()}>
                    Cetak
                  </button>
                  {selectedInvoice.guest.phone &&
                    balance(selectedInvoice) > 0 && (
                      <a
                        className="button secondary"
                        target="_blank"
                        rel="noreferrer"
                        href={
                          "https://wa.me/" +
                          selectedInvoice.guest.phone
                            .replace(/^0/, "62")
                            .replace(/\D/g, "") +
                          "?text=" +
                          encodeURIComponent(
                            `Halo Bapak/Ibu ${selectedInvoice.guest.name}, kami ingin mengingatkan tagihan kamar ${selectedInvoice.room.number} sebesar ${rupiah(balance(selectedInvoice))} yang jatuh tempo tanggal ${selectedInvoice.due}. Terima kasih.`,
                          )
                        }
                      >
                        Buka Pengingat WhatsApp ↗
                      </a>
                    )}
                  <button
                    className="secondary"
                    disabled={
                      demo ||
                      !owner ||
                      paid(selectedInvoice) > 0 ||
                      selectedInvoice.status === "VOID"
                    }
                    onClick={() => setModal("void")}
                  >
                    Batalkan Tagihan
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={submit}>
                {modal === "tenantSettings" && selectedStay && (
                  <>
                    <p>
                      Ubah data penghuni dan jadwal tagihan berulang untuk kamar{" "}
                      {selectedRoom?.number}.
                    </p>
                    <label>
                      Nama penghuni
                      <input
                        name="name"
                        defaultValue={selectedStay.guest.name}
                        minLength={2}
                        maxLength={100}
                        required
                      />
                    </label>
                    <label>
                      WhatsApp
                      <input
                        name="phone"
                        type="tel"
                        pattern="(\+62|62|0)8[0-9]{7,12}"
                        placeholder="081234567890"
                        defaultValue={selectedStay.guest.phone}
                        required
                      />
                    </label>
                    <div className="form-row">
                      <label>
                        Tarif bulanan (Rp)
                        <input
                          name="rate"
                          type="number"
                          min={0}
                          max={1000000000}
                          step={1}
                          defaultValue={selectedStay.rate}
                          required
                        />
                      </label>
                      <label>
                        Jatuh tempo setiap tanggal
                        <input
                          name="billingDay"
                          type="number"
                          min={1}
                          max={31}
                          step={1}
                          defaultValue={selectedStay.billingDay}
                          required
                        />
                      </label>
                    </div>
                    <p className="notice">
                      Perubahan berlaku untuk tagihan berulang berikutnya.
                      Tagihan yang sudah terbit tetap memakai jatuh tempo dan
                      nominal sebelumnya. Tanggal 29–31 menyesuaikan hari
                      terakhir pada bulan yang lebih pendek.
                    </p>
                  </>
                )}
                {modal === "mockLock" && (
                  <>
                    <div className="notice">
                      <b>Simulasi kunci digital</b>
                      <p>
                        Perangkat ini belum mengendalikan pintu fisik.
                        Otomatisasi akses dapat diaktifkan setelah kunci
                        dipetakan ke kamar.
                      </p>
                    </div>
                    {roomSelect}
                    <label>
                      Nama kunci
                      <input
                        name="name"
                        minLength={2}
                        maxLength={100}
                        placeholder="Contoh: Kunci kamar 01"
                        required
                      />
                    </label>
                  </>
                )}
                {["room", "roomUpdate"].includes(modal) && (
                  <>
                    <label>
                      Nomor kamar
                      <input
                        name="number"
                        defaultValue={selectedRoom?.number}
                        maxLength={20}
                        required
                      />
                    </label>
                    <label>
                      Tarif (Rp)
                      <input
                        name="rate"
                        type="number"
                        min="0"
                        max="1000000000"
                        step="1"
                        defaultValue={selectedRoom?.rate ?? 1500000}
                        required
                      />
                    </label>
                    {modal === "roomUpdate" && (
                      <label>
                        Kesiapan kamar
                        <select
                          name="operational"
                          defaultValue={selectedRoom?.operational}
                        >
                          <option value="READY">Siap</option>
                          <option value="CLEANING">Perlu dibersihkan</option>
                          <option value="MAINTENANCE">Perawatan</option>
                        </select>
                      </label>
                    )}
                  </>
                )}
                {modal === "stay" && (
                  <>
                    {roomSelect}
                    <label>
                      Nama penghuni / tamu
                      <input name="name" minLength={2} required />
                    </label>
                    <label>
                      WhatsApp
                      <input
                        name="phone"
                        type="tel"
                        pattern="(\+62|62|0)8[0-9]{7,12}"
                        placeholder="081234567890"
                        required
                      />
                    </label>
                    <div className="form-row">
                      <label>
                        Tanggal mulai
                        <input
                          type="date"
                          name="start"
                          defaultValue={today}
                          required
                        />
                      </label>
                      <label>
                        {property?.type === "KOS"
                          ? "Tanggal akhir (opsional)"
                          : "Check-out"}
                        <input
                          type="date"
                          name="end"
                          required={property?.type === "HOTEL"}
                        />
                      </label>
                    </div>
                    <label>
                      Tarif (Rp)
                      <input
                        name="rate"
                        type="number"
                        min="0"
                        max="1000000000"
                        step="1"
                        defaultValue={selectedRoom?.rate ?? 0}
                        required
                      />
                    </label>
                    {property?.type === "KOS" && (
                      <label>
                        Hari tagihan (1–31)
                        <input
                          name="billingDay"
                          type="number"
                          min="1"
                          max="31"
                          defaultValue="10"
                          required
                        />
                      </label>
                    )}
                  </>
                )}
                {modal === "propertyUpdate" && (
                  <>
                    <label>
                      Nama properti
                      <input
                        name="name"
                        defaultValue={property?.name}
                        minLength={2}
                        required
                      />
                    </label>
                    <label>
                      Kota
                      <input name="city" defaultValue={property?.city} />
                    </label>
                  </>
                )}
                {(modal === "invoice" || modal === "draftEdit") && (
                  <>
                    {modal === "invoice" && staySelect}
                    <label>
                      Jatuh tempo
                      <input
                        name="due"
                        type="date"
                        defaultValue={
                          modal === "draftEdit" ? selectedInvoice?.due : today
                        }
                        required
                      />
                    </label>
                    <label>
                      Keterangan
                      <input
                        name="label"
                        defaultValue={
                          modal === "draftEdit"
                            ? selectedInvoice?.items[0]?.label
                            : "Sewa kamar"
                        }
                        required
                      />
                    </label>
                    <label>
                      Nominal (Rp)
                      <input
                        name="amount"
                        type="number"
                        min="1"
                        max="1000000000"
                        step="1"
                        defaultValue={
                          modal === "draftEdit"
                            ? selectedInvoice?.items[0]?.amount
                            : undefined
                        }
                        required
                      />
                    </label>
                    <div className="form-row">
                      <label>
                        Biaya tambahan (Rp)
                        <input
                          name="extra"
                          type="number"
                          min="0"
                          max="1000000000"
                          defaultValue={
                            modal === "draftEdit"
                              ? selectedInvoice?.items
                                  .filter((i) => i.label === "Biaya tambahan")
                                  .reduce((s, i) => s + i.amount, 0)
                              : 0
                          }
                        />
                      </label>
                      <label>
                        Diskon (Rp)
                        <input
                          name="discount"
                          type="number"
                          min="0"
                          max="1000000000"
                          defaultValue={
                            modal === "draftEdit"
                              ? Math.abs(
                                  selectedInvoice?.items
                                    .filter((i) => i.amount < 0)
                                    .reduce((s, i) => s + i.amount, 0) ?? 0,
                                )
                              : 0
                          }
                        />
                      </label>
                    </div>
                    {modal === "invoice" && (
                      <label className="checkbox">
                        <input type="checkbox" name="draft" />
                        Simpan sebagai draft, terbitkan nanti
                      </label>
                    )}
                    <p className="notice">
                      Periksa nominal sebelum menyimpan. Tagihan terbit hanya
                      dapat dibatalkan melalui alur pembatalan.
                    </p>
                  </>
                )}
                {modal === "recurring" && (
                  <>
                    {staySelect}
                    <label>
                      Periode tagihan
                      <input
                        name="period"
                        type="month"
                        defaultValue={today.slice(0, 7)}
                        required
                      />
                    </label>
                    <p className="notice">
                      Tarif dan hari tagihan mengikuti masa huni. Periode yang
                      sama tidak akan dibuat dua kali.
                    </p>
                  </>
                )}
                {modal === "payment" && (
                  <>
                    <p>
                      Sisa tagihan:{" "}
                      <b>
                        {rupiah(selectedInvoice ? balance(selectedInvoice) : 0)}
                      </b>
                    </p>
                    <label>
                      Nominal pembayaran (Rp)
                      <input
                        name="amount"
                        type="number"
                        step="1"
                        min="1"
                        max={selectedInvoice ? balance(selectedInvoice) : 0}
                        required
                      />
                    </label>
                    <label>
                      Tanggal pembayaran
                      <input
                        name="date"
                        type="date"
                        max={today}
                        defaultValue={today}
                        required
                      />
                    </label>
                    <label>
                      Metode
                      <select name="method">
                        <option value="CASH">Tunai</option>
                        <option value="TRANSFER">Transfer bank</option>
                        <option value="QRIS">QRIS (catat manual)</option>
                        <option value="OTHER">Lainnya</option>
                      </select>
                    </label>
                    <label>
                      Nomor referensi (opsional)
                      <input name="reference" maxLength={100} />
                    </label>
                    <label className="checkbox">
                      <input name="confirmed" type="checkbox" required />
                      Saya mengonfirmasi pembayaran ini sudah diterima.
                    </label>
                  </>
                )}
                {modal === "void" && (
                  <>
                    <p>Tagihan akan dibatalkan dan tetap ada dalam riwayat.</p>
                    <label>
                      Alasan pembatalan
                      <textarea
                        name="reason"
                        minLength={5}
                        maxLength={200}
                        required
                      />
                    </label>
                  </>
                )}
                <button disabled={pending || demo}>
                  {pending
                    ? "Menyimpan…"
                    : modal === "payment"
                      ? "Konfirmasi & Catat Pembayaran"
                      : "Simpan"}
                </button>
              </form>
            )}
          </section>
        </div>
      )}
    </WorkspaceShell>
  );
}
