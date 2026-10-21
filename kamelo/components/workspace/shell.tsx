"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Home,
  Building2,
  Users,
  Layers,
  FileText,
  ReceiptText,
  ClipboardList,
  MessageSquare,
  Inbox,
  Camera,
  Zap,
  ChartColumn,
  Wallet,
  Shield,
  Settings,
  BedDouble,
  Grid2X2,
  ChevronRight,
  LogOut,
} from "lucide-react";
import {
  workspaceNavigation,
  mobileWorkspaceTabs,
  type WorkspaceRole,
} from "@/lib/workspace/navigation";
import assets from "@/lib/workspace/assets.json";
import "@/app/workspace.css";
const icons = {
  home: Home,
  building: Building2,
  users: Users,
  layers: Layers,
  file: FileText,
  receipt: ReceiptText,
  clipboard: ClipboardList,
  message: MessageSquare,
  inbox: Inbox,
  camera: Camera,
  zap: Zap,
  chart: ChartColumn,
  wallet: Wallet,
  shield: Shield,
  settings: Settings,
  bed: BedDouble,
};
export const roleNames = {
  owner: "Pemilik",
  staff: "Staf",
  tenant: "Penghuni",
  admin: "Admin ELENIO",
};
export function WorkspaceShell({
  role,
  page,
  onNavigate,
  name,
  context,
  plan,
  children,
  propertyPicker,
  demo = false,
  onLogout,
}: {
  role: WorkspaceRole;
  page: string;
  onNavigate: (key: string) => void;
  name: string;
  context: string;
  plan?: string;
  children: ReactNode;
  propertyPicker?: ReactNode;
  demo?: boolean;
  onLogout?: () => void;
}) {
  const [more, setMore] = useState(false);
  const moreButton = useRef<HTMLButtonElement>(null);
  const nav = workspaceNavigation[role],
    primary = mobileWorkspaceTabs[role];
  const title =
    nav.find(([key]) => key === page)?.[1] ||
    (page === "tasks"
      ? "Pekerjaan"
      : page === "billing"
        ? "Tagihan & Pembayaran"
        : page === "iot"
          ? "Smart Room"
          : "Pengaturan properti");
  useEffect(() => {
    setMore(false);
  }, [page]);
  useEffect(() => {
    function key(e: KeyboardEvent) {
      if (e.key === "Escape" && more) {
        setMore(false);
        moreButton.current?.focus();
      }
    }
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [more]);
  function navigate(key: string) {
    onNavigate(key);
    setMore(false);
  }
  function item([key, label, icon]: [string, string, string], mobile = false) {
    const Icon = icons[icon as keyof typeof icons];
    return (
      <button
        key={key}
        type="button"
        className={page === key ? "active" : ""}
        aria-current={page === key ? "page" : undefined}
        onClick={() => navigate(key)}
      >
        <Icon size={mobile ? 20 : 17} />
        {mobile ? label.split(" ")[0] : label}
      </button>
    );
  }
  return (
    <div className="bo-root">
      <div className={"shell bo-role-" + role}>
        <aside className="side">
          <a className="brand" href="/" aria-label="Kamelo by ELENIO — beranda">
            <img src={assets.logo} alt="Kamelo by ELENIO" />
          </a>
          <div className="side-label">
            {roleNames[role]} · {context}
          </div>
          <nav className="nav" aria-label="Navigasi workspace">
            {nav.map((n) => item(n))}
          </nav>
          <div className="side-footer">
            <strong>Kamelo by ELENIO</strong>
            <small>Pengelolaan properti & layanan penghuni</small>
            <button className="btn outline" onClick={() => navigate("account")}>
              Akun & akses
            </button>
            {onLogout && !demo && (
              <a className="btn outline" href="/workspaces">
                Pilih workspace
              </a>
            )}
            {onLogout && (
              <button className="bo-logout" onClick={onLogout}>
                <LogOut size={16} />
                Keluar
              </button>
            )}
          </div>
        </aside>
        <section className="workspace">
          <div className="mobiletop">
            <a href="/" aria-label="Kamelo by ELENIO">
              <img src={assets.logo} alt="Kamelo" />
            </a>
            <small>
              {roleNames[role]} · {context}
            </small>
          </div>
          <div className="top">
            <div>
              <h1>{title}</h1>
              <p>
                Kamelo / {roleNames[role]} / {context}
              </p>
            </div>
            <div className="actions">
              {propertyPicker}
              {plan && role === "owner" && (
                <span className="chip info">{plan}</span>
              )}
              <button
                className="profile"
                onClick={() => navigate("account")}
                aria-label="Buka akun saya"
              >
                <span className="avatar">{name.slice(0, 1) || "?"}</span>
                <span className="avsmall">
                  {name.split(" ")[0]} · {roleNames[role]}
                </span>
                <ChevronRight size={13} />
              </button>
            </div>
          </div>
          {demo && (
            <p className="bo-demo" role="status">
              Data contoh · hanya-baca. Tidak ada data pelanggan atau perintah
              perangkat nyata.
            </p>
          )}
          <div className="main">{children}</div>
        </section>
        <nav className="mobilebar" aria-label="Navigasi mobile">
          {nav
            .filter(([key]) => primary.includes(key))
            .map((n) => item(n, true))}
          <button
            ref={moreButton}
            className={more ? "active" : ""}
            aria-expanded={more}
            aria-controls="workspace-more"
            onClick={() => setMore(!more)}
          >
            <Grid2X2 size={20} />
            Lainnya
          </button>
        </nav>
        {more && (
          <div
            id="workspace-more"
            className="moremenu"
            aria-label="Menu lainnya"
          >
            {nav.filter(([key]) => !primary.includes(key)).map((n) => item(n))}
            {onLogout && <button onClick={onLogout}>Keluar</button>}
          </div>
        )}
      </div>
    </div>
  );
}
