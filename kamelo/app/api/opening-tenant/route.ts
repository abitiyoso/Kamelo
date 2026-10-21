import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma";
import { db } from "@/lib/db";
import { sessionIdentity, rateLimit } from "@/lib/auth";
import { validOrigin } from "@/lib/origin";
import {
  openingTenantActor,
  tenantOpeningRead,
  openingUploadFields,
  recordOpeningProof,
} from "@/lib/opening-tenant";
import {
  limitedFormData,
  storeProofBytes,
  removeProofFile,
} from "@/lib/tenant";
import { MAX_PROOF_SIZE, proofMime } from "@/lib/proof-files.mjs";
import { createHash } from "node:crypto";
const headers = {
  "Cache-Control": "private, no-store",
  "Referrer-Policy": "no-referrer",
};
export async function GET(req: NextRequest) {
  const s = await sessionIdentity();
  if (!s)
    return NextResponse.json(
      { error: "Silakan masuk." },
      { status: 401, headers },
    );
  try {
    const page = Number(req.nextUrl.searchParams.get("page") || 1);
    const reminderPage = Number(
      req.nextUrl.searchParams.get("reminderPage") || 1,
    );
    if (!Number.isInteger(page) || page < 1 || page > 100000)
      throw Error("Halaman tidak valid.");
    if (
      !Number.isInteger(reminderPage) ||
      reminderPage < 1 ||
      reminderPage > 100000
    )
      throw Error("Halaman pengingat tidak valid.");
    const result = await db.$transaction(
      async (tx) =>
        tenantOpeningRead(
          tx,
          await openingTenantActor(tx, s.token),
          req.nextUrl.searchParams.get("receivableId"),
          page,
          reminderPage,
        ),
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    return NextResponse.json(result, { headers });
  } catch {
    return NextResponse.json(
      { error: "Saldo awal tidak tersedia untuk akses ini." },
      { status: 403, headers },
    );
  }
}
export async function POST(req: NextRequest) {
  if (!validOrigin(req))
    return NextResponse.json(
      { error: "Permintaan tidak diizinkan." },
      { status: 403, headers },
    );
  const s = await sessionIdentity();
  if (!s)
    return NextResponse.json(
      { error: "Silakan masuk." },
      { status: 401, headers },
    );
  let key = "";
  try {
    await db.$transaction((tx) => openingTenantActor(tx, s.token));
    await rateLimit("opening-proof:" + s.userId, 10);
    const form = await limitedFormData(req),
      input = openingUploadFields.parse(Object.fromEntries(form)),
      file = form.get("file");
    if (!(file instanceof File) || !file.size || file.size > MAX_PROOF_SIZE)
      throw Error("Pilih foto atau PDF maksimal 5 MB.");
    const bytes = Buffer.from(await file.arrayBuffer()),
      mimeType = proofMime(bytes);
    if (file.type && file.type !== mimeType)
      throw Error("Jenis berkas tidak sesuai dengan isinya.");
    key = await storeProofBytes(bytes);
    const result = await db.$transaction(
      (tx) =>
        recordOpeningProof(tx, s.token, input, {
          storageKey: key,
          mimeType,
          fileSize: bytes.length,
          contentHash: createHash("sha256").update(bytes).digest("hex"),
        }),
      { timeout: 15000 },
    );
    if (result.reused) await removeProofFile(key);
    return NextResponse.json(
      { ok: true, result: { id: result.id, status: "RECEIVED" } },
      { headers },
    );
  } catch (e) {
    if (key) await removeProofFile(key);
    return NextResponse.json(
      {
        error:
          e instanceof Prisma.PrismaClientKnownRequestError ||
          e instanceof Prisma.PrismaClientUnknownRequestError
            ? "Bukti sama sudah tersimpan atau data berubah; muat ulang."
            : e instanceof Error && !e.message.startsWith("[")
              ? e.message
              : "Periksa file dan kolom unggahan.",
      },
      { status: 400, headers },
    );
  }
}
