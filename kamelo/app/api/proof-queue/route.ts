import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma";
import { z } from "zod";
import { db } from "@/lib/db";
import { currentUser, sessionIdentity, rateLimit } from "@/lib/auth";
import { validOrigin } from "@/lib/origin";
import { importActor } from "@/lib/room-import";
import {
  queueFilters,
  proofQueueRead,
  proofQueueDetail,
  proofQueueWrite,
} from "@/lib/proof-queue";
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
    const result = await db.$transaction(
      async (tx) => {
        const a = await importActor(tx, s.token);
        if (req.nextUrl.searchParams.has("proofId")) {
          const source = z
              .enum(["INVOICE", "OPENING"])
              .parse(req.nextUrl.searchParams.get("source")),
            id = z
              .string()
              .min(1)
              .max(100)
              .parse(req.nextUrl.searchParams.get("proofId"));
          return {
            detail: await proofQueueDetail(tx, a.organizationId, source, id),
          };
        }
        return proofQueueRead(
          tx,
          a.organizationId,
          queueFilters.parse(Object.fromEntries(req.nextUrl.searchParams)),
        );
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    return NextResponse.json(result, { headers });
  } catch {
    return NextResponse.json(
      { error: "Antrean bukti tidak tersedia. Periksa akses dan filter." },
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
    await rateLimit("proof-queue:" + s.userId, 60);
    const text = await req.text();
    if (text.length > 5000) throw Error("Permintaan terlalu besar.");
    const body = z
      .object({ key: z.string().uuid() })
      .passthrough()
      .parse(JSON.parse(text));
    const result = await db.$transaction(
      async (tx) => {
        const before = await importActor(tx, s.token);
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${before.organizationId}))`;
        const a = await importActor(tx, s.token);
        if (a.organizationId !== before.organizationId)
          throw Error("Workspace berubah.");
        const key = z.string().uuid().parse(body.key),
          requestHash = stableHash({
            ...body,
            actorId: a.userId,
            domain: "PROOF_QUEUE",
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
        const response = await proofQueueWrite(tx, a, body);
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
            ? "Periksa rincian, catatan dan konfirmasi keputusan."
            : e instanceof Prisma.PrismaClientKnownRequestError ||
                e instanceof Prisma.PrismaClientUnknownRequestError
              ? "Data berubah bersamaan. Perbarui antrean."
              : e instanceof SyntaxError
                ? "Permintaan tidak valid."
                : e instanceof Error
                  ? e.message
                  : "Keputusan belum tersimpan.",
      },
      { status: 400, headers },
    );
  }
}
