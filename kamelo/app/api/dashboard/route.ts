import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma";
import { z } from "zod";
import { db } from "@/lib/db";
import { currentUser, sessionIdentity } from "@/lib/auth";
import { importActor } from "@/lib/room-import";
import { localToday } from "@/lib/operations";
import { dashboardRead } from "@/lib/dashboard";
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
    const p = z
      .object({
        propertyId: z.string().min(1).max(100),
        page: z.coerce.number().int().min(1).max(100000).default(1),
      })
      .parse(Object.fromEntries(req.nextUrl.searchParams));
    const result = await db.$transaction(
      async (tx) => {
        const a = await importActor(tx, s.token);
        return dashboardRead(
          tx,
          a.organizationId,
          p.propertyId,
          localToday(),
          p.page,
        );
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    return NextResponse.json(result, { headers });
  } catch {
    return NextResponse.json(
      {
        error:
          "Ringkasan gabungan belum tersedia. Periksa akses dan muat ulang.",
      },
      { status: 403, headers },
    );
  }
}
