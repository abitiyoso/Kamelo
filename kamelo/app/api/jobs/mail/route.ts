import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { drainEmailOutbox } from "@/lib/email/outbox";
export async function POST(req: NextRequest) {
  const expected = process.env.OPERATIONS_JOB_KEY || "",
    received = req.headers.get("authorization")?.replace(/^Bearer /, "") || "";
  if (
    expected.length < 64 ||
    Buffer.byteLength(expected) !== Buffer.byteLength(received) ||
    !timingSafeEqual(Buffer.from(expected), Buffer.from(received))
  )
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return NextResponse.json(await drainEmailOutbox(10), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json(
      { error: "Email worker unavailable." },
      { status: 503 },
    );
  }
}
