import { Prisma } from "@/generated/prisma";
import { z } from "zod";
import { readResidentCsv } from "./resident-import-csv.mjs";
import { lifecycleWrite, lifecycleAudit } from "./lifecycle";
import { stableHash } from "./lifecycle-rules.mjs";
import { encryptSecret, decryptSecret } from "./secrets";
type Tx = Prisma.TransactionClient;
const input = z.object({
  propertyId: z.string().min(1).max(100),
  csv: z.string().max(100000),
  mapping: z.object({
    number: z.number().int(),
    name: z.number().int(),
    phone: z.number().int(),
    start: z.number().int(),
    end: z.number().int(),
    rate: z.number().int(),
    billingDay: z.number().int(),
  }),
  choices: z.record(z.string(), z.string().max(100)).default({}),
});
const normalize = (s: string) => s.normalize("NFKC").toLocaleLowerCase("id-ID");
const overlap = (
  a: { start: string; end: string | null },
  b: { start: string; end: string | null },
) => a.start < (b.end || "9999-12-31") && b.start < (a.end || "9999-12-31");
export async function residentImportPreview(
  tx: Tx,
  organizationId: string,
  body: unknown,
) {
  const p = input.parse(body),
    property = await tx.property.findFirst({
      where: { id: p.propertyId, organizationId },
      select: { id: true, type: true, billingAutomation: true },
    });
  if (!property) throw Error("Properti tidak ditemukan.");
  const parsed = readResidentCsv(p.csv, p.mapping),
    rows = [];
  for (const r of parsed.rows) {
    const errors = [...r.errors];
    const rooms = await tx.room.findMany({
      where: {
        propertyId: p.propertyId,
        number: { equals: r.number, mode: "insensitive" },
      },
      select: {
        id: true,
        operational: true,
        devices: {
          where: { kind: "LOCK", automationEnabled: true },
          select: { id: true },
        },
      },
      take: 2,
    });
    const room = rooms.length === 1 ? rooms[0] : null;
    if (!room || room.operational !== "READY")
      errors.push("Kamar harus ditemukan secara unik dan berstatus siap.");
    if (property.type === "HOTEL" && !r.end)
      errors.push("Tanggal akhir wajib untuk hotel.");
    const rawPhone = r.phone.replace(/^\+62/, ""),
      candidates = await tx.guest.findMany({
        where: {
          propertyId: p.propertyId,
          OR: [
            {
              phone: {
                in: r.phone ? [r.phone, "62" + rawPhone, "0" + rawPhone] : [],
              },
            },
            { name: { equals: r.name, mode: "insensitive" } },
          ],
        },
        select: { id: true, name: true, phone: true },
        take: 21,
        orderBy: { id: "asc" },
      });
    let guestId = p.choices[String(r.line)] || "NEW";
    if (candidates.length > 20)
      errors.push(
        "Terlalu banyak profil cocok. Tinjau identitas secara manual di Database Penghuni.",
      );
    if (candidates.length && !candidates.some((c) => c.id === guestId))
      errors.push(
        "Profil serupa ditemukan. Pilih profil lama secara eksplisit; profil tidak digabung otomatis.",
      );
    if (!candidates.length && guestId !== "NEW")
      errors.push("Pilihan profil tidak cocok dengan data properti ini.");
    if (
      room &&
      (await tx.stay.count({
        where: {
          roomId: room.id,
          status: { in: ["ACTIVE", "CONFIRMED", "CHECKED_IN"] },
          start: { lt: r.end || "9999-12-31" },
          OR: [{ end: null }, { end: { gt: r.start } }],
        },
      }))
    )
      errors.push("Kamar berbenturan dengan masa tinggal/reservasi lama.");
    if (
      guestId !== "NEW" &&
      candidates.some((c) => c.id === guestId) &&
      (await tx.stay.count({
        where: {
          guestId,
          status: { in: ["ACTIVE", "CONFIRMED", "CHECKED_IN"] },
          start: { lt: r.end || "9999-12-31" },
          OR: [{ end: null }, { end: { gt: r.start } }],
        },
      }))
    )
      errors.push("Profil sudah memiliki masa tinggal pada periode tersebut.");
    rows.push({
      ...r,
      roomId: room?.id || "",
      guestId,
      errors,
      candidates: candidates.slice(0, 20).map((c) => ({
        id: c.id,
        name: c.name,
        phone: "…" + c.phone.slice(-4),
      })),
      automatedLock: !!room?.devices.length,
    });
  }
  for (let i = 0; i < rows.length; i++)
    for (let j = i + 1; j < rows.length; j++) {
      const a = rows[i],
        b = rows[j];
      if (
        ((a.phone && a.phone === b.phone) ||
          normalize(a.name) === normalize(b.name)) &&
        (a.guestId === "NEW" || b.guestId === "NEW")
      ) {
        a.errors.push("Nama/nomor telepon berulang untuk profil baru di CSV.");
        b.errors.push("Nama/nomor telepon berulang untuk profil baru di CSV.");
      }
      if (
        overlap(a, b) &&
        ((a.roomId && a.roomId === b.roomId) ||
          (a.guestId !== "NEW" && a.guestId === b.guestId))
      ) {
        a.errors.push("Periode kamar/profil bertabrakan di dalam CSV.");
        b.errors.push("Periode kamar/profil bertabrakan di dalam CSV.");
      }
    }
  const automation = {
    billing: property.billingAutomation,
    locks: rows.some((r) => r.automatedLock),
  };
  const digest = stableHash({
    organizationId,
    propertyId: p.propertyId,
    type: property.type,
    automation,
    rows,
  });
  return {
    headers: parsed.headers,
    rows,
    automation,
    digest,
    valid: rows.every((r) => !r.errors.length),
  };
}
const snapshotSchema = z
  .array(
    z.object({
      stay: z.object({
        id: z.string(),
        roomId: z.string(),
        guestId: z.string(),
        start: z.string(),
        end: z.string().nullable(),
        rate: z.number(),
        billingDay: z.number(),
        status: z.string(),
      }),
      newGuest: z
        .object({
          id: z.string(),
          propertyId: z.string(),
          name: z.string(),
          phone: z.string(),
        })
        .nullable(),
    }),
  )
  .min(1)
  .max(50);
export async function residentImportWrite(
  tx: Tx,
  a: { userId: string; organizationId: string },
  body: Record<string, unknown>,
) {
  if (body.confirmed !== true)
    throw Error("Konfirmasi data dan dampak otomatisasi terlebih dahulu.");
  if (body.action === "commit") {
    const p = input.parse(body),
      preview = await residentImportPreview(tx, a.organizationId, p);
    if (!preview.valid)
      throw Error(
        "Perbaiki bentrok kamar, profil, atau tanggal sebelum impor.",
      );
    if (body.digest !== preview.digest)
      throw Error("Data berubah. Pratinjau ulang sebelum impor.");
    const property = await tx.property.findUniqueOrThrow({
        where: { id: p.propertyId },
        select: { id: true, type: true },
      }),
      snapshots = [];
    for (const r of preview.rows) {
      const guest =
        r.guestId === "NEW"
          ? await tx.guest.create({
              data: { propertyId: p.propertyId, name: r.name, phone: r.phone },
            })
          : null;
      const result = await lifecycleWrite(
        tx,
        { id: a.userId, organizationId: a.organizationId },
        property,
        {
          action: "returnStay",
          guestId: guest?.id || r.guestId,
          roomId: r.roomId,
          start: r.start,
          ...(r.end ? { end: r.end } : {}),
          rate: r.rate,
          billingDay: r.billingDay,
        },
      );
      const stayId = String((result as { stayId: string }).stayId),
        stay = await tx.stay.findUniqueOrThrow({ where: { id: stayId } });
      snapshots.push({ stay, newGuest: guest });
    }
    const batch = await tx.residentImportBatch.create({
      data: {
        propertyId: p.propertyId,
        actorId: a.userId,
        recordCount: snapshots.length,
        encryptedSnapshots: encryptSecret(JSON.stringify(snapshots)),
      },
    });
    await lifecycleAudit(
      tx,
      a.organizationId,
      a.userId,
      "RESIDENT_IMPORT_COMMITTED",
      batch.id,
      { count: snapshots.length },
    );
    return { id: batch.id, count: snapshots.length };
  }
  if (body.action !== "rollback") throw Error("Tindakan impor tidak tersedia.");
  const batch = await tx.residentImportBatch.findFirst({
    where: {
      id: z.string().min(1).max(100).parse(body.batchId),
      property: { organizationId: a.organizationId },
    },
  });
  if (!batch || batch.status !== "COMMITTED")
    throw Error("Impor tidak ditemukan atau sudah dibatalkan.");
  const snapshots = snapshotSchema.parse(
    JSON.parse(decryptSecret(batch.encryptedSnapshots)),
  );
  for (const s of [...snapshots].sort((a, b) =>
    a.stay.id.localeCompare(b.stay.id),
  )) {
    await tx.$queryRaw`SELECT id FROM "Stay" WHERE id=${s.stay.id} FOR UPDATE`;
    const stay = await tx.stay.findFirst({
      where: { id: s.stay.id, room: { propertyId: batch.propertyId } },
      include: {
        contract: { select: { id: true } },
        depositAccount: { select: { id: true } },
        convertedProspect: { select: { id: true } },
        incomingTransfer: { select: { id: true } },
        _count: {
          select: {
            invoices: true,
            accesses: true,
            stayLinks: true,
            tickets: true,
            occupantAccesses: true,
            messageThreads: true,
            outgoingTransfers: true,
          },
        },
      },
    });
    if (
      await tx.invitation.count({
        where: { organizationId: a.organizationId, stayId: s.stay.id },
      })
    )
      throw Error(
        "Pembatalan ditolak: masa tinggal sudah memiliki undangan. Riwayat harus dipertahankan.",
      );
    if (
      !stay ||
      stableHash(
        Object.fromEntries(
          Object.keys(s.stay).map((k) => [k, stay[k as keyof typeof stay]]),
        ),
      ) !== stableHash(s.stay) ||
      stay.contract ||
      stay.depositAccount ||
      stay.convertedProspect ||
      stay.incomingTransfer ||
      Object.values(stay._count).some((n) => n > 0)
    )
      throw Error(
        "Pembatalan ditolak: masa tinggal berubah atau sudah memiliki aktivitas turunan. Tidak ada data yang dihapus.",
      );
    if (s.newGuest) {
      await tx.$queryRaw`SELECT id FROM "Guest" WHERE id=${s.newGuest.id} FOR UPDATE`;
      const g = await tx.guest.findFirst({
        where: { id: s.newGuest.id, propertyId: batch.propertyId },
        include: {
          residentProfile: { select: { id: true } },
          _count: { select: { invoices: true, stays: true, openingReceivables:true } },
        },
      });
      if (
        !g ||
        stableHash({
          id: g.id,
          propertyId: g.propertyId,
          name: g.name,
          phone: g.phone,
        }) !== stableHash(s.newGuest) ||
        g.residentProfile ||
        g._count.invoices ||
        g._count.openingReceivables ||
        g._count.stays !== 1
      )
        throw Error(
          "Pembatalan ditolak: profil baru sudah diubah atau digunakan. Tidak ada data yang dihapus.",
        );
    }
  }
  await tx.stay.deleteMany({
    where: {
      id: { in: snapshots.map((s) => s.stay.id) },
      room: { propertyId: batch.propertyId },
    },
  });
  await tx.guest.deleteMany({
    where: {
      id: { in: snapshots.flatMap((s) => (s.newGuest ? [s.newGuest.id] : [])) },
      propertyId: batch.propertyId,
    },
  });
  await tx.residentImportBatch.update({
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
    "RESIDENT_IMPORT_ROLLED_BACK",
    batch.id,
    { count: batch.recordCount },
  );
  return { id: batch.id, count: batch.recordCount };
}
