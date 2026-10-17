import type { Metadata } from "next";
import { TenantPortal } from "@/components/tenant-portal";
export const metadata: Metadata = {
  title: "Tagihan Penghuni · Kamelo by ELENIO",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
export default async function Page({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  return <TenantPortal token={(await params).token} />;
}
