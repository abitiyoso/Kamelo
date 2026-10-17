import { db } from "./db";
import { roomStatus } from "./domain.mjs";

export type MetricDirection = "up" | "down" | "flat";

export function incomeComparison(current: number, previous: number) {
  const change = current - previous;
  return {
    incomeChange: change,
    // A percentage cannot be calculated against a zero base.
    incomeChangePercent:
      previous > 0
        ? Math.round((change / previous) * 1000) / 10
        : current === 0
          ? 0
          : null,
    incomeDirection: (change > 0
      ? "up"
      : change < 0
        ? "down"
        : "flat") as MetricDirection,
  };
}

export async function propertyMetrics(
  propertyId: string,
  today: string,
  roomId?: string,
  invoiceIds?: string[],
) {
  const issued = { propertyId, status: { notIn: ["VOID", "DRAFT"] } };
  const [year, currentMonth, day] = today.split("-").map(Number);
  const currentStart = today.slice(0, 7) + "-01";
  const previousStart = new Date(Date.UTC(year, currentMonth - 2, 1))
    .toISOString()
    .slice(0, 10);
  const previousLastDay = new Date(
    Date.UTC(year, currentMonth - 1, 0),
  ).getUTCDate();
  const comparisonEnd = new Date(
    Date.UTC(year, currentMonth - 2, Math.min(day, previousLastDay)),
  )
    .toISOString()
    .slice(0, 10);
  const cohort = { ...issued, date: { gte: currentStart, lte: today } };
  const months = Array.from({ length: 6 }, (_, index) =>
    new Date(Date.UTC(year, currentMonth - 6 + index, 1))
      .toISOString()
      .slice(0, 7),
  );
  const [
    invoices,
    paid,
    month,
    count,
    monthlyPayments,
    previousMonth,
    overdue,
    cohortTotal,
    cohortPaid,
    rooms,
  ] = await Promise.all([
    db.invoice.aggregate({ where: issued, _sum: { total: true } }),
    db.payment.aggregate({
      where: { invoice: issued },
      _sum: { amount: true },
    }),
    db.payment.aggregate({
      where: { invoice: issued, date: { gte: currentStart, lte: today } },
      _sum: { amount: true },
    }),
    db.invoice.count({
      where: {
        propertyId,
        ...(roomId ? { roomId } : {}),
        ...(invoiceIds ? { id: { in: invoiceIds } } : {}),
      },
    }),
    Promise.all(
      months.map((month) =>
        db.payment.aggregate({
          where: { invoice: issued, date: { startsWith: month, lte: today } },
          _sum: { amount: true },
        }),
      ),
    ),
    db.payment.aggregate({
      where: {
        invoice: issued,
        date: { gte: previousStart, lte: comparisonEnd },
      },
      _sum: { amount: true },
    }),
    // This query has no pagination: old unpaid invoices remain in the insight.
    db.invoice.findMany({
      where: { ...issued, due: { lt: today } },
      select: { total: true, payments: { select: { amount: true } } },
    }),
    db.invoice.aggregate({ where: cohort, _sum: { total: true } }),
    db.payment.aggregate({
      where: { invoice: cohort, date: { lte: today } },
      _sum: { amount: true },
    }),
    db.room.findMany({
      where: { propertyId },
      select: {
        operational: true,
        stays: { select: { status: true, start: true, end: true } },
      },
    }),
  ]);
  const trend = months.map((month, index) => ({
    month,
    amount: monthlyPayments[index]._sum.amount ?? 0,
  }));
  const income = month._sum.amount ?? 0;
  const previousMonthIncome = previousMonth._sum.amount ?? 0;
  const comparison = incomeComparison(income, previousMonthIncome);
  const overdueBalances = overdue.map((invoice) =>
    Math.max(
      0,
      invoice.total -
        invoice.payments.reduce((sum, payment) => sum + payment.amount, 0),
    ),
  );
  const overdueBalance = overdueBalances.reduce((sum, value) => sum + value, 0);
  const overdueCount = overdueBalances.filter((value) => value > 0).length;
  const occupiedCount = rooms.filter(
    (room) => roomStatus(room, room.stays, today) === "OCCUPIED",
  ).length;
  const occupancyPercent = rooms.length
    ? Math.round((occupiedCount / rooms.length) * 100)
    : 0;
  const collectionTotal = cohortTotal._sum.total ?? 0;
  const collectionPaid = cohortPaid._sum.amount ?? 0;
  const collectionRate =
    collectionTotal > 0
      ? Math.round((collectionPaid / collectionTotal) * 1000) / 10
      : null;
  const formatMoney = (value: number) =>
    new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(value);
  const incomeText =
    comparison.incomeChangePercent === null
      ? "Pemasukan mulai tercatat bulan ini; periode pembanding bulan lalu belum memiliki pembayaran."
      : comparison.incomeDirection === "flat"
        ? "Pemasukan sama dengan periode pembanding bulan lalu."
        : `Pemasukan ${comparison.incomeDirection === "up" ? "naik" : "turun"} ${formatMoney(Math.abs(comparison.incomeChange))} dibanding periode pembanding bulan lalu.`;
  return {
    total: invoices._sum.total ?? 0,
    paid: paid._sum.amount ?? 0,
    income,
    outstanding: (invoices._sum.total ?? 0) - (paid._sum.amount ?? 0),
    invoiceCount: count,
    trend,
    previousMonthIncome,
    ...comparison,
    currentStart,
    currentEnd: today,
    comparisonStart: previousStart,
    comparisonEnd,
    roomCount: rooms.length,
    occupiedCount,
    occupancyPercent,
    overdueBalance,
    overdueCount,
    collectionTotal,
    collectionPaid,
    collectionRate,
    insights: [
      { kind: "income", text: incomeText },
      {
        kind: "occupancy",
        text: rooms.length
          ? `${occupiedCount} dari ${rooms.length} kamar terisi hari ini (${occupancyPercent}%).`
          : "Belum ada kamar yang tercatat.",
      },
      {
        kind: "overdue",
        text: overdueCount
          ? `${overdueCount} tagihan melewati jatuh tempo dengan sisa saldo ${formatMoney(overdueBalance)}.`
          : "Tidak ada tagihan bersaldo yang melewati jatuh tempo.",
      },
      {
        kind: "collection",
        text:
          collectionRate === null
            ? "Belum ada tagihan terbit bulan ini untuk menghitung tingkat pelunasan."
            : `${collectionRate.toLocaleString("id-ID")}% nilai tagihan terbit bulan ini telah dibayar hingga hari ini.`,
      },
    ],
  };
}
