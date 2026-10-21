import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma";
import { z } from "zod";
import { db } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { lifecycleDate } from "@/lib/lifecycle";
import { localToday } from "@/lib/operations";
import { financeReport, movementQuery } from "@/lib/finance-report";
import { financeCsv, reportComparison } from "@/lib/finance-rules.mjs";
const headers = {
  "Cache-Control": "private, no-store",
  "Referrer-Policy": "no-referrer",
};
const page = (s: string | null) => {
  const n = Number(s || 1);
  if (!Number.isInteger(n) || n < 1 || n > 100000)
    throw Error("Halaman tidak valid.");
  return n;
};
export async function GET(req: NextRequest) {
  const user = await currentUser();
  if (!user)
    return NextResponse.json(
      { error: "Silakan masuk." },
      { status: 401, headers },
    );
  if (user.role !== "OWNER")
    return NextResponse.json(
      { error: "Laporan keuangan hanya untuk pemilik organisasi." },
      { status: 403, headers },
    );
  try {
    const p = req.nextUrl.searchParams,
      propertyId = p.get("propertyId") || "",
      today = localToday(),
      from = lifecycleDate.parse(p.get("from") || today.slice(0, 7) + "-01"),
      to = lifecycleDate.parse(p.get("to") || today);
    if (from < "1900-01-01" || to > today)
      throw Error(
        "Periksa tanggal laporan; tanggal akhir tidak boleh di masa depan.",
      );
    reportComparison(from, to);
    const properties = await db.property.findMany({
      where: {
        organizationId: user.organizationId,
        ...(propertyId !== "all" ? { id: propertyId } : {}),
      },
      select: { id: true, name: true },
    });
    if (propertyId !== "all" && !properties.length)
      return NextResponse.json(
        { error: "Properti tidak ditemukan." },
        { status: 404, headers },
      );
    const ids = properties.map((r) => r.id);
    const result = await db.$transaction(
      async (tx) => {
        const expenseId = p.get("expenseId");
        if (expenseId) {
          const expense = await tx.expense.findFirst({
            where: { id: expenseId, propertyId: { in: ids } },
            include: { property: { select: { name: true } } },
          });
          if (!expense) return null;
          const ep = page(p.get("entryPage"));
          const entries = await tx.expenseEntry.findMany({
            where: { expenseId },
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            take: 30,
            skip: (ep - 1) * 30,
            select: {
              id: true,
              kind: true,
              delta: true,
              date: true,
              reference: true,
              note: true,
              paymentId: true,
              reversesId: true,
              createdAt: true,
              reversal: { select: { id: true } },
              financeMatches: {
                where: { revokedAt: null },
                select: { id: true, statementReference: true },
              },
            },
          });
          const total = await tx.expenseEntry.aggregate({
            where: { expenseId },
            _sum: { delta: true },
          });
          const { createdBy, ...safe } = expense;
          return {
            expense: {
              ...safe,
              paid: total._sum.delta || 0,
              balance:
                expense.status === "VOID"
                  ? 0
                  : expense.amount - (total._sum.delta || 0),
            },
            entries,
            entryPage: ep,
            entryTotal: await tx.expenseEntry.count({ where: { expenseId } }),
          };
        }
        if (p.has("entryId")) {
          const entryId = p.get("entryId") || "",
            source = z
              .enum(["RENT", "EXPENSE", "OPENING"])
              .parse(p.get("source"));
          const entry =
            source === "RENT"
              ? await tx.payment.findFirst({
                  where: {
                    id: entryId,
                    invoice: {
                      propertyId: { in: ids },
                      status: { notIn: ["DRAFT", "VOID"] },
                    },
                  },
                  select: { id: true },
                })
              : source === "OPENING"
                ? await tx.openingReceipt.findFirst({
                    where: {
                      id: entryId,
                      receivable: { propertyId: { in: ids } },
                    },
                    select: { id: true },
                  })
                : await tx.expenseEntry.findFirst({
                    where: {
                      id: entryId,
                      expense: { propertyId: { in: ids } },
                    },
                    select: { id: true },
                  });
          if (!entry) return null;
          const mp = page(p.get("matchPage")),
            where = {
              propertyId: { in: ids },
              ...(source === "RENT"
                ? { paymentId: entryId }
                : source === "OPENING"
                  ? { openingReceiptId: entryId }
                  : { expenseEntryId: entryId }),
            };
          return {
            activeMatch: await tx.financeMatch.findFirst({
              where: { ...where, revokedAt: null },
              select: {
                id: true,
                statementReference: true,
                statementDate: true,
                amount: true,
              },
            }),
            matches: await tx.financeMatch.findMany({
              where,
              orderBy: [{ createdAt: "desc" }, { id: "desc" }],
              take: 30,
              skip: (mp - 1) * 30,
              select: {
                id: true,
                amount: true,
                statementReference: true,
                statementDate: true,
                note: true,
                createdAt: true,
                revokedAt: true,
                revokeReason: true,
              },
            }),
            matchPage: mp,
            matchTotal: await tx.financeMatch.count({ where }),
          };
        }
        const format = p.get("format"),
          view = p.get("view") || "expenses",
          pg = page(p.get("page")),
          q = (p.get("q") || "").trim().slice(0, 100),
          category = p.get("category") || "";
        if (
          !["expenses", "movements", "monthly"].includes(view) ||
          (format && format !== "csv") ||
          (category &&
            !["UTILITY", "MAINTENANCE", "STAFF", "OTHER"].includes(category))
        )
          throw Error("Filter laporan tidak valid.");
        const summary = await financeReport(tx, ids, from, to);
        if (view === "monthly")
          return {
            properties,
            summary,
            view,
            rows: summary.trend,
            total: summary.trend.length,
            page: 1,
          };
        if (view === "movements") {
          const query = movementQuery(ids, from, to);
          const rows = await tx.$queryRaw<any[]>(
            Prisma.sql`SELECT * FROM (${query}) m ORDER BY date DESC,source,id DESC LIMIT ${format ? 5001 : 50} OFFSET ${format ? 0 : (pg - 1) * 50}`,
          );
          const [count] = await tx.$queryRaw<{ total: bigint }[]>(
            Prisma.sql`SELECT COUNT(*)::bigint AS total FROM (${query}) m`,
          );
          return {
            properties,
            summary,
            view,
            rows,
            total: Number(count.total),
            page: pg,
          };
        }
        const where = {
          propertyId: { in: ids },
          incurredOn: { gte: from, lte: to },
          ...(q
            ? {
                OR: [
                  {
                    description: { contains: q, mode: "insensitive" as const },
                  },
                  { payee: { contains: q, mode: "insensitive" as const } },
                  { reference: { contains: q, mode: "insensitive" as const } },
                ],
              }
            : {}),
          ...(category ? { category } : {}),
        };
        const rows = await tx.expense.findMany({
          where,
          orderBy: [{ incurredOn: "desc" }, { id: "desc" }],
          take: format ? 5001 : 50,
          skip: format ? 0 : (pg - 1) * 50,
          select: {
            id: true,
            propertyId: true,
            property: { select: { name: true } },
            description: true,
            category: true,
            amount: true,
            incurredOn: true,
            due: true,
            payee: true,
            reference: true,
            note: true,
            status: true,
          },
        });
        const paid = await tx.expenseEntry.groupBy({
          by: ["expenseId"],
          where: {
            expenseId: { in: rows.map((r) => r.id) },
            date: { lte: to },
          },
          _sum: { delta: true },
        });
        return {
          properties,
          summary,
          view,
          rows: rows.map((r) => {
            const net = paid.find((x) => x.expenseId === r.id)?._sum.delta || 0;
            return {
              ...r,
              paid: net,
              balance: r.status === "VOID" ? 0 : r.amount - net,
            };
          }),
          total: await tx.expense.count({ where }),
          page: pg,
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
        timeout: 20000,
      },
    );
    if (!result)
      return NextResponse.json(
        { error: "Catatan tidak ditemukan." },
        { status: 404, headers },
      );
    if (p.get("format") === "csv") {
      if (
        !("rows" in result) ||
        !Array.isArray(result.rows) ||
        typeof result.total !== "number"
      )
        throw Error("Pilih laporan untuk diekspor.");
      if (result.total > 5000)
        throw Error(
          "Ekspor maksimal 5.000 baris. Persempit periode atau filter; tidak ada data yang dipotong diam-diam.",
        );
      const rows = result.rows as any[];
      const csv =
        result.view === "monthly"
          ? financeCsv([
              [
                "Bulan",
                "Kas sewa diterima",
                "Biaya dibayarkan bersih",
                "Surplus kas",
              ],
              ...rows.map((r) => [r.month, r.income, r.outflow, r.surplus]),
            ])
          : result.view === "movements"
            ? financeCsv([
                [
                  "Tanggal",
                  "Properti",
                  "Sumber",
                  "Jenis",
                  "Keterangan",
                  "Kas masuk (+) / keluar (-)",
                  "Referensi",
                  "Pencocokan manual",
                  "Referensi rekening",
                  "Tanggal rekening",
                ],
                ...rows.map((r) => [
                  r.date,
                  r.propertyName,
                  r.source,
                  r.kind,
                  r.description,
                  r.cashAmount,
                  r.reference,
                  r.reversed
                    ? "Sudah dikoreksi"
                    : r.kind === "REVERSAL"
                      ? "Koreksi non-bank"
                      : r.matchId
                        ? "Dicocokkan manual"
                        : "Belum dicocokkan",
                  r.statementReference,
                  r.statementDate,
                ]),
              ])
            : financeCsv([
                [
                  "Tanggal biaya",
                  "Properti",
                  "Keterangan",
                  "Kategori",
                  "Penerima",
                  "Referensi",
                  "Jumlah biaya",
                  "Dibayar bersih s.d. akhir periode",
                  "Sisa s.d. akhir periode",
                  "Status",
                  "Catatan",
                ],
                ...rows.map((r) => [
                  r.incurredOn,
                  r.property.name,
                  r.description,
                  r.category,
                  r.payee,
                  r.reference,
                  r.amount,
                  r.paid,
                  r.balance,
                  r.status,
                  r.note,
                ]),
              ]);
      return new NextResponse(csv, {
        headers: {
          ...headers,
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="kamelo-${result.view}-${from}-${to}.csv"`,
          "X-Content-Type-Options": "nosniff",
        },
      });
    }
    return NextResponse.json(result, { headers });
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof z.ZodError
            ? "Periksa tanggal laporan Anda."
            : e instanceof Prisma.PrismaClientKnownRequestError ||
                e instanceof Prisma.PrismaClientUnknownRequestError
              ? "Laporan belum dapat dimuat. Coba kembali."
              : e instanceof Error
                ? e.message
                : "Laporan belum tersedia.",
      },
      { status: 400, headers },
    );
  }
}
