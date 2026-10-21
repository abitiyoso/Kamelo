import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { localToday } from "@/lib/operations";
const headers = {
  "Cache-Control": "private, no-store",
  "Referrer-Policy": "no-referrer",
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
      { error: "Akses tidak diizinkan." },
      { status: 403, headers },
    );
  try {
    const p = req.nextUrl.searchParams;
    const property = await db.property.findFirst({
      where: {
        id: p.get("propertyId") || "",
        organizationId: user.organizationId,
      },
      select: { id: true },
    });
    if (!property)
      return NextResponse.json(
        { error: "Properti tidak ditemukan." },
        { status: 404, headers },
      );
    const prospectId = p.get("prospectId");
    if (prospectId) {
      const prospect = await db.prospect.findFirst({
        where: { id: prospectId, propertyId: property.id },
        include: {
          room: { select: { number: true } },
          convertedStay: {
            select: {
              id: true,
              guestId: true,
              status: true,
              room: { select: { number: true } },
            },
          },
        },
      });
      if (!prospect)
        return NextResponse.json(
          { error: "Prospek tidak ditemukan." },
          { status: 404, headers },
        );
      const activityPage = Math.max(
        1,
        Math.min(100000, Number(p.get("activityPage")) || 1),
      );
      if (!Number.isInteger(activityPage)) throw Error();
      const activities = await db.prospectActivity.findMany({
        where: { prospectId },
        orderBy: { revision: "desc" },
        take: 30,
        skip: (activityPage - 1) * 30,
        select: {
          id: true,
          revision: true,
          kind: true,
          note: true,
          metadata: true,
          createdAt: true,
        },
      });
      return NextResponse.json(
        {
          prospect,
          activities,
          activityPage,
          activityTotal: await db.prospectActivity.count({
            where: { prospectId },
          }),
        },
        { headers },
      );
    }
    const page = Math.max(1, Math.min(100000, Number(p.get("page")) || 1)),
      q = (p.get("q") || "").trim().slice(0, 100),
      stage = p.get("stage") || "";
    if (
      !Number.isInteger(page) ||
      (stage &&
        !["NEW", "SURVEY", "OFFER", "LOST", "CONVERTED"].includes(stage))
    )
      throw Error();
    const where = {
      propertyId: property.id,
      ...(stage ? { stage } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" as const } },
              { phone: { contains: q } },
            ],
          }
        : {}),
    };
    const [rows, total, active, surveys, due, available] = await Promise.all([
      db.prospect.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * 50,
        take: 50,
        select: {
          id: true,
          name: true,
          phone: true,
          interest: true,
          source: true,
          stage: true,
          notes: true,
          requestedStart: true,
          requestedEnd: true,
          followUpAt: true,
          room: { select: { number: true } },
        },
      }),
      db.prospect.count({ where }),
      db.prospect.count({
        where: {
          propertyId: property.id,
          stage: { in: ["NEW", "SURVEY", "OFFER"] },
        },
      }),
      db.prospect.count({
        where: {
          propertyId: property.id,
          stage: "SURVEY",
          surveyAt: { gte: new Date() },
        },
      }),
      db.prospect.count({
        where: {
          propertyId: property.id,
          stage: { in: ["NEW", "SURVEY", "OFFER"] },
          followUpAt: { lte: new Date() },
        },
      }),
      db.room.count({
        where: {
          propertyId: property.id,
          operational: "READY",
          stays: {
            none: {
              status: { in: ["ACTIVE", "CHECKED_IN", "CONFIRMED"] },
              start: { lte: localToday() },
              OR: [{ end: null }, { end: { gt: localToday() } }],
            },
          },
        },
      }),
    ]);
    return NextResponse.json(
      { rows, total, page, active, surveys, due, available },
      { headers },
    );
  } catch {
    return NextResponse.json(
      { error: "Data prospek belum dapat dimuat." },
      { status: 400, headers },
    );
  }
}
