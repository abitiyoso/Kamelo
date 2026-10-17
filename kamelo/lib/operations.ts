import { randomBytes } from "node:crypto";
import { z } from "zod";
import { Prisma, User, Property } from "@/generated/prisma";
import { hashToken } from "./auth";
import { encryptSecret } from "./secrets";

export const operationActions = [
  "ticketCreate",
  "ticketUpdate",
  "guestSettings",
  "stayLink",
  "guestDeviceConfig",
];
export const ticketInclude = {
  assignee: { select: { id: true, name: true } },
  stay: {
    select: {
      room: { select: { number: true } },
      guest: { select: { name: true } },
    },
  },
  updates: { orderBy: { createdAt: "asc" as const } },
};
export const localToday = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
export function activeStay(
  stay: { status: string; start: string; end: string | null },
  today = localToday(),
) {
  return (
    ["ACTIVE", "CHECKED_IN"].includes(stay.status) &&
    stay.start <= today &&
    (!stay.end || stay.end > today)
  );
}
export const ticketInput = z.object({
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().min(3).max(2000),
  category: z.enum(["MAINTENANCE", "COMPLAINT", "CLEANING", "OTHER"]),
  priority: z.enum(["LOW", "NORMAL", "URGENT"]).default("NORMAL"),
});

export async function operationsAction(
  tx: Prisma.TransactionClient,
  user: User,
  property: Property,
  body: Record<string, unknown>,
  origin: string,
) {
  const owner = () => {
    if (user.role !== "OWNER")
      throw new Error("Hanya owner yang dapat mengubah pengaturan ini.");
  };
  const audit = (action: string, targetId: string) =>
    tx.audit.create({
      data: {
        organizationId: user.organizationId,
        actorId: user.id,
        action,
        targetId,
        metadata: {},
      },
    });
  async function assignee(value: unknown) {
    const target = z
      .string()
      .max(100)
      .nullable()
      .parse(value || null);
    if (!target) return null;
    if (user.role !== "OWNER" && target !== user.id)
      throw new Error(
        "Staf hanya dapat mengambil tugas untuk dirinya sendiri.",
      );
    const member = await tx.user.findFirst({
      where: { id: target, organizationId: user.organizationId },
    });
    if (
      !member ||
      (member.role !== "OWNER" && !member.propertyIds.includes(property.id))
    )
      throw new Error("Penanggung jawab tidak mempunyai akses properti.");
    return member.id;
  }
  if (body.action === "ticketCreate") {
    const input = ticketInput.parse(body);
    const stayId = z
      .string()
      .max(100)
      .nullable()
      .parse(body.stayId || null);
    if (
      stayId &&
      !(await tx.stay.findFirst({
        where: { id: stayId, room: { propertyId: property.id } },
      }))
    )
      throw new Error("Masa tinggal tidak ditemukan.");
    const ticket = await tx.ticket.create({
      data: {
        ...input,
        propertyId: property.id,
        stayId,
        assigneeId: await assignee(body.assigneeId),
        createdBy: user.id,
        updates: {
          create: {
            actorId: user.id,
            note: "Tiket dibuat oleh pengelola.",
            status: "OPEN",
          },
        },
      },
    });
    await audit("TICKET_CREATED", ticket.id);
    return { ok: true };
  }
  if (body.action === "ticketUpdate") {
    const input = z
      .object({
        ticketId: z.string(),
        status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED"]),
        note: z.string().trim().min(3).max(2000),
      })
      .parse(body);
    const ticket = await tx.ticket.findFirst({
      where: { id: input.ticketId, propertyId: property.id },
    });
    if (
      !ticket ||
      (user.role !== "OWNER" &&
        ticket.assigneeId &&
        ticket.assigneeId !== user.id)
    )
      throw new Error("Tiket tidak ditemukan atau ditugaskan ke staf lain.");
    const assigneeId =
      user.role === "OWNER" ? await assignee(body.assigneeId) : user.id;
    await tx.ticket.update({
      where: { id: ticket.id },
      data: {
        status: input.status,
        assigneeId,
        updates: {
          create: { actorId: user.id, note: input.note, status: input.status },
        },
      },
    });
    await audit("TICKET_UPDATED", ticket.id);
    return { ok: true };
  }
  if (body.action === "guestSettings") {
    owner();
    const input = z
      .object({
        wifiSsid: z.string().trim().max(100),
        wifiPassword: z.string().max(128).optional(),
        guestInstructions: z.string().trim().max(5000),
        supportPhone: z.string().regex(/^(?:\+?\d{8,16})?$/),
      })
      .parse(body);
    const encryptedWifiPassword = !input.wifiSsid
      ? null
      : input.wifiPassword
        ? encryptSecret(input.wifiPassword)
        : property.encryptedWifiPassword;
    await tx.property.update({
      where: { id: property.id },
      data: {
        wifiSsid: input.wifiSsid,
        encryptedWifiPassword,
        guestInstructions: input.guestInstructions,
        supportPhone: input.supportPhone,
      },
    });
    await audit("GUEST_SETTINGS_UPDATED", property.id);
    return { ok: true };
  }
  if (body.action === "stayLink") {
    const stay = await tx.stay.findFirst({
      where: {
        id: z.string().parse(body.stayId),
        room: { propertyId: property.id },
      },
    });
    if (!stay || !activeStay(stay))
      throw new Error(
        "Tautan hanya tersedia untuk masa tinggal yang sedang aktif.",
      );
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(
      Math.min(
        Date.now() + 14 * 86400000,
        stay.end ? +new Date(stay.end + "T00:00:00+07:00") : Infinity,
      ),
    );
    await tx.stayLink.updateMany({
      where: { stayId: stay.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await tx.stayLink.create({
      data: {
        stayId: stay.id,
        tokenHash: hashToken(token),
        includeAccess: user.role === "OWNER" || user.canControlDevices,
        expiresAt,
      },
    });
    await audit("STAY_LINK_CREATED", stay.id);
    return { ok: true, url: new URL("/stay/" + token, origin).href, expiresAt };
  }
  if (body.action === "guestDeviceConfig") {
    owner();
    const input = z
      .object({ deviceId: z.string(), enabled: z.boolean() })
      .parse(body);
    const device = await tx.device.findFirst({
      where: {
        id: input.deviceId,
        propertyId: property.id,
        provider: "MOCK",
        kind: { not: "LOCK" },
        roomId: { not: null },
      },
    });
    if (!device)
      throw new Error(
        "Pilih perangkat simulasi non-kunci yang sudah dipetakan ke kamar.",
      );
    await tx.device.update({
      where: { id: device.id },
      data: { guestControllable: input.enabled },
    });
    await audit("GUEST_DEVICE_PERMISSION_UPDATED", device.id);
    return { ok: true };
  }
  throw new Error("Aksi tidak dikenal.");
}
