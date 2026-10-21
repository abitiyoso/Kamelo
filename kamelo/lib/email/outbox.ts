import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma";
import { encryptSecret, decryptSecret } from "@/lib/secrets";
import { renderEmail } from "./templates.mjs";
import { emailConfig, deliverEmail, emailFailure } from "./transport.mjs";
import { reminderEmailGuard } from "../reminder-eligibility";
export async function enqueueEmail(
  tx: Prisma.TransactionClient,
  {
    template,
    to,
    values,
    dedupeKey,
    userId,
    organizationId,
    expiresAt,
  }: {
    template: string;
    to: string;
    values: Record<string, string>;
    dedupeKey: string;
    userId?: string;
    organizationId?: string;
    expiresAt?: Date;
  },
) {
  const config = emailConfig(),
    content = renderEmail(template, values, config.origin);
  return tx.emailOutbox.upsert({
    where: { dedupeKey },
    update: {},
    create: {
      dedupeKey,
      userId,
      organizationId,
      template,
      encryptedPayload: encryptSecret(JSON.stringify({ to, ...content })),
      expiresAt,
      status: config.driver === "disabled" ? "BLOCKED" : "QUEUED",
    },
  });
}
export async function drainEmailOutbox(limit = 10) {
  // A crashed sender may already have submitted DATA: never retry an expired lease automatically.
  await db.emailOutbox.updateMany({
    where: { status: "PROCESSING", leaseUntil: { lt: new Date() } },
    data: { status: "UNKNOWN", lastErrorCode: "DELIVERY_UNCERTAIN" },
  });
  let processed = 0;
  for (let n = 0; n < Math.min(limit, 50); n++) {
    const row = await db.$transaction(async (tx) => {
      const ids = await tx.$queryRaw<
        { id: string }[]
      >`SELECT id FROM "EmailOutbox" WHERE status='QUEUED' AND "nextAttemptAt"<=NOW() ORDER BY "createdAt",id FOR UPDATE SKIP LOCKED LIMIT 1`;
      if (!ids.length) return null;
      return tx.emailOutbox.update({
        where: { id: ids[0].id },
        data: {
          status: "PROCESSING",
          attempts: { increment: 1 },
          leaseUntil: new Date(Date.now() + 60000),
        },
      });
    });
    if (!row) break;
    if (row.template === "payment_reminder") {
      const reason = await db.$transaction(async (tx) => {
        const d = await tx.reminderDelivery.findUnique({
          where: { emailOutboxId: row.id },
          include: { property: { select: { organizationId: true } } },
        });
        if (!d) return "REMINDER_ORPHANED";
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${d.property.organizationId}))`;
        return await reminderEmailGuard(tx, row.id);
      });
      if (reason) {
        await db.emailOutbox.update({
          where: { id: row.id },
          data: {
            status: "CANCELLED",
            encryptedPayload: "",
            leaseUntil: null,
            lastErrorCode: reason,
          },
        });
        continue;
      }
    }
    if (row.expiresAt && row.expiresAt <= new Date()) {
      await db.emailOutbox.update({
        where: { id: row.id },
        data: { status: "CANCELLED", encryptedPayload: "", leaseUntil: null },
      });
      continue;
    }
    try {
      const message = JSON.parse(decryptSecret(row.encryptedPayload));
      const delivered = await deliverEmail(message, row.id);
      await db.emailOutbox.update({
        where: { id: row.id },
        data: {
          status: delivered.status,
          providerMessageId: delivered.messageId,
          acceptedAt: new Date(),
          leaseUntil: null,
          lastErrorCode: null,
        },
      });
    } catch (error) {
      const failure = emailFailure(error);
      await db.emailOutbox.update({
        where: { id: row.id },
        data: {
          status:
            failure.retry && row.attempts >= 5 ? "FAILED" : failure.status,
          lastErrorCode: failure.code,
          leaseUntil: null,
          nextAttemptAt: new Date(
            Date.now() + 30000 * 2 ** Math.min(row.attempts, 5),
          ),
        },
      });
    }
    processed++;
  }
  return { processed };
}
export async function flushLocalMail() {
  if (process.env.MAIL_DRIVER === "sink") await drainEmailOutbox(10);
}
