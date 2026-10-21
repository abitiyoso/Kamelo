import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma";
import { z } from "zod";
import { db } from "@/lib/db";
import { currentUser, sessionIdentity, rateLimit } from "@/lib/auth";
import { validOrigin } from "@/lib/origin";
import { importActor } from "@/lib/room-import";
import { openingPreview, openingWrite } from "@/lib/opening-balances";
import {
  ownerOpeningEvidence,
  openingEvidenceWrite,
} from "@/lib/opening-tenant";
import {
  openingSummary,
  openingReceiptDetail,
  openingReceiptWrite,
} from "@/lib/opening-receipts";
import { stableHash } from "@/lib/lifecycle-rules.mjs";
import { decryptSecret } from "@/lib/secrets";
import { localToday } from "@/lib/operations";
import {
  openingReminderPreview,
  openingReminderWrite,
} from "@/lib/opening-reminders";
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
        const a = await importActor(tx, s.token),
          p = req.nextUrl.searchParams,
          scope = p.get("propertyId") || "",
          page = Number(p.get("page") || 1);
        if (!Number.isInteger(page) || page < 1 || page > 100000)
          throw Error("Halaman tidak valid.");
        const properties = await tx.property.findMany({
            where: {
              organizationId: a.organizationId,
              ...(scope !== "all" ? { id: scope } : {}),
            },
            select: { id: true },
          }),
          ids = properties.map((r) => r.id);
        if (scope !== "all" && !ids.length)
          throw Error("Properti tidak ditemukan.");
        const where = { propertyId: { in: ids } };
        const summary = await openingSummary(tx, ids);
        if (p.has("receivableId") && p.get("reminders") === "1")
          return {
            reminders: await openingReminderPreview(
              tx,
              ids,
              p.get("receivableId")!,
              page,
            ),
          };
        if (p.has("receivableId") && p.get("evidence") === "1")
          return {
            evidence: await ownerOpeningEvidence(
              tx,
              ids,
              p.get("receivableId")!,
              page,
              p.get("proofId"),
            ),
          };
        if (p.has("receivableId"))
          return {
            receipt: await openingReceiptDetail(
              tx,
              ids,
              p.get("receivableId")!,
              page,
            ),
          };
        const batches = await tx.openingBalanceBatch.findMany({
          where,
          select: {
            id: true,
            asOf: true,
            status: true,
            recordCount: true,
            createdAt: true,
            property: { select: { name: true } },
          },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: 20,
          skip: (page - 1) * 20,
        });
        let detail = null;
        if (p.get("batchId")) {
          const batch = await tx.openingBalanceBatch.findFirst({
            where: { id: p.get("batchId")!, ...where },
            select: {
              id: true,
              asOf: true,
              status: true,
              createdAt: true,
              recordCount: true,
              encryptedSourceNote: true,
              encryptedVoidReason: true,
              voidedAt: true,
              property: { select: { name: true } },
              rows: {
                select: {
                  id: true,
                  reference: true,
                  amount: true,
                  due: true,
                  status: true,
                  guest: { select: { name: true } },
                  _count: { select: { entries: true, proofs: true } },
                },
                orderBy: { id: "asc" },
              },
            },
          });
          if (!batch) throw Error("Batch tidak ditemukan.");
          const { encryptedSourceNote, encryptedVoidReason, ...rest } = batch;
          detail = {
            ...rest,
            sourceNote: decryptSecret(encryptedSourceNote),
            voidReason: encryptedVoidReason
              ? decryptSecret(encryptedVoidReason)
              : null,
          };
        }
        return {
          summary,
          batches,
          totalBatches: await tx.openingBalanceBatch.count({ where }),
          page,
          detail,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    return NextResponse.json(result, { headers });
  } catch {
    return NextResponse.json(
      {
        error:
          "Register saldo awal tidak tersedia. Periksa akses dan filter Anda.",
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
    await rateLimit("opening-balances:" + s.userId, 60);
    const text = await req.text();
    if (text.length > 120000) throw Error("Permintaan terlalu besar.");
    const body = z
      .object({
        action: z.enum([
          "preview",
          "commit",
          "void",
          "receipt",
          "reverseReceipt",
          "refundReceipt",
          "shareOpening",
          "revokeOpening",
          "reviewOpeningProof",
          "remindOpening",
        ]),
      })
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
          return openingPreview(tx, a.organizationId, body);
        const key = z.string().uuid().parse(body.key),
          requestHash = stableHash({
            ...body,
            actorId: a.userId,
            domain: "OPENING_BALANCES",
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
        const response =
          body.action === "remindOpening"
            ? await openingReminderWrite(tx, a, body)
            : ["receipt", "reverseReceipt", "refundReceipt"].includes(
                  body.action,
                )
              ? await openingReceiptWrite(tx, a, body)
              : [
                    "shareOpening",
                    "revokeOpening",
                    "reviewOpeningProof",
                  ].includes(body.action)
                ? await openingEvidenceWrite(tx, a, body)
                : await openingWrite(tx, a, body);
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
