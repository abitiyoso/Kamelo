import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma";
import { z } from "zod";
import { db } from "@/lib/db";
import { currentUser, sessionIdentity, rateLimit } from "@/lib/auth";
import { validOrigin } from "@/lib/origin";
import {
  messageActor,
  messageWrite,
  threadScope,
  threadSelect,
} from "@/lib/messages";
import { decryptSecret } from "@/lib/secrets";
import { stableHash } from "@/lib/lifecycle-rules.mjs";
import { activeStay } from "@/lib/operations";
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
async function session() {
  await currentUser();
  return sessionIdentity();
}
export async function GET(req: NextRequest) {
  const s = await session();
  if (!s)
    return NextResponse.json(
      { error: "Silakan masuk." },
      { status: 401, headers },
    );
  try {
    return await db.$transaction(
      async (tx) => {
        let a;
        try {
          a = await messageActor(tx, s.token);
        } catch {
          return NextResponse.json(
            { error: "Akses pesan tidak tersedia." },
            { status: 403, headers },
          );
        }
        const p = req.nextUrl.searchParams,
          page = pageValue(p.get("page")),
          id = p.get("threadId");
        if (id) {
          const thread = await tx.messageThread.findFirst({
            where: { id, ...threadScope(a) },
            select: threadSelect,
          });
          if (!thread)
            return NextResponse.json(
              { error: "Percakapan tidak ditemukan." },
              { status: 404, headers },
            );
          const entries = await tx.messageEntry.findMany({
            where: { threadId: id },
            orderBy: { revision: "desc" },
            take: 30,
            skip: (page - 1) * 30,
            select: {
              id: true,
              revision: true,
              kind: true,
              actorRole: true,
              encryptedBody: true,
              createdAt: true,
            },
          });
          return NextResponse.json(
            {
              thread,
              role: a.role,
              active: activeStay(thread.stay),
              entries: entries.map(({ encryptedBody, ...e }) => ({
                ...e,
                message: decryptSecret(encryptedBody),
              })),
              total: await tx.messageEntry.count({ where: { threadId: id } }),
              page,
            },
            { headers },
          );
        }
        const propertyId = p.get("propertyId") || "";
        if (a.role !== "TENANT") {
          const property = await tx.property.findFirst({
            where: {
              id: propertyId,
              organizationId: a.organizationId,
              ...(a.role === "STAFF"
                ? { id: { equals: propertyId, in: a.propertyIds } }
                : {}),
            },
            select: { id: true },
          });
          if (!property)
            return NextResponse.json(
              { error: "Properti tidak ditemukan." },
              { status: 404, headers },
            );
        } else if (propertyId) {
          const stay = await tx.stay.findUniqueOrThrow({
            where: { id: a.stayId! },
            select: { room: { select: { propertyId: true } } },
          });
          if (stay.room.propertyId !== propertyId)
            return NextResponse.json(
              { error: "Properti tidak ditemukan." },
              { status: 404, headers },
            );
        }
        if (p.get("recipients") === "1") {
          if (a.role !== "OWNER")
            return NextResponse.json(
              { error: "Akses penerima ditolak." },
              { status: 403, headers },
            );
          const q = (p.get("q") || "").trim();
          if (q.length > 100) throw Error("Pencarian terlalu panjang.");
          const where: Prisma.OccupantAccessWhereInput = {
            status: "ACTIVE",
            revokedAt: null,
            user: {
              emailVerifiedAt: { not: null },
              accountStatus: { notIn: ["PENDING", "SUSPENDED", "CLOSED"] },
              ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
            },
            stay: { room: { propertyId } },
          };
          const grants = await tx.occupantAccess.findMany({
            where,
            include: {
              user: { select: { id: true, name: true } },
              stay: {
                select: {
                  id: true,
                  status: true,
                  start: true,
                  end: true,
                  room: { select: { number: true } },
                },
              },
            },
            orderBy: { id: "asc" },
            take: 30,
            skip: (page - 1) * 30,
          });
          return NextResponse.json(
            {
              recipients: grants.map((g) => ({
                stayId: g.stay.id,
                userId: g.user.id,
                name: g.user.name,
                room: g.stay.room.number,
                active: activeStay(g.stay),
              })),
              total: await tx.occupantAccess.count({ where }),
              page,
            },
            { headers },
          );
        }
        const where: Prisma.MessageThreadWhereInput = {
          ...threadScope(a),
          ...(a.role !== "TENANT"
            ? {
                stay: {
                  room: {
                    propertyId,
                    property: { organizationId: a.organizationId },
                  },
                },
              }
            : {}),
        };
        const staff =
          a.role === "OWNER"
            ? await tx.orgMembership.findMany({
                where: {
                  organizationId: a.organizationId,
                  role: "STAFF",
                  status: "ACTIVE",
                  propertyIds: { has: propertyId },
                  user: {
                    accountStatus: {
                      notIn: ["PENDING", "SUSPENDED", "CLOSED"],
                    },
                  },
                },
                select: { id: true, user: { select: { name: true } } },
                orderBy: { createdAt: "asc" },
                take: 100,
              })
            : [];
        return NextResponse.json(
          {
            role: a.role,
            rows: await tx.messageThread.findMany({
              where,
              select: threadSelect,
              orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
              take: 20,
              skip: (page - 1) * 20,
            }),
            total: await tx.messageThread.count({ where }),
            page,
            staff,
          },
          { headers },
        );
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  } catch {
    return NextResponse.json(
      { error: "Pesan belum dapat dimuat. Periksa filter dan coba kembali." },
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
  const s = await session();
  if (!s)
    return NextResponse.json(
      { error: "Silakan masuk." },
      { status: 401, headers },
    );
  try {
    await rateLimit("message:" + s.userId, 100);
    const body = await req.json(),
      key = z.string().uuid().parse(body.key),
      requestHash = stableHash({
        ...body,
        actorId: s.userId,
        domain: "MESSAGES",
      });
    const result = await db.$transaction(
      async (tx) => {
        const initial = await messageActor(tx, s.token);
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${initial.organizationId}))`;
        const a = await messageActor(tx, s.token);
        if (a.organizationId !== initial.organizationId)
          throw Error("Workspace berubah. Muat ulang.");
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
        const response = await messageWrite(tx, a, body);
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
            ? "Periksa pesan dan konfirmasi Anda."
            : e instanceof Prisma.PrismaClientKnownRequestError ||
                e instanceof Prisma.PrismaClientUnknownRequestError
              ? "Data berubah bersamaan. Muat ulang dan coba kembali."
              : e instanceof Error
                ? e.message
                : "Pesan belum tersimpan.",
      },
      { status: 400, headers },
    );
  }
}
