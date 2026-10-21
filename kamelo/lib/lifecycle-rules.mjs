import { createHash } from "node:crypto";
export function stableHash(value) {
  const normalize = (x) =>
    Array.isArray(x)
      ? x.map(normalize)
      : x && typeof x === "object"
        ? Object.fromEntries(
            Object.keys(x)
              .sort()
              .map((k) => [k, normalize(x[k])]),
          )
        : x;
  return createHash("sha256")
    .update(JSON.stringify(normalize(value)))
    .digest("hex");
}
export function depositMovement(balance, pending, delta) {
  if (
    ![balance, pending, delta].every(Number.isSafeInteger) ||
    balance < 0 ||
    pending < 0 ||
    pending > balance ||
    delta === 0 ||
    balance + delta < pending ||
    balance + delta > 1000000000
  )
    throw Error(
      "Mutasi melebihi deposit yang tersedia atau nominal tidak valid.",
    );
  return balance + delta;
}
export function depositState(balance, pending, required, entries) {
  if (pending > 0) return "DEDUCTION_PENDING";
  if (balance > 0) return balance < required ? "PARTIALLY_HELD" : "HELD";
  if (!entries) return required > 0 ? "DUE" : "NOT_REQUIRED";
  return "SETTLED";
}
