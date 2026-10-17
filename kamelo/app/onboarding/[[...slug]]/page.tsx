import { Onboarding } from "@/components/onboarding";
import { currentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { plans } from "@/lib/plans";
export const dynamic = "force-dynamic";
export default async function Page() {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (user.role !== "OWNER") redirect("/app/dashboard");
  const effective =
    user.organization.subscriptionStatus === "ACTIVE" &&
    (!user.organization.planExpiresAt ||
      user.organization.planExpiresAt > new Date())
      ? user.organization.plan
      : "free";
  const plan = plans.find((p) => p.id === effective) ?? plans[0];
  const rooms = await db.room.count({
    where: { property: { organizationId: user.organizationId } },
  });
  const upgrade = await db.upgrade.findFirst({
    where: { organizationId: user.organizationId, status: "REQUESTED" },
    orderBy: { createdAt: "desc" },
  });
  return (
    <Onboarding
      roomLimit={plan.rooms}
      remainingRooms={Math.max(0, plan.rooms - rooms)}
      planName={plan.name}
      requestedPlanName={
        plans.find((p) => p.id === upgrade?.plan && p.id !== effective)?.name
      }
    />
  );
}
