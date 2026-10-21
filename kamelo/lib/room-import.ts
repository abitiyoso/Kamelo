import { Prisma } from "@/generated/prisma";
import { z } from "zod";
import { messageActor } from "./messages";
import { plans } from "./plans";
import { readRoomCsv } from "./room-import-csv.mjs";
import { stableHash } from "./lifecycle-rules.mjs";
import { lifecycleAudit } from "./lifecycle";
type Tx = Prisma.TransactionClient;
export async function importActor(tx: Tx, token: string) {
  const a = await messageActor(tx, token);
  if (a.role !== "OWNER") throw Error("Impor hanya tersedia untuk owner.");
  return a;
}
const input = z.object({
  propertyId: z.string().min(1).max(100),
  csv: z.string().max(100000),
  mapping: z.object({ number: z.number().int(), rate: z.number().int() }),
});
export async function roomImportPreview(
  tx: Tx,
  organizationId: string,
  body: unknown,
) {
  const p = input.parse(body);
  const property = await tx.property.findFirst({
    where: { id: p.propertyId, organizationId },
    select: { id: true },
  });
  if (!property) throw Error("Properti tidak ditemukan.");
  const parsed = readRoomCsv(p.csv, p.mapping);
  const existing = await tx.room.findMany({
    where: { propertyId: p.propertyId },
    select: { number: true },
  });
  const names = new Set(
    existing.map((r) => r.number.normalize("NFKC").toLocaleLowerCase("id-ID")),
  );
  const rows = parsed.rows.map((r) => ({
    ...r,
    errors: [
      ...r.errors,
      ...(names.has(r.number.normalize("NFKC").toLocaleLowerCase("id-ID"))
        ? ["Nomor kamar sudah ada. Ubah CSV; kamar lama tidak ditimpa."]
        : []),
    ],
  }));
  const org = await tx.organization.findUniqueOrThrow({
    where: { id: organizationId },
  });
  const plan =
    plans.find(
      (p) =>
        p.id ===
        (org.subscriptionStatus === "ACTIVE" &&
        (!org.planExpiresAt || org.planExpiresAt > new Date())
          ? org.plan
          : "free"),
    ) || plans[0];
  const count = await tx.room.count({
    where: { property: { organizationId } },
  });
  const capacityError =
    count + rows.length > plan.rooms
      ? `Batas paket ${plan.rooms} kamar, sudah terpakai ${count}.`
      : "";
  const digest = stableHash({
    organizationId,
    propertyId: p.propertyId,
    rows,
    capacityError,
    count,
    limit: plan.rooms,
  });
  return {
    headers: parsed.headers,
    rows,
    capacityError,
    digest,
    valid: !capacityError && rows.every((r) => !r.errors.length),
  };
}
export async function roomImportWrite(
  tx: Tx,
  a: { userId: string; organizationId: string },
  body: Record<string, unknown>,
) {
  if (body.confirmed !== true)
    throw Error("Konfirmasi hasil pratinjau terlebih dahulu.");
  if (body.action === "commit") {
    const p = input.parse(body),
      preview = await roomImportPreview(tx, a.organizationId, p);
    if (!preview.valid)
      throw Error("Perbaiki bentrok atau batas paket sebelum impor.");
    if (body.digest !== preview.digest)
      throw Error("Data berubah. Pratinjau ulang sebelum impor.");
    const rooms = [];
    for (const r of preview.rows)
      rooms.push(
        await tx.room.create({
          data: { propertyId: p.propertyId, number: r.number, rate: r.rate },
        }),
      );
    const batch = await tx.roomImportBatch.create({
      data: {
        propertyId: p.propertyId,
        actorId: a.userId,
        roomSnapshots: rooms,
        roomCount: rooms.length,
      },
    });
    await lifecycleAudit(
      tx,
      a.organizationId,
      a.userId,
      "ROOM_IMPORT_COMMITTED",
      batch.id,
      { count: rooms.length },
    );
    return { id: batch.id, count: rooms.length };
  }
  if (body.action !== "rollback") throw Error("Tindakan impor tidak tersedia.");
  const batch = await tx.roomImportBatch.findFirst({
    where: {
      id: z.string().min(1).max(100).parse(body.batchId),
      property: { organizationId: a.organizationId },
    },
  });
  if (!batch || batch.status !== "COMMITTED")
    throw Error("Impor tidak ditemukan atau sudah dibatalkan.");
  const snapshots = z
    .array(
      z.object({
        id: z.string(),
        propertyId: z.string(),
        number: z.string(),
        rate: z.number(),
        operational: z.string(),
      }),
    )
    .min(1)
    .max(100)
    .parse(batch.roomSnapshots);
  // Lock rows against concurrent updates/FK inserts. Never remove a changed or referenced room.
  for (const s of [...snapshots].sort((a, b) => a.id.localeCompare(b.id))) {
    await tx.$queryRaw`SELECT id FROM "Room" WHERE id=${s.id} FOR UPDATE`;
    const r = await tx.room.findUnique({
      where: { id: s.id },
      include: {
        _count: {
          select: {
            stays: true,
            invoices: true,
            devices: true,
            interestedProspects: true,
          },
        },
      },
    });
    if (
      !r ||
      s.propertyId !== batch.propertyId ||
      r.propertyId !== s.propertyId ||
      r.number !== s.number ||
      r.rate !== s.rate ||
      r.operational !== s.operational ||
      Object.values(r._count).some((n) => n > 0)
    )
      throw Error(
        "Pembatalan ditolak: kamar telah diubah atau digunakan. Tidak ada kamar yang dihapus.",
      );
  }
  await tx.room.deleteMany({
    where: {
      id: { in: snapshots.map((s) => s.id) },
      propertyId: batch.propertyId,
    },
  });
  await tx.roomImportBatch.update({
    where: { id: batch.id },
    data: {
      status: "ROLLED_BACK",
      rolledBackAt: new Date(),
      rolledBackBy: a.userId,
    },
  });
  await lifecycleAudit(
    tx,
    a.organizationId,
    a.userId,
    "ROOM_IMPORT_ROLLED_BACK",
    batch.id,
    { count: batch.roomCount },
  );
  return { id: batch.id, count: batch.roomCount };
}
