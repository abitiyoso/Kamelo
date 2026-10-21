import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma";
import { db } from "@/lib/db";
import { sessionIdentity } from "@/lib/auth";
import { openingTenantActor } from "@/lib/opening-tenant";
const headers = {
  "Cache-Control": "private, no-store",
  "Referrer-Policy": "no-referrer",
};
export async function GET(req: NextRequest) {
  try {
    const s = await sessionIdentity();
    if (!s) throw Error();
    const page = Number(req.nextUrl.searchParams.get("page") || 1);
    if (!Number.isInteger(page) || page < 1 || page > 100000) throw Error();
    const result = await db.$transaction(
      async (tx) => {
        const a = await openingTenantActor(tx, s.token);
        const where = {
          userId: a.userId,
          grantId: a.grant.id,
          propertyId: a.grant.stay.room.propertyId,
          channel: "PORTAL",
          status: "PUBLISHED",
          OR: [
            {
              invoice: {
                stayId: a.grant.stayId,
                guestId: a.grant.stay.guestId,
              },
            },
            {
              share: {
                userId: a.userId,
                grantId: a.grant.id,
                stayId: a.grant.stayId,
                revokedAt: null,
                receivable: {
                  guestId: a.grant.stay.guestId,
                  propertyId: a.grant.stay.room.propertyId,
                },
              },
            },
          ],
        } satisfies Prisma.ReminderDeliveryWhereInput;
        return {
          rows: await tx.reminderDelivery.findMany({
            where,
            select: {
              id: true,
              reference: true,
              amount: true,
              due: true,
              createdAt: true,
              invoiceId: true,
              receivableId: true,
            },
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            take: 20,
            skip: (page - 1) * 20,
          }),
          total: await tx.reminderDelivery.count({ where }),
          page,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    return NextResponse.json(result, { headers });
  } catch {
    return NextResponse.json(
      { error: "Pengingat tidak tersedia. Periksa akses tagihan Anda." },
      { status: 403, headers },
    );
  }
}
