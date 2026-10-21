import {
  scryptSync,
  randomBytes,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { cookies } from "next/headers";
import { db } from "./db";
export const hashToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return salt + ":" + scryptSync(password, salt, 64).toString("hex");
}
export function verifyPassword(password: string, encoded: string) {
  const [salt, hash] = encoded.split(":");
  const candidate = scryptSync(password, salt, 64);
  return (
    candidate.length === Buffer.from(hash, "hex").length &&
    timingSafeEqual(candidate, Buffer.from(hash, "hex"))
  );
}
export async function sessionIdentity() {
  const token = (await cookies()).get("kh-session")?.value;
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { token: hashToken(token) },
    include: { user: { include: { organization: true } } },
  });
  if (
    !session ||
    session.expires <= new Date() ||
    ["SUSPENDED", "CLOSED"].includes(session.user.accountStatus)
  )
    return null;
  return session;
}
export async function ensureLegacyMembership(user: {
  id: string;
  organizationId: string;
  role: string;
  accountStatus: string;
  propertyIds: string[];
  canRecordPayments: boolean;
  canControlDevices: boolean;
}) {
  if (
    user.accountStatus !== "LEGACY_ACTIVE" ||
    !["OWNER", "STAFF"].includes(user.role)
  )
    return;
  await db.orgMembership.upsert({
    where: {
      userId_organizationId: {
        userId: user.id,
        organizationId: user.organizationId,
      },
    },
    update: {},
    create: {
      userId: user.id,
      organizationId: user.organizationId,
      role: user.role,
      propertyIds: user.propertyIds,
      canRecordPayments: user.canRecordPayments,
      canControlDevices: user.canControlDevices,
    },
  });
}
export async function currentUser() {
  const session = await sessionIdentity();
  if (!session) return null;
  const user = session.user;
  if (user.accountStatus === "PENDING") return null;
  if (session.contextType === "PLATFORM")
    return user.platformAdmin
      ? { ...user, role: "PLATFORM_ADMIN", membershipId: null }
      : null;
  if (session.contextType !== "ORG") return null;
  await ensureLegacyMembership(user);
  const membership = await db.orgMembership.findFirst({
    where: session.membershipId
      ? { id: session.membershipId, userId: user.id }
      : { userId: user.id, organizationId: user.organizationId },
    include: { organization: true },
  });
  if (!membership || membership.status !== "ACTIVE") return null;
  return {
    ...user,
    organizationId: membership.organizationId,
    organization: membership.organization,
    role: membership.role,
    propertyIds: membership.propertyIds,
    canRecordPayments: membership.canRecordPayments,
    canControlDevices: membership.canControlDevices,
    membershipId: membership.id,
  };
}
export async function createSession(userId: string, userAgent = "") {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  await ensureLegacyMembership(user);
  const memberships = await db.orgMembership.findMany({
    where: { userId, status: "ACTIVE" },
  });
  const occupant = await db.occupantAccess.findFirst({
    where: { userId, status: "ACTIVE", revokedAt: null },
  });
  const member =
    memberships.find((m) => m.organizationId === user.organizationId) ||
    memberships[0];
  const contextType =
    user.accountStatus === "PENDING"
      ? "ACCOUNT"
      : member
        ? "ORG"
        : occupant
          ? "STAY"
          : "ACCOUNT";
  const token = randomBytes(32).toString("hex"),
    expires = new Date(Date.now() + 7 * 86400000);
  await db.session.create({
    data: {
      token: hashToken(token),
      userId,
      expires,
      contextType,
      membershipId: contextType === "ORG" ? member?.id : null,
      occupantAccessId: contextType === "STAY" ? occupant?.id : null,
      userAgent: userAgent.slice(0, 160),
    },
  });
  (await cookies()).set("kh-session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires,
    path: "/",
  });
  return user.accountStatus === "PENDING"
    ? "/verify-email"
    : memberships.length + Number(Boolean(occupant)) > 1
      ? "/workspaces"
      : contextType === "STAY"
        ? "/resident"
        : contextType === "ORG"
          ? "/app/dashboard"
          : "/workspaces";
}
export async function rateLimit(key: string, limit = 8) {
  const now = new Date();
  await db.rateLimit.deleteMany({ where: { key, expires: { lt: now } } });
  const bucket = await db.rateLimit.upsert({
    where: { key },
    create: { key, count: 1, expires: new Date(Date.now() + 15 * 60000) },
    update: { count: { increment: 1 } },
  });
  if (bucket.count > limit)
    throw new Error("Terlalu banyak percobaan. Coba kembali dalam 15 menit.");
}
