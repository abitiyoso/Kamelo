import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma";
import { z } from "zod";
import { db } from "@/lib/db";
import { currentUser, sessionIdentity, rateLimit } from "@/lib/auth";
import { validOrigin } from "@/lib/origin";
import { importActor } from "@/lib/room-import";
import { inspectWorkbook, workbookToCsv } from "@/lib/import-workbook.mjs";
const headers = {
  "Cache-Control": "private, no-store",
  "Referrer-Policy": "no-referrer",
};
export const runtime = "nodejs";
export async function POST(req: NextRequest) {
  if (!validOrigin(req))
    return NextResponse.json(
      { error: "Permintaan tidak diizinkan." },
      { status: 403, headers },
    );
  await currentUser();
  const s = await sessionIdentity();
  if (!s)
    return NextResponse.json(
      { error: "Silakan masuk." },
      { status: 401, headers },
    );
  try {
    await db.$transaction((tx) => importActor(tx, s.token));
    await rateLimit("import-file:" + s.userId, 45);
    if (!req.body) throw Error("File tidak tersedia.");
    const reader = req.body.getReader(),
      parts: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const r = await reader.read();
      if (r.done) break;
      size += r.value.length;
      if (size > 1100000) {
        await reader.cancel();
        throw Error("Unggahan XLSX maksimal 1 MB.");
      }
      parts.push(r.value);
    }
    const bytes = Buffer.concat(parts),
      form = await new Response(bytes, {
        headers: { "Content-Type": req.headers.get("content-type") || "" },
      }).formData();
    const action = z
        .enum(["inspect", "headers", "convert"])
        .parse(form.get("action")),
      kind = z.enum(["rooms", "residents", "balances"]).parse(form.get("kind")),
      file = form.get("file");
    if (
      !(file instanceof File) ||
      !file.name.toLowerCase().endsWith(".xlsx") ||
      file.size > 1000000
    )
      throw Error("Pilih file .xlsx maksimal 1 MB.");
    const workbook = await inspectWorkbook(
      new Uint8Array(await file.arrayBuffer()),
    );
    // Parsing is read-only; recheck a session that may have expired/revoked while reading.
    await db.$transaction((tx) => importActor(tx, s.token));
    if (action === "inspect")
      return NextResponse.json(
        { sheets: workbook.map((w) => w.sheet) },
        { headers },
      );
    const sheet = z.string().min(1).max(200).parse(form.get("sheet"));
    const mapping =
      action === "convert"
        ? z
            .record(z.string(), z.number().int())
            .parse(JSON.parse(String(form.get("mapping") || "")))
        : undefined;
    return NextResponse.json(workbookToCsv(workbook, kind, sheet, mapping), {
      headers,
    });
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof z.ZodError || e instanceof SyntaxError
            ? "Periksa file, lembar, dan pemetaan kolom Anda."
            : e instanceof Prisma.PrismaClientKnownRequestError ||
                e instanceof Prisma.PrismaClientUnknownRequestError
              ? "Akses file belum tersedia. Muat ulang workspace."
              : e instanceof Error
                ? e.message
                : "XLSX belum dapat dibaca.",
      },
      { status: 400, headers },
    );
  }
}
