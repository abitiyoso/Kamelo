import { Prisma } from "@/generated/prisma";
import { reportComparison } from "./finance-rules.mjs";
type Tx = Prisma.TransactionClient;
const filter = (column: Prisma.Sql, ids: string[]) =>
  ids.length
    ? Prisma.sql`${column} IN (${Prisma.join(ids)})`
    : Prisma.sql`FALSE`;
export function movementQuery(ids: string[], from: string, to: string) {
  const rent = filter(Prisma.sql`i."propertyId"`, ids),
    opening = filter(Prisma.sql`r."propertyId"`, ids),
    cost = filter(Prisma.sql`e."propertyId"`, ids);
  return Prisma.sql`
 SELECT p.id, 'RENT' AS source, 'RENT_RECEIPT' AS kind, i."propertyId", pr.name AS "propertyName", p.date, p.amount AS "cashAmount", i.number AS description, p.reference, false AS reversed,
   m.id AS "matchId", m."statementReference", m."statementDate"
 FROM "Payment" p JOIN "Invoice" i ON i.id=p."invoiceId" JOIN "Property" pr ON pr.id=i."propertyId"
 LEFT JOIN "FinanceMatch" m ON m."paymentId"=p.id AND m."revokedAt" IS NULL
 WHERE ${rent} AND i.status NOT IN ('DRAFT','VOID') AND p.date BETWEEN ${from} AND ${to}
 UNION ALL
 SELECT ee.id, 'EXPENSE' AS source, ee.kind, e."propertyId", pr.name AS "propertyName", ee.date, -ee.delta AS "cashAmount", e.description, ee.reference,
   EXISTS(SELECT 1 FROM "ExpenseEntry" rev WHERE rev."reversesId"=ee.id) AS reversed,
   m.id AS "matchId", m."statementReference", m."statementDate"
 FROM "ExpenseEntry" ee JOIN "Expense" e ON e.id=ee."expenseId" JOIN "Property" pr ON pr.id=e."propertyId"
 LEFT JOIN "FinanceMatch" m ON m."expenseEntryId"=ee.id AND m."revokedAt" IS NULL
 WHERE ${cost} AND ee.date BETWEEN ${from} AND ${to}
 UNION ALL
 SELECT e.id,'OPENING' AS source,CASE WHEN e.kind='RECEIPT' THEN 'OPENING_RECEIPT' WHEN e.kind='REFUND' THEN 'OPENING_REFUND' ELSE 'REVERSAL' END AS kind,r."propertyId",pr.name AS "propertyName",e.date,e.delta AS "cashAmount",r.reference AS description,e.reference,
 EXISTS(SELECT 1 FROM "OpeningReceipt" rev WHERE rev."reversesId"=e.id) AS reversed,m.id AS "matchId",m."statementReference",m."statementDate"
 FROM "OpeningReceipt" e JOIN "OpeningReceivable" r ON r.id=e."receivableId" JOIN "Property" pr ON pr.id=r."propertyId"
 LEFT JOIN "FinanceMatch" m ON m."openingReceiptId"=e.id AND m."revokedAt" IS NULL
 WHERE ${opening} AND e.date BETWEEN ${from} AND ${to}`;
}
export async function financeCashDaily(
  tx: Tx,
  ids: string[],
  from: string,
  to: string,
) {
  const rent = filter(Prisma.sql`i."propertyId"`, ids),
    opening = filter(Prisma.sql`r."propertyId"`, ids),
    cost = filter(Prisma.sql`e."propertyId"`, ids);
  const [rentDaily, costDaily] = await Promise.all([
    tx.$queryRaw<
      { date: string; amount: bigint }[]
    >(Prisma.sql`SELECT date,SUM(amount)::bigint AS amount FROM (
      SELECT p.date,p.amount FROM "Payment" p JOIN "Invoice" i ON i.id=p."invoiceId" WHERE ${rent} AND i.status NOT IN ('DRAFT','VOID') AND p.date BETWEEN ${from} AND ${to}
      UNION ALL SELECT e.date,e.delta AS amount FROM "OpeningReceipt" e JOIN "OpeningReceivable" r ON r.id=e."receivableId" WHERE ${opening} AND e.date BETWEEN ${from} AND ${to}) cash GROUP BY date`),
    tx.$queryRaw<{ date: string; amount: bigint }[]>(
      Prisma.sql`SELECT ee.date,SUM(ee.delta)::bigint AS amount FROM "ExpenseEntry" ee JOIN "Expense" e ON e.id=ee."expenseId" WHERE ${cost} AND ee.date BETWEEN ${from} AND ${to} GROUP BY ee.date`,
    ),
  ]);
  return { rentDaily, costDaily };
}
export async function financeReport(
  tx: Tx,
  ids: string[],
  from: string,
  to: string,
) {
  const comparison = reportComparison(from, to),
    cost = filter(Prisma.sql`e."propertyId"`, ids),
    deposit = filter(Prisma.sql`r."propertyId"`, ids);
  const [{ rentDaily, costDaily }, depositRows, unpaidRows] = await Promise.all(
    [
      financeCashDaily(tx, ids, comparison.from, to),
      tx.$queryRaw<
        { liability: bigint; cash: bigint; deductions: bigint }[]
      >(Prisma.sql`SELECT COALESCE(SUM(d.delta),0)::bigint AS liability,
   COALESCE(SUM(CASE WHEN d.date BETWEEN ${from} AND ${to} AND COALESCE(origin.kind,d.kind) IN ('RECEIPT','REFUND') THEN d.delta ELSE 0 END),0)::bigint AS cash,
   -COALESCE(SUM(CASE WHEN d.date BETWEEN ${from} AND ${to} AND COALESCE(origin.kind,d.kind)='DEDUCTION' THEN d.delta ELSE 0 END),0)::bigint AS deductions
   FROM "DepositEntry" d JOIN "DepositAccount" da ON da.id=d."accountId" JOIN "Stay" s ON s.id=da."stayId" JOIN "Room" r ON r.id=s."roomId" LEFT JOIN "DepositEntry" origin ON origin.id=d."reversesId" WHERE ${deposit} AND d.date<=${to}`),
      tx.$queryRaw<
        { booked: bigint; unpaid: bigint }[]
      >(Prisma.sql`SELECT COALESCE(SUM(CASE WHEN e."incurredOn">=${from} THEN e.amount ELSE 0 END),0)::bigint AS booked,
   COALESCE(SUM(e.amount-COALESCE(p.paid,0)),0)::bigint AS unpaid FROM "Expense" e LEFT JOIN (SELECT "expenseId",SUM(delta) AS paid FROM "ExpenseEntry" WHERE date<=${to} GROUP BY "expenseId") p ON p."expenseId"=e.id WHERE ${cost} AND e.status='OPEN' AND e."incurredOn"<=${to}`),
    ],
  );
  const sum = (
    rows: { date: string; amount: bigint }[],
    start: string,
    end: string,
  ) =>
    rows
      .filter((r) => r.date >= start && r.date <= end)
      .reduce((s, r) => s + Number(r.amount), 0);
  const rentReceived = sum(rentDaily, from, to),
    expenseCashOut = sum(costDaily, from, to),
    surplus = rentReceived - expenseCashOut,
    previousSurplus =
      sum(rentDaily, comparison.from, comparison.to) -
      sum(costDaily, comparison.from, comparison.to);
  const trend = [];
  const cursor = new Date(from + "T00:00:00Z");
  cursor.setUTCDate(1);
  while (cursor.toISOString().slice(0, 10) <= to) {
    const month = cursor.toISOString().slice(0, 7),
      income = rentDaily
        .filter(
          (r) => r.date.startsWith(month) && r.date >= from && r.date <= to,
        )
        .reduce((s, r) => s + Number(r.amount), 0),
      outflow = costDaily
        .filter(
          (r) => r.date.startsWith(month) && r.date >= from && r.date <= to,
        )
        .reduce((s, r) => s + Number(r.amount), 0);
    trend.push({ month, income, outflow, surplus: income - outflow });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  const d = depositRows[0],
    unpaid = unpaidRows[0],
    movements = movementQuery(ids, from, to);
  const [counts] = await tx.$queryRaw<{ unmatched: bigint; matched: bigint }[]>(
    Prisma.sql`SELECT COUNT(*) FILTER(WHERE "matchId" IS NULL)::bigint AS unmatched,COUNT(*) FILTER(WHERE "matchId" IS NOT NULL)::bigint AS matched FROM (${movements}) m WHERE kind<>'REVERSAL' AND NOT reversed`,
  );
  const chartResolution = comparison.days <= 62 ? "DAILY" : "MONTHLY";
  const chart =
    chartResolution === "DAILY"
      ? Array.from({ length: comparison.days }, (_, i) => {
          const bucket = new Date(
            Date.parse(from + "T00:00:00Z") + i * 86400000,
          )
            .toISOString()
            .slice(0, 10);
          const income = sum(rentDaily, bucket, bucket),
            outflow = sum(costDaily, bucket, bucket);
          return { bucket, income, outflow, surplus: income - outflow };
        })
      : trend.map((r) => ({ ...r, bucket: r.month }));
  return {
    from,
    to,
    rentReceived,
    expenseCashOut,
    surplus,
    previousSurplus,
    change: surplus - previousSurplus,
    comparison,
    trend,
    chart,
    chartResolution,
    depositLiability: Number(d.liability),
    depositCashMovement: Number(d.cash),
    depositDeductions: Number(d.deductions),
    recordedCashMovement: surplus + Number(d.cash),
    bookedExpenses: Number(unpaid.booked),
    unpaidExpenses: Number(unpaid.unpaid),
    unmatched: Number(counts.unmatched),
    matched: Number(counts.matched),
  };
}
