import { Prisma } from "@/generated/prisma";
import { z } from "zod";
import { stableHash } from "./lifecycle-rules.mjs";
import { lifecycleAudit } from "./lifecycle";
import { enqueueEmail } from "./email/outbox";
import { emailConfig } from "./email/transport.mjs";
import { emailLink } from "./email/templates.mjs";
import {
  activeReminderPolicy,
  recipientHash,
  reminderSources,
  type ReminderSource,
} from "./reminder-eligibility";
import { reminderClock, reminderDueLimit } from "./reminder-clock.mjs";
type Tx = Prisma.TransactionClient;
export const reminderDefaults = {
  enabled: false,
  emailEnabled: false,
  hour: 9,
  leadDays: 0,
  intervalDays: 3,
  revision: 0,
};
export async function reminderCandidates(
  tx: Tx,
  propertyId: string,
  channel: "PORTAL" | "EMAIL",
) {
  const policy = await activeReminderPolicy(tx, propertyId),
    clock = reminderClock();
  if (
    !policy ||
    clock.hour < policy.hour ||
    (channel === "EMAIL" && !policy.emailEnabled)
  )
    return [];
  const cutoff = new Date(Date.now() - policy.intervalDays * 86400000),
    manualCutoff = new Date(Date.now() - 86400000);
  const sources = await reminderSources(
    tx,
    propertyId,
    reminderDueLimit(clock.today, policy.leadDays),
  );
  return tx.$queryRaw<
    ReminderSource[]
  >(Prisma.sql`WITH s AS (${sources}) SELECT s.* FROM s WHERE NOT EXISTS (
    SELECT 1 FROM "ReminderDelivery" d LEFT JOIN "EmailOutbox" e ON e.id=d."emailOutboxId" WHERE d.channel=${channel}
    AND ((s.source='INVOICE' AND d."invoiceId"=s.id) OR (s.source='OPENING' AND d."receivableId"=s.id))
    AND (d."createdAt">${cutoff} OR (d.channel='EMAIL' AND e.status IN ('QUEUED','PROCESSING','UNKNOWN')) OR (d."scheduledOn"=${clock.today} AND d."grantId"=s."grantId")))
    AND (${channel}<>'PORTAL' OR s.source<>'OPENING' OR NOT EXISTS(SELECT 1 FROM "OpeningReminder" m WHERE m."receivableId"=s.id AND m."createdAt">${manualCutoff}))
    ORDER BY s.due,s.source,s.id,s."grantId" LIMIT 20`);
}
export async function runReminderProperty(tx: Tx, propertyId: string) {
  const policy = await activeReminderPolicy(tx, propertyId),
    clock = reminderClock();
  if (!policy || clock.hour < policy.hour) return { portal: 0, email: 0 };
  const counts = { portal: 0, email: 0 };
  for (const channel of ["PORTAL", "EMAIL"] as const) {
    for (const r of await reminderCandidates(tx, propertyId, channel)) {
      const amount = Number(r.amount);
      if (!Number.isSafeInteger(amount) || amount <= 0 || amount > 1000000000)
        continue;
      const dedupeKey =
        "reminder:" +
        stableHash({
          source: r.source,
          id: r.id,
          grant: r.grantId,
          channel,
          date: clock.today,
        });
      // The whole job holds the same organization lock as payments, proof reviews and access changes.
      const outbox =
        channel === "EMAIL"
          ? await enqueueEmail(tx, {
              template: "payment_reminder",
              to: r.email,
              values: {
                url_portal: emailLink(emailConfig().origin, "/resident"),
              },
              dedupeKey,
              userId: r.userId,
              organizationId: policy.property.organizationId,
              expiresAt: new Date(Date.parse(clock.today + "T17:00:00Z")), // next Jakarta midnight
            })
          : null;
      await tx.reminderDelivery.create({
        data: {
          propertyId,
          invoiceId: r.source === "INVOICE" ? r.id : null,
          receivableId: r.source === "OPENING" ? r.id : null,
          shareId: r.shareId,
          grantId: r.grantId,
          userId: r.userId,
          channel,
          scheduledOn: clock.today,
          amount,
          due: r.due,
          reference: r.reference,
          emailHash: recipientHash(r.email),
          policyRevision: policy.revision,
          dedupeKey,
          status: channel === "PORTAL" ? "PUBLISHED" : "QUEUED",
          emailOutboxId: outbox?.id,
        },
      });
      counts[channel === "PORTAL" ? "portal" : "email"]++;
    }
  }
  await tx.reminderPolicy.update({
    where: { propertyId },
    data: { lastRunAt: new Date() },
  });
  return counts;
}
export async function reminderRead(
  tx: Tx,
  organizationId: string,
  propertyId: string,
  page: number,
) {
  const property = await tx.property.findFirst({
    where: { id: propertyId, organizationId },
    select: { id: true, name: true },
  });
  if (!property) throw Error("Pilih satu properti yang Anda kelola.");
  const policy = await tx.reminderPolicy.findUnique({ where: { propertyId } });
  const rows = await tx.reminderDelivery.findMany({
    where: { propertyId },
    select: {
      id: true,
      channel: true,
      status: true,
      reason: true,
      reference: true,
      amount: true,
      due: true,
      createdAt: true,
      emailOutbox: { select: { status: true, lastErrorCode: true } },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 20,
    skip: (page - 1) * 20,
  });
  return {
    property,
    policy: policy
      ? {
          enabled: policy.enabled,
          emailEnabled: policy.emailEnabled,
          hour: policy.hour,
          leadDays: policy.leadDays,
          intervalDays: policy.intervalDays,
          revision: policy.revision,
          lastRunAt: policy.lastRunAt,
        }
      : reminderDefaults,
    history: rows,
    total: await tx.reminderDelivery.count({ where: { propertyId } }),
    page,
    candidates: (await reminderCandidates(tx, propertyId, "PORTAL")).map(
      (r) => ({
        source: r.source,
        reference: r.reference,
        amount: Number(r.amount),
        due: r.due,
      }),
    ),
    clock: reminderClock(),
    transport: emailConfig().driver,
  };
}
export async function reminderSave(
  tx: Tx,
  a: { userId: string; organizationId: string },
  body: Record<string, unknown>,
) {
  const p = z
    .object({
      propertyId: z.string().min(1).max(100),
      enabled: z.boolean(),
      emailEnabled: z.boolean(),
      hour: z.number().int().min(0).max(23),
      leadDays: z.number().int().min(0).max(30),
      intervalDays: z.number().int().min(1).max(30),
      revision: z.number().int().min(0),
      confirmed: z.literal(true),
    })
    .parse(body);
  if (
    !(await tx.property.findFirst({
      where: { id: p.propertyId, organizationId: a.organizationId },
    }))
  )
    throw Error("Properti tidak ditemukan.");
  const old = await tx.reminderPolicy.findUnique({
    where: { propertyId: p.propertyId },
  });
  if ((old?.revision || 0) !== p.revision)
    throw Error("Pengaturan berubah. Muat ulang sebelum menyimpan.");
  const { revision, confirmed, ...data } = p;
  const result = await tx.reminderPolicy.upsert({
    where: { propertyId: p.propertyId },
    create: { ...data, actorId: a.userId, revision: 1 },
    update: { ...data, actorId: a.userId, revision: revision + 1 },
  });
  await lifecycleAudit(
    tx,
    a.organizationId,
    a.userId,
    "REMINDER_POLICY_UPDATED",
    p.propertyId,
    {
      enabled: p.enabled,
      emailEnabled: p.emailEnabled,
      revision: result.revision,
    },
  );
  return { propertyId: p.propertyId, revision: result.revision };
}
