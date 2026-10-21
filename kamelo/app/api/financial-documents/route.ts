import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma";
import { z } from "zod";
import { db } from "@/lib/db";
import { currentUser, sessionIdentity, rateLimit } from "@/lib/auth";
import { validOrigin } from "@/lib/origin";
import {
  documentActor,
  documentDetail,
  documentRead,
  documentWrite,
} from "@/lib/financial-documents";
import { stableHash } from "@/lib/lifecycle-rules.mjs";
import { receiptHtml } from "@/lib/receipt-html.mjs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
const headers = {
  "Cache-Control": "private, no-store",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
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
    const p = req.nextUrl.searchParams,
      page = z.coerce
        .number()
        .int()
        .min(1)
        .max(100000)
        .parse(p.get("page") || 1);
    const reviewPage = z.coerce
      .number()
      .int()
      .min(1)
      .max(100000)
      .parse(p.get("reviewPage") || 1);
    const result = await db.$transaction(
      async (tx) => {
        const a = await documentActor(tx, s.token);
        if (p.has("id"))
          return documentDetail(
            tx,
            a,
            z.string().min(1).max(100).parse(p.get("id")),
            reviewPage,
          );
        return documentRead(tx, a, p.get("propertyId") || "all", page);
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
        timeout: 15000,
      },
    );
    if (p.get("format") === "html" && "snapshot" in result) {
      const logo = (
        await readFile(
          join(process.cwd(), "public/brand/kamelo-backoffice.png"),
        )
      ).toString("base64");
      return new NextResponse(receiptHtml(result, logo), {
        headers: {
          ...headers,
          "Content-Type": "text/html; charset=utf-8",
          "Content-Disposition": `${p.get("download") === "1" ? "attachment" : "inline"}; filename="${result.number}.html"`,
          "Content-Security-Policy":
            "default-src 'none'; img-src data:; style-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
        },
      });
    }
    return NextResponse.json(result, { headers });
  } catch {
    return NextResponse.json(
      {
        error:
          "Arsip kuitansi tidak tersedia. Periksa akses tagihan atau properti Anda.",
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
    await rateLimit("financial-documents:" + s.userId, 60);
    const text = await req.text();
    if (text.length > 6000) throw Error("Permintaan terlalu besar.");
    const body = z
      .object({
        action: z.enum(["issue", "review"]),
        key: z.string().uuid(),
        confirmed: z.literal(true),
      })
      .passthrough()
      .parse(JSON.parse(text));
    const result = await db.$transaction(
      async (tx) => {
        const before = await documentActor(tx, s.token);
        if (before.kind !== "OWNER")
          throw Error("Kuitansi hanya dapat diterbitkan oleh owner.");
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${before.organizationId}))`;
        const a = await documentActor(tx, s.token);
        if (a.kind !== "OWNER" || a.organizationId !== before.organizationId)
          throw Error("Workspace berubah.");
        const requestHash = stableHash({
            ...body,
            actorId: a.userId,
            domain: "FINANCIAL_DOCUMENTS",
          }),
          old = await tx.lifecycleCommand.findUnique({
            where: {
              organizationId_key: {
                organizationId: a.organizationId,
                key: body.key,
              },
            },
          });
        if (old) {
          if (old.requestHash !== requestHash)
            throw Error("Kunci permintaan sudah digunakan.");
          return old.response;
        }
        const response = await documentWrite(tx, a, body);
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
            ? "Periksa sumber, konfirmasi, atau tanggal tinjau."
            : e instanceof Prisma.PrismaClientKnownRequestError ||
                e instanceof Prisma.PrismaClientUnknownRequestError
              ? "Data berubah bersamaan. Tinjau ulang arsip."
              : e instanceof Error
                ? e.message
                : "Arsip belum tersimpan.",
      },
      { status: 400, headers },
    );
  }
}
