import { Prisma } from "@/generated/prisma";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { plans } from "./plans";
import { lifecycleDate, lifecycleAudit } from "./lifecycle";
import { localToday } from "./operations";
import { encryptSecret, decryptSecret } from "./secrets";
import {
  subscriptionEnd,
  subscriptionMovement,
  subscriptionPaymentState,
} from "./subscription-rules.mjs";
type Tx = Prisma.TransactionClient;
const id = z.string().min(1).max(100),
  amount = z.number().int().min(1).max(1000000000);
export function billingProfileView(p: any) {
  if (!p) return null;
  const { encryptedTaxId, ...safe } = p;
  return {
    ...safe,
    maskedTaxId: encryptedTaxId
      ? "•••• " + decryptSecret(encryptedTaxId).slice(-4)
      : "",
  };
}
export async function subscriptionEvent(
  tx: Tx,
  organizationId: string,
  actorId: string,
  kind: string,
  note: string,
  metadata: Prisma.InputJsonObject = {},
  invoiceId?: string,
) {
  await tx.subscriptionEvent.create({
    data: { organizationId, actorId, kind, note, metadata, invoiceId },
  });
  await lifecycleAudit(
    tx,
    organizationId,
    actorId,
    "SAAS_" + kind,
    invoiceId || organizationId,
  );
}
export async function invoiceRows(tx: Tx, organizationId: string, page = 1) {
  const where = { organizationId };
  const rows = await tx.subscriptionInvoice.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 25,
    skip: (page - 1) * 25,
  });
  const groups = await tx.subscriptionEntry.groupBy({
    by: ["invoiceId"],
    where: { invoiceId: { in: rows.map((r) => r.id) } },
    _sum: { delta: true },
    _count: true,
  });
  return {
    invoices: rows.map((r) => {
      const g = groups.find((g) => g.invoiceId === r.id),
        paid = g?._sum.delta || 0;
      return {
        ...r,
        billingSnapshot: billingProfileView(r.billingSnapshot),
        paid,
        balance: r.status === "VOID" ? 0 : r.total - paid,
        financialStatus: subscriptionPaymentState(
          r,
          paid,
          g?._count || 0,
          localToday(),
        ),
      };
    }),
    invoicePage: page,
    invoiceTotal: await tx.subscriptionInvoice.count({ where }),
  };
}
export async function subscriptionSummary(tx: Tx, organizationId?: string) {
  const scope = organizationId
    ? Prisma.sql`WHERE i."organizationId" = ${organizationId}`
    : Prisma.sql``;
  const rows = await tx.$queryRaw<
    { billed: bigint; paid: bigint; dueCustomers: bigint; balance: bigint }[]
  >(Prisma.sql`
    SELECT COALESCE(SUM(CASE WHEN i.status = 'ISSUED' THEN i.total ELSE 0 END),0)::bigint AS billed,
      COALESCE(SUM(p.paid),0)::bigint AS paid,
      COALESCE(SUM(CASE WHEN i.status = 'ISSUED' THEN i.total - COALESCE(p.paid,0) ELSE 0 END),0)::bigint AS balance,
      COUNT(DISTINCT CASE WHEN i.status = 'ISSUED' AND i.due < ${localToday()} AND i.total > COALESCE(p.paid,0) THEN i."organizationId" END)::bigint AS "dueCustomers"
    FROM "SubscriptionInvoice" i LEFT JOIN (SELECT "invoiceId", SUM(delta) AS paid FROM "SubscriptionEntry" GROUP BY "invoiceId") p ON p."invoiceId" = i.id ${scope}`);
  return Object.fromEntries(
    Object.entries(rows[0]).map(([k, v]) => [k, Number(v)]),
  );
}
export async function subscriptionWrite(
  tx: Tx,
  actor: { id: string; organizationId: string; role: string },
  organizationId: string,
  body: Record<string, unknown>,
) {
  const org = await tx.organization.findUnique({
    where: { id: organizationId },
  });
  if (!org) throw Error("Pelanggan tidak ditemukan.");
  const action = String(body.action),
    today = localToday();
  const event = (
    kind: string,
    note: string,
    metadata: Prisma.InputJsonObject = {},
    invoiceId?: string,
  ) =>
    subscriptionEvent(
      tx,
      organizationId,
      actor.id,
      kind,
      note,
      metadata,
      invoiceId,
    );
  if (action === "billingProfile") {
    const p = z
      .object({
        legalName: z.string().trim().min(2).max(150),
        address: z.string().trim().min(5).max(1000),
        contactName: z.string().trim().min(2).max(100),
        contactEmail: z.email().max(254),
        taxId: z.string().trim().max(40).default(""),
        clearTaxId: z.boolean().default(false),
        reference: z.string().trim().min(5).max(300),
        revision: z.number().int().min(0),
        confirmed: z.literal(true),
      })
      .parse(body);
    const old = await tx.saaSBillingProfile.findUnique({
      where: { organizationId },
    });
    if ((old?.revision || 0) !== p.revision)
      throw Error("Profil penagihan telah berubah. Muat ulang.");
    const data = {
      legalName: p.legalName,
      address: p.address,
      contactName: p.contactName,
      contactEmail: p.contactEmail,
      reference: p.reference,
      encryptedTaxId: p.clearTaxId
        ? null
        : p.taxId
          ? encryptSecret(p.taxId)
          : old?.encryptedTaxId || null,
      revision: p.revision + 1,
    };
    await tx.saaSBillingProfile.upsert({
      where: { organizationId },
      create: { organizationId, ...data },
      update: data,
    });
    await event(
      "BILLING_PROFILE_UPDATED",
      "Profil penagihan diperbarui; identitas login tidak berubah.",
      { revision: data.revision },
    );
    return { organizationId };
  }
  if (actor.role !== "PLATFORM_ADMIN")
    throw Error("Akses administrator platform diperlukan.");
  if (action === "subscriptionIssue") {
    const p = z
      .object({
        plan: z.enum(["starter", "plus"]),
        months: z.number().int().min(1).max(12),
        periodStart: lifecycleDate,
        due: lifecycleDate,
        confirmed: z.literal(true),
      })
      .parse(body);
    const profile = await tx.saaSBillingProfile.findUnique({
      where: { organizationId },
    });
    if (!profile)
      throw Error("Lengkapi profil penagihan sebelum menerbitkan tagihan.");
    const periodEnd = subscriptionEnd(p.periodStart, p.months),
      plan = plans.find((x) => x.id === p.plan)!;
    if (
      await tx.subscriptionInvoice.count({
        where: {
          organizationId,
          status: "ISSUED",
          periodStart: { lt: periodEnd },
          periodEnd: { gt: p.periodStart },
        },
      })
    )
      throw Error(
        "Periode bertumpang tindih dengan tagihan langganan yang sudah terbit.",
      );
    const invoice = await tx.subscriptionInvoice.create({
      data: {
        organizationId,
        number: "KML-" + randomUUID(),
        plan: p.plan,
        monthlyPrice: plan.price,
        months: p.months,
        total: plan.price * p.months,
        periodStart: p.periodStart,
        periodEnd,
        due: p.due,
        billingSnapshot: JSON.parse(JSON.stringify(profile)),
        createdBy: actor.id,
      },
    });
    await event(
      "INVOICE_ISSUED",
      "Tagihan langganan diterbitkan sesuai harga katalog; belum ada pembayaran atau aktivasi.",
      {
        plan: p.plan,
        total: invoice.total,
        periodStart: p.periodStart,
        periodEnd,
      },
      invoice.id,
    );
    return { organizationId, invoiceId: invoice.id };
  }
  const invoice = await tx.subscriptionInvoice.findFirst({
    where: { id: id.parse(body.invoiceId), organizationId },
  });
  if (!invoice) throw Error("Tagihan langganan tidak ditemukan.");
  if (invoice.status === "VOID") throw Error("Tagihan sudah dibatalkan.");
  const total = await tx.subscriptionEntry.aggregate({
      where: { invoiceId: invoice.id },
      _sum: { delta: true },
    }),
    paid = total._sum.delta || 0;
  if (action === "subscriptionReceipt" || action === "subscriptionRefund") {
    const p = z
      .object({
        amount,
        date: lifecycleDate,
        reference: z.string().trim().min(5).max(200),
        note: z.string().trim().min(5).max(1000),
        confirmed: z.literal(true),
        receiptId: id.optional(),
      })
      .parse(body);
    if (p.date > today)
      throw Error("Tanggal mutasi tidak boleh di masa depan.");
    const refund = action === "subscriptionRefund";
    if (refund) {
      const receipt = await tx.subscriptionEntry.findFirst({
        where: {
          id: p.receiptId || "",
          invoiceId: invoice.id,
          kind: "RECEIPT",
          reversal: null,
        },
        include: { refunds: { include: { reversal: true } } },
      });
      if (!receipt || p.date < receipt.date)
        throw Error("Penerimaan asal tidak valid.");
      const refunded = receipt.refunds
        .filter((e) => !e.reversal)
        .reduce((s, e) => s - e.delta, 0);
      if (p.amount > receipt.delta - refunded)
        throw Error("Pengembalian melebihi penerimaan asal.");
    }
    const delta = refund ? -p.amount : p.amount;
    if (
      await tx.subscriptionEntry.count({
        where: {
          invoiceId: invoice.id,
          kind: refund ? "REFUND" : "RECEIPT",
          reference: { equals: p.reference, mode: "insensitive" },
        },
      })
    )
      throw Error("Referensi mutasi sudah dicatat pada tagihan ini.");
    subscriptionMovement(paid, invoice.total, delta);
    const entry = await tx.subscriptionEntry.create({
      data: {
        invoiceId: invoice.id,
        kind: refund ? "REFUND" : "RECEIPT",
        delta,
        date: p.date,
        reference: p.reference,
        note: p.note,
        actorId: actor.id,
        ...(refund ? { receiptId: p.receiptId } : {}),
      },
    });
    await event(
      refund ? "REFUND_RECORDED" : "RECEIPT_RECORDED",
      refund
        ? "Pengembalian dana dicatat; hak paket tidak diubah otomatis dan perlu ditinjau."
        : "Penerimaan dicatat; aktivasi paket tetap memerlukan peninjauan terpisah.",
      { amount: p.amount, entryId: entry.id },
      invoice.id,
    );
    return { organizationId, invoiceId: invoice.id, entryId: entry.id };
  }
  if (action === "subscriptionCorrect") {
    const p = z
      .object({
        entryId: id,
        note: z.string().trim().min(10).max(1000),
        confirmed: z.literal(true),
      })
      .parse(body);
    const entry = await tx.subscriptionEntry.findFirst({
      where: { id: p.entryId, invoiceId: invoice.id },
      include: { reversal: true, refunds: { include: { reversal: true } } },
    });
    if (
      !entry ||
      entry.kind === "REVERSAL" ||
      entry.reversal ||
      entry.refunds.some((e) => !e.reversal)
    )
      throw Error(
        "Mutasi tidak dapat dikoreksi; periksa pengembalian atau koreksi sebelumnya.",
      );
    subscriptionMovement(paid, invoice.total, -entry.delta);
    const correction = await tx.subscriptionEntry.create({
      data: {
        invoiceId: invoice.id,
        kind: "REVERSAL",
        delta: -entry.delta,
        date: today,
        reference: entry.id,
        note: p.note,
        actorId: actor.id,
        reversesId: entry.id,
      },
    });
    await event(
      "ENTRY_CORRECTED",
      "Koreksi pencatatan ditambahkan; riwayat dan hak paket tidak diubah otomatis.",
      { entryId: entry.id, correctionId: correction.id },
      invoice.id,
    );
    return { organizationId, invoiceId: invoice.id, entryId: correction.id };
  }
  if (action === "subscriptionVoid") {
    const p = z
      .object({
        note: z.string().trim().min(10).max(1000),
        confirmed: z.literal(true),
      })
      .parse(body);
    if (paid !== 0 || invoice.activatedAt)
      throw Error(
        "Tagihan dengan saldo penerimaan atau aktivasi tidak dapat dibatalkan.",
      );
    await tx.subscriptionInvoice.update({
      where: { id: invoice.id },
      data: { status: "VOID", voidReason: p.note },
    });
    await event("INVOICE_VOIDED", p.note, {}, invoice.id);
  } else if (action === "subscriptionActivate") {
    const p = z
      .object({
        confirmed: z.literal(true),
        replaceLegacy: z.boolean().default(false),
        note: z.string().trim().min(10).max(1000),
      })
      .parse(body);
    if (paid !== invoice.total)
      throw Error(
        "Penerimaan bersih harus sama dengan total tagihan sebelum aktivasi.",
      );
    if (invoice.activatedAt)
      throw Error(
        "Tagihan ini sudah diaktifkan. Riwayat aktivasi tidak diulang.",
      );
    if (invoice.periodStart > today || invoice.periodEnd <= today)
      throw Error(
        "Aktivasi hanya dapat dilakukan dalam periode layanan tagihan.",
      );
    const expires = new Date(invoice.periodEnd + "T00:00:00+07:00");
    if (org.plan !== "free" && org.subscriptionStatus === "ACTIVE") {
      if (!org.planExpiresAt && !p.replaceLegacy)
        throw Error(
          "Paket lama belum memiliki batas waktu. Konfirmasikan penggantian masa berlaku secara eksplisit.",
        );
      if (org.planExpiresAt && org.planExpiresAt > expires)
        throw Error(
          "Aktivasi ini akan mempersingkat masa berlaku yang sudah ada.",
        );
    }
    await tx.organization.update({
      where: { id: org.id },
      data: {
        plan: invoice.plan,
        subscriptionStatus: "ACTIVE",
        planExpiresAt: expires,
      },
    });
    await tx.subscriptionInvoice.update({
      where: { id: invoice.id },
      data: { activatedAt: new Date() },
    });
    await tx.upgrade.updateMany({
      where: { organizationId, plan: invoice.plan, status: "REQUESTED" },
      data: { status: "ACTIVATED" },
    });
    await event(
      "PAID_PERIOD_ACTIVATED",
      p.note,
      {
        before: {
          plan: org.plan,
          status: org.subscriptionStatus,
          expiresAt: org.planExpiresAt?.toISOString() || null,
        },
        after: { plan: invoice.plan, expiresAt: expires.toISOString() },
      },
      invoice.id,
    );
  } else throw Error("Tindakan langganan tidak dikenal.");
  return { organizationId, invoiceId: invoice.id };
}
