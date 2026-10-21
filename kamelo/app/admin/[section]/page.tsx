import { AdminPage } from "@/components/workspace/admin-server";
import { notFound } from "next/navigation";
export default async function Page({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const section = (await params).section;
  if (
    ![
      "organizations",
      "subscriptions",
      "support",
      "integrations",
      "account",
    ].includes(section)
  )
    notFound();
  return <AdminPage initialPage={section} />;
}
