import { Prisma } from "@/generated/prisma";
import { z } from "zod";
import { lifecycleDate, lifecycleAudit } from "./lifecycle";
import { localToday } from "./operations";
import { expenseMovement } from "./finance-rules.mjs";
type Tx = Prisma.TransactionClient;
const id = z.string().min(1).max(100),
  amount = z.number().int().min(1).max(1000000000),
  note = z.string().trim().min(10).max(1000);
export async function financeWrite(
  tx: Tx,
  user: { id: string; organizationId: string },
  property: { id: string },
  body: Record<string, unknown>,
) {
  const action = String(body.action),
    today = localToday();
  const audit = (
    kind: string,
    target: string,
    metadata: Prisma.InputJsonObject = {},
  ) =>
    lifecycleAudit(
      tx,
      user.organizationId,
      user.id,
      "FINANCE_" + kind,
      target,
      metadata,
    );
  if (action === "financeExpenseCreate") {
    const p = z
      .object({
        description: z.string().trim().min(3).max(200),
        category: z.enum(["UTILITY", "MAINTENANCE", "STAFF", "OTHER"]),
        amount,
        incurredOn: lifecycleDate,
        due: lifecycleDate.nullable().default(null),
        payee: z.string().trim().min(2).max(150),
        reference: z.string().trim().max(200).default(""),
        note: z.string().trim().max(1000).default(""),
        confirmed: z.literal(true),
      })
      .parse(body);
    if (
      p.incurredOn < "1900-01-01" ||
      p.incurredOn > today ||
      (p.due && p.due < p.incurredOn)
    )
      throw Error("Periksa tanggal biaya dan jatuh tempo.");
    if (
      p.reference &&
      (await tx.expense.count({
        where: {
          propertyId: property.id,
          status: "OPEN",
          payee: { equals: p.payee, mode: "insensitive" },
          reference: { equals: p.reference, mode: "insensitive" },
        },
      }))
    )
      throw Error("Referensi biaya dari penerima ini sudah dicatat.");
    const { confirmed, ...data } = p;
    const expense = await tx.expense.create({
      data: { ...data, propertyId: property.id, createdBy: user.id },
    });
    await audit("EXPENSE_RECORDED", expense.id, { amount: p.amount });
    return { expenseId: expense.id };
  }
  if (action === "financeUnmatch") {
    const p = z
      .object({ matchId: id, note, confirmed: z.literal(true) })
      .parse(body);
    const row = await tx.financeMatch.findFirst({
      where: { id: p.matchId, propertyId: property.id, revokedAt: null },
    });
    if (!row) throw Error("Pencocokan aktif tidak ditemukan.");
    await tx.financeMatch.update({
      where: { id: row.id },
      data: { revokedAt: new Date(), revokedBy: user.id, revokeReason: p.note },
    });
    await audit("MATCH_REVOKED", row.id);
    return { matchId: row.id };
  }
  if (action === "financeMatch") {
    const p = z
      .object({
        source: z.enum(["RENT", "EXPENSE", "OPENING"]),
        entryId: id,
        amount,
        direction: z.enum(["IN", "OUT"]),
        statementDate: lifecycleDate,
        statementReference: z.string().trim().min(5).max(200),
        note,
        confirmed: z.literal(true),
      })
      .parse(body);
    if (p.statementDate > today)
      throw Error("Tanggal mutasi rekening tidak boleh di masa depan.");
    let expected = 0,
      direction = "IN";
    if (p.source === "RENT") {
      const row = await tx.payment.findFirst({
        where: {
          id: p.entryId,
          invoice: {
            propertyId: property.id,
            status: { notIn: ["DRAFT", "VOID"] },
          },
        },
      });
      if (!row) throw Error("Pembayaran sewa tidak ditemukan.");
      expected = row.amount;
    } else if (p.source === "OPENING") {
      const row = await tx.openingReceipt.findFirst({
        where: {
          id: p.entryId,
          receivable: { propertyId: property.id },
          kind: { in: ["RECEIPT", "REFUND"] },
          reversal: null,
        },
      });
      if (!row)
        throw Error(
          "Penerimaan saldo awal tidak ditemukan atau telah dikoreksi.",
        );
      expected = Math.abs(row.delta);
      direction = row.delta > 0 ? "IN" : "OUT";
    } else {
      const row = await tx.expenseEntry.findFirst({
        where: {
          id: p.entryId,
          expense: { propertyId: property.id },
          kind: { in: ["PAYMENT", "REFUND"] },
          reversal: null,
        },
      });
      if (!row)
        throw Error("Mutasi biaya tidak ditemukan atau telah dikoreksi.");
      expected = Math.abs(row.delta);
      direction = row.delta > 0 ? "OUT" : "IN";
    }
    if (p.amount !== expected || p.direction !== direction)
      throw Error("Nominal atau arah mutasi tidak sesuai dengan catatan.");
    const source =
      p.source === "RENT"
        ? { paymentId: p.entryId }
        : p.source === "OPENING"
          ? { openingReceiptId: p.entryId }
          : { expenseEntryId: p.entryId };
    if (
      await tx.financeMatch.count({
        where: {
          propertyId: property.id,
          revokedAt: null,
          OR: [
            source,
            {
              statementReference: {
                equals: p.statementReference,
                mode: "insensitive",
              },
              statementDate: p.statementDate,
            },
          ],
        },
      })
    )
      throw Error("Catatan atau referensi mutasi rekening sudah dicocokkan.");
    const row = await tx.financeMatch.create({
      data: {
        ...source,
        propertyId: property.id,
        amount: p.amount,
        statementReference: p.statementReference,
        statementDate: p.statementDate,
        note: p.note,
        actorId: user.id,
      },
    });
    await audit("MANUAL_MATCH_RECORDED", row.id, { source: p.source });
    return { matchId: row.id };
  }
  const expense = await tx.expense.findFirst({
    where: { id: id.parse(body.expenseId), propertyId: property.id },
  });
  if (!expense) throw Error("Biaya tidak ditemukan.");
  if (expense.status === "VOID") throw Error("Biaya sudah dibatalkan.");
  const totals = await tx.expenseEntry.aggregate({
      where: { expenseId: expense.id },
      _sum: { delta: true },
    }),
    paid = totals._sum.delta || 0;
  if (action === "financeExpensePay" || action === "financeExpenseRefund") {
    const p = z
      .object({
        amount,
        date: lifecycleDate,
        reference: z.string().trim().min(5).max(200),
        note,
        confirmed: z.literal(true),
        paymentId: id.optional(),
      })
      .parse(body);
    if (p.date > today || p.date < expense.incurredOn)
      throw Error("Tanggal mutasi harus antara tanggal biaya dan hari ini.");
    const refund = action === "financeExpenseRefund";
    if (refund) {
      const payment = await tx.expenseEntry.findFirst({
        where: {
          id: p.paymentId || "",
          expenseId: expense.id,
          kind: "PAYMENT",
          reversal: null,
        },
        include: { refunds: { include: { reversal: true } } },
      });
      if (
        !payment ||
        p.date < payment.date ||
        p.amount >
          payment.delta -
            payment.refunds
              .filter((r) => !r.reversal)
              .reduce((s, r) => s - r.delta, 0)
      )
        throw Error(
          "Pengembalian melebihi pembayaran asal atau tanggalnya tidak sesuai.",
        );
    }
    const kind = refund ? "REFUND" : "PAYMENT",
      delta = refund ? -p.amount : p.amount;
    expenseMovement(paid, expense.amount, delta);
    if (
      await tx.expenseEntry.count({
        where: {
          expenseId: expense.id,
          kind,
          reference: { equals: p.reference, mode: "insensitive" },
        },
      })
    )
      throw Error("Referensi mutasi biaya sudah dicatat.");
    const entry = await tx.expenseEntry.create({
      data: {
        expenseId: expense.id,
        kind,
        delta,
        date: p.date,
        reference: p.reference,
        note: p.note,
        actorId: user.id,
        ...(refund ? { paymentId: p.paymentId } : {}),
      },
    });
    await audit(
      refund ? "EXPENSE_REFUND_RECORDED" : "EXPENSE_PAYMENT_RECORDED",
      expense.id,
      { entryId: entry.id, amount: p.amount },
    );
    return { expenseId: expense.id, entryId: entry.id };
  }
  if (action === "financeExpenseCorrect") {
    const p = z
      .object({ entryId: id, note, confirmed: z.literal(true) })
      .parse(body);
    const row = await tx.expenseEntry.findFirst({
      where: { id: p.entryId, expenseId: expense.id },
      include: {
        reversal: true,
        refunds: { include: { reversal: true } },
        financeMatches: { where: { revokedAt: null }, select: { id: true } },
      },
    });
    if (
      !row ||
      row.kind === "REVERSAL" ||
      row.reversal ||
      row.refunds.some((r) => !r.reversal)
    )
      throw Error(
        "Mutasi tidak dapat dikoreksi. Periksa pengembalian atau koreksi sebelumnya.",
      );
    if (row.financeMatches.length)
      throw Error(
        "Batalkan pencocokan mutasi rekening sebelum mengoreksi catatan.",
      );
    expenseMovement(paid, expense.amount, -row.delta);
    const correction = await tx.expenseEntry.create({
      data: {
        expenseId: expense.id,
        kind: "REVERSAL",
        delta: -row.delta,
        date: row.date,
        reference: row.id,
        note: p.note,
        actorId: user.id,
        reversesId: row.id,
      },
    });
    await audit("EXPENSE_ENTRY_CORRECTED", expense.id, {
      entryId: row.id,
      correctionId: correction.id,
    });
    return { expenseId: expense.id, entryId: correction.id };
  }
  if (action === "financeExpenseVoid") {
    const p = z.object({ note, confirmed: z.literal(true) }).parse(body);
    if (paid !== 0)
      throw Error(
        "Biaya dengan saldo pembayaran bersih tidak dapat dibatalkan.",
      );
    await tx.expense.update({
      where: { id: expense.id },
      data: { status: "VOID", voidReason: p.note, voidedAt: new Date() },
    });
    await audit("EXPENSE_VOIDED", expense.id);
    return { expenseId: expense.id };
  }
  throw Error("Tindakan keuangan tidak dikenal.");
}
