import { Prisma } from "@/generated/prisma";
type Tx = Prisma.TransactionClient;
export async function residentFinance(
  tx: Tx,
  a: {
    userId: string;
    grant: {
      id: string;
      stayId: string;
      stay: { guestId: string; room: { propertyId: string } };
    };
  },
  today: string,
) {
  const b = Prisma.sql`SELECT 'INVOICE'::text AS source,i.number AS reference,i.due,GREATEST(0,i.total-COALESCE(p.paid,0))::bigint AS remaining
 FROM "Invoice" i LEFT JOIN (SELECT "invoiceId",SUM(amount) AS paid FROM "Payment" WHERE date<=${today} GROUP BY "invoiceId") p ON p."invoiceId"=i.id
 WHERE i."stayId"=${a.grant.stayId} AND i.status NOT IN ('DRAFT','VOID') AND i.date<=${today}
 UNION ALL SELECT 'OPENING'::text AS source,r.reference,r.due,GREATEST(0,r.amount-COALESCE(p.paid,0))::bigint AS remaining
 FROM "OpeningShare" s JOIN "OpeningReceivable" r ON r.id=s."receivableId" JOIN "OpeningBalanceBatch" batch ON batch.id=r."batchId"
 LEFT JOIN (SELECT "receivableId",SUM(delta) AS paid FROM "OpeningReceipt" WHERE date<=${today} GROUP BY "receivableId") p ON p."receivableId"=r.id
 WHERE s."grantId"=${a.grant.id} AND s."userId"=${a.userId} AND s."stayId"=${a.grant.stayId} AND s."revokedAt" IS NULL AND r."guestId"=${a.grant.stay.guestId} AND r."propertyId"=${a.grant.stay.room.propertyId} AND r.status='OPEN' AND batch.status='OPEN' AND batch."asOf"<=${today}`;
  const sources = await tx.$queryRaw<
    { source: string; outstanding: bigint; overdue: bigint; count: number }[]
  >(
    Prisma.sql`WITH b AS (${b}) SELECT source,COALESCE(SUM(remaining),0)::bigint AS outstanding,COALESCE(SUM(remaining) FILTER(WHERE due<${today}),0)::bigint AS overdue,COUNT(*) FILTER(WHERE remaining>0)::int AS count FROM b GROUP BY source`,
  );
  const next = await tx.$queryRaw<
    { source: string; reference: string; due: string; remaining: bigint }[]
  >(
    Prisma.sql`WITH b AS (${b}) SELECT * FROM b WHERE remaining>0 ORDER BY due ASC,source ASC,reference ASC LIMIT 1`,
  );
  const invoice = Number(
      sources.find((s) => s.source === "INVOICE")?.outstanding || 0,
    ),
    opening = Number(
      sources.find((s) => s.source === "OPENING")?.outstanding || 0,
    ),
    overdue = sources.reduce((s, r) => s + Number(r.overdue), 0);
  if (
    ![invoice, opening, invoice + opening, overdue].every(Number.isSafeInteger)
  )
    throw Error("Ringkasan nominal melewati batas angka aman.");
  return {
    asOf: today,
    invoice,
    opening,
    outstanding: invoice + opening,
    overdue,
    next: next.length
      ? { ...next[0], remaining: Number(next[0].remaining) }
      : null,
  };
}
