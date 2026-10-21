import { Prisma } from "@/generated/prisma";
import { z } from "zod";
import { safeProofSelect, billingToolsAction } from "./tenant";
import { ownerOpeningEvidence, openingEvidenceWrite } from "./opening-tenant";
import { stableHash } from "./lifecycle-rules.mjs";
type Tx = Prisma.TransactionClient;
export const queueFilters = z.object({
  propertyId: z.string().min(1).max(100).default("all"),
  source: z.enum(["ALL", "INVOICE", "OPENING"]).default("ALL"),
  status: z.enum(["ALL", "PENDING", "APPROVED", "REJECTED"]).default("PENDING"),
  q: z.string().trim().max(100).default(""),
  page: z.coerce.number().int().min(1).max(100000).default(1),
  order: z.enum(["OLDEST", "NEWEST"]).default("OLDEST"),
});
export type QueueFilters = z.infer<typeof queueFilters>;
export async function proofQueueRead(
  tx: Tx,
  organizationId: string,
  f: QueueFilters,
) {
  const properties = await tx.property.findMany({
    where: { organizationId },
    select: { id: true, name: true },
    orderBy: [{ name: "asc" }, { id: "asc" }],
  });
  if (f.propertyId !== "all" && !properties.some((p) => p.id === f.propertyId))
    throw Error("Properti tidak ditemukan.");
  const sources = Prisma.sql`
 SELECT 'INVOICE'::text AS source,b.id,b."invoiceId" AS "parentId",b.amount,b.date,b.method,b.reference,b.status,b."uploadedAt",
 i."propertyId",p.name AS "propertyName",i.number AS "sourceReference",i.due,i.status AS "sourceStatus",g.name AS "guestName",r.number AS "roomNumber"
 FROM "PaymentProof" b JOIN "Invoice" i ON i.id=b."invoiceId" JOIN "Property" p ON p.id=i."propertyId" JOIN "Guest" g ON g.id=i."guestId" JOIN "Room" r ON r.id=i."roomId"
 WHERE p."organizationId"=${organizationId}
 UNION ALL
 SELECT 'OPENING'::text AS source,b.id,b."receivableId" AS "parentId",b.amount,b.date,b.method,b.reference,b.status,b."uploadedAt",
 a."propertyId",p.name AS "propertyName",a.reference AS "sourceReference",a.due,a.status AS "sourceStatus",g.name AS "guestName",r.number AS "roomNumber"
 FROM "OpeningProof" b JOIN "OpeningReceivable" a ON a.id=b."receivableId" JOIN "Property" p ON p.id=a."propertyId" JOIN "Guest" g ON g.id=a."guestId"
 JOIN "OpeningShare" s ON s.id=b."shareId" JOIN "Stay" t ON t.id=s."stayId" JOIN "Room" r ON r.id=t."roomId"
 WHERE p."organizationId"=${organizationId}`;
  const where = Prisma.sql`(${f.propertyId}='all' OR s."propertyId"=${f.propertyId}) AND (${f.source}='ALL' OR s.source=${f.source}) AND (${f.q}='' OR position(lower(${f.q}) in lower(concat_ws(' ',s.reference,s."sourceReference",s."guestName",s."roomNumber",s."propertyName")))>0)`;
  const summary = await tx.$queryRaw<any[]>(
    Prisma.sql`WITH s AS (${sources}) SELECT count(*)::int AS total, count(*) FILTER(WHERE status='PENDING' AND source='INVOICE')::int AS "pendingInvoice",count(*) FILTER(WHERE status='PENDING' AND source='OPENING')::int AS "pendingOpening",count(*) FILTER(WHERE status='APPROVED')::int AS approved,count(*) FILTER(WHERE status='REJECTED')::int AS rejected FROM s WHERE ${where}`,
  );
  const status = Prisma.sql`(${f.status}='ALL' OR s.status=${f.status})`;
  const direction = f.order === "OLDEST" ? Prisma.sql`ASC` : Prisma.sql`DESC`;
  const rows = await tx.$queryRaw<any[]>(
    Prisma.sql`WITH s AS (${sources}) SELECT * FROM s WHERE ${where} AND ${status} ORDER BY "uploadedAt" ${direction},source ASC,id ASC LIMIT 20 OFFSET ${(f.page - 1) * 20}`,
  );
  const counts = await tx.$queryRaw<{ total: number }[]>(
    Prisma.sql`WITH s AS (${sources}) SELECT count(*)::int AS total FROM s WHERE ${where} AND ${status}`,
  );
  return {
    properties,
    rows,
    total: counts[0].total,
    summary: summary[0],
    page: f.page,
    filters: f,
  };
}
export async function proofQueueDetail(
  tx: Tx,
  organizationId: string,
  source: "INVOICE" | "OPENING",
  id: string,
) {
  if (source === "INVOICE") {
    const p = await tx.paymentProof.findFirst({
      where: { id, invoice: { property: { organizationId } } },
      select: {
        ...safeProofSelect,
        invoice: {
          select: {
            id: true,
            number: true,
            total: true,
            due: true,
            status: true,
            propertyId: true,
            property: { select: { name: true } },
            guest: { select: { name: true } },
            room: { select: { number: true } },
            payments: { select: { amount: true } },
          },
        },
      },
    });
    if (!p) throw Error("Bukti tidak ditemukan.");
    const { invoice, ...proof } = p,
      paid = invoice.payments.reduce((s, p) => s + p.amount, 0);
    const parent = {
      id: invoice.id,
      reference: invoice.number,
      amount: invoice.total,
      paid,
      remaining: invoice.total - paid,
      due: invoice.due,
      status: invoice.status,
      propertyId: invoice.propertyId,
      propertyName: invoice.property.name,
      guestName: invoice.guest.name,
      roomNumber: invoice.room.number,
    };
    return {
      source,
      proof,
      parent,
      matchingReceipts: [],
      digest: stableHash({
        source,
        id,
        status: proof.status,
        amount: proof.amount,
        date: proof.date,
        method: proof.method,
        reference: proof.reference,
        parent,
      }),
    };
  }
  const p = await tx.openingProof.findFirst({
    where: { id, receivable: { property: { organizationId } } },
    select: {
      receivableId: true,
      share: {
        select: { stay: { select: { room: { select: { number: true } } } } },
      },
      receivable: {
        select: {
          id: true,
          reference: true,
          amount: true,
          due: true,
          status: true,
          propertyId: true,
          property: { select: { name: true } },
          guest: { select: { name: true } },
        },
      },
    },
  });
  if (!p) throw Error("Bukti tidak ditemukan.");
  const r = p.receivable,
    paid =
      (
        await tx.openingReceipt.aggregate({
          where: { receivableId: r.id },
          _sum: { delta: true },
        })
      )._sum.delta || 0;
  const e = await ownerOpeningEvidence(tx, [r.propertyId], r.id, 1, id),
    { matchingReceipts, ...proof } = e.review!;
  const parent = {
    id: r.id,
    reference: r.reference,
    amount: r.amount,
    paid,
    remaining: r.status === "VOID" ? 0 : r.amount - paid,
    due: r.due,
    status: r.status,
    propertyId: r.propertyId,
    propertyName: r.property.name,
    guestName: r.guest.name,
    roomNumber: p.share.stay.room.number,
  };
  return {
    source,
    proof,
    parent,
    matchingReceipts,
    digest: stableHash({
      source,
      id,
      status: proof.status,
      amount: proof.amount,
      date: proof.date,
      method: proof.method,
      reference: proof.reference,
      parent,
    }),
  };
}
export async function proofQueueWrite(
  tx: Tx,
  a: { organizationId: string; userId: string },
  body: Record<string, unknown>,
) {
  const b = z
    .object({
      source: z.enum(["INVOICE", "OPENING"]),
      proofId: z.string().min(1).max(100),
      decision: z.enum(["APPROVED", "REJECTED"]),
      note: z.string().trim().min(10).max(500),
      confirmed: z.literal(true),
      digest: z.string().length(64),
      existingReceiptId: z.string().max(100).default(""),
    })
    .parse(body);
  const d = await proofQueueDetail(tx, a.organizationId, b.source, b.proofId);
  if (d.proof.status !== "PENDING")
    throw Error("Bukti sudah diperiksa. Perbarui antrean.");
  if (d.digest !== b.digest)
    throw Error(
      "Saldo atau bukti berubah. Muat ulang rincian sebelum memutuskan.",
    );
  if (b.source === "OPENING")
    return openingEvidenceWrite(tx, a, {
      ...b,
      action: "reviewOpeningProof",
      receivableId: d.parent.id,
    });
  if (b.existingReceiptId)
    throw Error("Penautan penerimaan hanya tersedia untuk saldo awal.");
  const u = await tx.user.findUniqueOrThrow({ where: { id: a.userId } });
  return billingToolsAction(
    tx,
    { ...u, role: "OWNER", organizationId: a.organizationId },
    d.parent.propertyId,
    {
      action: "reviewProof",
      proofId: b.proofId,
      decision: b.decision === "APPROVED" ? "APPROVE" : "REJECT",
      reviewNote: b.note,
      confirmed: true,
    },
    "",
  );
}
