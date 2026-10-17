export const MAX_PROOF_SIZE = 5 * 1024 * 1024;
export function proofMime(bytes) {
  const b = Buffer.from(bytes);
  if (
    b.length >= 8 &&
    b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    return "image/png";
  if (b.length >= 3 && b[0] === 255 && b[1] === 216 && b[2] === 255)
    return "image/jpeg";
  if (
    b.length >= 12 &&
    b.toString("ascii", 0, 4) === "RIFF" &&
    b.toString("ascii", 8, 12) === "WEBP"
  )
    return "image/webp";
  if (b.length >= 5 && b.toString("ascii", 0, 5) === "%PDF-")
    return "application/pdf";
  throw new Error(
    "Bukti harus berupa foto JPG, PNG, WebP, atau PDF yang valid.",
  );
}
export function proofAmount(value) {
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n <= 0 || n > 1000000000)
    throw new Error("Nominal bukti pembayaran tidak valid.");
  return n;
}
