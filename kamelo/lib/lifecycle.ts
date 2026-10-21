import { Prisma } from "@/generated/prisma";
import { z } from "zod";
import { activeStay, localToday } from "./operations";
import { syncRoomAccess } from "./smart-access";
import {
  depositMovement,
  stableHash,
  depositState,
} from "./lifecycle-rules.mjs";
import { encryptSecret } from "./secrets";
type Tx = Prisma.TransactionClient;
const id = z.string().min(1).max(100),
  money = z.number().int().min(0).max(1000000000);
export const lifecycleDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => {
    const d = new Date(v + "T00:00:00Z");
    return Number.isFinite(+d) && d.toISOString().slice(0, 10) === v;
  });
export async function depositSummary(tx: Tx, accountId: string, required = 0) {
  const sum = await tx.depositEntry.aggregate({
      where: { accountId },
      _sum: { delta: true },
      _count: true,
    }),
    pending = await tx.depositAdjustment.aggregate({
      where: { accountId, status: "PENDING" },
      _sum: { amount: true },
    });
  const balance = sum._sum.delta || 0,
    reserved = pending._sum.amount || 0;
  return {
    balance,
    pending: reserved,
    available: balance - reserved,
    required,
    state: depositState(balance, reserved, required, sum._count),
  };
}
export async function lifecycleAudit(
  tx: Tx,
  organizationId: string,
  actorId: string,
  action: string,
  targetId: string,
  metadata: Prisma.InputJsonObject = {},
) {
  await tx.audit.create({
    data: { organizationId, actorId, action, targetId, metadata },
  });
}
export async function closeStayLifecycle(
  tx: Tx,
  stayId: string,
  status: string,
  actorId: string,
  organizationId: string,
) {
  await tx.contract.updateMany({
    where: { stayId, status: { in: ["DRAFT", "ACTIVE"] } },
    data: { status: status === "CANCELLED" ? "CANCELLED" : "CLOSED" },
  });
  await tx.stayLink.updateMany({
    where: { stayId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  if (status !== "CHECKED_OUT") return;
  const stay = await tx.stay.findUniqueOrThrow({
    where: { id: stayId },
    include: { room: true },
  });
  await tx.room.update({
    where: { id: stay.roomId },
    data: { operational: "CLEANING" },
  });
  // All callers hold the organization lock; repeated requests cannot create duplicate cleaning work.
  if (!(await tx.ticket.count({ where: { stayId, category: "CLEANING" } }))) {
    const ticket = await tx.ticket.create({
      data: {
        propertyId: stay.room.propertyId,
        stayId,
        title: "Bersihkan kamar " + stay.room.number,
        description:
          "Masa tinggal berakhir. Periksa kondisi dan kebersihan sebelum menandai kamar siap.",
        category: "CLEANING",
        createdBy: actorId,
        updates: {
          create: {
            actorId,
            status: "OPEN",
            note: "Tugas dibuat setelah masa tinggal berakhir.",
          },
        },
      },
    });
    await lifecycleAudit(
      tx,
      organizationId,
      actorId,
      "CHECKOUT_CLEANING_TICKET_CREATED",
      ticket.id,
    );
  }
}
async function version(
  tx: Tx,
  contract: { id: string; revision: number },
  data: {
    start: string;
    end: string;
    rent: number;
    depositRequired: number;
    terms: string;
    state: string;
    signatureReference: string;
  },
  actorId: string,
) {
  const revision = contract.revision + 1;
  await tx.contractVersion.create({
    data: {
      contractId: contract.id,
      revision,
      ...data,
      snapshotHash: stableHash(data),
      actorId,
    },
  });
  return tx.contract.update({ where: { id: contract.id }, data: { revision } });
}
async function availability(
  tx: Tx,
  roomId: string,
  propertyId: string,
  start: string,
  end: string | null,
  exclude?: string,
) {
  const room = await tx.room.findFirst({
    where: { id: roomId, propertyId, operational: "READY" },
  });
  if (!room) throw Error("Kamar tujuan belum siap.");
  if (
    await tx.stay.count({
      where: {
        id: exclude ? { not: exclude } : undefined,
        roomId,
        status: { in: ["ACTIVE", "CONFIRMED", "CHECKED_IN"] },
        start: { lt: end || "9999-12-31" },
        OR: [{ end: null }, { end: { gt: start } }],
      },
    })
  )
    throw Error("Kamar bertabrakan dengan masa tinggal atau reservasi lain.");
  return room;
}
export async function lifecycleWrite(
  tx: Tx,
  user: { id: string; organizationId: string },
  property: { id: string; type: string },
  body: Record<string, unknown>,
) {
  const action = String(body.action),
    audit = (name: string, target: string, data: Prisma.InputJsonObject = {}) =>
      lifecycleAudit(tx, user.organizationId, user.id, name, target, data);
  if (action === "profile") {
    const p = z
      .object({
        guestId: id,
        name: z.string().trim().min(2).max(100),
        phone: z.string().regex(/^(?:\+62|62|0)8\d{7,12}$/),
        email: z.union([z.literal(""), z.email()]).default(""),
        emergencyConsent: z.boolean(),
        emergencyName: z.string().trim().max(100).default(""),
        emergencyPhone: z.string().trim().max(30).default(""),
      })
      .parse(body);
    const guest = await tx.guest.findFirst({
      where: { id: p.guestId, propertyId: property.id },
    });
    if (!guest) throw Error("Penghuni tidak ditemukan.");
    if (p.emergencyConsent && (!p.emergencyName || !p.emergencyPhone))
      throw Error("Isi kontak darurat yang telah disetujui.");
    await tx.guest.update({
      where: { id: guest.id },
      data: { name: p.name, phone: p.phone },
    });
    await tx.residentProfile.upsert({
      where: { guestId: guest.id },
      create: {
        guestId: guest.id,
        email: p.email,
        emergencyConsent: p.emergencyConsent,
        encryptedEmergencyContact: p.emergencyConsent
          ? encryptSecret(
              JSON.stringify({
                name: p.emergencyName,
                phone: p.emergencyPhone,
              }),
            )
          : null,
      },
      update: {
        email: p.email,
        emergencyConsent: p.emergencyConsent,
        encryptedEmergencyContact: p.emergencyConsent
          ? encryptSecret(
              JSON.stringify({
                name: p.emergencyName,
                phone: p.emergencyPhone,
              }),
            )
          : null,
      },
    });
    await audit("RESIDENT_PROFILE_UPDATED", guest.id, {
      emergencyConsent: p.emergencyConsent,
    });
    return { guestId: guest.id };
  }
  if (action === "returnStay") {
    const input = z
      .object({
        guestId: id,
        roomId: id,
        start: lifecycleDate,
        end: lifecycleDate.optional(),
        rate: money,
        billingDay: z.number().int().min(1).max(31),
      })
      .parse(body);
    const guest = await tx.guest.findFirst({
      where: { id: input.guestId, propertyId: property.id },
    });
    if (!guest) throw Error("Penghuni tidak ditemukan.");
    if (
      (property.type === "HOTEL" && !input.end) ||
      (input.end && input.end <= input.start)
    )
      throw Error("Periksa tanggal masa tinggal.");
    if (
      await tx.stay.count({
        where: {
          guestId: guest.id,
          status: { in: ["ACTIVE", "CHECKED_IN", "CONFIRMED"] },
          start: { lt: input.end || "9999-12-31" },
          OR: [{ end: null }, { end: { gt: input.start } }],
        },
      })
    )
      throw Error(
        "Profil ini masih memiliki masa tinggal yang bertumpang tindih.",
      );
    const room = await availability(
      tx,
      input.roomId,
      property.id,
      input.start,
      input.end || null,
    );
    const stay = await tx.stay.create({
      data: {
        guestId: guest.id,
        roomId: room.id,
        start: input.start,
        end: input.end || null,
        rate: input.rate,
        billingDay: input.billingDay,
        status: property.type === "HOTEL" ? "CONFIRMED" : "ACTIVE",
      },
    });
    await syncRoomAccess(
      tx,
      room.id,
      localToday(),
      user.id,
      user.organizationId,
    );
    await audit("RETURNING_RESIDENT_STAY_CREATED", stay.id, {
      guestId: guest.id,
    });
    return { stayId: stay.id };
  }
  const stayId = id.parse(body.stayId),
    stay = await tx.stay.findFirst({
      where: { id: stayId, room: { propertyId: property.id } },
      include: {
        room: true,
        contract: {
          include: { versions: { orderBy: { revision: "desc" }, take: 1 } },
        },
        depositAccount: true,
      },
    });
  if (!stay) throw Error("Masa tinggal tidak ditemukan.");
  if (action === "contractCreate") {
    if (
      !["ACTIVE", "CHECKED_IN", "CONFIRMED"].includes(stay.status) ||
      stay.contract
    )
      throw Error("Kontrak sudah ada atau masa tinggal tidak aktif.");
    const p = z
      .object({
        end: lifecycleDate,
        depositRequired: money,
        terms: z.string().trim().min(10).max(10000),
      })
      .parse(body);
    if (p.end <= stay.start || p.end <= localToday())
      throw Error("Tanggal akhir kontrak tidak valid.");
    const data = {
      start: stay.start,
      end: p.end,
      rent: stay.rate,
      depositRequired: p.depositRequired,
      terms: p.terms,
      state: "PROPOSED",
      signatureReference: "",
    };
    const c = await tx.contract.create({
      data: {
        stayId,
        versions: {
          create: {
            revision: 1,
            ...data,
            snapshotHash: stableHash(data),
            actorId: user.id,
          },
        },
      },
    });
    await tx.depositAccount.upsert({
      where: { stayId },
      create: { stayId },
      update: {},
    });
    await audit("CONTRACT_PROPOSED", c.id);
    return { contractId: c.id };
  }
  if (
    action === "contractRenew" ||
    action === "contractAgree" ||
    action === "contractRevise"
  ) {
    const c = stay.contract;
    if (
      !c ||
      !["DRAFT", "ACTIVE"].includes(c.status) ||
      !["ACTIVE", "CHECKED_IN", "CONFIRMED"].includes(stay.status)
    )
      throw Error("Kontrak tidak dapat diubah.");
    if (z.number().int().parse(body.revision) !== c.revision)
      throw Error("Kontrak berubah. Muat ulang sebelum melanjutkan.");
    const old = c.versions[0];
    if (action === "contractRevise") {
      if (old.state !== "PROPOSED")
        throw Error("Hanya usulan yang belum disepakati dapat diperbaiki.");
      const p = z
        .object({
          end: lifecycleDate,
          terms: z.string().trim().min(10).max(10000),
          depositRequired: money.optional(),
        })
        .parse(body);
      if (
        p.end <= stay.start ||
        p.end <= localToday() ||
        (c.status === "ACTIVE" && stay.end && p.end < stay.end)
      )
        throw Error("Tanggal usulan tidak valid.");
      await version(
        tx,
        c,
        {
          start: old.start,
          end: p.end,
          rent: old.rent,
          depositRequired:
            c.status === "DRAFT"
              ? (p.depositRequired ?? old.depositRequired)
              : old.depositRequired,
          terms: p.terms,
          state: "PROPOSED",
          signatureReference: "",
        },
        user.id,
      );
      await audit("CONTRACT_PROPOSAL_REVISED", c.id);
      return { contractId: c.id };
    }
    if (action === "contractRenew") {
      if (c.status !== "ACTIVE" || old.state !== "AGREED")
        throw Error("Selesaikan persetujuan kontrak sebelumnya.");
      const end = lifecycleDate.parse(body.end);
      if (end <= old.end || end <= localToday())
        throw Error("Perpanjangan harus setelah akhir kontrak sebelumnya.");
      await version(
        tx,
        c,
        {
          start: old.start,
          end,
          rent: old.rent,
          depositRequired: old.depositRequired,
          terms: old.terms,
          state: "PROPOSED",
          signatureReference: "",
        },
        user.id,
      );
      await audit("CONTRACT_RENEWAL_PROPOSED", c.id);
      return { contractId: c.id };
    }
    const reference = z.string().trim().min(5).max(500).parse(body.reference);
    if (
      old.end <= localToday() ||
      old.state !== "PROPOSED" ||
      body.confirmed !== true
    )
      throw Error("Konfirmasi persetujuan manual kedua pihak diperlukan.");
    if (stay.room.operational !== "READY" && stay.status === "CONFIRMED")
      throw Error("Kamar belum siap.");
    // Exclude this stay; contracts cannot extend into another reservation.
    if (
      await tx.stay.count({
        where: {
          id: { not: stay.id },
          roomId: stay.roomId,
          status: { in: ["ACTIVE", "CONFIRMED", "CHECKED_IN"] },
          start: { lt: old.end },
          OR: [{ end: null }, { end: { gt: stay.start } }],
        },
      })
    )
      throw Error("Periode kontrak bertabrakan dengan reservasi lain.");
    if (property.type === "HOTEL" && old.end !== stay.end)
      throw Error(
        "Perubahan tanggal reservasi hotel harus diproses melalui alur reservasi.",
      );
    await version(
      tx,
      c,
      {
        start: old.start,
        end: old.end,
        rent: old.rent,
        depositRequired: old.depositRequired,
        terms: old.terms,
        state: "AGREED",
        signatureReference: reference,
      },
      user.id,
    );
    await tx.contract.update({
      where: { id: c.id },
      data: { status: "ACTIVE" },
    });
    await tx.stay.update({ where: { id: stayId }, data: { end: old.end } });
    await syncRoomAccess(
      tx,
      stay.roomId,
      localToday(),
      user.id,
      user.organizationId,
    );
    await audit("CONTRACT_MANUAL_AGREEMENT_RECORDED", c.id);
    return { contractId: c.id };
  }
  if (action === "transfer") {
    if (body.confirmed !== true || !activeStay(stay))
      throw Error(
        "Konfirmasi pindah kamar untuk masa tinggal aktif diperlukan.",
      );
    const destination = id.parse(body.roomId);
    if (destination === stay.roomId) throw Error("Pilih kamar yang berbeda.");
    const room = await availability(
      tx,
      destination,
      property.id,
      localToday(),
      stay.end,
    );
    const account = stay.depositAccount,
      balance = account ? await depositSummary(tx, account.id) : null;
    if (balance?.pending)
      throw Error("Selesaikan usulan potongan deposit sebelum pindah kamar.");
    await tx.stay.update({
      where: { id: stay.id },
      data: { status: "CHECKED_OUT", end: localToday() },
    });
    const next = await tx.stay.create({
      data: {
        roomId: room.id,
        guestId: stay.guestId,
        start: localToday(),
        end: stay.end,
        rate: stay.rate,
        billingDay: stay.billingDay,
        status: stay.status,
      },
    });
    if (stay.contract) {
      const previous =
        (await tx.contractVersion.findFirst({
          where: { contractId: stay.contract.id, state: "AGREED" },
          orderBy: { revision: "desc" },
        })) || stay.contract.versions[0];
      await tx.contract.update({
        where: { id: stay.contract.id },
        data: { status: "SUPERSEDED" },
      });
      if (previous) {
        const data = {
          start: next.start,
          end: previous.end,
          rent: previous.rent,
          depositRequired: previous.depositRequired,
          terms: previous.terms,
          state: "PROPOSED",
          signatureReference: "",
        };
        await tx.contract.create({
          data: {
            stayId: next.id,
            versions: {
              create: {
                revision: 1,
                ...data,
                snapshotHash: stableHash(data),
                actorId: user.id,
              },
            },
          },
        });
      }
    }
    if (account) {
      const nextAccount = await tx.depositAccount.create({
        data: { stayId: next.id },
      });
      if (balance!.balance > 0) {
        const reference = "Pindah kamar: " + stay.id + " -> " + next.id;
        await tx.depositEntry.createMany({
          data: [
            {
              accountId: account.id,
              kind: "TRANSFER_OUT",
              delta: -balance!.balance,
              date: localToday(),
              reference,
              actorId: user.id,
            },
            {
              accountId: nextAccount.id,
              kind: "TRANSFER_IN",
              delta: balance!.balance,
              date: localToday(),
              reference,
              actorId: user.id,
            },
          ],
        });
      }
    }
    const grants = await tx.occupantAccess.findMany({
      where: { stayId: stay.id, status: "ACTIVE", revokedAt: null },
    });
    for (const g of grants)
      await tx.occupantAccess.create({
        data: {
          stayId: next.id,
          userId: g.userId,
          canViewBilling: g.canViewBilling,
          canControlDevices: g.canControlDevices,
          includeAccess: g.includeAccess,
        },
      });
    await tx.roomTransfer.create({
      data: {
        fromStayId: stay.id,
        toStayId: next.id,
        date: localToday(),
        actorId: user.id,
      },
    });
    await closeStayLifecycle(
      tx,
      stay.id,
      "CHECKED_OUT",
      user.id,
      user.organizationId,
    );
    await syncRoomAccess(
      tx,
      stay.roomId,
      localToday(),
      user.id,
      user.organizationId,
    );
    await syncRoomAccess(
      tx,
      next.roomId,
      localToday(),
      user.id,
      user.organizationId,
    );
    await audit("RESIDENT_ROOM_TRANSFERRED", next.id, { fromStayId: stay.id });
    return { stayId: next.id };
  }
  const account = stay.depositAccount;
  if (!account) throw Error("Buat kontrak dan akun deposit terlebih dahulu.");
  const current = await depositSummary(tx, account.id);
  if (action === "depositReceive" || action === "depositRefund") {
    const p = z
      .object({
        amount: money.refine((n) => n > 0),
        reference: z.string().trim().min(5).max(500),
      })
      .parse(body);
    if (body.confirmed !== true)
      throw Error(
        "Konfirmasi penerimaan atau pengembalian dana nyata diperlukan.",
      );
    if (
      action === "depositReceive" &&
      (stay.contract?.status !== "ACTIVE" ||
        !["ACTIVE", "CHECKED_IN", "CONFIRMED"].includes(stay.status))
    )
      throw Error(
        "Penerimaan memerlukan kontrak yang sudah disepakati dan masa tinggal aktif.",
      );
    if (
      action === "depositRefund" &&
      !["CHECKED_OUT", "CANCELLED"].includes(stay.status)
    )
      throw Error("Pengembalian dicatat setelah checkout atau pembatalan.");
    const delta = action === "depositReceive" ? p.amount : -p.amount;
    depositMovement(current.balance, current.pending, delta);
    const entry = await tx.depositEntry.create({
      data: {
        accountId: account.id,
        kind: action === "depositReceive" ? "RECEIPT" : "REFUND",
        delta,
        date: localToday(),
        reference: p.reference,
        actorId: user.id,
      },
    });
    await audit("DEPOSIT_" + entry.kind, entry.id, { amount: p.amount });
    return { entryId: entry.id };
  }
  if (action === "deductionPropose") {
    if (stay.status !== "CHECKED_OUT")
      throw Error("Periksa kondisi kamar setelah checkout terlebih dahulu.");
    const p = z
      .object({
        amount: money.refine((n) => n > 0),
        reason: z.string().trim().min(5).max(1000),
        inspectionNote: z.string().trim().min(10).max(2000),
      })
      .parse(body);
    depositMovement(current.balance, current.pending, -p.amount);
    const adjustment = await tx.depositAdjustment.create({
      data: { accountId: account.id, ...p, createdBy: user.id },
    });
    await audit("DEPOSIT_DEDUCTION_PROPOSED", adjustment.id);
    return { adjustmentId: adjustment.id };
  }
  if (action === "deductionReview") {
    const a = await tx.depositAdjustment.findFirst({
      where: {
        id: id.parse(body.adjustmentId),
        accountId: account.id,
        status: "PENDING",
      },
    });
    if (!a) throw Error("Usulan tidak aktif.");
    const approved = z.boolean().parse(body.approved);
    if (approved && body.confirmed !== true)
      throw Error(
        "Konfirmasi persetujuan potongan dengan penghuni diperlukan.",
      );
    if (approved) {
      depositMovement(current.balance, current.pending - a.amount, -a.amount);
      await tx.depositEntry.create({
        data: {
          accountId: account.id,
          kind: "DEDUCTION",
          delta: -a.amount,
          date: localToday(),
          reference: a.reason + " · " + a.inspectionNote,
          actorId: user.id,
        },
      });
    }
    await tx.depositAdjustment.update({
      where: { id: a.id },
      data: {
        status: approved ? "APPROVED" : "REJECTED",
        reviewedBy: user.id,
        reviewedAt: new Date(),
      },
    });
    await audit("DEPOSIT_DEDUCTION_REVIEWED", a.id, { approved });
    return { adjustmentId: a.id };
  }
  if (action === "depositReverse") {
    const e = await tx.depositEntry.findFirst({
      where: { id: id.parse(body.entryId), accountId: account.id },
      include: { reversal: true },
    });
    if (
      !e ||
      e.reversal ||
      !["RECEIPT", "REFUND", "DEDUCTION"].includes(e.kind)
    )
      throw Error(
        "Mutasi tidak dapat dikoreksi. Transfer deposit tidak dibalik secara terpisah.",
      );
    const reference = z.string().trim().min(10).max(500).parse(body.reference);
    if (body.confirmed !== true) throw Error("Konfirmasi koreksi diperlukan.");
    depositMovement(current.balance, current.pending, -e.delta);
    const reversal = await tx.depositEntry.create({
      data: {
        accountId: account.id,
        kind: "REVERSAL",
        delta: -e.delta,
        date: localToday(),
        reference,
        actorId: user.id,
        reversesId: e.id,
      },
    });
    await audit("DEPOSIT_ENTRY_REVERSED", reversal.id, { entryId: e.id });
    return { entryId: reversal.id };
  }
  throw Error("Aksi tidak tersedia.");
}
