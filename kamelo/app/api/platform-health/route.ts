import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { integrationReadiness } from "@/lib/integration-readiness.mjs";
import { integrationPreflight } from "@/lib/integration-preflight.mjs";
const headers = {
  "Cache-Control": "private, no-store",
  "Referrer-Policy": "no-referrer",
};
export async function GET(req: NextRequest) {
  const u = await currentUser();
  if (!u)
    return NextResponse.json(
      { error: "Silakan masuk." },
      { status: 401, headers },
    );
  if (u.role !== "PLATFORM_ADMIN")
    return NextResponse.json(
      { error: "Gunakan workspace Platform ELENIO." },
      { status: 403, headers },
    );
  try {
    const p = req.nextUrl.searchParams,
      page = Number(p.get("page") || 1),
      organizationId = p.get("organizationId") || undefined;
    if (!Number.isInteger(page) || page < 1 || page > 100000)
      throw Error("Invalid page");
    const domain = p.get("domain") || "all";
    if (!["all", "support", "subscription"].includes(domain))
      throw Error("Invalid filter");
    const actions =
      domain === "support"
        ? [{ action: { startsWith: "SUPPORT_" } }]
        : domain === "subscription"
          ? [{ action: { startsWith: "SAAS_" } }]
          : [
              { action: { startsWith: "SUPPORT_" } },
              { action: { startsWith: "SAAS_" } },
            ];
    const where: Prisma.AuditWhereInput = { organizationId, OR: actions };
    return await db.$transaction(
      async (tx) => {
        const audits = await tx.audit.findMany({
          where,
          select: {
            id: true,
            action: true,
            targetId: true,
            createdAt: true,
            organization: { select: { name: true } },
          },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: 30,
          skip: (page - 1) * 30,
        });
        return NextResponse.json(
          {
            checkedAt: new Date().toISOString(),
            readiness: integrationReadiness(),
            preflight: integrationPreflight(),
            audits,
            total: await tx.audit.count({ where }),
            page,
            mailQueue: await tx.emailOutbox.groupBy({
              by: ["status"],
              _count: { _all: true },
            }),
            scope:
              "Platform support dan subscription; metadata, identitas penghuni, pesan, kredensial, dan rekaman kamera tidak ditampilkan. Tidak menjalankan pemeriksaan jaringan atau mengirim email.",
          },
          { headers },
        );
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  } catch {
    return NextResponse.json(
      { error: "Status belum dapat dimuat. Periksa filter dan coba kembali." },
      { status: 400, headers },
    );
  }
}
