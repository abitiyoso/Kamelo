import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  sessionIdentity,
  hashToken,
  rateLimit,
  verifyPassword,
  hashPassword,
  ensureLegacyMembership,
} from "@/lib/auth";
import {
  verified,
  issueChallenge,
  consumeChallenge,
  identityAudit,
} from "@/lib/identity";
import { enqueueEmail, flushLocalMail } from "@/lib/email/outbox";
import { validOrigin } from "@/lib/origin";
import { Prisma } from "@/generated/prisma";
const headers = {
  "Cache-Control": "private, no-store",
  "Referrer-Policy": "no-referrer",
};
export async function GET() {
  const s = await sessionIdentity();
  if (!s)
    return NextResponse.json(
      { error: "Silakan masuk." },
      { status: 401, headers },
    );
  await ensureLegacyMembership(s.user);
  const memberships = await db.orgMembership.findMany({
    where: { userId: s.userId, status: "ACTIVE" },
    include: { organization: { select: { name: true } } },
  });
  const stays = await db.occupantAccess.findMany({
    where: { userId: s.userId, status: "ACTIVE", revokedAt: null },
    include: {
      stay: {
        include: {
          room: { include: { property: { select: { name: true } } } },
        },
      },
    },
  });
  const sessions = await db.session.findMany({
    where: { userId: s.userId, expires: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  const mail = await db.emailOutbox.findFirst({
    where: { userId: s.userId },
    orderBy: { createdAt: "desc" },
    select: { status: true, createdAt: true },
  });
  const pendingInvitations = verified(s.user)
    ? await db.invitation.findMany({
        where: {
          recipientEmail: s.user.email,
          state: "PENDING",
          expiresAt: { gt: new Date() },
        },
        include: { organization: { select: { name: true } } },
        take: 30,
      })
    : [];
  const pendingEmail = await db.identityChallenge.findFirst({
    where: {
      userId: s.userId,
      purpose: "EMAIL_CHANGE",
      consumedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
    select: { targetEmail: true },
  });
  return NextResponse.json(
    {
      profile: {
        name: s.user.name,
        email: s.user.email,
        phone: s.user.phone,
        emailVerifiedAt: s.user.emailVerifiedAt,
        phoneVerifiedAt: s.user.phoneVerifiedAt,
        accountStatus: s.user.accountStatus,
        notificationsEnabled: s.user.notificationsEnabled,
        pendingEmail: pendingEmail?.targetEmail,
      },
      pendingInvitations: pendingInvitations.map((i) => ({
        id: i.id,
        kind: i.kind,
        label: i.organization.name,
        expiresAt: i.expiresAt,
      })),
      contexts: [
        ...memberships.map((m) => ({
          id: m.id,
          type: "ORG",
          label: m.organization.name,
          role: m.role,
          active:
            s.contextType === "ORG" &&
            (s.membershipId === m.id ||
              (!s.membershipId && m.organizationId === s.user.organizationId)),
        })),
        ...stays.map((g) => ({
          id: g.id,
          type: "STAY",
          label: g.stay.room.property.name + " · Kamar " + g.stay.room.number,
          role: "TENANT",
          active: s.contextType === "STAY" && s.occupantAccessId === g.id,
        })),
        ...(s.user.platformAdmin
          ? [
              {
                id: "platform",
                type: "PLATFORM",
                label: "Admin ELENIO",
                role: "PLATFORM_ADMIN",
                active: s.contextType === "PLATFORM",
              },
            ]
          : []),
      ],
      sessions: sessions.map((r) => ({
        id: hashToken("session:" + r.token),
        createdAt: r.createdAt,
        expires: r.expires,
        userAgent: r.userAgent || "Perangkat tidak dicatat",
        current: r.token === s.token,
      })),
      mail,
    },
    { headers },
  );
}
export async function POST(req: NextRequest) {
  if (!validOrigin(req))
    return NextResponse.json(
      { error: "Permintaan tidak diizinkan." },
      { status: 403, headers },
    );
  try {
    const b = await req.json();
    const s = await sessionIdentity();
    if (b.action === "verify") {
      await rateLimit(
        "verify:" + (s?.userId || hashToken(String(b.token).split(".")[0])),
        15,
      );
      const result = await consumeChallenge(
        z.string().max(150).parse(b.token),
        "VERIFY",
      );
      await flushLocalMail();
      return NextResponse.json(result, { headers });
    }
    if (!s)
      return NextResponse.json(
        { error: "Silakan masuk." },
        { status: 401, headers },
      );
    await rateLimit("account:" + s.userId, 60);
    let redirect: string | undefined;
    if (b.action === "resend") {
      await rateLimit("verification-send:" + s.userId, 5);
      await db.$transaction((tx) => issueChallenge(tx, s.user, "EMAIL_VERIFY"));
      await flushLocalMail();
    } else if (b.action === "profile") {
      const name = z.string().trim().min(2).max(100).parse(b.name),
        notificationsEnabled = z.boolean().parse(b.notificationsEnabled);
      await db.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: s.userId },
          data: { name, notificationsEnabled },
        });
        await identityAudit(
          tx,
          s.user.organizationId,
          s.userId,
          "PROFILE_UPDATED",
          s.userId,
        );
      });
    } else if (b.action === "changeEmail") {
      await rateLimit("change-email:" + s.userId, 5);
      if (!verifyPassword(String(b.password), s.user.password))
        throw Error("Kata sandi saat ini tidak cocok.");
      const email = z
        .email()
        .transform((v) => v.trim().toLowerCase())
        .parse(b.email);
      if (email === s.user.email) throw Error("Gunakan alamat email baru.");
      await db.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"identity:" + s.userId}))`;
        const fresh = await tx.user.findUniqueOrThrow({
          where: { id: s.userId },
        });
        if (
          !(await tx.session.count({
            where: {
              token: s.token,
              userId: s.userId,
              expires: { gt: new Date() },
            },
          })) ||
          !verifyPassword(String(b.password), fresh.password) ||
          ["SUSPENDED", "CLOSED"].includes(fresh.accountStatus)
        )
          throw Error("Sesi berubah. Silakan masuk kembali.");
        await issueChallenge(tx, fresh, "EMAIL_CHANGE", email);
      });
      await flushLocalMail();
    } else if (b.action === "changePassword") {
      await rateLimit("change-password:" + s.userId, 5);
      if (!verifyPassword(String(b.currentPassword), s.user.password))
        throw Error("Kata sandi saat ini tidak cocok.");
      const password = z.string().min(10).max(128).parse(b.password);
      await db.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"identity:" + s.userId}))`;
        const fresh = await tx.user.findUniqueOrThrow({
          where: { id: s.userId },
        });
        if (
          !(await tx.session.count({
            where: {
              token: s.token,
              userId: s.userId,
              expires: { gt: new Date() },
            },
          })) ||
          !verifyPassword(String(b.currentPassword), fresh.password) ||
          ["SUSPENDED", "CLOSED"].includes(fresh.accountStatus)
        )
          throw Error("Sesi berubah. Silakan masuk kembali.");
        await tx.user.update({
          where: { id: s.userId },
          data: { password: hashPassword(password) },
        });
        await tx.session.deleteMany({ where: { userId: s.userId } });
        await enqueueEmail(tx, {
          template: "security",
          to: s.user.email,
          values: {
            nama: s.user.name,
            perubahan: "Kata sandi diubah dan semua sesi lama dicabut.",
          },
          dedupeKey: "password-change:" + crypto.randomUUID(),
          userId: s.userId,
          organizationId: s.user.organizationId,
        });
        await identityAudit(
          tx,
          s.user.organizationId,
          s.userId,
          "PASSWORD_CHANGED",
          s.userId,
        );
      });
      (await cookies()).delete("kh-session");
      redirect = "/login";
      await flushLocalMail();
    } else if (b.action === "revokeOthers") {
      await db.$transaction(async (tx) => {
        await tx.session.deleteMany({
          where: { userId: s.userId, token: { not: s.token } },
        });
        await identityAudit(
          tx,
          s.user.organizationId,
          s.userId,
          "OTHER_SESSIONS_REVOKED",
          s.userId,
        );
      });
    } else if (b.action === "revokeSession") {
      const sessions = await db.session.findMany({
        where: { userId: s.userId },
      });
      const target = sessions.find(
        (r) => hashToken("session:" + r.token) === b.id,
      );
      if (!target) throw Error("Sesi tidak ditemukan.");
      await db.$transaction(async (tx) => {
        await tx.session.deleteMany({
          where: { token: target.token, userId: s.userId },
        });
        await identityAudit(
          tx,
          s.user.organizationId,
          s.userId,
          "SESSION_REVOKED",
          s.userId,
        );
      });
      if (target.token === s.token) {
        (await cookies()).delete("kh-session");
        redirect = "/login";
      }
    } else if (b.action === "switch") {
      if (s.user.accountStatus === "PENDING")
        throw Error("Verifikasi email sebelum memilih workspace.");
      if (b.type === "ORG") {
        const m = await db.orgMembership.findFirst({
          where: { id: String(b.id), userId: s.userId, status: "ACTIVE" },
        });
        if (!m) throw Error("Akses workspace tidak tersedia.");
        await db.session.update({
          where: { token: s.token },
          data: {
            contextType: "ORG",
            membershipId: m.id,
            occupantAccessId: null,
          },
        });
        redirect = "/app/dashboard";
      } else if (b.type === "STAY") {
        if (!verified(s.user)) throw Error("Verifikasi email terlebih dahulu.");
        const g = await db.occupantAccess.findFirst({
          where: {
            id: String(b.id),
            userId: s.userId,
            status: "ACTIVE",
            revokedAt: null,
          },
        });
        if (!g) throw Error("Akses masa tinggal tidak tersedia.");
        await db.session.update({
          where: { token: s.token },
          data: {
            contextType: "STAY",
            occupantAccessId: g.id,
            membershipId: null,
          },
        });
        redirect = "/resident";
      } else if (b.type === "PLATFORM" && s.user.platformAdmin) {
        await db.session.update({
          where: { token: s.token },
          data: {
            contextType: "PLATFORM",
            membershipId: null,
            occupantAccessId: null,
          },
        });
        redirect = "/admin";
      } else throw Error("Akses workspace tidak tersedia.");
    } else throw Error("Aksi tidak tersedia.");
    return NextResponse.json({ ok: true, redirect }, { headers });
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof Prisma.PrismaClientKnownRequestError
            ? "Perubahan belum dapat diproses. Periksa data atau masuk kembali."
            : e instanceof z.ZodError
              ? "Periksa isian Anda."
              : e instanceof Error
                ? e.message
                : "Permintaan belum dapat diproses.",
      },
      { status: 400, headers },
    );
  }
}
