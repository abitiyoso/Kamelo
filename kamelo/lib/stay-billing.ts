import type { Prisma } from "@/generated/prisma";
// Transfer carries an already-issued recurring period, not a second rental charge.
// An unrelated later stay is deliberately not matched by phone, person, or calendar month.
export async function transferredPeriodInvoice(
  tx: Prisma.TransactionClient,
  stayId: string,
  period: string,
) {
  let current = stayId;
  for (let n = 0; n < 100; n++) {
    const transfer = await tx.roomTransfer.findUnique({
      where: { toStayId: current },
      select: { fromStayId: true },
    });
    if (!transfer) return null;
    const prior = await tx.invoice.findUnique({
      where: { stayId_period: { stayId: transfer.fromStayId, period } },
    });
    if (prior && !["DRAFT", "VOID"].includes(prior.status)) return prior;
    current = transfer.fromStayId;
  }
  throw Error(
    "Riwayat perpindahan perlu ditinjau sebelum menagih periode ini.",
  );
}
