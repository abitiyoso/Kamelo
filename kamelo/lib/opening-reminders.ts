import { Prisma } from "@/generated/prisma";
import { z } from "zod";
import { localToday } from "./operations";
import { lifecycleAudit } from "./lifecycle";
import { stableHash } from "./lifecycle-rules.mjs";
type Tx = Prisma.TransactionClient;
const select = {
  id: true,
  amount: true,
  due: true,
  reference: true,
  createdAt: true,
} as const;
export async function openingReminderPreview(
  tx: Tx,
  ids: string[],
  id: string,
  page: number,
) {
  const row = await tx.openingReceivable.findFirst({
    where: { id, propertyId: { in: ids } },
  });
  if (!row) throw Error("Saldo tidak ditemukan.");
  const share = await tx.openingShare.findFirst({
    where: { receivableId: id, revokedAt: null },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          emailVerifiedAt: true,
          accountStatus: true,
        },
      },
      grant: {
        select: {
          status: true,
          revokedAt: true,
          canViewBilling: true,
          userId: true,
          stayId: true,
        },
      },
      stay: {
        select: { guestId: true, room: { select: { propertyId: true } } },
      },
    },
  });
  const paid =
    (
      await tx.openingReceipt.aggregate({
        where: { receivableId: id },
        _sum: { delta: true },
      })
    )._sum.delta || 0;
  const remaining = row.amount - paid;
  const pending = await tx.openingProof.count({
    where: { receivableId: id, status: "PENDING" },
  });
  const last = await tx.openingReminder.findFirst({
    where: { receivableId: id },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });
  const automated = await tx.reminderDelivery.findFirst({
    where: { receivableId: id, channel: "PORTAL", status: "PUBLISHED" },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });
  const latestAt = Math.max(
    last ? +last.createdAt : 0,
    automated ? +automated.createdAt : 0,
  );
  const nextAt = latestAt ? new Date(latestAt + 86400000) : null;
  const valid =
    share &&
    share.grant.status === "ACTIVE" &&
    !share.grant.revokedAt &&
    share.grant.canViewBilling &&
    share.grant.userId === share.userId &&
    share.grant.stayId === share.stayId &&
    share.user.emailVerifiedAt &&
    !["PENDING", "SUSPENDED", "CLOSED"].includes(share.user.accountStatus) &&
    share.stay.guestId === row.guestId &&
    share.stay.room.propertyId === row.propertyId;
  const reason =
    row.status !== "OPEN"
      ? "Saldo dibatalkan."
      : remaining <= 0
        ? "Saldo sudah lunas."
        : row.due > localToday()
          ? "Belum jatuh tempo."
          : !valid
            ? "Bagikan saldo ke akun terverifikasi dengan izin tagihan aktif terlebih dahulu."
            : pending
              ? "Periksa bukti bayar yang menunggu sebelum mengingatkan lagi."
              : nextAt && nextAt > new Date()
                ? "Pengingat dibatasi sekali per saldo dalam 24 jam."
                : "";
  const preview = {
    receivableId: id,
    shareId: share?.id || "",
    remaining,
    due: row.due,
    reference: row.reference,
    lastId: last?.id || "",
    automatedId: automated?.id || "",
  };
  return {
    preview: {
      ...preview,
      digest: stableHash(preview),
      target: valid
        ? { name: share!.user.name, email: share!.user.email }
        : null,
      eligible: !reason,
      reason,
      nextAt,
      pending,
    },
    history: await tx.openingReminder.findMany({
      where: { receivableId: id },
      select,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 20,
      skip: (page - 1) * 20,
    }),
    total: await tx.openingReminder.count({ where: { receivableId: id } }),
    page,
  };
}
export async function openingReminderWrite(
  tx: Tx,
  a: { organizationId: string; userId: string },
  body: Record<string, unknown>,
) {
  if (body.confirmed !== true)
    throw Error("Tinjau dan konfirmasi pengingat terlebih dahulu.");
  const id = z.string().min(1).max(100).parse(body.receivableId);
  const row = await tx.openingReceivable.findFirst({
    where: { id, property: { organizationId: a.organizationId } },
  });
  if (!row) throw Error("Saldo tidak ditemukan.");
  const { preview: p } = await openingReminderPreview(
    tx,
    [row.propertyId],
    id,
    1,
  );
  if (!p.eligible) throw Error(p.reason);
  if (p.digest !== body.digest)
    throw Error("Saldo atau penerima berubah. Perbarui pratinjau pengingat.");
  const reminder = await tx.openingReminder.create({
    data: {
      receivableId: id,
      shareId: p.shareId,
      amount: p.remaining,
      due: p.due,
      reference: p.reference,
      actorId: a.userId,
    },
  });
  await lifecycleAudit(
    tx,
    a.organizationId,
    a.userId,
    "OPENING_PORTAL_REMINDER",
    reminder.id,
    { receivableId: id, channel: "PORTAL" },
  );
  return { id: reminder.id, channel: "PORTAL", amount: reminder.amount };
}
export async function tenantOpeningReminders(
  tx: Tx,
  shareId: string,
  page: number,
) {
  return {
    rows: await tx.openingReminder.findMany({
      where: { shareId },
      select,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 20,
      skip: (page - 1) * 20,
    }),
    total: await tx.openingReminder.count({ where: { shareId } }),
    page,
  };
}
