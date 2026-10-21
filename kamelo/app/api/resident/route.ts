import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { occupantForSession } from "@/lib/identity";
import { activeStay } from "@/lib/operations";
import { localToday } from "@/lib/operations";
import { sessionIdentity } from "@/lib/auth";
import { openingTenantActor } from "@/lib/opening-tenant";
import { residentFinance } from "@/lib/resident-finance";
import { Prisma } from "@/generated/prisma";
export async function GET() {
  const g = await occupantForSession();
  if (!g)
    return NextResponse.json(
      { error: "Akses penghuni tidak tersedia." },
      { status: 403 },
    );
  try {
    const s = await sessionIdentity();
    const finance =
      g.canViewBilling && s
        ? await db.$transaction(
            async (tx) => {
              const a = await openingTenantActor(tx, s.token);
              if (a.grant.id !== g.id) throw Error("Workspace berubah.");
              const invoices = await tx.invoice.findMany({
                where: { stayId: g.stayId, status: { not: "DRAFT" } },
                orderBy: { date: "desc" },
                take: 100,
                include: { payments: { select: { amount: true } } },
              });
              return {
                invoices,
                billingSummary: await residentFinance(tx, a, localToday()),
              };
            },
            { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
          )
        : { invoices: [], billingSummary: null };
    const invoices = finance.invoices;
    return NextResponse.json(
      {
        name: g.stay.guest.name,
        property: g.stay.room.property.name,
        room: g.stay.room.number,
        active: activeStay(g.stay),
        canViewBilling: g.canViewBilling,
        billingSummary: finance.billingSummary,
        invoices: invoices.map((i) => ({
          id: i.id,
          number: i.number,
          date: i.date,
          due: i.due,
          status: i.status,
          balance:
            i.status === "VOID"
              ? 0
              : i.total - i.payments.reduce((s, p) => s + p.amount, 0),
        })),
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "Ringkasan penghuni belum tersedia. Muat ulang workspace." },
      { status: 403, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}
