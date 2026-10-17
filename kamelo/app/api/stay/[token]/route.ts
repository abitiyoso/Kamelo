import QRCode from "qrcode";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { hashToken, rateLimit } from "@/lib/auth";
import { activeStay, ticketInput, localToday } from "@/lib/operations";
import { decryptSecret } from "@/lib/secrets";
import { syncRoomAccess, tenantAccess } from "@/lib/smart-access";
import { validOrigin } from "@/lib/origin";
import { MockTuyaProvider, SmartDevice } from "@/lib/iot";

const headers = {
  "Cache-Control": "private, no-store",
  "Referrer-Policy": "no-referrer",
};
async function resolve(token: string) {
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  const link = await db.stayLink.findUnique({
    where: { tokenHash: hashToken(token) },
    include: {
      stay: { include: { guest: true, room: { include: { property: true } } } },
    },
  });
  return link &&
    !link.revokedAt &&
    link.expiresAt > new Date() &&
    activeStay(link.stay)
    ? link
    : null;
}
type Context = { params: Promise<{ token: string }> };
export async function GET(_req: NextRequest, ctx: Context) {
  try {
    const { token } = await ctx.params;
    const initial = await resolve(token);
    if (!initial)
      return NextResponse.json(
        { error: "Tautan tidak aktif atau masa tinggal sudah selesai." },
        { status: 404, headers },
      );
    return await db.$transaction(
      async (tx) => {
        const property = initial.stay.room.property;
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${property.organizationId}))`;
        const current = await tx.stayLink.findUnique({
          where: { id: initial.id },
          include: {
            stay: {
              include: { room: { include: { property: true } }, guest: true },
            },
          },
        });
        if (
          !current ||
          current.revokedAt ||
          current.expiresAt <= new Date() ||
          !activeStay(current.stay)
        )
          return NextResponse.json(
            { error: "Tautan tidak aktif." },
            { status: 404, headers },
          );
        const stay = current.stay,
          settings = stay.room.property;
        if (current.includeAccess)
          await syncRoomAccess(
            tx,
            stay.roomId,
            localToday(),
            "guest-access-refresh",
            property.organizationId,
          );
        const devices = await tx.device.findMany({
          where: {
            roomId: stay.roomId,
            propertyId: property.id,
            guestControllable: true,
            provider: "MOCK",
            kind: { not: "LOCK" },
          },
          select: {
            id: true,
            name: true,
            online: true,
            state: true,
            capabilities: true,
          },
        });
        const tickets = await tx.ticket.findMany({
          where: { stayId: stay.id, propertyId: property.id },
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            title: true,
            description: true,
            category: true,
            priority: true,
            status: true,
            createdAt: true,
            updates: {
              select: { note: true, status: true, createdAt: true },
              orderBy: { createdAt: "asc" },
            },
          },
        });
        const wifiPassword = settings.encryptedWifiPassword
          ? decryptSecret(settings.encryptedWifiPassword)
          : "";
        const escapeWifi = (value: string) =>
          value.replace(/([\\;,:"])/g, "\\$1");
        const wifiQr = settings.wifiSsid
          ? await QRCode.toDataURL(
              `WIFI:T:${wifiPassword ? "WPA" : "nopass"};S:${escapeWifi(settings.wifiSsid)};P:${escapeWifi(wifiPassword)};;`,
              { width: 220, margin: 2, errorCorrectionLevel: "M" },
            )
          : null;
        return NextResponse.json(
          {
            property: settings.name,
            room: stay.room.number,
            guest: stay.guest.name,
            start: stay.start,
            end: stay.end,
            wifiSsid: settings.wifiSsid,
            wifiQr,
            wifiPassword: settings.encryptedWifiPassword
              ? decryptSecret(settings.encryptedWifiPassword)
              : "",
            instructions: settings.guestInstructions,
            supportPhone: settings.supportPhone,
            devices,
            tickets,
            access: current.includeAccess
              ? await tenantAccess(tx, stay.id, localToday())
              : null,
          },
          { headers },
        );
      },
      { timeout: 15000 },
    );
  } catch {
    return NextResponse.json(
      { error: "Layanan sementara tidak tersedia." },
      { status: 503, headers },
    );
  }
}
export async function POST(req: NextRequest, ctx: Context) {
  try {
    if (!validOrigin(req))
      return NextResponse.json(
        { error: "Permintaan tidak diizinkan." },
        { status: 403, headers },
      );
    const { token } = await ctx.params,
      initial = await resolve(token);
    if (!initial)
      return NextResponse.json(
        { error: "Tautan tidak aktif." },
        { status: 404, headers },
      );
    await rateLimit("stay:" + initial.id, 30);
    const body = await req.json();
    const result = await db.$transaction(async (tx) => {
      const property = initial.stay.room.property;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${property.organizationId}))`;
      const link = await tx.stayLink.findUnique({
        where: { id: initial.id },
        include: { stay: true },
      });
      if (
        !link ||
        link.revokedAt ||
        link.expiresAt <= new Date() ||
        !activeStay(link.stay)
      )
        throw new Error("Masa tinggal atau tautan tidak aktif.");
      if (body.action === "ticket") {
        const input = ticketInput.parse(body);
        const ticket = await tx.ticket.create({
          data: {
            ...input,
            propertyId: property.id,
            stayId: link.stayId,
            createdBy: "GUEST",
            updates: {
              create: {
                actorId: "GUEST",
                note: "Permintaan diterima oleh pengelola.",
                status: "OPEN",
              },
            },
          },
        });
        await tx.audit.create({
          data: {
            organizationId: property.organizationId,
            actorId: "GUEST",
            action: "GUEST_TICKET_CREATED",
            targetId: ticket.id,
            metadata: {},
          },
        });
      } else if (body.action === "device") {
        const input = z
          .object({
            deviceId: z.string(),
            code: z.string(),
            value: z.union([z.boolean(), z.number().int()]),
          })
          .parse(body);
        const device = await tx.device.findFirst({
          where: {
            id: input.deviceId,
            propertyId: property.id,
            roomId: link.stay.roomId,
            guestControllable: true,
            provider: "MOCK",
            kind: { not: "LOCK" },
          },
        });
        if (!device)
          throw new Error("Perangkat tidak tersedia untuk kamar ini.");
        const provider = new MockTuyaProvider([
          {
            ...device,
            capabilities: device.capabilities as SmartDevice["capabilities"],
            state: device.state as SmartDevice["state"],
          },
        ]);
        const updated = await provider.sendDeviceCommand(device.id, {
          code: input.code,
          value: input.value,
        });
        await tx.device.update({
          where: { id: device.id },
          data: { state: updated.state, syncedAt: new Date() },
        });
        await tx.audit.create({
          data: {
            organizationId: property.organizationId,
            actorId: "GUEST",
            action: "GUEST_MOCK_COMMAND",
            targetId: device.id,
            metadata: { code: input.code, value: input.value },
          },
        });
      } else throw new Error("Aksi tidak dikenal.");
      return { ok: true };
    });
    return NextResponse.json(result, { headers });
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof z.ZodError
            ? "Periksa kembali isian Anda."
            : e instanceof Error
              ? e.message
              : "Permintaan gagal.",
      },
      { status: 400, headers },
    );
  }
}
