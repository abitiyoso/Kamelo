export type PaymentProof = {
  id: string;
  amount: number;
  date: string;
  method: string;
  reference: string | null;
  status: string;
  reviewNote?: string | null;
  uploadedAt: string;
};

export type TenantInvoice = {
  number: string;
  customerName: string;
  roomNumber: string;
  propertyName: string;
  date: string;
  due: string;
  total: number;
  paid: number;
  balance: number;
  status: string;
  items: { label: string; amount: number }[];
  proofs: PaymentProof[];
};

export type TenantData = {
  invoice: TenantInvoice;
  access?: {
    mode: "SIMULATION";
    status: "ACTIVE" | "REVOKED" | "PENDING";
    validFrom: string;
    validUntil?: string | null;
    pin?: string;
  } | null;
  branding: string;
};

export const paymentMethodNames: Record<string, string> = {
  TRANSFER: "Transfer bank",
  QRIS: "QRIS",
  CASH: "Tunai",
  OTHER: "Lainnya",
};

export const proofStatusNames: Record<string, string> = {
  PENDING: "Menunggu verifikasi",
  APPROVED: "Disetujui",
  REJECTED: "Ditolak",
};

export const tenantDate = (value: string) => {
  const day = value.slice(0, 10);
  const parsed = new Date(`${day}T00:00:00Z`);
  return Number.isFinite(+parsed)
    ? new Intl.DateTimeFormat("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      }).format(parsed)
    : "—";
};

export const tenantToday = () =>
  new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Jakarta",
  }).format(new Date());
