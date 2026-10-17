import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { tenantLinkRecord, proofFile } from "@/lib/tenant";
export const dynamic = "force-dynamic";
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const proof = await db.paymentProof.findUnique({
      where: { id },
      include: { invoice: { include: { property: true } } },
    });
    if (!proof)
      return NextResponse.json(
        { error: "Berkas tidak tersedia." },
        { status: 404 },
      );
    const user = await currentUser(),
      token = request.nextUrl.searchParams.get("token"),
      link = token ? await tenantLinkRecord(token) : null;
    const allowedUser =
      user &&
      user.organizationId === proof.invoice.property.organizationId &&
      (user.role === "OWNER" ||
        user.propertyIds.includes(proof.invoice.propertyId));
    if (!allowedUser && link?.invoiceId !== proof.invoiceId)
      return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });
    const bytes = await proofFile(proof.storageKey),
      extension =
        proof.mimeType === "application/pdf"
          ? "pdf"
          : proof.mimeType === "image/jpeg"
            ? "jpg"
            : proof.mimeType === "image/webp"
              ? "webp"
              : "png";
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": proof.mimeType,
        "Content-Length": String(bytes.length),
        "Content-Disposition": `attachment; filename="bukti-${proof.id}.${extension}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "no-referrer",
        "Content-Security-Policy": "default-src 'none'; sandbox",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Berkas belum dapat dibuka." },
      { status: 404 },
    );
  }
}
