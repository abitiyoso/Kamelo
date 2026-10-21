import { Prisma } from "@/generated/prisma";
import { z } from "zod";
import { readOpeningCsv } from "./opening-balances-csv.mjs";
import { lifecycleDate, lifecycleAudit } from "./lifecycle";
import { localToday } from "./operations";
import { stableHash } from "./lifecycle-rules.mjs";
import { encryptSecret } from "./secrets";
type Tx = Prisma.TransactionClient;
const input = z.object({
  propertyId: z.string().min(1).max(100),
  csv: z.string().max(100000),
  asOf: lifecycleDate,
  sourceNote: z.string().trim().min(10).max(1000),
  mapping: z.object({
    name: z.number().int(),
    phone: z.number().int(),
    reference: z.number().int(),
    amount: z.number().int(),
    due: z.number().int(),
  }),
  choices: z.record(z.string(), z.string().max(100)).default({}),
});
export async function openingPreview(
  tx: Tx,
  organizationId: string,
  body: unknown,
) {
  const p = input.parse(body);
  if (p.asOf < "1900-01-01" || p.asOf > localToday())
    throw Error(
      "Tanggal saldo awal tidak boleh di masa depan atau sebelum 1900.",
    );
  if (
    !(await tx.property.count({ where: { id: p.propertyId, organizationId } }))
  )
    throw Error("Properti tidak ditemukan.");
  const parsed = readOpeningCsv(p.csv, p.mapping),
    keys = parsed.rows.map((r) => r.sourceKey);
  const invoices = await tx.$queryRaw<{ key: string }[]>(
    Prisma.sql`SELECT upper(regexp_replace(btrim(number),' +',' ','g')) AS key FROM "Invoice" WHERE "propertyId"=${p.propertyId} AND upper(regexp_replace(btrim(number),' +',' ','g')) IN (${Prisma.join(keys)})`,
  );
  const current = await tx.openingReceivable.findMany({
    where: {
      propertyId: p.propertyId,
      status: "OPEN",
      sourceKey: { in: keys },
    },
    select: { sourceKey: true },
  });
  const seen = new Set([
      ...invoices.map((r) => r.key),
      ...current.map((r) => r.sourceKey),
    ]),
    rows = [];
  for (const r of parsed.rows) {
    const phone = r.phone.replace(/^\+62/, ""),
      candidates = await tx.guest.findMany({
        where: {
          propertyId: p.propertyId,
          OR: [
            {
              phone: {
                in: r.phone ? [r.phone, "62" + phone, "0" + phone] : [],
              },
            },
            { name: { equals: r.name, mode: "insensitive" } },
          ],
        },
        select: { id: true, name: true, phone: true },
        orderBy: { id: "asc" },
        take: 21,
      });
    const guestId = p.choices[String(r.line)] || "",
      errors = [...r.errors];
    if (!candidates.length)
      errors.push(
        "Profil belum ditemukan. Tambahkan/tinjau penghuni lebih dahulu.",
      );
    if (candidates.length > 20)
      errors.push("Profil terlalu banyak. Tinjau identitas secara manual.");
    if (!candidates.some((g) => g.id === guestId))
      errors.push("Pilih profil penghuni secara eksplisit.");
    if (seen.has(r.sourceKey))
      errors.push(
        "Referensi sudah dipakai pada saldo awal aktif atau nomor tagihan Kamelo.",
      );
    rows.push({
      ...r,
      guestId,
      errors,
      candidates: candidates.slice(0, 20).map((g) => ({
        id: g.id,
        name: g.name,
        phone: "…" + g.phone.slice(-4),
      })),
    });
  }
  return {
    rows,
    total: rows.reduce((sum, r) => sum + r.amount, 0),
    valid: rows.every((r) => !r.errors.length),
    digest: stableHash({
      organizationId,
      propertyId: p.propertyId,
      asOf: p.asOf,
      sourceNote: p.sourceNote,
      rows,
    }),
  };
}
export async function openingWrite(
  tx: Tx,
  a: { userId: string; organizationId: string },
  body: Record<string, unknown>,
) {
  if (body.confirmed !== true)
    throw Error(
      "Konfirmasi sumber dan pemeriksaan saldo awal terlebih dahulu.",
    );
  if (body.action === "commit") {
    const p = input.parse(body),
      preview = await openingPreview(tx, a.organizationId, p);
    if (!preview.valid)
      throw Error(
        "Perbaiki profil, referensi, atau nominal sebelum menyimpan.",
      );
    if (body.digest !== preview.digest)
      throw Error("Data berubah. Pratinjau ulang saldo awal.");
    const batch = await tx.openingBalanceBatch.create({
      data: {
        propertyId: p.propertyId,
        asOf: p.asOf,
        recordCount: preview.rows.length,
        encryptedSourceNote: encryptSecret(p.sourceNote),
        actorId: a.userId,
      },
    });
    await tx.openingReceivable.createMany({
      data: preview.rows.map((r) => ({
        propertyId: p.propertyId,
        batchId: batch.id,
        guestId: r.guestId,
        reference: r.reference,
        sourceKey: r.sourceKey,
        amount: r.amount,
        due: r.due,
      })),
    });
    await lifecycleAudit(
      tx,
      a.organizationId,
      a.userId,
      "OPENING_RECEIVABLES_RECORDED",
      batch.id,
      { count: preview.rows.length, total: preview.total },
    );
    return { id: batch.id, count: preview.rows.length };
  }
  if (body.action !== "void")
    throw Error("Tindakan saldo awal tidak tersedia.");
  const batch = await tx.openingBalanceBatch.findFirst({
    where: {
      id: z.string().min(1).max(100).parse(body.batchId),
      status: "OPEN",
      property: { organizationId: a.organizationId },
    },
  });
  if (!batch) throw Error("Batch tidak ditemukan atau sudah dibatalkan.");
  if (
    await tx.openingProof.count({
      where: { receivable: { batchId: batch.id } },
    })
  )
    throw Error(
      "Batch memiliki riwayat bukti. Tinjau bukti tanpa membatalkan sumber saldo.",
    );
  if (
    await tx.openingReceipt.count({
      where: { receivable: { batchId: batch.id } },
    })
  )
    throw Error(
      "Batch memiliki riwayat penerimaan; tinjau atau koreksi penerimaan tanpa membatalkan sumber saldo.",
    );
  const reason = z.string().trim().min(10).max(1000).parse(body.reason);
  await tx.openingReceivable.updateMany({
    where: { batchId: batch.id, status: "OPEN" },
    data: { status: "VOID" },
  });
  await tx.openingBalanceBatch.update({
    where: { id: batch.id },
    data: {
      status: "VOID",
      voidedAt: new Date(),
      voidedBy: a.userId,
      encryptedVoidReason: encryptSecret(reason),
    },
  });
  await lifecycleAudit(
    tx,
    a.organizationId,
    a.userId,
    "OPENING_RECEIVABLES_VOIDED",
    batch.id,
    { count: batch.recordCount },
  );
  return { id: batch.id, count: batch.recordCount };
}
