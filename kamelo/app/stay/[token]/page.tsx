import { StayPortal } from "@/components/stay-portal";
export const metadata = {
  title: "Layanan Penghuni | Kamelo by ELENIO",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
export default async function Page({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <StayPortal token={token} />;
}
