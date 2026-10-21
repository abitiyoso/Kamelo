import { randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { db } from "./db";
import { hashToken, hashPassword, sessionIdentity } from "./auth";
import { enqueueEmail } from "./email/outbox";
import { emailLink } from "./email/templates.mjs";
import type { Prisma } from "@/generated/prisma";
import { identityPolicy } from "./identity-policy.mjs";
export const verified = (u: {
  emailVerifiedAt: Date | null;
  accountStatus: string;
}) =>
  Boolean(u.emailVerifiedAt) &&
  !["PENDING", "SUSPENDED", "CLOSED"].includes(u.accountStatus);
export function appOrigin() {
  const u = new URL(process.env.APP_URL || "http://invalid");
  if (
    u.protocol !== "https:" &&
    !["localhost", "127.0.0.1", "[::1]"].includes(u.hostname)
  )
    throw Error("APP_URL tidak valid.");
  return u.origin;
}
export async function identityAudit(
  tx: Prisma.TransactionClient,
  organizationId: string,
  actorId: string,
  action: string,
  targetId: string,
  metadata: Prisma.InputJsonObject = {},
) {
  await tx.audit.create({
    data: { organizationId, actorId, action, targetId, metadata },
  });
}
export async function issueChallenge(
  tx: Prisma.TransactionClient,
  user: { id: string; email: string; name: string; organizationId: string },
  purpose: string,
  targetEmail = user.email,
) {
  const policy = identityPolicy();
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"identity:" + user.id}))`;
  const last = await tx.identityChallenge.findFirst({
    where: { userId: user.id, purpose },
    orderBy: { createdAt: "desc" },
  });
  if (
    last &&
    Date.now() - last.createdAt.getTime() < policy.resendSeconds * 1000
  )
    return { queued: false, cooldown: policy.resendSeconds };
  const superseded = await tx.identityChallenge.findMany({
    where: { userId: user.id, purpose, consumedAt: null },
    select: { id: true },
  });
  await tx.emailOutbox.updateMany({
    where: {
      dedupeKey: { in: superseded.map((c) => "challenge:" + c.id) },
      status: { in: ["QUEUED", "BLOCKED"] },
    },
    data: { status: "CANCELLED", encryptedPayload: "" },
  });
  await tx.identityChallenge.updateMany({
    where: { userId: user.id, purpose, consumedAt: null },
    data: { consumedAt: new Date() },
  });
  const id = randomUUID(),
    secret = randomBytes(32).toString("hex"),
    expiresAt = new Date(
      Date.now() +
        (purpose === "RESET"
          ? policy.resetMinutes
          : policy.verificationMinutes) *
          60000,
    );
  await tx.identityChallenge.create({
    data: {
      id,
      userId: user.id,
      purpose,
      targetEmail,
      tokenHash: hashToken(secret),
      expiresAt,
    },
  });
  const url = emailLink(
    appOrigin(),
    purpose === "RESET" ? "/reset-password" : "/verify-email",
    `token=${id}.${secret}`,
  );
  await enqueueEmail(tx, {
    template: purpose === "RESET" ? "05" : "01",
    to: targetEmail,
    values: {
      nama: user.name,
      url_reset: url,
      url_verifikasi: url,
      menit_verifikasi: String(policy.verificationMinutes),
      menit_reset: String(policy.resetMinutes),
    },
    dedupeKey: "challenge:" + id,
    userId: user.id,
    organizationId: user.organizationId,
    expiresAt,
  });
  return { queued: true, cooldown: policy.resendSeconds };
}
export async function consumeChallenge(
  token: string,
  purpose: "VERIFY" | "RESET",
  password?: string,
) {
  const match = /^([a-zA-Z0-9_-]{20,64})\.([a-f0-9]{64})$/.exec(token);
  if (!match) throw Error("Tautan tidak valid atau kedaluwarsa.");
  const session = await sessionIdentity();
  const result = await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"challenge:" + match[1]}))`;
    const c = await tx.identityChallenge.findUnique({
      where: { id: match[1] },
      include: { user: true },
    });
    if (c) {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"identity:" + c.userId}))`;
      Object.assign(
        c,
        await tx.identityChallenge.findUniqueOrThrow({ where: { id: c.id } }),
      );
      c.user = await tx.user.findUniqueOrThrow({ where: { id: c.userId } });
    }
    if (
      !c ||
      c.consumedAt ||
      c.expiresAt <= new Date() ||
      c.attempts >= identityPolicy().maxAttempts
    )
      return { error: true };
    if (
      !timingSafeEqual(
        Buffer.from(c.tokenHash),
        Buffer.from(hashToken(match[2])),
      )
    ) {
      await tx.identityChallenge.update({
        where: { id: c.id },
        data: { attempts: { increment: 1 } },
      });
      return { error: true };
    }
    if (
      (purpose === "RESET") !== (c.purpose === "RESET") ||
      ["SUSPENDED", "CLOSED"].includes(c.user.accountStatus)
    )
      return { error: true };
    if (
      c.purpose !== "RESET" &&
      (session?.userId !== c.userId ||
        !(await tx.session.count({
          where: {
            token: session.token,
            userId: c.userId,
            expires: { gt: new Date() },
          },
        })))
    )
      return { error: true };
    if (c.purpose === "EMAIL_VERIFY" && c.targetEmail !== c.user.email)
      return { error: true };
    if (purpose === "RESET") {
      if (!password) throw Error("Kata sandi diperlukan.");
      await tx.user.update({
        where: { id: c.userId },
        data: { password: hashPassword(password) },
      });
      await tx.session.deleteMany({ where: { userId: c.userId } });
      await enqueueEmail(tx, {
        template: "security",
        to: c.user.email,
        values: {
          nama: c.user.name,
          perubahan:
            "Kata sandi akun Anda telah diatur ulang. Semua sesi lama telah dicabut.",
        },
        dedupeKey: "reset-notice:" + c.id,
        userId: c.userId,
        organizationId: c.user.organizationId,
      });
    } else {
      const old = c.user.email;
      await tx.user.update({
        where: { id: c.userId },
        data: {
          email: c.targetEmail,
          emailVerifiedAt: new Date(),
          ...(c.user.accountStatus === "PENDING"
            ? { accountStatus: "ACTIVE" }
            : {}),
        },
      });
      await tx.orgMembership.updateMany({
        where: { userId: c.userId, status: "PENDING" },
        data: { status: "ACTIVE" },
      });
      if (c.purpose === "EMAIL_CHANGE") {
        await tx.session.deleteMany({ where: { userId: c.userId } });
        await enqueueEmail(tx, {
          template: "security",
          to: old,
          values: {
            nama: c.user.name,
            perubahan:
              "Alamat email akun Anda telah diubah setelah pemeriksaan kata sandi dan verifikasi alamat baru.",
          },
          dedupeKey: "email-notice:" + c.id,
          userId: c.userId,
          organizationId: c.user.organizationId,
        });
      } else {
        const owner = await tx.orgMembership.findFirst({
          where: { userId: c.userId, role: "OWNER", status: "ACTIVE" },
        });
        await enqueueEmail(tx, {
          template: owner ? "02" : "security",
          to: c.targetEmail,
          values: {
            nama: c.user.name,
            url_onboarding: emailLink(appOrigin(), "/onboarding"),
            perubahan:
              "Alamat email Anda telah diverifikasi. Tinjau dan terima undangan untuk mengaktifkan akses yang ditawarkan.",
          },
          dedupeKey: "verified:" + c.id,
          userId: c.userId,
          organizationId: c.user.organizationId,
        });
        if (session?.userId === c.userId) {
          const m = await tx.orgMembership.findFirst({
            where: { userId: c.userId, status: "ACTIVE" },
          });
          if (m)
            await tx.session.updateMany({
              where: { token: session.token },
              data: { contextType: "ORG", membershipId: m.id },
            });
        }
      }
    }
    await tx.identityChallenge.update({
      where: { id: c.id },
      data: { consumedAt: new Date() },
    });
    await identityAudit(
      tx,
      c.user.organizationId,
      c.userId,
      purpose === "RESET" ? "PASSWORD_RESET" : "EMAIL_VERIFIED",
      c.userId,
      { purpose: c.purpose },
    );
    return {
      error: false,
      redirect:
        purpose === "RESET" ||
        c.purpose === "EMAIL_CHANGE" ||
        session?.userId !== c.userId
          ? "/login"
          : "/workspaces",
    };
  });
  if (result.error)
    throw Error("Tautan tidak valid, telah dipakai, atau kedaluwarsa.");
  return { ok: true, redirect: result.redirect };
}
export async function occupantForSession(active = false) {
  const session = await sessionIdentity();
  if (
    !session ||
    !verified(session.user) ||
    session.contextType !== "STAY" ||
    !session.occupantAccessId
  )
    return null;
  const grant = await db.occupantAccess.findFirst({
    where: {
      id: session.occupantAccessId,
      userId: session.userId,
      status: "ACTIVE",
      revokedAt: null,
    },
    include: {
      stay: { include: { guest: true, room: { include: { property: true } } } },
    },
  });
  if (!grant) return null;
  if (active) {
    const { activeStay } = await import("./operations");
    if (!activeStay(grant.stay)) return null;
  }
  return grant;
}
