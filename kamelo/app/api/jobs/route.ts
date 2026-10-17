import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
import { runPropertyOperations } from "@/lib/automation";
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
    const organizations = await db.organization.findMany({
      select: { id: true },
    });
    let issued = 0;
    for (const org of organizations)
      await db.$transaction(
        async (tx) => {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${org.id}))`;
          const properties = await tx.property.findMany({
            where: { organizationId: org.id },
            select: { id: true },
          });
          for (const property of properties)
            issued += (await runPropertyOperations(tx, property.id)).issued;
        },
        { timeout: 30000 },
      );
    return NextResponse.json(
      { ok: true, issued },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "Operations failed. Retry the job." },
      { status: 503 },
    );
  }
}
