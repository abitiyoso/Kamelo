import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma";
import { z } from "zod";
import { db } from "@/lib/db";
import { currentUser, sessionIdentity, rateLimit } from "@/lib/auth";
import { validOrigin } from "@/lib/origin";
import { stableHash } from "@/lib/lifecycle-rules.mjs";
import { supportWrite } from "@/lib/support";
import { decryptSecret } from "@/lib/secrets";
import { supportStatuses } from "@/lib/support-rules.mjs";
const headers = {
  "Cache-Control": "private, no-store",
  "Referrer-Policy": "no-referrer",
};
function pageValue(v: string | null) {
  const n = Number(v || 1);
  if (!Number.isInteger(n) || n < 1 || n > 100000)
    throw Error("Halaman tidak valid.");
  return n;
}
const selected = {
  id: true,
  organizationId: true,
  subject: true,
  category: true,
  priority: true,
  status: true,
  revision: true,
  createdAt: true,
  updatedAt: true,
  assigneeId: true,
  organization: { select: { name: true } },
  assignee: { select: { name: true } },
} as const;
export async function GET(req: NextRequest) {
  const u = await currentUser();
  if (!u)
    return NextResponse.json(
      { error: "Silakan masuk." },
      { status: 401, headers },
    );
  if (!["OWNER", "PLATFORM_ADMIN"].includes(u.role))
    return NextResponse.json(
      { error: "Akses bantuan organisasi tidak diizinkan." },
      { status: 403, headers },
    );
  try {
    const p = req.nextUrl.searchParams,
      platform = u.role === "PLATFORM_ADMIN";
    const organizationId = platform
      ? p.get("organizationId") || undefined
      : u.organizationId;
    if (
      !platform &&
      p.has("organizationId") &&
      p.get("organizationId") !== u.organizationId
    )
      return NextResponse.json(
        { error: "Tiket tidak ditemukan." },
        { status: 404, headers },
      );
    const caseId = p.get("caseId");
    return await db.$transaction(
      async (tx) => {
        if (caseId) {
          const c = await tx.supportCase.findFirst({
            where: { id: caseId, organizationId },
            select: selected,
          });
          if (!c)
            return NextResponse.json(
              { error: "Tiket tidak ditemukan." },
              { status: 404, headers },
            );
          const page = pageValue(p.get("entryPage"));
          const entries = await tx.supportEntry.findMany({
            where: { caseId },
            orderBy: { revision: "desc" },
            take: 30,
            skip: (page - 1) * 30,
            select: {
              id: true,
              kind: true,
              actorRole: true,
              encryptedBody: true,
              status: true,
              revision: true,
              createdAt: true,
            },
          });
          return NextResponse.json(
            {
              case: c,
              entries: entries.map(({ encryptedBody, ...e }) => ({
                ...e,
                message: decryptSecret(encryptedBody),
              })),
              entryPage: page,
              entryTotal: await tx.supportEntry.count({ where: { caseId } }),
            },
            { headers },
          );
        }
        const page = pageValue(p.get("page")),
          q = (p.get("q") || "").trim();
        if (q.length > 100) throw Error("Pencarian terlalu panjang.");
        const status = p.get("status") || "";
        if (status && !supportStatuses.includes(status))
          throw Error("Status tidak valid.");
        const where: Prisma.SupportCaseWhereInput = {
          organizationId,
          ...(status ? { status } : {}),
          ...(q
            ? {
                OR: [
                  { subject: { contains: q, mode: "insensitive" } },
                  { id: { equals: q } },
                  ...(platform
                    ? [
                        {
                          organization: {
                            name: { contains: q, mode: "insensitive" as const },
                          },
                        },
                      ]
                    : []),
                ],
              }
            : {}),
        };
        return NextResponse.json(
          {
            organizationId: platform ? null : u.organizationId,
            rows: await tx.supportCase.findMany({
              where,
              select: selected,
              orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
              take: 20,
              skip: (page - 1) * 20,
            }),
            total: await tx.supportCase.count({ where }),
            page,
            summary: await tx.supportCase.groupBy({
              by: ["status"],
              where: { organizationId },
              _count: { _all: true },
            }),
          },
          { headers },
        );
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  } catch {
    return NextResponse.json(
      { error: "Bantuan belum dapat dimuat. Periksa filter dan coba kembali." },
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
  const user = await currentUser(),
    identity = await sessionIdentity();
  if (!user)
    return NextResponse.json(
      { error: "Silakan masuk." },
      { status: 401, headers },
    );
  if (!["OWNER", "PLATFORM_ADMIN"].includes(user.role))
    return NextResponse.json(
      { error: "Akses tidak diizinkan." },
      { status: 403, headers },
    );
  try {
    await rateLimit("support:" + user.id, 80);
    const body = await req.json(),
      key = z.string().uuid().parse(body.key),
      organizationId = z.string().min(1).max(100).parse(body.organizationId);
    if (user.role === "OWNER" && organizationId !== user.organizationId)
      return NextResponse.json(
        { error: "Akses tidak diizinkan." },
        { status: 403, headers },
      );
    const requestHash = stableHash({
      ...body,
      actorId: user.id,
      domain: "SUPPORT",
    });
    const result = await db.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${organizationId}))`;
        const session = identity
          ? await tx.session.findUnique({
              where: { token: identity.token },
              include: { user: true },
            })
          : null;
        if (
          !session ||
          session.userId !== user.id ||
          session.expires <= new Date() ||
          ["PENDING", "SUSPENDED", "CLOSED"].includes(
            session.user.accountStatus,
          )
        )
          throw Error("Akses berubah. Masuk kembali.");
        if (user.role === "PLATFORM_ADMIN") {
          if (session.contextType !== "PLATFORM" || !session.user.platformAdmin)
            throw Error("Akses platform telah berubah.");
        } else {
          const member = await tx.orgMembership.findFirst({
            where: {
              id: user.membershipId || "",
              userId: user.id,
              organizationId,
              role: "OWNER",
              status: "ACTIVE",
            },
          });
          if (
            !member ||
            session.contextType !== "ORG" ||
            (session.membershipId && session.membershipId !== member.id)
          )
            throw Error("Akses organisasi telah berubah.");
        }
        const previous = await tx.lifecycleCommand.findUnique({
          where: { organizationId_key: { organizationId, key } },
        });
        if (previous) {
          if (previous.requestHash !== requestHash)
            throw Error("Kunci permintaan telah digunakan untuk data berbeda.");
          return previous.response;
        }
        const data = await supportWrite(tx, user, organizationId, body);
        await tx.lifecycleCommand.create({
          data: { organizationId, key, requestHash, response: data },
        });
        return data;
      },
      { timeout: 15000 },
    );
    return NextResponse.json({ ok: true, result }, { headers });
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof z.ZodError
            ? "Periksa isi tiket, status, dan konfirmasi Anda."
            : e instanceof Prisma.PrismaClientKnownRequestError ||
                e instanceof Prisma.PrismaClientUnknownRequestError
              ? "Data berubah bersamaan. Muat ulang sebelum mencoba kembali."
              : e instanceof Error
                ? e.message
                : "Permintaan belum dapat diproses.",
      },
      { status: 400, headers },
    );
  }
}
