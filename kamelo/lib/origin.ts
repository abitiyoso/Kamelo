import type { NextRequest } from "next/server";
export function validOrigin(req: NextRequest) {
  const expected =
    process.env.APP_URL ??
    (process.env.NODE_ENV === "development"
      ? `http://${req.headers.get("host")}`
      : "");
  return (
    Boolean(expected) && req.headers.get("origin") === new URL(expected).origin
  );
}
