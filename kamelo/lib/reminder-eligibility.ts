import { Prisma } from "@/generated/prisma";
import { createHash } from "node:crypto";
import { reminderClock, reminderDueLimit } from "./reminder-clock.mjs";
type Tx = Prisma.TransactionClient;
export const recipientHash = (email: string) =>
  createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
export async function activeReminderPolicy(tx: Tx, propertyId: string) {
  const policy = await tx.reminderPolicy.findUnique({
    where: { propertyId },
    include: { property: true },
  });
  if (!policy?.enabled) return null;
  const owner = await tx.orgMembership.findFirst({
    where: {
      organizationId: policy.property.organizationId,
      userId: policy.actorId,
      role: "OWNER",
      status: "ACTIVE",
      revokedAt: null,
      user: { accountStatus: { notIn: ["PENDING", "SUSPENDED", "CLOSED"] } },
    },
  });
  return owner ? policy : null;
}
// One canonical, current source query is shared by scheduling and dispatch validation.
export async function reminderSources(
  tx: Tx,
  propertyId: string,
  limitDue: string,
  filter?: {
    invoiceId: string | null;
    receivableId: string | null;
    grantId: string;
  },
) {
  const invoiceFilter = filter
    ? Prisma.sql`AND i.id=${filter.invoiceId || ""} AND a.id=${filter.grantId}`
    : Prisma.empty;
  const openingFilter = filter
    ? Prisma.sql`AND r.id=${filter.receivableId || ""} AND a.id=${filter.grantId}`
    : Prisma.empty;
  return Prisma.sql`
    SELECT 'INVOICE'::text AS source,i.id,i."propertyId",i.number AS reference,i.due,(i.total-COALESCE(p.paid,0))::bigint AS amount,a.id AS "grantId",a."userId",NULL::text AS "shareId",u.email
    FROM "Invoice" i JOIN "Stay" s ON s.id=i."stayId" JOIN "Room" room ON room.id=s."roomId"
    JOIN "OccupantAccess" a ON a."stayId"=s.id JOIN "User" u ON u.id=a."userId"
    LEFT JOIN (SELECT "invoiceId",SUM(amount) AS paid FROM "Payment" GROUP BY "invoiceId") p ON p."invoiceId"=i.id
    WHERE i."propertyId"=${propertyId} AND room."propertyId"=i."propertyId" AND s."guestId"=i."guestId" AND i.status NOT IN ('DRAFT','VOID') AND i.date<=${reminderClock().today} AND i.due<=${limitDue} AND i.total>COALESCE(p.paid,0)
    AND a.status='ACTIVE' AND a."revokedAt" IS NULL AND a."canViewBilling" AND u."emailVerifiedAt" IS NOT NULL AND u."accountStatus" NOT IN ('PENDING','SUSPENDED','CLOSED')
    AND NOT EXISTS(SELECT 1 FROM "PaymentProof" b WHERE b."invoiceId"=i.id AND b.status='PENDING') ${invoiceFilter}
    UNION ALL
    SELECT 'OPENING',r.id,r."propertyId",r.reference,r.due,(r.amount-COALESCE(p.paid,0))::bigint,a.id,a."userId",sh.id,u.email
    FROM "OpeningReceivable" r JOIN "OpeningBalanceBatch" batch ON batch.id=r."batchId"
    JOIN "OpeningShare" sh ON sh."receivableId"=r.id JOIN "OccupantAccess" a ON a.id=sh."grantId" AND a."userId"=sh."userId" AND a."stayId"=sh."stayId"
    JOIN "Stay" s ON s.id=a."stayId" AND s."guestId"=r."guestId" JOIN "Room" room ON room.id=s."roomId" AND room."propertyId"=r."propertyId" JOIN "User" u ON u.id=a."userId"
    LEFT JOIN (SELECT "receivableId",SUM(delta) AS paid FROM "OpeningReceipt" GROUP BY "receivableId") p ON p."receivableId"=r.id
    WHERE r."propertyId"=${propertyId} AND r.status='OPEN' AND batch.status='OPEN' AND batch."asOf"<=${reminderClock().today} AND r.due<=${limitDue} AND r.amount>COALESCE(p.paid,0) AND sh."revokedAt" IS NULL
    AND a.status='ACTIVE' AND a."revokedAt" IS NULL AND a."canViewBilling" AND u."emailVerifiedAt" IS NOT NULL AND u."accountStatus" NOT IN ('PENDING','SUSPENDED','CLOSED')
    AND NOT EXISTS(SELECT 1 FROM "OpeningProof" b WHERE b."receivableId"=r.id AND b.status='PENDING') ${openingFilter}`;
}
export type ReminderSource = {
  source: string;
  id: string;
  propertyId: string;
  reference: string;
  due: string;
  amount: bigint;
  grantId: string;
  userId: string;
  shareId: string | null;
  email: string;
};
export async function reminderEmailGuard(tx: Tx, outboxId: string) {
  const delivery = await tx.reminderDelivery.findUnique({
    where: { emailOutboxId: outboxId },
    include: { emailOutbox: { select: { expiresAt: true } } },
  });
  if (!delivery) return null; // Other transactional templates retain their established behavior.
  const policy = await activeReminderPolicy(tx, delivery.propertyId),
    clock = reminderClock();
  let reason = "";
  if (delivery.status !== "QUEUED") reason = "REMINDER_CANCELLED";
  else if (!policy?.emailEnabled || policy.revision !== delivery.policyRevision)
    reason = "REMINDER_POLICY_CHANGED";
  else if (
    clock.today !== delivery.scheduledOn ||
    (delivery.emailOutbox?.expiresAt &&
      delivery.emailOutbox.expiresAt <= new Date())
  )
    reason = "REMINDER_EXPIRED";
  else {
    const rows = await tx.$queryRaw<ReminderSource[]>(
      await reminderSources(
        tx,
        delivery.propertyId,
        reminderDueLimit(clock.today, policy.leadDays),
        delivery,
      ),
    );
    const row = rows.find(
      (r) => r.userId === delivery.userId && r.shareId === delivery.shareId,
    );
    if (
      !row ||
      Number(row.amount) !== delivery.amount ||
      row.due !== delivery.due ||
      row.reference !== delivery.reference ||
      recipientHash(row.email) !== delivery.emailHash
    )
      reason = "REMINDER_SOURCE_CHANGED";
  }
  if (reason && delivery.status === "QUEUED")
    await tx.reminderDelivery.update({
      where: { id: delivery.id },
      data: { status: "CANCELLED", reason },
    });
  return reason;
}
