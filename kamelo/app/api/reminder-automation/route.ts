import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma";
import { z } from "zod";
import { db } from "@/lib/db";
import { currentUser, sessionIdentity, rateLimit } from "@/lib/auth";
import { validOrigin } from "@/lib/origin";
import { importActor } from "@/lib/room-import";
import {
  reminderRead,
  reminderSave,
  runReminderProperty,
} from "@/lib/reminder-automation";
import { stableHash } from "@/lib/lifecycle-rules.mjs";
const headers = {
  "Cache-Control": "private, no-store",
  "Referrer-Policy": "no-referrer",
};
export async function GET(req: NextRequest) {
  await currentUser();
  const s = await sessionIdentity();
  if (!s)
    return NextResponse.json(
      { error: "Silakan masuk." },
      { status: 401, headers },
    );
  try {
    const propertyId = z
      .string()
      .min(1)
      .max(100)
      .parse(req.nextUrl.searchParams.get("propertyId"));
    const page = z.coerce
      .number()
      .int()
      .min(1)
      .max(100000)
      .parse(req.nextUrl.searchParams.get("page") || 1);
    const result = await db.$transaction(
      async (tx) => {
        const a = await importActor(tx, s.token);
        return reminderRead(tx, a.organizationId, propertyId, page);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    return NextResponse.json(result, { headers });
  } catch {
    return NextResponse.json(
      {
        error:
          "Pengaturan pengingat tidak tersedia. Periksa properti dan akses owner.",
      },
      { status: 403, headers },
    );
  }
}
export async function POST(req: NextRequest) {
  if (!validOrigin(req))
    return NextResponse.json(
      { error: "Permintaan tidak diizinkan." },
      { status: 403, headers },
    );
  await currentUser();
  const s = await sessionIdentity();
  if (!s)
    return NextResponse.json(
      { error: "Silakan masuk." },
      { status: 401, headers },
    );
  try {
    await rateLimit("reminder-automation:" + s.userId, 60);
    const text = await req.text();
    if (text.length > 5000) throw Error("Permintaan terlalu besar.");
    const body = z
      .object({
        action: z.enum(["save", "run"]),
        key: z.string().uuid(),
        propertyId: z.string().min(1).max(100),
        confirmed: z.literal(true),
      })
      .passthrough()
      .parse(JSON.parse(text));
    const result = await db.$transaction(
      async (tx) => {
        const before = await importActor(tx, s.token);
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${before.organizationId}))`;
        const a = await importActor(tx, s.token);
        if (a.organizationId !== before.organizationId)
          throw Error("Workspace berubah.");
        if (
          !(await tx.property.findFirst({
            where: { id: body.propertyId, organizationId: a.organizationId },
          }))
        )
          throw Error("Properti tidak ditemukan.");
        const requestHash = stableHash({
          ...body,
          actorId: a.userId,
          domain: "REMINDER_AUTOMATION",
        });
        const old = await tx.lifecycleCommand.findUnique({
          where: {
            organizationId_key: {
              organizationId: a.organizationId,
              key: body.key,
            },
          },
        });
        if (old) {
          if (old.requestHash !== requestHash)
            throw Error("Kunci permintaan sudah digunakan untuk data berbeda.");
          return old.response;
        }
        const response =
          body.action === "save"
            ? await reminderSave(tx, a, body)
            : await runReminderProperty(tx, body.propertyId);
        await tx.lifecycleCommand.create({
          data: {
            organizationId: a.organizationId,
            key: body.key,
            requestHash,
            response,
          },
        });
        return response;
      },
      { timeout: 15000 },
    );
    return NextResponse.json({ ok: true, result }, { headers });
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof z.ZodError
            ? "Periksa jadwal dan konfirmasi pengingat."
            : e instanceof Prisma.PrismaClientKnownRequestError ||
                e instanceof Prisma.PrismaClientUnknownRequestError
              ? "Data berubah bersamaan. Muat ulang pengaturan."
              : e instanceof Error
                ? e.message
                : "Pengingat belum diproses.",
      },
      { status: 400, headers },
    );
  }
}
