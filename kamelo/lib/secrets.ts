import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

function encryptionKey(): Buffer {
  const configured = process.env.DATA_ENCRYPTION_KEY;
  if (configured) {
    if (!/^[a-f\d]{64}$/i.test(configured))
      throw new Error(
        "DATA_ENCRYPTION_KEY harus berisi 64 karakter hex (32 byte).",
      );
    return Buffer.from(configured, "hex");
  }

  let local = false;
  try {
    const url = new URL(process.env.APP_URL ?? "");
    local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  } catch {
    // An absent or invalid public URL must not enable a local key in hosting.
  }
  if (!local)
    throw new Error(
      "DATA_ENCRYPTION_KEY wajib dikonfigurasi sebelum akses digital digunakan di hosting. Gunakan kunci acak 32 byte dalam format hex.",
    );

  const directory = path.join(process.cwd(), ".local-secrets");
  const filename = path.join(directory, "data-key");
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  try {
    writeFileSync(filename, randomBytes(32).toString("hex"), {
      encoding: "utf8",
      flag: "wx",
      mode: 0o600,
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
  }
  const saved = readFileSync(filename, "utf8").trim();
  if (!/^[a-f\d]{64}$/i.test(saved))
    throw new Error(
      "Kunci enkripsi lokal tidak valid. Pulihkan .local-secrets/data-key dari cadangan.",
    );
  return Buffer.from(saved, "hex");
}

/** AES-256-GCM, with a fresh nonce and authenticated ciphertext on every write. */
export function encryptSecret(value: string): string {
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), nonce);
  cipher.setAAD(Buffer.from("kamelo:smart-access:v1"));
  const ciphertext = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  return [
    "v1",
    nonce.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

export function decryptSecret(encoded: string): string {
  const [version, nonceText, tagText, ciphertextText, extra] =
    encoded.split(".");
  if (
    version !== "v1" ||
    !nonceText ||
    !tagText ||
    !ciphertextText ||
    extra !== undefined
  )
    throw new Error("Format data akses terenkripsi tidak valid.");
  const nonce = Buffer.from(nonceText, "base64url");
  const tag = Buffer.from(tagText, "base64url");
  if (nonce.length !== 12 || tag.length !== 16)
    throw new Error("Format data akses terenkripsi tidak valid.");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), nonce);
  decipher.setAAD(Buffer.from("kamelo:smart-access:v1"));
  decipher.setAuthTag(tag);
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextText, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
