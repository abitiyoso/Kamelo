import { Prisma } from "@/generated/prisma";
import { z } from "zod";
import { lifecycleDate, lifecycleAudit } from "./lifecycle";
import { localToday } from "./operations";
import { encryptSecret, decryptSecret } from "./secrets";
type Tx = Prisma.TransactionClient;
export async function openingSummary(tx: Tx, ids: string[]) {
  if (!ids.length) return { total: 0, overdue: 0, count: 0 };
  const [r] = await tx.$queryRaw<
    { total: bigint; overdue: bigint; count: bigint }[]
  >(
    Prisma.sql`SELECT COALESCE(SUM(balance),0)::bigint AS total,COALESCE(SUM(balance) FILTER(WHERE due<${localToday()}),0)::bigint AS overdue,COUNT(*) FILTER(WHERE balance>0)::bigint AS count FROM (SELECT r.id,r.due,r.amount-COALESCE(SUM(e.delta),0) AS balance FROM "OpeningReceivable" r JOIN "OpeningBalanceBatch" b ON b.id=r."batchId" LEFT JOIN "OpeningReceipt" e ON e."receivableId"=r.id WHERE r."propertyId" IN (${Prisma.join(ids)}) AND r.status='OPEN' AND b.status='OPEN' GROUP BY r.id) s`,
  );
  const result = {
    total: Number(r.total),
    overdue: Number(r.overdue),
    count: Number(r.count),
  };
  if (!Object.values(result).every(Number.isSafeInteger))
    throw Error("Ringkasan nominal melewati batas angka aman.");
  return result;
}
export async function openingReceiptDetail(
  tx: Tx,
  ids: string[],
  id: string,
  page: number,
) {
  const row = await tx.openingReceivable.findFirst({
    where: { id, propertyId: { in: ids } },
    select: {
      id: true,
      reference: true,
      amount: true,
      due: true,
      status: true,
      guest: { select: { name: true } },
      batch: { select: { asOf: true, status: true } },
    },
  });
  if (!row) throw Error("Saldo awal tidak ditemukan.");
  const paid =
    (
      await tx.openingReceipt.aggregate({
        where: { receivableId: id },
        _sum: { delta: true },
      })
    )._sum.delta || 0;
  const entries = await tx.openingReceipt.findMany({
    where: { receivableId: id },
    select: {
      id: true,
      kind: true,
      delta: true,
      date: true,
      method: true,
      reference: true,
      encryptedNote: true,
      reversal: { select: { id: true } },
      matches: { where: { revokedAt: null }, select: { id: true } },
      refundOfId: true,
      refunds: { select: { delta: true, reversal: { select: { id: true } } } },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 20,
    skip: (page - 1) * 20,
  });
  return {
    ...row,
    paid,
    remaining: row.amount - paid,
    page,
    totalEntries: await tx.openingReceipt.count({
      where: { receivableId: id },
    }),
    entries: entries.map(({ encryptedNote, ...r }) => ({
      ...r,
      note: decryptSecret(encryptedNote),
    })),
  };
}
export async function openingReceiptWrite(
  tx: Tx,
  a: { userId: string; organizationId: string },
  body: Record<string, unknown>,
) {
  const p = z
    .object({
      receivableId: z.string().min(1).max(100),
      note: z.string().trim().min(10).max(1000),
      confirmed: z.literal(true),
    })
    .parse(body);
  const r = await tx.openingReceivable.findFirst({
    where: {
      id: p.receivableId,
      status: "OPEN",
      property: { organizationId: a.organizationId },
      batch: { status: "OPEN" },
    },
    include: { batch: true },
  });
  if (!r) throw Error("Saldo awal tidak ditemukan atau dibatalkan.");
  let data;
  if (body.action === "receipt") {
    const v = z
      .object({
        amount: z.number().int().min(1).max(1000000000),
        date: lifecycleDate,
        method: z.enum(["TRANSFER", "CASH", "QRIS", "OTHER"]),
        reference: z.string().trim().min(3).max(100),
      })
      .parse(body);
    if (v.date < r.batch.asOf || v.date > localToday())
      throw Error(
        "Tanggal penerimaan harus sejak tanggal saldo awal sampai hari ini.",
      );
    const paid =
      (
        await tx.openingReceipt.aggregate({
          where: { receivableId: r.id },
          _sum: { delta: true },
        })
      )._sum.delta || 0;
    if (v.amount > r.amount - paid)
      throw Error("Nominal melebihi sisa piutang.");
    if (
      await tx.openingReceipt.count({
        where: {
          receivableId: r.id,
          kind: "RECEIPT",
          reference: { equals: v.reference, mode: "insensitive" },
        },
      })
    )
      throw Error(
        "Referensi penerimaan sudah digunakan pada saldo ini, termasuk catatan yang dikoreksi.",
      );
    data = {
      kind: "RECEIPT",
      delta: v.amount,
      date: v.date,
      method: v.method,
      reference: v.reference,
    };
  } else if (body.action === "refundReceipt") {
    const v = z
      .object({
        entryId: z.string().min(1).max(100),
        amount: z.number().int().min(1).max(1000000000),
        date: lifecycleDate,
        method: z.enum(["TRANSFER", "CASH", "QRIS", "OTHER"]),
        reference: z.string().trim().min(3).max(100),
      })
      .parse(body);
    const original = await tx.openingReceipt.findFirst({
      where: {
        id: v.entryId,
        receivableId: r.id,
        kind: "RECEIPT",
        reversal: null,
      },
      include: { refunds: { include: { reversal: true } } },
    });
    if (!original) throw Error("Penerimaan asal tidak tersedia.");
    const refunded = original.refunds
      .filter((e) => !e.reversal)
      .reduce((s, e) => s - e.delta, 0);
    if (v.amount > original.delta - refunded)
      throw Error("Refund melebihi dana penerimaan asal yang masih tersedia.");
    if (v.date < original.date || v.date > localToday())
      throw Error(
        "Tanggal refund harus sejak penerimaan asal sampai hari ini.",
      );
    if (
      await tx.openingReceipt.count({
        where: {
          receivableId: r.id,
          kind: "REFUND",
          reference: { equals: v.reference, mode: "insensitive" },
        },
      })
    )
      throw Error(
        "Referensi refund sudah digunakan, termasuk catatan yang dikoreksi.",
      );
    data = {
      kind: "REFUND",
      delta: -v.amount,
      date: v.date,
      method: v.method,
      reference: v.reference,
      refundOfId: original.id,
    };
  } else {
    const original = await tx.openingReceipt.findFirst({
      where: {
        id: z.string().min(1).max(100).parse(body.entryId),
        receivableId: r.id,
        kind: { in: ["RECEIPT", "REFUND"] },
        reversal: null,
        matches: { none: { revokedAt: null } },
      },
      include: { refunds: { include: { reversal: true } } },
    });
    if (!original)
      throw Error(
        "Penerimaan sudah dikoreksi atau masih dicocokkan dengan bank. Batalkan pencocokan terlebih dahulu.",
      );
    if (
      original.kind === "RECEIPT" &&
      original.refunds.some((e) => !e.reversal)
    )
      throw Error(
        "Koreksi refund terkait terlebih dahulu sebelum membalik penerimaan asal.",
      );
    data = {
      kind: "REVERSAL",
      delta: -original.delta,
      date: original.date,
      method: original.method,
      reference: original.reference,
      reversesId: original.id,
    };
  }
  const entry = await tx.openingReceipt.create({
    data: {
      ...data,
      receivableId: r.id,
      encryptedNote: encryptSecret(p.note),
      actorId: a.userId,
    },
  });
  await lifecycleAudit(
    tx,
    a.organizationId,
    a.userId,
    "OPENING_" + data.kind,
    entry.id,
    { receivableId: r.id, amount: Math.abs(data.delta) },
  );
  return { id: entry.id, receivableId: r.id };
}
