import { Prisma } from "@/generated/prisma";
import { z } from "zod";
import { verified } from "./identity";
import { encryptSecret } from "./secrets";
import { privacyKinds, privacyNext, privacyOpen } from "./privacy-rules.mjs";
type Tx = Prisma.TransactionClient;
export async function privacyActor(tx: Tx, token: string, platform: boolean) {
  const s = await tx.session.findUnique({
    where: { token },
    include: { user: true },
  });
  if (!s || s.expires <= new Date() || !verified(s.user))
    throw Error("Masuk dengan akun terverifikasi untuk mengakses privasi.");
  if (platform && (s.contextType !== "PLATFORM" || !s.user.platformAdmin))
    throw Error("Gunakan workspace Platform ELENIO.");
  return { userId: s.userId, platform };
}
export async function privacyWrite(
  tx: Tx,
  a: { userId: string; platform: boolean },
  body: Record<string, unknown>,
) {
  const action = z
    .enum(["create", "reply", "cancel", "reopen", "review"])
    .parse(body.action);
  const message = z.string().trim().min(10).max(4000).parse(body.message);
  if (body.confirmed !== true)
    throw Error("Periksa isi permintaan dan konfirmasi Anda.");
  let r;
  if (action === "create") {
    if (a.platform) throw Error("Permintaan pribadi dibuat oleh pemilik akun.");
    const kind = z
      .string()
      .refine((v) => privacyKinds.includes(v))
      .parse(body.kind);
    if (
      await tx.privacyRequest.findFirst({
        where: { requesterId: a.userId, kind, status: { in: privacyOpen } },
      })
    )
      throw Error(
        "Permintaan sejenis masih terbuka. Lanjutkan permintaan yang sudah ada.",
      );
    r = await tx.privacyRequest.create({
      data: { requesterId: a.userId, kind },
    });
  } else {
    r = await tx.privacyRequest.findFirst({
      where: {
        id: z.string().min(1).max(100).parse(body.requestId),
        ...(!a.platform ? { requesterId: a.userId } : {}),
      },
    });
    if (!r) throw Error("Permintaan tidak ditemukan.");
    if (z.number().int().positive().parse(body.revision) !== r.revision)
      throw Error("Permintaan berubah. Muat ulang sebelum melanjutkan.");
    const status = privacyNext(
      a.platform,
      action,
      r.status,
      String(body.status || ""),
    );
    if (
      action === "reopen" &&
      (await tx.privacyRequest.findFirst({
        where: {
          requesterId: r.requesterId,
          kind: r.kind,
          status: { in: privacyOpen },
        },
      }))
    )
      throw Error("Permintaan sejenis lain masih terbuka.");
    if (action === "review" && ["RESPONDED", "DECLINED"].includes(status))
      z.string().trim().min(5).max(200).parse(body.reference);
    r = await tx.privacyRequest.update({
      where: { id: r.id },
      data: { status, revision: { increment: 1 } },
    });
  }
  const reference =
    a.platform && action === "review"
      ? z
          .string()
          .trim()
          .max(200)
          .parse(body.reference || "")
      : "";
  await tx.privacyEntry.create({
    data: {
      requestId: r.id,
      revision: r.revision,
      kind: action.toUpperCase(),
      actorId: a.userId,
      actorRole: a.platform ? "PLATFORM_ADMIN" : "ACCOUNT",
      status: r.status,
      encryptedBody: encryptSecret(JSON.stringify({ message, reference })),
    },
  });
  return { requestId: r.id, revision: r.revision };
}
export async function accountSummary(tx: Tx, userId: string) {
  const profile = await tx.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      name: true,
      email: true,
      phone: true,
      emailVerifiedAt: true,
      phoneVerifiedAt: true,
      notificationsEnabled: true,
      accountStatus: true,
    },
  });
  const memberships = await tx.orgMembership.findMany({
    where: { userId, status: "ACTIVE" },
    select: {
      role: true,
      organization: { select: { name: true } },
      createdAt: true,
    },
    take: 1001,
    orderBy: { createdAt: "asc" },
  });
  const stays = await tx.occupantAccess.findMany({
    where: { userId, status: "ACTIVE", revokedAt: null },
    select: {
      createdAt: true,
      stay: {
        select: {
          start: true,
          end: true,
          status: true,
          room: {
            select: { number: true, property: { select: { name: true } } },
          },
        },
      },
    },
    take: 1001,
    orderBy: { createdAt: "asc" },
  });
  const requests = await tx.privacyRequest.findMany({
    where: { requesterId: userId },
    select: {
      id: true,
      kind: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
    take: 1001,
    orderBy: { createdAt: "asc" },
  });
  if ([memberships, stays, requests].some((rows) => rows.length > 1000))
    throw Error(
      "Ringkasan melebihi batas unduhan. Ajukan permintaan salinan data untuk peninjauan.",
    );
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    scope:
      "Ringkasan profil, akses aktif, dan status permintaan privasi milik akun ini. Bukan salinan lengkap seluruh dokumen atau transaksi.",
    profile,
    memberships,
    stays,
    requests,
  };
}
