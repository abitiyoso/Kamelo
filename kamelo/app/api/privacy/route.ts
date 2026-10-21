import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma";
import { z } from "zod";
import { db } from "@/lib/db";
import { sessionIdentity, rateLimit } from "@/lib/auth";
import { validOrigin } from "@/lib/origin";
import { privacyActor, privacyWrite, accountSummary } from "@/lib/privacy";
import { privacyKinds, privacyStatuses } from "@/lib/privacy-rules.mjs";
import { stableHash } from "@/lib/lifecycle-rules.mjs";
import { decryptSecret } from "@/lib/secrets";
const headers = {
  "Cache-Control": "private, no-store",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};
const select = {
  id: true,
  kind: true,
  status: true,
  revision: true,
  createdAt: true,
  updatedAt: true,
  requester: { select: { name: true } },
} as const;
function pageValue(v: string | null) {
  const n = Number(v || 1);
  if (!Number.isInteger(n) || n < 1 || n > 100000)
    throw Error("Halaman tidak valid.");
  return n;
}
export async function GET(req: NextRequest) {
  const s = await sessionIdentity();
  if (!s)
    return NextResponse.json(
      { error: "Silakan masuk." },
      { status: 401, headers },
    );
  try {
    return await db.$transaction(
      async (tx) => {
        const p = req.nextUrl.searchParams,
          platform = p.get("platform") === "1";
        let a;
        try {
          a = await privacyActor(tx, s.token, platform);
        } catch {
          return NextResponse.json(
            { error: "Akses privasi tidak tersedia pada konteks ini." },
            { status: 403, headers },
          );
        }
        if (p.has("userId") || p.has("organizationId"))
          throw Error("Pemilihan akun lain tidak diizinkan.");
        if (p.get("summary") === "1") {
          if (platform)
            return NextResponse.json(
              { error: "Ringkasan hanya dapat diunduh oleh pemilik akun." },
              { status: 403, headers },
            );
          return NextResponse.json(await accountSummary(tx, a.userId), {
            headers: {
              ...headers,
              "Content-Disposition":
                'attachment; filename="kamelo-ringkasan-akun.json"',
            },
          });
        }
        const id = p.get("requestId"),
          page = pageValue(p.get("page")),
          where: Prisma.PrivacyRequestWhereInput = a.platform
            ? {}
            : { requesterId: a.userId };
        if (id) {
          const request = await tx.privacyRequest.findFirst({
            where: { id, ...where },
            select,
          });
          if (!request)
            return NextResponse.json(
              { error: "Permintaan tidak ditemukan." },
              { status: 404, headers },
            );
          const entries = await tx.privacyEntry.findMany({
            where: { requestId: id },
            select: {
              id: true,
              kind: true,
              status: true,
              revision: true,
              actorRole: true,
              encryptedBody: true,
              createdAt: true,
            },
            orderBy: { revision: "desc" },
            take: 30,
            skip: (page - 1) * 30,
          });
          return NextResponse.json(
            {
              request,
              entries: entries.map(({ encryptedBody, ...e }) => ({
                ...e,
                ...JSON.parse(decryptSecret(encryptedBody)),
              })),
              total: await tx.privacyEntry.count({ where: { requestId: id } }),
              page,
            },
            { headers },
          );
        }
        const kind = p.get("kind") || "",
          status = p.get("status") || "";
        if (
          (kind && !privacyKinds.includes(kind)) ||
          (status && !privacyStatuses.includes(status))
        )
          throw Error("Filter tidak valid.");
        if (kind) where.kind = kind;
        if (status) where.status = status;
        return NextResponse.json(
          {
            rows: await tx.privacyRequest.findMany({
              where,
              select,
              orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
              take: 20,
              skip: (page - 1) * 20,
            }),
            total: await tx.privacyRequest.count({ where }),
            page,
          },
          { headers },
        );
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof Error &&
          e.message.startsWith("Ringkasan melebihi batas unduhan.")
            ? e.message
            : "Data privasi belum dapat dimuat. Periksa filter dan coba kembali.",
      },
      { status: 400, headers },
    );
  }
}
export async function POST(req: NextRequest) {
  if (!validOrigin(req))
    return NextResponse.json(
      { error: "Permintaan tidak diizinkan." },
      { status: 403, headers },
    );
  const s = await sessionIdentity();
  if (!s)
    return NextResponse.json(
      { error: "Silakan masuk." },
      { status: 401, headers },
    );
  try {
    await rateLimit("privacy:" + s.userId, 80);
    const body = await req.json(),
      key = z.string().uuid().parse(body.key),
      platform = body.platform === true;
    const requestHash = stableHash({
      ...body,
      actorId: s.userId,
      domain: "PRIVACY",
    });
    const result = await db.$transaction(
      async (tx) => {
        const initial = await privacyActor(tx, s.token, platform);
        const target =
          body.action === "create"
            ? { requesterId: initial.userId }
            : await tx.privacyRequest.findFirst({
                where: {
                  id: String(body.requestId || ""),
                  ...(!platform ? { requesterId: initial.userId } : {}),
                },
                select: { requesterId: true },
              });
        if (!target) throw Error("Permintaan tidak ditemukan.");
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"privacy:" + target.requesterId}))`;
        const a = await privacyActor(tx, s.token, platform);
        const user = await tx.user.findUniqueOrThrow({
          where: { id: target.requesterId },
          select: { organizationId: true },
        });
        const previous = await tx.lifecycleCommand.findUnique({
          where: {
            organizationId_key: { organizationId: user.organizationId, key },
          },
        });
        if (previous) {
          if (previous.requestHash !== requestHash)
            throw Error("Kunci permintaan telah digunakan untuk data berbeda.");
          return previous.response;
        }
        const response = await privacyWrite(tx, a, body);
        await tx.lifecycleCommand.create({
          data: {
            organizationId: user.organizationId,
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
            ? "Periksa jenis, isi permintaan, versi dan konfirmasi Anda."
            : e instanceof Prisma.PrismaClientKnownRequestError ||
                e instanceof Prisma.PrismaClientUnknownRequestError
              ? "Data berubah bersamaan. Muat ulang sebelum mencoba kembali."
              : e instanceof Error
                ? e.message
                : "Permintaan belum tersimpan.",
      },
      { status: 400, headers },
    );
  }
}
