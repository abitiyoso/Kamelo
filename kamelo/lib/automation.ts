import { randomUUID } from "node:crypto";
import { Prisma } from "@/generated/prisma";
import { billingDate } from "./domain.mjs";
import { plans } from "./plans";
import { syncRoomAccess } from "./smart-access";
import { localToday } from "./operations";

// Caller holds the organization lock. Running twice cannot issue duplicate periods.
export async function runPropertyOperations(
  tx: Prisma.TransactionClient,
  propertyId: string,
  today = localToday(),
) {
  const property = await tx.property.findUniqueOrThrow({
    where: { id: propertyId },
    include: {
      organization: true,
      rooms: { include: { stays: true, devices: true } },
    },
  });
  const org = property.organization;
  const effective =
    org.subscriptionStatus === "ACTIVE" &&
    (!org.planExpiresAt || org.planExpiresAt > new Date())
      ? org.plan
      : "free";
  const recurring = Boolean(plans.find((p) => p.id === effective)?.recurring);
  let issued = 0;
  for (const room of property.rooms) {
    if (room.devices.some((d) => d.kind === "LOCK" && d.provider === "MOCK"))
      await syncRoomAccess(tx, room.id, today, "operations-worker", org.id);
    if (!property.billingAutomation || property.type !== "KOS" || !recurring)
      continue;
    const period = today.slice(0, 7),
      [year, month] = period.split("-").map(Number);
    for (const stay of room.stays) {
      const due = billingDate(year, month, stay.billingDay);
      if (
        stay.status !== "ACTIVE" ||
        due > today ||
        due < stay.start ||
        (stay.end && due >= stay.end)
      )
        continue;
      if (
        await tx.invoice.findUnique({
          where: { stayId_period: { stayId: stay.id, period } },
        })
      )
        continue;
      const invoice = await tx.invoice.create({
        data: {
          propertyId,
          roomId: room.id,
          guestId: stay.guestId,
          stayId: stay.id,
          number: "KH-" + randomUUID().slice(0, 12).toUpperCase(),
          date: today,
          due,
          period,
          total: stay.rate,
          items: [{ label: "Sewa kamar " + period, amount: stay.rate }],
          status: "UNPAID",
        },
      });
      await tx.audit.create({
        data: {
          organizationId: org.id,
          actorId: "operations-worker",
          action: "RECURRING_INVOICE_ISSUED",
          targetId: invoice.id,
          metadata: { period, total: stay.rate },
        },
      });
      issued++;
    }
  }
  await tx.property.update({
    where: { id: propertyId },
    data: { operationsLastRunAt: new Date() },
  });
  return { issued };
}
