import { Prisma } from "@/generated/prisma";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { encryptSecret, decryptSecret } from "./secrets";
import { stableHash } from "./lifecycle-rules.mjs";
import { lifecycleAudit, lifecycleDate } from "./lifecycle";
import { localToday } from "./operations";
import { openingTenantActor } from "./opening-tenant";
import { importActor } from "./room-import";
type Tx = Prisma.TransactionClient;
export async function documentActor(tx: Tx, token: string) {
  const s = await tx.session.findUnique({
    where: { token },
    select: { contextType: true },
  });
  if (s?.contextType === "STAY") {
    const a = await openingTenantActor(tx, token);
    return { kind: "TENANT" as const, ...a };
  }
  return { kind: "OWNER" as const, ...(await importActor(tx, token)) };
}
type Actor = Awaited<ReturnType<typeof documentActor>>;
export async function documentSource(
  tx: Tx,
  organizationId: string,
  source: string,
  id: string,
) {
  let property,
    guest,
    room,
    sourceReference,
    amount,
    date,
    method,
    reference,
    corrected = false,
    refunded = 0,
    stayId = "",
    receivableId = "";
  if (source === "INVOICE") {
    const p = await tx.payment.findFirst({
      where: { id, invoice: { property: { organizationId } } },
      include: {
        invoice: {
          include: {
            property: { include: { organization: true } },
            guest: true,
            room: true,
          },
        },
      },
    });
    if (!p) throw Error("Penerimaan tidak ditemukan.");
    property = p.invoice.property;
    guest = p.invoice.guest;
    room = p.invoice.room;
    sourceReference = p.invoice.number;
    amount = p.amount;
    date = p.date;
    method = p.method;
    reference = p.reference;
    corrected = ["DRAFT", "VOID"].includes(p.invoice.status);
    stayId = p.invoice.stayId;
  } else {
    const p = await tx.openingReceipt.findFirst({
      where: {
        id,
        kind: "RECEIPT",
        receivable: { property: { organizationId } },
      },
      include: {
        reversal: true,
        refunds: { include: { reversal: true } },
        receivable: {
          include: {
            property: { include: { organization: true } },
            guest: true,
          },
        },
      },
    });
    if (!p) throw Error("Penerimaan tidak ditemukan.");
    property = p.receivable.property;
    guest = p.receivable.guest;
    sourceReference = p.receivable.reference;
    amount = p.delta;
    date = p.date;
    method = p.method;
    reference = p.reference;
    corrected = !!p.reversal;
    refunded = p.refunds
      .filter((r) => !r.reversal)
      .reduce((s, r) => s - r.delta, 0);
    receivableId = p.receivableId;
  }
  const snapshot = {
    version: 1,
    propertyId: property.id,
    organization: property.organization.name,
    property: property.name,
    city: property.city,
    guest: guest.name,
    room: room?.number || "",
    source,
    sourceReference,
    amount,
    date,
    method,
    reference,
  };
  const state = {
    corrected,
    refunded,
    retained: corrected ? 0 : amount - refunded,
    status: corrected
      ? "CORRECTED"
      : refunded === amount
        ? "REFUNDED"
        : refunded
          ? "PARTIALLY_REFUNDED"
          : "ACTIVE",
  };
  return {
    snapshot,
    state,
    stayId,
    receivableId,
    digest: stableHash({ snapshot, state }),
  };
}
async function visible(
  tx: Tx,
  a: Actor,
  doc: {
    propertyId: string;
    paymentId: string | null;
    openingReceiptId: string | null;
  },
) {
  const source = await documentSource(
    tx,
    a.organizationId,
    doc.paymentId ? "INVOICE" : "OPENING",
    doc.paymentId || doc.openingReceiptId!,
  );
  if (a.kind === "TENANT") {
    if (doc.propertyId !== a.grant.stay.room.propertyId)
      throw Error("Kuitansi tidak tersedia.");
    if (doc.paymentId) {
      if (source.stayId !== a.grant.stayId)
        throw Error("Kuitansi tidak tersedia.");
    } else if (
      !(await tx.openingShare.findFirst({
        where: {
          receivableId: source.receivableId,
          userId: a.userId,
          grantId: a.grant.id,
          stayId: a.grant.stayId,
          revokedAt: null,
          receivable: {
            propertyId: doc.propertyId,
            guestId: a.grant.stay.guestId,
          },
        },
      }))
    )
      throw Error("Kuitansi tidak tersedia.");
  }
  return source;
}
export async function documentDetail(
  tx: Tx,
  a: Actor,
  id: string,
  reviewPage = 0,
) {
  const doc = await tx.financialDocument.findFirst({
    where: { id, property: { organizationId: a.organizationId } },
  });
  if (!doc) throw Error("Kuitansi tidak tersedia.");
  const source = await visible(tx, a, doc),
    snapshot = JSON.parse(decryptSecret(doc.encryptedSnapshot));
  if (stableHash(snapshot) !== doc.snapshotHash)
    throw Error("Integritas arsip tidak sesuai.");
  const review =
    a.kind === "OWNER"
      ? await tx.financialDocumentReview.findFirst({
          where: { documentId: id },
          orderBy: { revision: "desc" },
          select: {
            revision: true,
            action: true,
            reviewOn: true,
            encryptedNote: true,
            createdAt: true,
          },
        })
      : null;
  const reviewHistory =
    a.kind === "OWNER" && reviewPage > 0
      ? {
          page: reviewPage,
          total: await tx.financialDocumentReview.count({
            where: { documentId: id },
          }),
          rows: (
            await tx.financialDocumentReview.findMany({
              where: { documentId: id },
              orderBy: { revision: "desc" },
              take: 20,
              skip: (reviewPage - 1) * 20,
              select: {
                revision: true,
                action: true,
                reviewOn: true,
                encryptedNote: true,
                createdAt: true,
              },
            })
          ).map(({ encryptedNote, ...r }) => ({
            ...r,
            note: decryptSecret(encryptedNote),
          })),
        }
      : null;
  return {
    id: doc.id,
    number: doc.number,
    issuedAt: doc.issuedAt,
    snapshotHash: doc.snapshotHash,
    snapshot,
    state: source.state,
    reviewHistory,
    review: review
      ? {
          revision: review.revision,
          action: review.action,
          reviewOn: review.reviewOn,
          note: decryptSecret(review.encryptedNote),
          createdAt: review.createdAt,
        }
      : null,
  };
}
export async function documentRead(
  tx: Tx,
  a: Actor,
  propertyId: string,
  page: number,
) {
  const where: Prisma.FinancialDocumentWhereInput = {
    property: { organizationId: a.organizationId },
  };
  if (a.kind === "OWNER") {
    if (
      propertyId !== "all" &&
      !(await tx.property.findFirst({
        where: { id: propertyId, organizationId: a.organizationId },
      }))
    )
      throw Error("Properti tidak ditemukan.");
    if (propertyId !== "all") where.propertyId = propertyId;
  } else {
    where.propertyId = a.grant.stay.room.propertyId;
    where.OR = [
      {
        payment: {
          invoice: { stayId: a.grant.stayId, guestId: a.grant.stay.guestId },
        },
      },
      {
        openingReceipt: {
          receivable: {
            guestId: a.grant.stay.guestId,
            shares: {
              some: {
                userId: a.userId,
                grantId: a.grant.id,
                stayId: a.grant.stayId,
                revokedAt: null,
              },
            },
          },
        },
      },
    ];
  }
  const docs = await tx.financialDocument.findMany({
    where,
    select: { id: true },
    orderBy: [{ issuedAt: "desc" }, { id: "desc" }],
    take: 20,
    skip: (page - 1) * 20,
  });
  const rows = [];
  for (const doc of docs) rows.push(await documentDetail(tx, a, doc.id));
  let candidates: any[] = [];
  if (a.kind === "OWNER") {
    const scope =
      propertyId === "all" ? Prisma.empty : Prisma.sql`AND pr.id=${propertyId}`;
    const raw = await tx.$queryRaw<
      { source: string; id: string }[]
    >(Prisma.sql`SELECT * FROM (
 SELECT 'INVOICE'::text AS source,p.id,p.date FROM "Payment" p JOIN "Invoice" i ON i.id=p."invoiceId" JOIN "Property" pr ON pr.id=i."propertyId" WHERE pr."organizationId"=${a.organizationId} ${scope} AND i.status NOT IN ('DRAFT','VOID') AND p.date<=${localToday()} AND NOT EXISTS(SELECT 1 FROM "FinancialDocument" d WHERE d."paymentId"=p.id)
 UNION ALL SELECT 'OPENING',p.id,p.date FROM "OpeningReceipt" p JOIN "OpeningReceivable" r ON r.id=p."receivableId" JOIN "Property" pr ON pr.id=r."propertyId" WHERE pr."organizationId"=${a.organizationId} ${scope} AND p.kind='RECEIPT' AND p.date<=${localToday()} AND NOT EXISTS(SELECT 1 FROM "OpeningReceipt" rev WHERE rev."reversesId"=p.id) AND p.delta>COALESCE((SELECT -SUM(f.delta) FROM "OpeningReceipt" f WHERE f."refundOfId"=p.id AND NOT EXISTS(SELECT 1 FROM "OpeningReceipt" rev WHERE rev."reversesId"=f.id)),0) AND NOT EXISTS(SELECT 1 FROM "FinancialDocument" d WHERE d."openingReceiptId"=p.id)) s ORDER BY date,id LIMIT 20`);
    for (const r of raw) {
      const s = await documentSource(tx, a.organizationId, r.source, r.id);
      candidates.push({ source: r.source, id: r.id, ...s });
    }
  }
  return {
    rows,
    total: await tx.financialDocument.count({ where }),
    page,
    candidates,
  };
}
export async function documentWrite(
  tx: Tx,
  a: Actor,
  body: Record<string, unknown>,
) {
  if (a.kind !== "OWNER" || body.confirmed !== true)
    throw Error("Owner harus meninjau dan mengonfirmasi.");
  if (body.action === "issue") {
    const p = z
      .object({
        source: z.enum(["INVOICE", "OPENING"]),
        entryId: z.string().min(1).max(100),
        digest: z.string().length(64),
      })
      .parse(body);
    const source = await documentSource(
      tx,
      a.organizationId,
      p.source,
      p.entryId,
    );
    const old = await tx.financialDocument.findFirst({
      where:
        p.source === "INVOICE"
          ? { paymentId: p.entryId }
          : { openingReceiptId: p.entryId },
    });
    if (old) return { id: old.id, number: old.number };
    if (
      source.state.corrected ||
      source.state.retained <= 0 ||
      source.snapshot.date > localToday()
    )
      throw Error("Penerimaan tidak aktif untuk penerbitan kuitansi.");
    if (source.digest !== p.digest)
      throw Error("Penerimaan berubah. Tinjau ulang calon kuitansi.");
    const number =
      "KML-" +
      localToday().slice(0, 4) +
      "-" +
      randomUUID().replaceAll("-", "").slice(0, 16).toUpperCase();
    const doc = await tx.financialDocument.create({
      data: {
        propertyId: source.snapshot.propertyId,
        ...(p.source === "INVOICE"
          ? { paymentId: p.entryId }
          : { openingReceiptId: p.entryId }),
        number,
        encryptedSnapshot: encryptSecret(JSON.stringify(source.snapshot)),
        snapshotHash: stableHash(source.snapshot),
        actorId: a.userId,
      },
    });
    await tx.financialDocumentReview.create({
      data: {
        documentId: doc.id,
        revision: 1,
        action: "KEEP",
        encryptedNote: encryptSecret(
          "Arsip dipertahankan. Jadwal tinjau mengikuti kebijakan bisnis yang disetujui.",
        ),
        actorId: a.userId,
      },
    });
    await lifecycleAudit(
      tx,
      a.organizationId,
      a.userId,
      "RECEIPT_DOCUMENT_ISSUED",
      doc.id,
      { number, source: p.source },
    );
    return { id: doc.id, number };
  }
  const p = z
    .object({
      documentId: z.string().min(1).max(100),
      revision: z.number().int().min(1),
      retentionAction: z.enum(["KEEP", "HOLD", "REVIEW"]),
      reviewOn: lifecycleDate.nullable(),
      note: z.string().trim().min(10).max(1000),
    })
    .parse(body);
  const doc = await documentDetail(tx, a, p.documentId);
  if (doc.review?.revision !== p.revision)
    throw Error("Peninjauan berubah. Muat ulang arsip.");
  if (p.retentionAction === "REVIEW" && !p.reviewOn)
    throw Error("Tanggal tinjau wajib diisi.");
  const review = await tx.financialDocumentReview.create({
    data: {
      documentId: p.documentId,
      revision: p.revision + 1,
      action: p.retentionAction,
      reviewOn: p.reviewOn,
      encryptedNote: encryptSecret(p.note),
      actorId: a.userId,
    },
  });
  await lifecycleAudit(
    tx,
    a.organizationId,
    a.userId,
    "DOCUMENT_RETENTION_REVIEW",
    doc.id,
    { action: p.retentionAction, revision: review.revision },
  );
  return { id: doc.id, revision: review.revision };
}
