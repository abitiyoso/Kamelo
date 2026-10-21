import { redirect } from "next/navigation";
import { sessionIdentity } from "@/lib/auth";
import { occupantForSession, verified } from "@/lib/identity";
import { ResidentPortal } from "@/components/identity/resident-portal";
export default async function ResidentPage() {
  const s = await sessionIdentity();
  if (!s) redirect("/login");
  if (!verified(s.user)) redirect("/verify-email");
  if (!(await occupantForSession())) redirect("/workspaces");
  return <ResidentPortal />;
}
