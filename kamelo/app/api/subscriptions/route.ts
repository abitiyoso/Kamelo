import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma";
import { z } from "zod";
import { db } from "@/lib/db";
import { currentUser, sessionIdentity, rateLimit } from "@/lib/auth";
import { validOrigin } from "@/lib/origin";
import { stableHash } from "@/lib/lifecycle-rules.mjs";
import {
  billingProfileView,
  invoiceRows,
  subscriptionSummary,
  subscriptionWrite,
} from "@/lib/subscriptions";
const headers = {
  "Cache-Control": "private, no-store",
  "Referrer-Policy": "no-referrer",
};
const selected = {
  id: true,
  name: true,
  plan: true,
  subscriptionStatus: true,
  planExpiresAt: true,
} as const;
const pageValue = (v: string | null) => {
  const n = Number(v || 1);
  if (!Number.isInteger(n) || n < 1 || n > 100000)
    throw Error("Halaman tidak valid.");
  return n;
};
export async function GET(req: NextRequest) {
  const user = await currentUser();
  if (!user)
    return NextResponse.json(
      { error: "Silakan masuk." },
      { status: 401, headers },
    );
  const own = req.nextUrl.searchParams.get("own") === "1";
  if (own ? user.role !== "OWNER" : user.role !== "PLATFORM_ADMIN")
    return NextResponse.json(
      { error: "Gunakan workspace dengan izin penagihan yang sesuai." },
      { status: 403, headers },
    );
  try {
    const p = req.nextUrl.searchParams;
    const organizationId = own ? user.organizationId : p.get("organizationId");
    if (
      own &&
      p.has("organizationId") &&
      p.get("organizationId") !== user.organizationId
    )
      return NextResponse.json(
        { error: "Pelanggan tidak ditemukan." },
        { status: 404, headers },
      );
    if (organizationId) {
      const organization = await db.organization.findUnique({
        where: { id: organizationId },
        select: {
          ...selected,
          billingProfile: true,
          properties: { select: { _count: { select: { rooms: true } } } },
          memberships: {
            where: { role: "OWNER", status: "ACTIVE" },
            take: 1,
            orderBy: { createdAt: "asc" },
            select: {
              user: {
                select: { name: true, email: true, emailVerifiedAt: true },
              },
            },
          },
        },
      });
      if (!organization)
        return NextResponse.json(
          { error: "Pelanggan tidak ditemukan." },
          { status: 404, headers },
        );
      const { properties, memberships, billingProfile, ...org } = organization;
      const invoiceId = p.get("invoiceId");
      if (invoiceId) {
        const invoice = await db.subscriptionInvoice.findFirst({
          where: { id: invoiceId, organizationId },
          select: { id: true },
        });
        if (!invoice)
          return NextResponse.json(
            { error: "Tagihan tidak ditemukan." },
            { status: 404, headers },
          );
        const entryPage = pageValue(p.get("entryPage"));
        const entries = await db.subscriptionEntry.findMany({
          where: { invoiceId },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: 30,
          skip: (entryPage - 1) * 30,
          select: {
            id: true,
            kind: true,
            delta: true,
            date: true,
            reference: true,
            note: true,
            receiptId: true,
            reversesId: true,
            reversal: { select: { id: true } },
          },
        });
        return NextResponse.json(
          {
            entries,
            entryPage,
            entryTotal: await db.subscriptionEntry.count({
              where: { invoiceId },
            }),
          },
          { headers },
        );
      }
      const tx = db as unknown as Prisma.TransactionClient;
      const invoices = await invoiceRows(
        tx,
        organizationId,
        pageValue(p.get("invoicePage")),
      );
      const eventPage = pageValue(p.get("eventPage"));
      const events = await db.subscriptionEvent.findMany({
        where: { organizationId },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (eventPage - 1) * 30,
        take: 30,
        select: {
          id: true,
          invoiceId: true,
          kind: true,
          note: true,
          metadata: true,
          createdAt: true,
        },
      });
      return NextResponse.json(
        {
          organization: org,
          billingProfile: billingProfileView(billingProfile),
          primaryOwner: memberships[0]?.user || null,
          propertyCount: properties.length,
          roomCount: properties.reduce((s, p) => s + p._count.rooms, 0),
          summary: await subscriptionSummary(tx, organizationId),
          ...invoices,
          events,
          eventPage,
          eventTotal: await db.subscriptionEvent.count({
            where: { organizationId },
          }),
          requests: await db.upgrade.findMany({
            where: { organizationId },
            orderBy: { createdAt: "desc" },
            take: 20,
            select: { id: true, plan: true, status: true, createdAt: true },
          }),
        },
        { headers },
      );
    }
    const page = pageValue(p.get("page")),
      q = (p.get("q") || "").trim().slice(0, 100),
      plan = p.get("plan") || "";
    if (plan && !["free", "starter", "plus"].includes(plan))
      throw Error("Paket tidak valid.");
    const where = {
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" as const } },
              {
                billingProfile: {
                  legalName: { contains: q, mode: "insensitive" as const },
                },
              },
            ],
          }
        : {}),
      ...(plan ? { plan } : {}),
    };
    const rows = await db.organization.findMany({
      where,
      orderBy: { id: "asc" },
      skip: (page - 1) * 50,
      take: 50,
      select: {
        ...selected,
        billingProfile: {
          select: { legalName: true, contactName: true, contactEmail: true },
        },
        properties: { select: { _count: { select: { rooms: true } } } },
        memberships: {
          where: { status: "ACTIVE", role: "OWNER" },
          take: 1,
          orderBy: { createdAt: "asc" },
          select: {
            user: {
              select: { name: true, email: true, emailVerifiedAt: true },
            },
          },
        },
      },
    });
    return NextResponse.json(
      {
        rows: rows.map(({ properties, memberships, ...r }) => ({
          ...r,
          primaryOwner: memberships[0]?.user || null,
          propertyCount: properties.length,
          roomCount: properties.reduce((s, p) => s + p._count.rooms, 0),
        })),
        total: await db.organization.count({ where }),
        organizations: await db.organization.count(),
        active: await db.organization.count({
          where: {
            subscriptionStatus: "ACTIVE",
            plan: { in: ["starter", "plus"] },
            OR: [
              { planExpiresAt: null },
              { planExpiresAt: { gt: new Date() } },
            ],
          },
        }),
        requested: await db.upgrade.count({ where: { status: "REQUESTED" } }),
        summary: await subscriptionSummary(
          db as unknown as Prisma.TransactionClient,
        ),
        page,
      },
      { headers },
    );
  } catch {
    return NextResponse.json(
      { error: "Data penagihan belum dapat dimuat." },
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
    await rateLimit("subscription:" + user.id, 80);
    const body = await req.json(),
      key = z.string().uuid().parse(body.key),
      organizationId = z.string().min(1).max(100).parse(body.organizationId);
    if (
      user.role === "OWNER" &&
      (organizationId !== user.organizationId ||
        body.action !== "billingProfile")
    )
      return NextResponse.json(
        { error: "Akses tidak diizinkan." },
        { status: 403, headers },
      );
    const requestHash = stableHash({
      ...body,
      actorId: user.id,
      domain: "SAAS",
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
        const data = await subscriptionWrite(tx, user, organizationId, body);
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
            ? "Periksa isian, tanggal, dan nominal Anda."
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
