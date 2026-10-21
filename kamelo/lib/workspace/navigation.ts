export type WorkspaceRole = "owner" | "staff" | "tenant" | "admin";
export const workspaceNavigation: Record<
  WorkspaceRole,
  [string, string, string][]
> = {
  owner: [
    ["dashboard", "Beranda", "home"],
    ["rooms", "Properti & Kamar", "building"],
    ["residents", "Database Penghuni", "users"],
    ["leads", "Prospek Sewa", "layers"],
    ["contracts", "Kontrak & Deposit", "file"],
    ["billing", "Tagihan & Pembayaran", "receipt"],
    ["tasks", "Pekerjaan", "clipboard"],
    ["messages", "Kotak Masuk", "message"],
    ["visitors", "Tamu & Paket", "inbox"],
    ["cctv", "CCTV & AI", "camera"],
    ["iot", "Smart Room", "zap"],
    ["leo", "LEO Insights", "chart"],
    ["finance", "Keuangan", "wallet"],
    ["team", "Tim & Akses", "shield"],
    ["account", "Akun & Pengaturan", "settings"],
  ],
  staff: [
    ["dashboard", "Tugas Saya", "clipboard"],
    ["rooms", "Kesiapan Kamar", "bed"],
    ["alerts", "Alert Keamanan", "shield"],
    ["messages", "Pesan", "message"],
    ["account", "Akun Saya", "settings"],
  ],
  tenant: [
    ["home", "Beranda", "home"],
    ["bills", "Tagihan", "receipt"],
    ["services", "Layanan", "clipboard"],
    ["room", "Kamar Saya", "bed"],
    ["messages", "Pesan", "message"],
    ["account", "Akun Saya", "settings"],
  ],
  admin: [
    ["organizations", "Pelanggan Kamelo", "building"],
    ["subscriptions", "Subscription", "wallet"],
    ["support", "Support Center", "clipboard"],
    ["integrations", "Integrasi & Audit", "shield"],
    ["account", "Akun Admin", "settings"],
  ],
};
export const mobileWorkspaceTabs: Record<WorkspaceRole, string[]> = {
  owner: ["dashboard", "rooms", "billing", "cctv"],
  staff: ["dashboard", "rooms", "alerts", "messages"],
  tenant: ["home", "bills", "services", "room"],
  admin: ["organizations", "subscriptions", "support", "integrations"],
};
export function workspacePageAllowed(role: WorkspaceRole, page: string) {
  return (
    workspaceNavigation[role].some(([key]) => key === page) ||
    (role === "owner" && page === "settings") ||
    (role === "staff" && page === "tasks")
  );
}
