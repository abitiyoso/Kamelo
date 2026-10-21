import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  createSession,
  currentUser,
  sessionIdentity,
  hashPassword,
  hashToken,
  rateLimit,
  verifyPassword,
} from "@/lib/auth";
import { validOrigin } from "@/lib/origin";
import { issueChallenge, consumeChallenge } from "@/lib/identity";
import { inviteRecord, assertInvitation } from "@/lib/invitations";
import { flushLocalMail } from "@/lib/email/outbox";
import { emailConfig } from "@/lib/email/transport.mjs";
const credentials = z.object({
  email: z.email().transform((v) => v.trim().toLowerCase()),
  password: z.string().min(10).max(128),
});
const headers = {
  "Cache-Control": "private, no-store",
  "Referrer-Policy": "no-referrer",
};
export async function POST(req: NextRequest) {
  if (!validOrigin(req))
    return NextResponse.json(
      { error: "Permintaan tidak diizinkan." },
      { status: 403, headers },
    );
  try {
    const body = await req.json();
    if (body.action === "logout") {
      const token = (await cookies()).get("kh-session")?.value;
      if (token)
        await db.session.deleteMany({ where: { token: hashToken(token) } });
      (await cookies()).delete("kh-session");
      return NextResponse.json({ ok: true }, { headers });
    }
    if (body.action === "forgot") {
      const email = z.email().parse(body.email).toLowerCase();
      await rateLimit("reset:" + hashToken(email), 3);
      if (emailConfig().driver === "disabled")
        return NextResponse.json(
          {
            error:
              "Pengiriman email pemulihan belum tersedia. Hubungi pengelola.",
          },
          { status: 503, headers },
        );
      const user = await db.user.findUnique({ where: { email } });
      if (user && !["SUSPENDED", "CLOSED"].includes(user.accountStatus))
        await db.$transaction((tx) => issueChallenge(tx, user, "RESET"));
      await flushLocalMail();
      return NextResponse.json(
        {
          ok: true,
          message:
            "Jika email terdaftar, permintaan pemulihan akan diproses. Periksa email atau hubungi pengelola jika belum diterima.",
        },
        { headers },
      );
    }
    if (body.action === "reset") {
      const input = z
        .object({
          token: z.string().max(150),
          password: z.string().min(10).max(128),
        })
        .parse(body);
      await rateLimit(
        "reset-consume:" + hashToken(input.token.split(".")[0]),
        10,
      );
      if (input.token.includes(".")) {
        const result = await consumeChallenge(
          input.token,
          "RESET",
          input.password,
        );
        await flushLocalMail();
        return NextResponse.json(result, { headers });
      }
      // Previously issued one-hour links continue to work during the expand/contract transition.
      if (!/^[a-f0-9]{64}$/.test(input.token))
        throw Error("Tautan tidak tersedia.");
      await db.$transaction(async (tx) => {
        const t = await tx.resetToken.findUnique({
          where: { token: hashToken(input.token) },
        });
        if (!t || t.expires <= new Date())
          throw Error("Tautan tidak tersedia.");
        await tx.resetToken.delete({ where: { token: t.token } });
        await tx.user.update({
          where: { id: t.userId },
          data: { password: hashPassword(input.password) },
        });
        await tx.session.deleteMany({ where: { userId: t.userId } });
      });
      return NextResponse.json({ ok: true, redirect: "/login" }, { headers });
    }
    const input = credentials.parse(body);
    await rateLimit("login:" + hashToken(input.email));
    if (body.action === "register") {
      const profile = z
          .object({
            name: z.string().trim().min(2).max(100),
            phone: z.string().regex(/^(?:\+62|62|0)8\d{7,12}$/),
          })
          .parse(body),
        requestedPlan = z
          .enum(["free", "starter", "plus"])
          .optional()
          .parse(body.requestedPlan);
      const invitationToken =
        typeof body.invitationToken === "string" ? body.invitationToken : null;
      const user = await db.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"register:" + input.email}))`;
        const existing = await tx.user.findUnique({
          where: { email: input.email },
        });
        if (existing) {
          if (
            existing.accountStatus === "PENDING" &&
            verifyPassword(input.password, existing.password)
          ) {
            await issueChallenge(tx, existing, "EMAIL_VERIFY");
            return existing;
          }
          return null;
        }
        let organizationId: string;
        if (invitationToken) {
          const inv = await inviteRecord(invitationToken);
          if (!inv || inv.recipientEmail !== input.email)
            throw Error("Periksa data undangan.");
          await assertInvitation(tx, inv);
          organizationId = inv.organizationId;
        } else
          organizationId = (
            await tx.organization.create({ data: { name: profile.name } })
          ).id;
        const created = await tx.user.create({
          data: {
            ...input,
            ...profile,
            password: hashPassword(input.password),
            organizationId,
            role: invitationToken ? "IDENTITY" : "OWNER",
            accountStatus: "PENDING",
          },
        });
        if (!invitationToken) {
          await tx.orgMembership.create({
            data: {
              userId: created.id,
              organizationId,
              role: "OWNER",
              status: "PENDING",
            },
          });
          if (requestedPlan && requestedPlan !== "free") {
            const upgrade = await tx.upgrade.create({
              data: { organizationId, plan: requestedPlan },
            });
            await tx.audit.create({
              data: {
                organizationId,
                actorId: "registration",
                action: "UPGRADE_REQUESTED",
                targetId: upgrade.id,
                metadata: { plan: requestedPlan },
              },
            });
          }
        }
        await issueChallenge(tx, created, "EMAIL_VERIFY");
        return created;
      });
      if (user)
        await createSession(user.id, req.headers.get("user-agent") || "");
      await flushLocalMail();
      return NextResponse.json(
        {
          ok: true,
          redirect: "/verify-email",
          message:
            "Jika alamat email dapat digunakan, petunjuk verifikasi akan diproses. Jika sudah memiliki akun, silakan masuk.",
          deliveryMode: emailConfig().driver,
        },
        { headers },
      );
    }
    if (body.action !== "login") throw Error("Aksi tidak tersedia.");
    const user = await db.user.findUnique({ where: { email: input.email } });
    if (
      !user ||
      !["PENDING", "ACTIVE", "LEGACY_ACTIVE"].includes(user.accountStatus) ||
      !verifyPassword(input.password, user.password)
    )
      return NextResponse.json(
        { error: "Email atau kata sandi salah." },
        { status: 401, headers },
      );
    const redirect = await createSession(
      user.id,
      req.headers.get("user-agent") || "",
    );
    return NextResponse.json({ ok: true, redirect }, { headers });
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof z.ZodError
            ? "Periksa isian Anda. Kata sandi minimal 10 karakter."
            : "Tidak dapat memproses permintaan. Periksa data atau coba kembali.",
      },
      { status: 400, headers },
    );
  }
}
export async function GET() {
  const user = await currentUser();
  if (user)
    return NextResponse.json({ name: user.name, role: user.role }, { headers });
  const s = await sessionIdentity();
  return NextResponse.json(
    s
      ? {
          name: s.user.name,
          role: "ACCOUNT",
          needsVerification: s.user.accountStatus === "PENDING",
        }
      : null,
    { headers },
  );
}
