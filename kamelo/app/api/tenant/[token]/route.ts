import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  tenantLinkRecord,
  safeProofSelect,
  operationalToday,
} from "@/lib/tenant";
import { rateLimit, hashToken } from "@/lib/auth";
import { syncRoomAccess, tenantAccess } from "@/lib/smart-access";
export const dynamic = "force-dynamic";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params;
    const link = await tenantLinkRecord(token);
    if (!link)
      return NextResponse.json(
        { error: "Tautan tidak valid atau sudah kedaluwarsa." },
        { status: 403 },
      );
    await rateLimit("tenant-read:" + hashToken(token), 120);
    const invoice = await db.invoice.findUniqueOrThrow({
      where: { id: link.invoiceId },
      include: {
        property: true,
        room: true,
        guest: true,
        payments: true,
        proofs: { select: safeProofSelect, orderBy: { uploadedAt: "desc" } },
      },
    });
    const paid = invoice.payments.reduce((s, p) => s + p.amount, 0);
    let access = null;
    if (link.includeAccess) {
      await db.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${invoice.property.organizationId}))`;
        await syncRoomAccess(
          tx,
          invoice.roomId,
          operationalToday(),
          "tenant-access-refresh",
          invoice.property.organizationId,
        );
      });
      access = await tenantAccess(db, invoice.stayId, operationalToday());
    }
    return NextResponse.json(
      {
        branding: "Kamelo by ELENIO",
        invoice: {
          number: invoice.number,
          customerName: invoice.guest.name,
          roomNumber: invoice.room.number,
          propertyName: invoice.property.name,
          date: invoice.date,
          due: invoice.due,
          total: invoice.total,
          paid,
          balance: ["DRAFT", "VOID"].includes(invoice.status)
            ? 0
            : invoice.total - paid,
          status: invoice.status,
          items: invoice.items,
          proofs: invoice.proofs,
        },
        access,
      },
      {
        headers: {
          "Cache-Control": "private, no-store",
          "Referrer-Policy": "no-referrer",
        },
      },
    );
  } catch {
    return NextResponse.json(
      {
        error:
          "Tagihan belum dapat dimuat. Coba kembali atau hubungi pengelola.",
      },
      { status: 400 },
    );
  }
}
