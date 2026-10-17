import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { currentUser, rateLimit } from "@/lib/auth";
import { db } from "@/lib/db";
import { validOrigin } from "@/lib/origin";
import { propertyMetrics } from "@/lib/metrics";
import { localToday } from "@/lib/operations";
import { rupiah } from "@/lib/plans";
export async function POST(req: NextRequest) {
  try {
    if (!validOrigin(req))
      return NextResponse.json(
        { error: "Permintaan tidak diizinkan." },
        { status: 403 },
      );
    const user = await currentUser();
    if (!user)
      return NextResponse.json({ error: "Silakan masuk." }, { status: 401 });
    await rateLimit("leo:" + user.id, 60);
    const { propertyId, topic } = z
      .object({
        propertyId: z.string(),
        topic: z.enum(["briefing", "income", "overdue", "rooms", "tasks"]),
      })
      .parse(await req.json());
    const property = await db.property.findFirst({
      where: {
        id: propertyId,
        organizationId: user.organizationId,
        ...(user.role === "STAFF"
          ? { id: { equals: propertyId, in: user.propertyIds } }
          : {}),
      },
    });
    if (!property)
      return NextResponse.json(
        { error: "Properti tidak ditemukan." },
        { status: 403 },
      );
    const metrics = await propertyMetrics(property.id, localToday());
    const open = await db.ticket.count({
      where: { propertyId: property.id, status: { not: "RESOLVED" } },
    });
    const urgent = await db.ticket.count({
      where: {
        propertyId: property.id,
        status: { not: "RESOLVED" },
        priority: "URGENT",
      },
    });
    const result = {
      income: {
        summary: metrics.insights[0].text,
        items: [
          `Pemasukan bulan ini ${rupiah(metrics.income)}`,
          `Pembanding ${metrics.comparisonStart} s.d. ${metrics.comparisonEnd}: ${rupiah(metrics.previousMonthIncome)}`,
        ],
        next: "Periksa pembayaran dan saldo tagihan.",
        module: "billing",
      },
      overdue: {
        summary: metrics.insights[2].text,
        items: [
          `Saldo lewat tempo ${rupiah(metrics.overdueBalance)}`,
          `${metrics.overdueCount} tagihan perlu ditindaklanjuti`,
        ],
        next: "Buka tagihan lewat tempo dan siapkan pengingat manual.",
        module: "billing",
      },
      rooms: {
        summary: metrics.insights[1].text,
        items: [
          `${metrics.roomCount - metrics.occupiedCount} kamar tidak sedang terisi`,
          "Kamar yang kosong belum tentu siap dijual; periksa status kebersihan dan perawatan.",
        ],
        next: "Periksa kesiapan kamar dan reservasi.",
        module: "rooms",
      },
      tasks: {
        summary: `${open} pekerjaan belum selesai; ${urgent} di antaranya mendesak.`,
        items: [
          "Gunakan penanggung jawab dan catatan progres agar pekerjaan dapat dilacak.",
        ],
        next: "Buka pekerjaan & komplain untuk tindak lanjut.",
        module: "tasks",
      },
      briefing: {
        summary: `${property.name}: ${metrics.occupiedCount}/${metrics.roomCount} kamar terisi, ${metrics.overdueCount} tagihan lewat tempo, ${open} pekerjaan terbuka.`,
        items: [
          metrics.insights[0].text,
          `${urgent} pekerjaan mendesak perlu diperiksa.`,
        ],
        next: metrics.overdueCount
          ? "Prioritaskan pengingat tagihan yang lewat tempo."
          : "Periksa pekerjaan dan kesiapan kamar hari ini.",
        module: metrics.overdueCount ? "billing" : "rooms",
      },
    }[topic];
    return NextResponse.json(
      { mode: "RULE_BASED", ...result },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof z.ZodError
            ? "Pilih pertanyaan yang tersedia."
            : "Ringkasan belum dapat dimuat. Coba lagi.",
      },
      { status: 400 },
    );
  }
}
