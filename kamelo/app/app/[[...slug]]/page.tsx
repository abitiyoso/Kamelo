import { Portal } from "@/components/portal";
import { currentUser } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { workspacePageAllowed } from "@/lib/workspace/navigation";
export const dynamic = "force-dynamic";
export default async function Page({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const { slug = [] } = await params;
  const page = ["guests", "bookings"].includes(slug[0])
    ? "rooms"
    : slug[0] || "dashboard";
  if (
    slug.length > 2 ||
    (slug.length === 2 && !["rooms", "billing"].includes(page)) ||
    !["OWNER", "STAFF"].includes(user.role) ||
    !(
      workspacePageAllowed(user.role === "OWNER" ? "owner" : "staff", page) ||
      (user.role === "STAFF" &&
        ((page === "billing" && user.canRecordPayments) ||
          (page === "iot" && user.canControlDevices)))
    )
  )
    notFound();
  return <Portal initialRole={user.role} />;
}
