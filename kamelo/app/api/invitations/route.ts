import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { currentUser, sessionIdentity, hashToken, rateLimit } from "@/lib/auth";
import { verified, identityAudit } from "@/lib/identity";
import {
  inviteRecord,
  acceptInvitation,
  sendInvitation,
  assertInvitation,
  assertSeats,
} from "@/lib/invitations";
import { flushLocalMail } from "@/lib/email/outbox";
import { validOrigin } from "@/lib/origin";
import { Prisma } from "@/generated/prisma";
const headers = {
  "Cache-Control": "private, no-store",
  "Referrer-Policy": "no-referrer",
};
export async function GET() {
  const u = await currentUser();
  if (!u || u.role !== "OWNER")
    return NextResponse.json(
      { error: "Akses ditolak." },
      { status: 403, headers },
    );
  const invitations = await db.invitation.findMany({
    where: { organizationId: u.organizationId },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      recipientEmail: true,
      kind: true,
      state: true,
      expiresAt: true,
      createdAt: true,
      propertyIds: true,
      stayId: true,
      acceptedBy: true,
    },
  });
  const occupants = await db.occupantAccess.findMany({
    where: {
      stay: { room: { property: { organizationId: u.organizationId } } },
    },
    select: {
      id: true,
      user: { select: { name: true, email: true } },
      stay: { select: { id: true, room: { select: { number: true } } } },
      status: true,
    },
  });
  const members = await db.orgMembership.findMany({
    where: {
      organizationId: u.organizationId,
      role: "STAFF",
      status: "ACTIVE",
    },
    select: { userId: true, user: { select: { name: true, email: true } } },
  });
  return NextResponse.json({ invitations, occupants, members }, { headers });
}
export async function POST(req: NextRequest) {
  if (!validOrigin(req))
    return NextResponse.json(
      { error: "Permintaan tidak diizinkan." },
      { status: 403, headers },
    );
  try {
    const b = await req.json(),
      s = await sessionIdentity();
    if (b.action === "preview") {
      await rateLimit("invite-preview:" + hashToken(String(b.token)), 30);
      const inv = await inviteRecord(String(b.token));
      if (!inv) throw Error("Undangan tidak valid.");
      await db.$transaction((tx) => assertInvitation(tx, inv));
      const org = await db.organization.findUniqueOrThrow({
        where: { id: inv.organizationId },
        select: { name: true },
      });
      return NextResponse.json(
        {
          kind: inv.kind,
          organization: org.name,
          expiresAt: inv.expiresAt,
          recipientHint:
            inv.recipientEmail.slice(0, 1) +
            "***@" +
            inv.recipientEmail.split("@")[1],
          requiresSignIn: !s,
        },
        { headers },
      );
    }
    if (!s)
      return NextResponse.json(
        { error: "Silakan masuk." },
        { status: 401, headers },
      );
    if (b.action === "accept") {
      await rateLimit("accept-invite:" + s.userId, 20);
      return NextResponse.json(
        await acceptInvitation(String(b.id || b.token), s.user, Boolean(b.id)),
        { headers },
      );
    }
    if (b.action === "decline") {
      if (!verified(s.user)) throw Error("Verifikasi email dahulu.");
      const inv = b.id
        ? await db.invitation.findUnique({ where: { id: String(b.id) } })
        : await inviteRecord(String(b.token));
      if (
        !inv ||
        inv.recipientEmail !== s.user.email ||
        inv.state !== "PENDING"
      )
        throw Error("Undangan tidak tersedia.");
      await db.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${inv.organizationId}))`;
        const changed = await tx.invitation.updateMany({
          where: {
            id: inv.id,
            state: "PENDING",
            recipientEmail: s.user.email,
            expiresAt: { gt: new Date() },
          },
          data: { state: "DECLINED" },
        });
        if (changed.count !== 1) throw Error("Undangan tidak tersedia.");
        await tx.emailOutbox.updateMany({
          where: {
            dedupeKey: { startsWith: `invite:${inv.id}:` },
            status: { in: ["QUEUED", "BLOCKED"] },
          },
          data: { status: "CANCELLED", encryptedPayload: "" },
        });
        await identityAudit(
          tx,
          inv.organizationId,
          s.userId,
          "INVITATION_DECLINED",
          inv.id,
        );
      });
      return NextResponse.json({ ok: true }, { headers });
    }
    const u = await currentUser();
    if (!u || u.role !== "OWNER" || !verified(u))
      return NextResponse.json(
        {
          error:
            "Hanya pemilik dengan email terverifikasi yang dapat mengelola undangan.",
        },
        { status: 403, headers },
      );
    await rateLimit("invitation-manage:" + u.id, 30);
    const result = await db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${u.organizationId}))`;
      const authority = await tx.orgMembership.findFirst({
        where: {
          userId: u.id,
          organizationId: u.organizationId,
          role: "OWNER",
          status: "ACTIVE",
        },
      });
      if (
        !authority ||
        !verified(await tx.user.findUniqueOrThrow({ where: { id: u.id } }))
      )
        throw Error("Akses telah dicabut.");
      if (b.action === "create") {
        const input = z
          .object({
            email: z.email().transform((v) => v.trim().toLowerCase()),
            kind: z.enum(["STAFF", "TENANT"]),
            propertyIds: z.array(z.string()).min(1).max(3),
            stayId: z.string().optional(),
            canRecordPayments: z.boolean().default(false),
            canControlDevices: z.boolean().default(false),
            includeAccess: z.boolean().default(false),
          })
          .parse(b);
        if (input.email === u.email)
          throw Error("Anda tidak dapat mengundang diri sendiri.");
        const count = await tx.property.count({
          where: {
            id: { in: input.propertyIds },
            organizationId: u.organizationId,
          },
        });
        if (count !== new Set(input.propertyIds).size)
          throw Error("Properti tidak valid.");
        await tx.invitation.updateMany({
          where: {
            organizationId: u.organizationId,
            recipientEmail: input.email,
            kind: input.kind,
            state: "PENDING",
          },
          data: { state: "REVOKED", revokedAt: new Date() },
        });
        if (input.kind === "STAFF") await assertSeats(tx, u.organizationId);
        const token = randomBytes(32).toString("hex"),
          inv = await tx.invitation.create({
            data: {
              organizationId: u.organizationId,
              issuerId: u.id,
              recipientEmail: input.email,
              kind: input.kind,
              propertyIds: input.propertyIds,
              stayId: input.kind === "TENANT" ? input.stayId : null,
              canRecordPayments:
                input.kind === "STAFF" && input.canRecordPayments,
              canControlDevices: input.canControlDevices,
              includeAccess: input.kind === "TENANT" && input.includeAccess,
              tokenHash: hashToken(token),
              expiresAt: new Date(Date.now() + 48 * 3600000),
            },
          });
        await assertInvitation(tx, inv);
        await sendInvitation(tx, inv, token, u);
        await identityAudit(
          tx,
          u.organizationId,
          u.id,
          "INVITATION_CREATED",
          inv.id,
          { kind: inv.kind },
        );
        return { id: inv.id };
      }
      if (b.action === "revokeOccupant") {
        const grant = await tx.occupantAccess.findFirst({
          where: {
            id: String(b.id),
            stay: { room: { property: { organizationId: u.organizationId } } },
          },
        });
        if (!grant) throw Error("Akses tidak ditemukan.");
        await tx.occupantAccess.update({
          where: { id: grant.id },
          data: { status: "REVOKED", revokedAt: new Date() },
        });
        await tx.session.deleteMany({ where: { userId: grant.userId } });
        await identityAudit(
          tx,
          u.organizationId,
          u.id,
          "OCCUPANT_ACCESS_REVOKED",
          grant.id,
        );
        return { ok: true };
      }
      if (b.action === "revokeMember") {
        const member = await tx.orgMembership.findFirst({
          where: {
            userId: String(b.userId),
            organizationId: u.organizationId,
            role: "STAFF",
          },
        });
        if (!member) throw Error("Anggota tidak ditemukan.");
        await tx.orgMembership.update({
          where: { id: member.id },
          data: { status: "REVOKED", revokedAt: new Date() },
        });
        await tx.session.deleteMany({ where: { userId: member.userId } });
        await identityAudit(
          tx,
          u.organizationId,
          u.id,
          "MEMBERSHIP_REVOKED",
          member.id,
        );
        return { ok: true };
      }
      const inv = await tx.invitation.findFirst({
        where: { id: String(b.id), organizationId: u.organizationId },
      });
      if (!inv) throw Error("Undangan tidak ditemukan.");
      await tx.emailOutbox.updateMany({
        where: {
          dedupeKey: { startsWith: `invite:${inv.id}:` },
          status: { in: ["QUEUED", "BLOCKED"] },
        },
        data: { status: "CANCELLED", encryptedPayload: "" },
      });
      if (b.action === "revoke") {
        await tx.invitation.update({
          where: { id: inv.id },
          data: { state: "REVOKED", revokedAt: new Date() },
        });
        if (inv.acceptedBy) {
          if (inv.kind === "STAFF")
            await tx.orgMembership.updateMany({
              where: {
                userId: inv.acceptedBy,
                organizationId: u.organizationId,
                role: "STAFF",
              },
              data: { status: "REVOKED", revokedAt: new Date() },
            });
          else
            await tx.occupantAccess.updateMany({
              where: { userId: inv.acceptedBy, stayId: inv.stayId! },
              data: { status: "REVOKED", revokedAt: new Date() },
            });
          await tx.session.deleteMany({ where: { userId: inv.acceptedBy } });
        }
        await identityAudit(
          tx,
          u.organizationId,
          u.id,
          "INVITATION_REVOKED",
          inv.id,
        );
        return { ok: true };
      }
      if (b.action === "resend" && ["PENDING", "REVOKED"].includes(inv.state)) {
        if (inv.kind === "STAFF") {
          const member = await tx.orgMembership.findFirst({
            where: {
              organizationId: u.organizationId,
              user: { email: inv.recipientEmail },
              status: "ACTIVE",
            },
          });
          if (!member)
            await assertSeats(tx, u.organizationId, inv.recipientEmail);
        }
        if (Date.now() - inv.createdAt.getTime() < 60000)
          throw Error("Tunggu sebelum mengirim ulang.");
        const token = randomBytes(32).toString("hex"),
          next = await tx.invitation.update({
            where: { id: inv.id },
            data: {
              state: "PENDING",
              revokedAt: null,
              tokenHash: hashToken(token),
              expiresAt: new Date(Date.now() + 48 * 3600000),
              createdAt: new Date(),
            },
          });
        await assertInvitation(tx, next);
        await sendInvitation(tx, next, token, u);
        await identityAudit(
          tx,
          u.organizationId,
          u.id,
          "INVITATION_REISSUED",
          next.id,
        );
        return { ok: true };
      }
      throw Error("Aksi tidak tersedia.");
    });
    await flushLocalMail();
    return NextResponse.json({ ok: true, result }, { headers });
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof Prisma.PrismaClientKnownRequestError
            ? "Undangan belum dapat diproses. Muat ulang dan periksa kembali."
            : e instanceof z.ZodError
              ? "Periksa isian undangan."
              : e instanceof Error
                ? e.message
                : "Undangan belum dapat diproses.",
      },
      { status: 400, headers },
    );
  }
}
