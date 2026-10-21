import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
import { runReminderProperty } from "@/lib/reminder-automation";
export async function POST(req: NextRequest) {
  const secret = process.env.OPERATIONS_JOB_KEY || "",
    received = req.headers.get("authorization")?.replace(/^Bearer /, "") || "";
  if (
    secret.length < 64 ||
    Buffer.byteLength(secret) !== Buffer.byteLength(received) ||
    !timingSafeEqual(Buffer.from(secret), Buffer.from(received))
  )
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const after = req.nextUrl.searchParams.get("after") || "";
    if (after.length > 100) throw Error();
    const policies = await db.reminderPolicy.findMany({
      where: { enabled: true, propertyId: { gt: after } },
      select: {
        propertyId: true,
        property: { select: { organizationId: true } },
      },
      orderBy: { propertyId: "asc" },
      take: 10,
    });
    let portal = 0,
      email = 0;
    for (const p of policies)
      await db.$transaction(
        async (tx) => {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${p.property.organizationId}))`;
          const counts = await runReminderProperty(tx, p.propertyId);
          portal += counts.portal;
          email += counts.email;
        },
        { timeout: 15000 },
      );
    return NextResponse.json(
      {
        ok: true,
        portal,
        email,
        next: policies.length === 10 ? policies.at(-1)!.propertyId : null,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "Reminder job failed. Retry safely." },
      { status: 503 },
    );
  }
}
