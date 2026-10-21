import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sessionIdentity } from "@/lib/auth";
import { importActor } from "@/lib/room-import";
import { openingTenantActor, tenantOpeningSource } from "@/lib/opening-tenant";
import { proofFile } from "@/lib/tenant";
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const headers = {
    "Cache-Control": "private, no-store",
    "Referrer-Policy": "no-referrer",
  };
  try {
    const s = await sessionIdentity();
    if (!s) throw Error("Access");
    const { id } = await params;
    const proof = await db.$transaction(async (tx) => {
      const p = await tx.openingProof.findUnique({
        where: { id },
        include: {
          receivable: {
            select: { property: { select: { organizationId: true } } },
          },
        },
      });
      if (!p) throw Error("Access");
      if (s.contextType === "ORG") {
        const a = await importActor(tx, s.token);
        if (a.organizationId !== p.receivable.property.organizationId)
          throw Error("Access");
      } else {
        const a = await openingTenantActor(tx, s.token);
        await tenantOpeningSource(tx, a, p.receivableId);
        if (p.uploadedBy !== a.userId) throw Error("Access");
      }
      return p;
    });
    const bytes = await proofFile(proof.storageKey),
      ext =
        proof.mimeType === "application/pdf"
          ? "pdf"
          : proof.mimeType === "image/jpeg"
            ? "jpg"
            : proof.mimeType === "image/webp"
              ? "webp"
              : "png";
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        ...headers,
        "Content-Type": proof.mimeType,
        "Content-Length": String(bytes.length),
        "Content-Disposition": `attachment; filename="bukti-saldo-${proof.id}.${ext}"`,
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Berkas tidak tersedia." },
      { status: 404, headers },
    );
  }
}
