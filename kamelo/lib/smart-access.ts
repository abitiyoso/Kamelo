import { randomInt } from "node:crypto";
import { Prisma, PrismaClient } from "@/generated/prisma";
import { MockTuyaProvider, SmartDevice } from "./iot";
import { decryptSecret, encryptSecret } from "./secrets";

type AccessStatus = "ACTIVE" | "SCHEDULED" | "PENDING" | "REVOKED";
const eligibleStatuses = ["ACTIVE", "CONFIRMED", "CHECKED_IN"];
const validDate = (date: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(date) &&
  !Number.isNaN(Date.parse(date)) &&
  new Date(date).toISOString().slice(0, 10) === date;
const inDates = (start: string, end: string | null, today: string) =>
  validDate(start) &&
  (!end || (validDate(end) && start < end)) &&
  start <= today &&
  (!end || today < end);
const eligibleNow = (type: string, status: string) =>
  (type === "KOS" && status === "ACTIVE") ||
  (type === "HOTEL" && status === "CHECKED_IN");

/** Call within the organization's locked transaction after a stay or mapping changes. */
export async function syncRoomAccess(
  tx: Prisma.TransactionClient,
  roomId: string,
  today: string,
  actorId: string,
  organizationId: string,
) {
  if (!validDate(today))
    throw new Error("Tanggal sinkronisasi akses tidak valid.");
  const room = await tx.room.findFirst({
    where: { id: roomId, property: { organizationId } },
    select: { id: true },
  });
  if (!room) throw new Error("Kamar akses tidak ditemukan.");

  // Historical mappings are included so remapping/unmapping also revokes old access.
  const devices = await tx.device.findMany({
    where: {
      property: { organizationId },
      OR: [{ roomId }, { accesses: { some: { stay: { roomId } } } }],
    },
    include: {
      room: {
        include: {
          property: true,
          stays: { where: { status: { in: eligibleStatuses } } },
        },
      },
      accesses: { include: { stay: true } },
    },
  });
  const summary = {
    devices: 0,
    active: 0,
    scheduled: 0,
    pending: 0,
    revoked: 0,
  };

  for (const device of devices) {
    if (device.kind !== "LOCK" && device.accesses.length === 0) continue;
    summary.devices++;
    const configured =
      device.provider === "MOCK" &&
      device.kind === "LOCK" &&
      device.automationEnabled &&
      !!device.room &&
      device.room.propertyId === device.propertyId &&
      device.room.property.organizationId === organizationId;
    const stays = new Map(
      device.accesses.map((access) => [access.stayId, access.stay]),
    );
    if (configured)
      for (const stay of device.room!.stays) stays.set(stay.id, stay);

    const plans = Array.from(stays.values()).map((stay) => {
      let status: AccessStatus = "REVOKED";
      let reason = "Masa tinggal berakhir atau akses dinonaktifkan";
      const eligible =
        configured &&
        stay.roomId === device.roomId &&
        eligibleStatuses.includes(stay.status) &&
        validDate(stay.start) &&
        (!stay.end || (validDate(stay.end) && stay.start < stay.end)) &&
        (!stay.end || today < stay.end);
      if (eligible) {
        const ready = eligibleNow(device.room!.property.type, stay.status);
        if (stay.start > today || !ready) {
          status = "SCHEDULED";
          reason =
            stay.start > today
              ? "Menunggu tanggal mulai"
              : "Menunggu check-in hotel";
        } else {
          status = "ACTIVE";
          reason = "Masa tinggal aktif";
        }
      }
      return { stay, status, reason };
    });

    const wantsActive = plans.some((plan) => plan.status === "ACTIVE");
    let confirmed = false;
    const capabilities = device.capabilities as SmartDevice["capabilities"];
    // A simulation can confirm only an online mock lock exposing this capability.
    if (
      device.provider === "MOCK" &&
      device.kind === "LOCK" &&
      device.online &&
      capabilities.access_active?.type === "boolean"
    ) {
      const provider = new MockTuyaProvider([
        {
          id: device.id,
          online: device.online,
          capabilities,
          state: device.state as SmartDevice["state"],
        },
      ]);
      let result: SmartDevice | null = null;
      try {
        result = await provider.sendDeviceCommand(device.id, {
          code: "access_active",
          value: wantsActive,
        });
      } catch {
        // Retain last confirmed device state; credentials remain hidden while pending.
        result = null;
      }
      confirmed =
        !!result?.online && result.state.access_active === wantsActive;
      if (confirmed && result) {
        await tx.device.update({
          where: { id: device.id },
          data: { state: result.state, syncedAt: new Date() },
        });
        if (
          (device.state as SmartDevice["state"]).access_active !== wantsActive
        )
          await tx.audit.create({
            data: {
              organizationId,
              actorId,
              action: "MOCK_ACCESS_COMMAND_CONFIRMED",
              targetId: device.id,
              metadata: { mode: "SIMULATION", accessActive: wantsActive },
            },
          });
      }
    }

    for (const plan of plans) {
      const existing = device.accesses.find(
        (access) => access.stayId === plan.stay.id,
      );
      let status: AccessStatus = plan.status;
      if (
        !confirmed &&
        (status === "ACTIVE" ||
          status === "REVOKED" ||
          (status === "SCHEDULED" && existing?.status === "ACTIVE"))
      )
        status = "PENDING";
      const revoked = plan.status === "REVOKED";
      const revokedAt = revoked ? (existing?.revokedAt ?? new Date()) : null;
      const changed =
        !existing ||
        existing.status !== status ||
        existing.validFrom !== plan.stay.start ||
        existing.validUntil !== plan.stay.end ||
        Boolean(existing.revokedAt) !== revoked;
      if (changed) {
        if (existing) {
          await tx.smartAccess.update({
            where: { id: existing.id },
            data: {
              status,
              validFrom: plan.stay.start,
              validUntil: plan.stay.end,
              revokedAt,
            },
          });
        } else {
          // The PIN is stored encrypted and never placed in audit metadata or device state.
          await tx.smartAccess.create({
            data: {
              deviceId: device.id,
              stayId: plan.stay.id,
              status,
              validFrom: plan.stay.start,
              validUntil: plan.stay.end,
              revokedAt,
              encryptedPin: encryptSecret(
                randomInt(0, 1_000_000).toString().padStart(6, "0"),
              ),
              provider: "MOCK",
            },
          });
        }
        await tx.audit.create({
          data: {
            organizationId,
            actorId,
            action: `SMART_ACCESS_${status}`,
            targetId: plan.stay.id,
            metadata: {
              deviceId: device.id,
              mode: "SIMULATION",
              online: device.online,
              reason:
                status === "PENDING"
                  ? "Menunggu konfirmasi perangkat"
                  : plan.reason,
              validFrom: plan.stay.start,
              validUntil: plan.stay.end,
              revocationRequested: revoked,
            },
          },
        });
      }
      if (status === "ACTIVE") summary.active++;
      else if (status === "SCHEDULED") summary.scheduled++;
      else if (status === "PENDING") summary.pending++;
      else summary.revoked++;
    }
  }
  return summary;
}

export type TenantAccess = {
  mode: "SIMULATION";
  status: "ACTIVE" | "REVOKED" | "PENDING";
  validFrom: string;
  validUntil: string | null;
  pin?: string;
};

/** The caller must verify the tenant link's stay and reconcile access before reading. */
export async function tenantAccess(
  db: PrismaClient | Prisma.TransactionClient,
  stayId: string,
  today: string,
): Promise<TenantAccess | null> {
  if (!validDate(today)) throw new Error("Tanggal akses tenant tidak valid.");
  const stay = await db.stay.findUnique({
    where: { id: stayId },
    include: {
      room: { include: { property: true } },
      accesses: {
        include: { device: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!stay || stay.accesses.length === 0) return null;
  const canReveal = (access: (typeof stay.accesses)[number]) =>
    access.status === "ACTIVE" &&
    !access.revokedAt &&
    access.provider === "MOCK" &&
    access.device.provider === "MOCK" &&
    access.device.kind === "LOCK" &&
    access.device.automationEnabled &&
    access.device.online &&
    access.device.roomId === stay.roomId &&
    access.device.propertyId === stay.room.propertyId &&
    (access.device.state as SmartDevice["state"]).access_active === true &&
    eligibleNow(stay.room.property.type, stay.status) &&
    inDates(stay.start, stay.end, today) &&
    inDates(access.validFrom, access.validUntil, today);
  const access =
    stay.accesses.find(canReveal) ??
    stay.accesses.find(
      (item) => item.status === "PENDING" || item.status === "SCHEDULED",
    ) ??
    stay.accesses[0];
  if (canReveal(access))
    return {
      mode: "SIMULATION",
      status: "ACTIVE",
      validFrom: access.validFrom,
      validUntil: access.validUntil,
      pin: decryptSecret(access.encryptedPin),
    };
  const revoked =
    access.status === "REVOKED" ||
    (access.status === "ACTIVE" &&
      (!eligibleStatuses.includes(stay.status) ||
        (!!access.validUntil && today >= access.validUntil) ||
        (!!stay.end && today >= stay.end)));
  return {
    mode: "SIMULATION",
    status: revoked ? "REVOKED" : "PENDING",
    validFrom: access.validFrom,
    validUntil: access.validUntil,
  };
}
