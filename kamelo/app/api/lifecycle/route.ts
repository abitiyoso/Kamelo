import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma";
import { z } from "zod";
import { db } from "@/lib/db";
import { currentUser, sessionIdentity, rateLimit } from "@/lib/auth";
import { occupantForSession } from "@/lib/identity";
import { validOrigin } from "@/lib/origin";
import { depositSummary, lifecycleWrite } from "@/lib/lifecycle";
import { prospectWrite } from "@/lib/prospects";
import { financeWrite } from "@/lib/finance";
import { activeStay, localToday } from "@/lib/operations";
import { stableHash } from "@/lib/lifecycle-rules.mjs";
import { decryptSecret } from "@/lib/secrets";
const headers = {
  "Cache-Control": "private, no-store",
  "Referrer-Policy": "no-referrer",
};
async function stayDetail(stayId: string, tenant = false) {
  const stay = await db.stay.findUniqueOrThrow({
    where: { id: stayId },
    select: {
      id: true,
      start: true,
      end: true,
      status: true,
      rate: true,
      billingDay: true,
      room: { select: { id: true, number: true } },
      contract: {
        include: {
          versions: {
            where: tenant ? { state: "AGREED" } : {},
            orderBy: { revision: "desc" },
            take: 50,
          },
        },
      },
      depositAccount: {
        include: {
          entries: {
            orderBy: { createdAt: "desc" },
            take: 50,
            include: { reversal: { select: { id: true } } },
          },
          adjustments: { orderBy: { createdAt: "desc" }, take: 30 },
        },
      },
      outgoingTransfers: { select: { toStayId: true, date: true } },
      incomingTransfer: { select: { fromStayId: true, date: true } },
    },
  });
  const agreed = stay.contract
    ? await db.contractVersion.findFirst({
        where: { contractId: stay.contract.id, state: "AGREED" },
        orderBy: { revision: "desc" },
      })
    : null;
  const summary = stay.depositAccount
    ? await depositSummary(
        db as unknown as Prisma.TransactionClient,
        stay.depositAccount.id,
        agreed?.depositRequired || 0,
      )
    : null;
  const account = stay.depositAccount
    ? {
        ...stay.depositAccount,
        entries: stay.depositAccount.entries.map(({ actorId, ...e }) => e),
        adjustments: stay.depositAccount.adjustments.map(
          ({ createdBy, reviewedBy, ...a }) => a,
        ),
        summary,
      }
    : null;
  const contract = stay.contract
    ? {
        ...stay.contract,
        versions: stay.contract.versions.map(
          ({ actorId, signatureReference, ...v }) => ({
            ...v,
            ...(!tenant ? { signatureReference } : {}),
          }),
        ),
      }
    : null;
  return { ...stay, contract, depositAccount: account };
}
export async function GET(req: NextRequest) {
  try {
    if (req.nextUrl.searchParams.get("resident") === "1") {
      const grant = await occupantForSession();
      if (!grant || !grant.canViewBilling)
        return NextResponse.json(
          { error: "Akses ditolak." },
          { status: 403, headers },
        );
      return NextResponse.json(
        { stay: await stayDetail(grant.stayId, true) },
        { headers },
      );
    }
    const u = await currentUser();
    if (!u)
      return NextResponse.json(
        { error: "Silakan masuk." },
        { status: 401, headers },
      );
    if (u.role !== "OWNER")
      return NextResponse.json(
        { error: "Akses ditolak." },
        { status: 403, headers },
      );
    const property = await db.property.findFirst({
      where: {
        id: req.nextUrl.searchParams.get("propertyId") || "",
        organizationId: u.organizationId,
      },
      select: { id: true },
    });
    if (!property)
      return NextResponse.json(
        { error: "Properti tidak ditemukan." },
        { status: 403, headers },
      );
    const guestId = req.nextUrl.searchParams.get("guestId");
    if (guestId) {
      const guest = await db.guest.findFirst({
        where: { id: guestId, propertyId: property.id },
        include: {
          residentProfile: true,
          stays: {
            where: { room: { propertyId: property.id } },
            orderBy: { start: "desc" },
            select: { id: true },
          },
        },
      });
      if (!guest)
        return NextResponse.json(
          { error: "Penghuni tidak ditemukan." },
          { status: 404, headers },
        );
      const profile = guest.residentProfile;
      const emergency =
        profile?.emergencyConsent && profile.encryptedEmergencyContact
          ? JSON.parse(decryptSecret(profile.encryptedEmergencyContact))
          : null;
      const stays = await Promise.all(guest.stays.map((s) => stayDetail(s.id)));
      const invoices = await db.invoice.findMany({
        where: { guestId: guest.id, propertyId: property.id },
        orderBy: { date: "desc" },
        take: 100,
        select: {
          id: true,
          number: true,
          date: true,
          due: true,
          total: true,
          status: true,
          stayId: true,
          payments: {
            select: {
              id: true,
              amount: true,
              date: true,
              method: true,
              reference: true,
            },
          },
          proofs: {
            select: { id: true, status: true, amount: true, uploadedAt: true },
          },
        },
      });
      const totals = await db.invoice.aggregate({
          where: {
            guestId: guest.id,
            propertyId: property.id,
            status: { notIn: ["DRAFT", "VOID"] },
          },
          _sum: { total: true },
        }),
        paid = await db.payment.aggregate({
          where: {
            invoice: {
              guestId: guest.id,
              propertyId: property.id,
              status: { notIn: ["DRAFT", "VOID"] },
            },
          },
          _sum: { amount: true },
        });
      const tickets = await db.ticket.findMany({
        where: { propertyId: property.id, stay: { guestId: guest.id } },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true,
          title: true,
          status: true,
          category: true,
          createdAt: true,
          stayId: true,
        },
      });
      const accounts = await db.occupantAccess.findMany({
        where: {
          stay: { guestId: guest.id, room: { propertyId: property.id } },
          status: "ACTIVE",
          revokedAt: null,
        },
        select: {
          id: true,
          stayId: true,
          user: { select: { email: true, emailVerifiedAt: true, name: true } },
        },
      });
      return NextResponse.json(
        {
          guest: {
            id: guest.id,
            name: guest.name,
            phone: guest.phone,
            email: profile?.email || "",
            emergencyConsent: profile?.emergencyConsent || false,
            emergency,
          },
          stays,
          invoices,
          tickets,
          accounts,
          totals: {
            billed: totals._sum.total || 0,
            paid: paid._sum.amount || 0,
            balance: (totals._sum.total || 0) - (paid._sum.amount || 0),
          },
        },
        { headers },
      );
    }
    const page = Math.min(
        10000,
        Math.max(
          0,
          Math.floor(Number(req.nextUrl.searchParams.get("page")) || 0),
        ),
      ),
      q = (req.nextUrl.searchParams.get("q") || "").slice(0, 100),
      view = req.nextUrl.searchParams.get("view");
    if (view === "contracts") {
      const where = { stay: { room: { propertyId: property.id } } };
      const rows = await db.contract.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: 50,
        skip: page * 50,
        include: {
          stay: {
            select: {
              id: true,
              status: true,
              guest: { select: { id: true, name: true } },
              room: { select: { number: true } },
              end: true,
              start: true,
            },
          },
          versions: { orderBy: { revision: "desc" }, take: 1 },
        },
      });
      const accounts = await db.depositAccount.findMany({
        where: { stayId: { in: rows.map((r) => r.stayId) } },
        select: { id: true, stayId: true },
      });
      const balances = await db.depositEntry.groupBy({
        by: ["accountId"],
        where: { account: { stay: { room: { propertyId: property.id } } } },
        _sum: { delta: true },
      });
      const held = new Map(
        balances.map((b) => [b.accountId, b._sum.delta || 0]),
      );
      const soon = new Date(
          Date.parse(localToday() + "T00:00:00Z") + 30 * 86400000,
        )
          .toISOString()
          .slice(0, 10),
        active = await db.contract.count({
          where: { ...where, status: "ACTIVE" },
        }),
        expiring = await db.contract.count({
          where: {
            ...where,
            status: "ACTIVE",
            stay: {
              room: { propertyId: property.id },
              end: { gte: localToday(), lte: soon },
            },
          },
        });
      return NextResponse.json(
        {
          rows: rows.map((r) => ({
            ...r,
            versions: r.versions.map(({ actorId, ...v }) => v),
            held:
              held.get(accounts.find((a) => a.stayId === r.stayId)?.id || "") ||
              0,
          })),
          total: await db.contract.count({ where }),
          summary: {
            active,
            expiring,
            held: balances.reduce((s, b) => s + (b._sum.delta || 0), 0),
          },
          page,
        },
        { headers },
      );
    }
    const where = {
      propertyId: property.id,
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" as const } },
              { phone: { contains: q } },
            ],
          }
        : {}),
    };
    const rows = await db.guest.findMany({
      where,
      orderBy: [{ name: "asc" }, { id: "asc" }],
      take: 50,
      skip: page * 50,
      select: {
        id: true,
        name: true,
        phone: true,
        stays: {
          orderBy: { start: "desc" },
          select: {
            id: true,
            start: true,
            end: true,
            status: true,
            rate: true,
            room: { select: { number: true } },
            occupantAccesses: {
              where: { status: "ACTIVE", revokedAt: null },
              select: { user: { select: { emailVerifiedAt: true } } },
            },
          },
        },
      },
    });
    const active = await db.stay.count({
      where: {
        room: { propertyId: property.id },
        status: { in: ["ACTIVE", "CHECKED_IN"] },
        start: { lte: localToday() },
        OR: [{ end: null }, { end: { gt: localToday() } }],
      },
    });
    return NextResponse.json(
      {
        rows: rows.map((r) => ({
          ...r,
          active: r.stays.some((s) => activeStay(s)),
          verified: r.stays.some((s) =>
            s.occupantAccesses.some((g) => g.user.emailVerifiedAt),
          ),
        })),
        total: await db.guest.count({ where }),
        active,
        page,
      },
      { headers },
    );
  } catch {
    return NextResponse.json(
      { error: "Data belum dapat dimuat." },
      { status: 503, headers },
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
  if (user.role !== "OWNER")
    return NextResponse.json(
      { error: "Hanya pemilik yang dapat mengelola data properti." },
      { status: 403, headers },
    );
  try {
    await rateLimit("lifecycle:" + user.id, 80);
    const body = await req.json(),
      key = z.string().uuid().parse(body.key),
      propertyId = z.string().min(1).max(100).parse(body.propertyId),
      requestHash = stableHash({ ...body, actorId: user.id });
    const result = await db.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${user.organizationId}))`;
        const session = identity
          ? await tx.session.findUnique({
              where: { token: identity.token },
              include: { user: { select: { accountStatus: true } } },
            })
          : null;
        const member = await tx.orgMembership.findFirst({
          where: {
            id: user.membershipId || "",
            userId: user.id,
            organizationId: user.organizationId,
            status: "ACTIVE",
            role: "OWNER",
          },
        });
        if (
          !member ||
          !session ||
          session.expires <= new Date() ||
          ["PENDING", "SUSPENDED", "CLOSED"].includes(
            session.user.accountStatus,
          ) ||
          session.contextType !== "ORG" ||
          (session.membershipId && session.membershipId !== member.id)
        )
          throw Error("Akses berubah. Masuk kembali.");
        const property = await tx.property.findFirst({
          where: { id: propertyId, organizationId: user.organizationId },
        });
        if (!property) throw Error("Properti tidak ditemukan.");
        const previous = await tx.lifecycleCommand.findUnique({
          where: {
            organizationId_key: { organizationId: user.organizationId, key },
          },
        });
        if (previous) {
          if (previous.requestHash !== requestHash)
            throw Error("Kunci permintaan sudah digunakan untuk data berbeda.");
          return previous.response;
        }
        const data = await (String(body.action).startsWith("finance")
          ? financeWrite(tx, user, property, body)
          : String(body.action).startsWith("prospect")
            ? prospectWrite(tx, user, property, body)
            : lifecycleWrite(tx, user, property, body));
        await tx.lifecycleCommand.create({
          data: {
            organizationId: user.organizationId,
            key,
            requestHash,
            response: data,
          },
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
            ? "Periksa isian, tanggal, dan nominal rupiah Anda."
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
