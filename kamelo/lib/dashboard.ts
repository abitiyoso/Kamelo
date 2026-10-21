import { Prisma } from "@/generated/prisma";
import { financeCashDaily } from "./finance-report";
import { incomeComparison } from "./metrics";
import { dashboardPeriods } from "./dashboard-periods.mjs";
type Tx = Prisma.TransactionClient;
export async function dashboardRead(
  tx: Tx,
  organizationId: string,
  propertyId: string,
  today: string,
  page: number,
) {
  const properties = await tx.property.findMany({
    where: {
      organizationId,
      ...(propertyId === "all" ? {} : { id: propertyId }),
    },
    select: { id: true, name: true },
  });
  if (propertyId !== "all" && !properties.length)
    throw Error("Properti tidak ditemukan.");
  const ids = properties.map((p) => p.id),
    scope = (col: Prisma.Sql) =>
      ids.length
        ? Prisma.sql`${col} IN (${Prisma.join(ids)})`
        : Prisma.sql`FALSE`;
  const { start, comparisonStart, comparisonEnd, months } =
    dashboardPeriods(today);
  const balances = Prisma.sql`
 SELECT 'INVOICE'::text AS source,i.id,i.number AS reference,i."propertyId",p.name AS "propertyName",g.name AS "guestName",i.due,GREATEST(0,i.total-COALESCE(pay.paid,0))::bigint AS remaining
 FROM "Invoice" i JOIN "Property" p ON p.id=i."propertyId" JOIN "Guest" g ON g.id=i."guestId"
 LEFT JOIN (SELECT "invoiceId",SUM(amount) AS paid FROM "Payment" WHERE date<=${today} GROUP BY "invoiceId") pay ON pay."invoiceId"=i.id
 WHERE ${scope(Prisma.sql`i."propertyId"`)} AND i.status NOT IN ('DRAFT','VOID') AND i.date<=${today}
 UNION ALL
 SELECT 'OPENING'::text AS source,r.id,r.reference,r."propertyId",p.name AS "propertyName",g.name AS "guestName",r.due,GREATEST(0,r.amount-COALESCE(pay.paid,0))::bigint AS remaining
 FROM "OpeningReceivable" r JOIN "OpeningBalanceBatch" b ON b.id=r."batchId" JOIN "Property" p ON p.id=r."propertyId" JOIN "Guest" g ON g.id=r."guestId"
 LEFT JOIN (SELECT "receivableId",SUM(delta) AS paid FROM "OpeningReceipt" WHERE date<=${today} GROUP BY "receivableId") pay ON pay."receivableId"=r.id
 WHERE ${scope(Prisma.sql`r."propertyId"`)} AND r.status='OPEN' AND b.status='OPEN' AND b."asOf"<=${today}`;
  const [{ rentDaily, costDaily }, totals, proofs, rows, overdueTotal] =
    await Promise.all([
      financeCashDaily(tx, ids, months[0] + "-01", today),
      tx.$queryRaw<any[]>(
        Prisma.sql`WITH b AS (${balances}) SELECT source,COALESCE(SUM(remaining),0)::bigint AS outstanding,COUNT(*) FILTER(WHERE remaining>0)::int AS count,COALESCE(SUM(remaining) FILTER(WHERE due<${today}),0)::bigint AS overdue,COUNT(*) FILTER(WHERE remaining>0 AND due<${today})::int AS "overdueCount" FROM b GROUP BY source`,
      ),
      tx.$queryRaw<{ source: string; count: number }[]>(
        Prisma.sql`SELECT 'INVOICE'::text AS source,COUNT(*)::int AS count FROM "PaymentProof" b JOIN "Invoice" i ON i.id=b."invoiceId" WHERE ${scope(Prisma.sql`i."propertyId"`)} AND b.status='PENDING' UNION ALL SELECT 'OPENING'::text AS source,COUNT(*)::int AS count FROM "OpeningProof" b JOIN "OpeningReceivable" r ON r.id=b."receivableId" WHERE ${scope(Prisma.sql`r."propertyId"`)} AND b.status='PENDING'`,
      ),
      tx.$queryRaw<any[]>(
        Prisma.sql`WITH b AS (${balances}) SELECT * FROM b WHERE remaining>0 AND due<${today} ORDER BY due ASC,source ASC,id ASC LIMIT 10 OFFSET ${(page - 1) * 10}`,
      ),
      tx.$queryRaw<{ count: number }[]>(
        Prisma.sql`WITH b AS (${balances}) SELECT COUNT(*)::int AS count FROM b WHERE remaining>0 AND due<${today}`,
      ),
    ]);
  const sum = (
    daily: { date: string; amount: bigint }[],
    from: string,
    to: string,
  ) =>
    daily
      .filter((r) => r.date >= from && r.date <= to)
      .reduce((s, r) => s + Number(r.amount), 0);
  const income = sum(rentDaily, start, today),
    expense = sum(costDaily, start, today),
    previousIncome = sum(rentDaily, comparisonStart, comparisonEnd),
    previousExpense = sum(costDaily, comparisonStart, comparisonEnd),
    surplus = income - expense,
    previousSurplus = previousIncome - previousExpense;
  const sources = ["INVOICE", "OPENING"].map((source) => {
    const r = totals.find((r) => r.source === source);
    return {
      source,
      outstanding: Number(r?.outstanding || 0),
      count: r?.count || 0,
      overdue: Number(r?.overdue || 0),
      overdueCount: r?.overdueCount || 0,
      pendingProofs: proofs.find((p) => p.source === source)?.count || 0,
    };
  });
  const trend = months.map((month) => {
    const from = month + "-01",
      last = new Date(
        Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0),
      )
        .toISOString()
        .slice(0, 10),
      income = sum(rentDaily, from, last),
      outflow = sum(costDaily, from, last);
    return { bucket: month, month, income, outflow, surplus: income - outflow };
  });
  const result = {
    asOf: today,
    currentStart: start,
    currentEnd: today,
    comparisonStart,
    comparisonEnd,
    income,
    expense,
    surplus,
    previousIncome,
    previousSurplus,
    surplusChange: surplus - previousSurplus,
    ...incomeComparison(income, previousIncome),
    outstanding: sources.reduce((s, r) => s + r.outstanding, 0),
    overdueBalance: sources.reduce((s, r) => s + r.overdue, 0),
    overdueCount: sources.reduce((s, r) => s + r.overdueCount, 0),
    proofCount: sources.reduce((s, r) => s + r.pendingProofs, 0),
    sources,
    trend,
    overdue: {
      rows: rows.map((r) => ({ ...r, remaining: Number(r.remaining) })),
      total: overdueTotal[0].count,
      page,
    },
  };
  const check = (v: unknown): void => {
    if (typeof v === "number" && !Number.isFinite(v))
      throw Error("Nilai ringkasan tidak valid.");
    if (v && typeof v === "object") Object.values(v).forEach(check);
  };
  // Monetary values must retain integer rupiah precision; percentages may be fractional.
  for (const amount of [
    income,
    expense,
    surplus,
    previousIncome,
    previousSurplus,
    result.outstanding,
    result.overdueBalance,
    ...sources.flatMap((s) => [s.outstanding, s.overdue]),
    ...trend.flatMap((t) => [t.income, t.outflow, t.surplus]),
  ])
    if (!Number.isSafeInteger(amount))
      throw Error("Ringkasan nominal melewati batas angka aman.");
  check(result);
  return result;
}
