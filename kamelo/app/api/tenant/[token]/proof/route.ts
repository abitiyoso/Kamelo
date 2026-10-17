import { NextRequest, NextResponse } from "next/server";
import { validOrigin } from "@/lib/origin";
import { rateLimit, hashToken } from "@/lib/auth";
import { limitedFormData, uploadProof, tenantLinkRecord } from "@/lib/tenant";
import { Prisma } from "@/generated/prisma";
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  if (!validOrigin(request))
    return NextResponse.json(
      { error: "Permintaan tidak diizinkan." },
      { status: 403 },
    );
  try {
    const { token } = await params;
    if (!(await tenantLinkRecord(token)))
      return NextResponse.json(
        { error: "Tautan tidak valid atau sudah kedaluwarsa." },
        { status: 403 },
      );
    await rateLimit("tenant-upload:" + hashToken(token), 10);
    const result = await uploadProof(token, await limitedFormData(request));
    return NextResponse.json(
      { ok: true, result },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message =
      error instanceof Prisma.PrismaClientKnownRequestError
        ? "Bukti yang sama sudah diunggah atau perubahan bersamaan terjadi. Muat ulang terlebih dahulu."
        : error instanceof Error
          ? error.message
          : "Bukti belum dapat diunggah.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
