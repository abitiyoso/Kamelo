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
export async function currentUser() {
  const token = (await cookies()).get("kh-session")?.value;
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { token: hashToken(token) },
    include: { user: { include: { organization: true } } },
  });
  return session && session.expires > new Date() ? session.user : null;
}
export async function createSession(userId: string) {
  const token = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 7 * 86400000);
  await db.session.create({
    data: { token: hashToken(token), userId, expires },
  });
  (await cookies()).set("kh-session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires,
    path: "/",
  });
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
