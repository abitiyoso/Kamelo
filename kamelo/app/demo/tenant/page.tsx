import type { Metadata } from "next";
import { TenantPortal } from "@/components/tenant-portal";
export const metadata: Metadata = {
  title: "Contoh Portal Penghuni · Kamelo",
  robots: { index: false, follow: false },
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ embedded?: string; property?: string }>;
}) {
  const params = await searchParams,
    hotel = params.property === "hotel";
  return (
    <TenantPortal
      key={hotel ? "hotel" : "kos"}
      demo
      hotel={hotel}
      embedded={params.embedded === "1"}
    />
  );
}
