export async function accountCall(
  action: string,
  body: Record<string, unknown> = {},
) {
  return identityCall("/api/account", { action, ...body });
}
export async function identityCall(
  url: string,
  body?: Record<string, unknown>,
) {
  const r = await fetch(url, {
    ...(body
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : {}),
    cache: "no-store",
  });
  const b = await r.json();
  if (!r.ok) throw Error(b.error || "Layanan belum tersedia.");
  return b;
}
