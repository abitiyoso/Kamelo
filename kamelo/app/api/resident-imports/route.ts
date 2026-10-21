import { importActor } from "@/lib/room-import";
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma";
import { z } from "zod";
import { db } from "@/lib/db";
import { currentUser, sessionIdentity, rateLimit } from "@/lib/auth";
import { validOrigin } from "@/lib/origin";
import {
  residentImportPreview,
  residentImportWrite,
} from "@/lib/resident-import";
import { stableHash } from "@/lib/lifecycle-rules.mjs";
const headers = { "Cache-Control": "private, no-store" };
export async function GET(req: NextRequest) {
  await currentUser();
  const s = await sessionIdentity();
  if (!s)
    return NextResponse.json(
      { error: "Silakan masuk." },
      { status: 401, headers },
    );
  try {
    const result = await db.$transaction(async (tx) => {
      const a = await importActor(tx, s.token),
        propertyId = req.nextUrl.searchParams.get("propertyId") || "";
      if (
        !(await tx.property.count({
          where: { id: propertyId, organizationId: a.organizationId },
        }))
      )
        throw Error("Properti tidak ditemukan.");
      return tx.residentImportBatch.findMany({
        where: { propertyId },
        select: {
          id: true,
          recordCount: true,
          status: true,
          createdAt: true,
          rolledBackAt: true,
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 20,
      });
    });
    return NextResponse.json({ rows: result }, { headers });
  } catch {
    return NextResponse.json(
      { error: "Riwayat impor tidak tersedia." },
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
    await rateLimit("resident-import:" + s.userId, 60);
    const text = await req.text();
    if (text.length > 120000) throw Error("Permintaan terlalu besar.");
    const body = z
      .object({ action: z.enum(["preview", "commit", "rollback"]) })
      .passthrough()
      .parse(JSON.parse(text));
    const result = await db.$transaction(
      async (tx) => {
        const initial = await importActor(tx, s.token);
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${initial.organizationId}))`;
        const a = await importActor(tx, s.token);
        if (a.organizationId !== initial.organizationId)
          throw Error("Workspace berubah. Muat ulang.");
        if (body.action === "preview")
          return residentImportPreview(tx, a.organizationId, body);
        const key = z.string().uuid().parse(body.key),
          requestHash = stableHash({
            ...body,
            actorId: a.userId,
            domain: "RESIDENT_IMPORT",
          });
        const previous = await tx.lifecycleCommand.findUnique({
          where: {
            organizationId_key: { organizationId: a.organizationId, key },
          },
        });
        if (previous) {
          if (previous.requestHash !== requestHash)
            throw Error("Kunci permintaan sudah digunakan untuk data berbeda.");
          return previous.response;
        }
        const response = await residentImportWrite(tx, a, body);
        await tx.lifecycleCommand.create({
          data: {
            organizationId: a.organizationId,
            key,
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
            ? "Periksa CSV, pemetaan, dan konfirmasi Anda."
            : e instanceof Prisma.PrismaClientKnownRequestError ||
                e instanceof Prisma.PrismaClientUnknownRequestError
              ? "Data berubah bersamaan. Pratinjau ulang dan coba kembali."
              : e instanceof SyntaxError
                ? "Permintaan tidak valid."
                : e instanceof Error
                  ? e.message
                  : "Impor belum tersimpan.",
      },
      { status: 400, headers },
    );
  }
}
