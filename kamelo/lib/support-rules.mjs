export const supportStatuses = [
  "OPEN",
  "IN_PROGRESS",
  "WAITING_CUSTOMER",
  "RESOLVED",
  "CLOSED",
];
export function supportNext(role, action, current, desired) {
  if (!supportStatuses.includes(current))
    throw Error("Status bantuan tidak valid.");
  if (action === "reply") {
    if (["RESOLVED", "CLOSED"].includes(current))
      throw Error("Buka kembali tiket sebelum membalas.");
    return role === "OWNER" && current === "WAITING_CUSTOMER"
      ? "IN_PROGRESS"
      : current;
  }
  if (action === "claim") {
    if (role !== "PLATFORM_ADMIN" || ["RESOLVED", "CLOSED"].includes(current))
      throw Error("Tiket ini tidak dapat diambil.");
    return current === "OPEN" ? "IN_PROGRESS" : current;
  }
  if (action === "reopen") {
    if (!["RESOLVED", "CLOSED"].includes(current))
      throw Error("Tiket masih terbuka.");
    return "OPEN";
  }
  if (action === "status") {
    const allowed =
      role === "OWNER"
        ? current === "RESOLVED" && desired === "CLOSED"
        : !["CLOSED", "RESOLVED"].includes(current) &&
          ["IN_PROGRESS", "WAITING_CUSTOMER", "RESOLVED"].includes(desired) &&
          desired !== current;
    if (!allowed) throw Error("Perubahan status tidak diizinkan.");
    return desired;
  }
  throw Error("Tindakan bantuan tidak dikenal.");
}
