import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  createSession,
  currentUser,
  hashPassword,
  hashToken,
  rateLimit,
  verifyPassword,
} from "@/lib/auth";
import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import { validOrigin } from "@/lib/origin";
const credentials = z.object({
  email: z.email().transform((v) => v.toLowerCase()),
  password: z.string().min(10).max(128),
});
export async function POST(req: NextRequest) {
  try {
    if (!validOrigin(req))
      return NextResponse.json(
        { error: "Permintaan tidak diizinkan." },
        { status: 403 },
      );
    const body = await req.json();
    if (body.action === "logout") {
      const token = (await cookies()).get("kh-session")?.value;
      if (token)
        await db.session.deleteMany({ where: { token: hashToken(token) } });
      (await cookies()).delete("kh-session");
      return NextResponse.json({ ok: true });
    }
    if (body.action === "forgot") {
      const email = z.email().parse(body.email).toLowerCase();
      await rateLimit("reset:" + hashToken(email), 3);
      if (!process.env.MAIL_ENDPOINT || !process.env.MAIL_API_KEY)
        return NextResponse.json(
          {
            error:
              "Pengiriman email pemulihan belum tersedia. Hubungi pengelola.",
          },
          { status: 503 },
        );
      const user = await db.user.findUnique({ where: { email } });
      if (user) {
        const token = randomBytes(32).toString("hex");
        await db.resetToken.create({
          data: {
            token: hashToken(token),
            userId: user.id,
            expires: new Date(Date.now() + 3600000),
          },
        });
        const response = await fetch(process.env.MAIL_ENDPOINT, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.MAIL_API_KEY}`,
          },
          body: JSON.stringify({
            to: email,
            subject: "Pulihkan akun KosHotel",
            text: `Buka ${process.env.APP_URL}/reset-password?token=${token}. Berlaku 1 jam.`,
          }),
        });
        if (!response.ok) throw new Error("Layanan email tidak tersedia.");
      }
      return NextResponse.json({
        ok: true,
        message: "Jika email terdaftar, tautan pemulihan akan dikirim.",
      });
    }
    if (body.action === "reset") {
      const input = z
        .object({
          token: z.string().length(64),
          password: z.string().min(10).max(128),
        })
        .parse(body);
      await db.$transaction(async (tx) => {
        const token = await tx.resetToken.findUnique({
          where: { token: hashToken(input.token) },
        });
        if (!token || token.expires < new Date())
          throw new Error("Tautan pemulihan tidak valid atau kedaluwarsa.");
        await tx.resetToken.delete({ where: { token: token.token } });
        await tx.user.update({
          where: { id: token.userId },
          data: { password: hashPassword(input.password) },
        });
        await tx.session.deleteMany({ where: { userId: token.userId } });
      });
      return NextResponse.json({ ok: true });
    }
    const input = credentials.parse(body);
    await rateLimit("login:" + hashToken(input.email));
    if (body.action === "register") {
      const requestedPlan = z
        .enum(["free", "starter", "plus"])
        .optional()
        .parse(body.requestedPlan);
      const profile = z
        .object({
          name: z.string().trim().min(2).max(100),
          phone: z.string().regex(/^(?:\+62|62|0)8\d{7,12}$/),
        })
        .parse(body);
      const user = await db.$transaction(async (tx) => {
        const org = await tx.organization.create({
          data: { name: profile.name },
        });
        if (requestedPlan && requestedPlan !== "free") {
          const upgrade = await tx.upgrade.create({
            data: { organizationId: org.id, plan: requestedPlan },
          });
          await tx.audit.create({
            data: {
              organizationId: org.id,
              actorId: "registration",
              action: "UPGRADE_REQUESTED",
              targetId: upgrade.id,
              metadata: { plan: requestedPlan },
            },
          });
        }
        return tx.user.create({
          data: {
            ...profile,
            ...input,
            password: hashPassword(input.password),
            organizationId: org.id,
          },
        });
      });
      await createSession(user.id);
      return NextResponse.json({ ok: true, redirect: "/onboarding" });
    }
    const user = await db.user.findUnique({ where: { email: input.email } });
    if (!user || !verifyPassword(input.password, user.password))
      return NextResponse.json(
        { error: "Email atau kata sandi salah." },
        { status: 401 },
      );
    await createSession(user.id);
    return NextResponse.json({ ok: true, redirect: "/app/dashboard" });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof z.ZodError
            ? "Periksa isian Anda. Kata sandi minimal 10 karakter."
            : "Tidak dapat memproses permintaan. Periksa data atau coba kembali.",
      },
      { status: 400 },
    );
  }
}
export async function GET() {
  const user = await currentUser();
  return NextResponse.json(user ? { name: user.name, role: user.role } : null);
}
