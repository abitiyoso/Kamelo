import { randomBytes } from "node:crypto";
import { db } from "./db";
import { hashToken } from "./auth";
import { verified, identityAudit, appOrigin } from "./identity";
import { enqueueEmail } from "./email/outbox";
import { emailLink } from "./email/templates.mjs";
import { plans } from "./plans";
import type { Prisma } from "@/generated/prisma";
export async function inviteRecord(token: string) {
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  return db.invitation.findUnique({ where: { tokenHash: hashToken(token) } });
}
export async function sendInvitation(
  tx: Prisma.TransactionClient,
  inv: {
    id: string;
    kind: string;
    recipientEmail: string;
    expiresAt: Date;
    organizationId: string;
    propertyIds: string[];
    stayId: string | null;
  },
  token: string,
  issuer: { name: string },
) {
  const org = await tx.organization.findUniqueOrThrow({
    where: { id: inv.organizationId },
  });
  const property = await tx.property.findFirst({
    where: { id: { in: inv.propertyIds }, organizationId: org.id },
  });
  const values = {
    nama_penerima: "calon anggota",
    nama_penghuni: "calon penghuni",
    nama_pengundang: issuer.name,
    role: "Staf",
    nama_properti: property?.name || org.name,
    waktu_kedaluwarsa: inv.expiresAt.toLocaleString("id-ID", {
      timeZone: "Asia/Jakarta",
    }),
    url_undangan: emailLink(appOrigin(), "/invite", `token=${token}`),
    url_akses_penghuni: emailLink(appOrigin(), "/invite", `token=${token}`),
  };
  await enqueueEmail(tx, {
    template: inv.kind === "TENANT" ? "04" : "03",
    to: inv.recipientEmail,
    values,
    dedupeKey: `invite:${inv.id}:${hashToken(token)}`,
    organizationId: org.id,
    expiresAt: inv.expiresAt,
  });
}
export async function assertInvitation(
  tx: Prisma.TransactionClient,
  inv: {
    issuerId: string;
    organizationId: string;
    state: string;
    expiresAt: Date;
    kind: string;
    stayId: string | null;
    propertyIds: string[];
  },
) {
  if (inv.state !== "PENDING" || inv.expiresAt <= new Date())
    throw Error("Undangan tidak aktif.");
  const issuer = await tx.orgMembership.findFirst({
    where: {
      userId: inv.issuerId,
      organizationId: inv.organizationId,
      role: "OWNER",
      status: "ACTIVE",
    },
    include: { user: true },
  });
  if (!issuer || !verified(issuer.user))
    throw Error("Pemberi undangan tidak lagi berwenang.");
  const n = await tx.property.count({
    where: { id: { in: inv.propertyIds }, organizationId: inv.organizationId },
  });
  if (n !== new Set(inv.propertyIds).size)
    throw Error("Penugasan properti tidak valid.");
  if (inv.kind === "TENANT") {
    const stay = await tx.stay.findFirst({
      where: {
        id: inv.stayId || "",
        room: {
          propertyId: { in: inv.propertyIds },
          property: { organizationId: inv.organizationId },
        },
        status: { in: ["ACTIVE", "CONFIRMED", "RESERVED", "CHECKED_IN"] },
      },
    });
    if (!stay) throw Error("Masa tinggal tidak tersedia.");
  }
}
export async function assertSeats(
  tx: Prisma.TransactionClient,
  organizationId: string,
  recipientEmail?: string,
) {
  const org = await tx.organization.findUniqueOrThrow({
      where: { id: organizationId },
    }),
    plan =
      plans.find(
        (p) =>
          p.id ===
          (org.subscriptionStatus === "ACTIVE" &&
          (!org.planExpiresAt || org.planExpiresAt > new Date())
            ? org.plan
            : "free"),
      ) || plans[0];
  const count = await tx.orgMembership.count({
    where: {
      organizationId,
      status: { in: ["ACTIVE", "PENDING"] },
      role: { in: ["OWNER", "STAFF"] },
    },
  });
  const pending = await tx.invitation.count({
    where: {
      organizationId,
      kind: "STAFF",
      state: "PENDING",
      expiresAt: { gt: new Date() },
      ...(recipientEmail ? { recipientEmail: { not: recipientEmail } } : {}),
    },
  });
  if (count + pending >= plan.users)
    throw Error("Batas pengguna paket tercapai.");
}
export async function acceptInvitation(
  token: string,
  user: {
    id: string;
    email: string;
    emailVerifiedAt: Date | null;
    accountStatus: string;
  },
  byId = false,
) {
  if (!verified(user))
    throw Error("Verifikasi email Anda sebelum menerima undangan.");
  const initial = byId
    ? await db.invitation.findUnique({ where: { id: token } })
    : await inviteRecord(token);
  if (!initial) throw Error("Undangan tidak valid.");
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${initial.organizationId}))`;
    const inv = await tx.invitation.findUniqueOrThrow({
      where: { id: initial.id },
    });
    if (!byId && inv.tokenHash !== hashToken(token))
      throw Error("Undangan tidak aktif.");
    const latest = await tx.user.findUniqueOrThrow({ where: { id: user.id } });
    if (!verified(latest) || latest.email !== user.email)
      throw Error("Identitas berubah; masuk kembali.");
    if (inv.recipientEmail !== user.email)
      throw Error("Masuk dengan email tujuan undangan.");
    if (inv.state === "ACCEPTED" && inv.acceptedBy === user.id)
      return { ok: true, redirect: "/workspaces" };
    await assertInvitation(tx, inv);
    if (inv.kind === "STAFF") {
      const member = await tx.orgMembership.findUnique({
        where: {
          userId_organizationId: {
            userId: user.id,
            organizationId: inv.organizationId,
          },
        },
      });
      if (member?.role === "OWNER")
        throw Error("Undangan staf tidak dapat mengubah akses pemilik.");
      if (member?.status !== "ACTIVE")
        await assertSeats(tx, inv.organizationId, inv.recipientEmail);
      await tx.orgMembership.upsert({
        where: {
          userId_organizationId: {
            userId: user.id,
            organizationId: inv.organizationId,
          },
        },
        create: {
          userId: user.id,
          organizationId: inv.organizationId,
          role: "STAFF",
          propertyIds: inv.propertyIds,
          canRecordPayments: inv.canRecordPayments,
          canControlDevices: inv.canControlDevices,
        },
        update: {
          status: "ACTIVE",
          revokedAt: null,
          propertyIds: inv.propertyIds,
          canRecordPayments: inv.canRecordPayments,
          canControlDevices: inv.canControlDevices,
        },
      });
    } else {
      const occupied = await tx.occupantAccess.findFirst({
        where: {
          stayId: inv.stayId!,
          status: "ACTIVE",
          userId: { not: user.id },
        },
      });
      if (occupied)
        throw Error("Masa tinggal sudah diklaim akun lain. Hubungi pengelola.");
      await tx.occupantAccess.upsert({
        where: { userId_stayId: { userId: user.id, stayId: inv.stayId! } },
        create: {
          userId: user.id,
          stayId: inv.stayId!,
          canControlDevices: inv.canControlDevices,
          includeAccess: inv.includeAccess,
        },
        update: {
          status: "ACTIVE",
          revokedAt: null,
          canControlDevices: inv.canControlDevices,
          includeAccess: inv.includeAccess,
        },
      });
    }
    await tx.invitation.update({
      where: { id: inv.id },
      data: { state: "ACCEPTED", acceptedBy: user.id, acceptedAt: new Date() },
    });
    await identityAudit(
      tx,
      inv.organizationId,
      user.id,
      "INVITATION_ACCEPTED",
      inv.id,
      { kind: inv.kind },
    );
    return { ok: true, redirect: "/workspaces" };
  });
}
