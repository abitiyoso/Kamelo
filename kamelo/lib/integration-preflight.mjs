import { integrationReadiness } from "./integration-readiness.mjs";
import { workerConfiguration, workerOrigin } from "./worker-client.mjs";
export function integrationPreflight(env = process.env) {
  let worker = "NEEDS_SETUP",
    origin = "INVALID";
  try {
    workerConfiguration(env);
    worker = "CONFIGURED_UNVERIFIED";
  } catch {}
  try {
    origin =
      new URL(workerOrigin(env.APP_URL)).protocol === "https:"
        ? "HTTPS"
        : "LOCAL_HTTP";
  } catch {}
  let database = "NEEDS_SETUP";
  try {
    const u = new URL(env.DATABASE_URL || "");
    if (
      ["postgres:", "postgresql:"].includes(u.protocol) &&
      u.hostname &&
      u.pathname.length > 1
    )
      database = "CONFIGURED_UNVERIFIED";
  } catch {}
  const encryption = /^[a-fA-F0-9]{64}$/.test(env.DATA_ENCRYPTION_KEY || "")
    ? "CONFIGURED_UNVERIFIED"
    : "NEEDS_SETUP";
  const requirements = {
    email: [
      "Mailbox Hostinger dan alamat pengirim yang disetujui",
      "SPF/DKIM/DMARC serta pengujian inbox/bounce",
      "Penerima uji dan izin pengiriman eksplisit",
    ],
    payment: ["Rencana gateway/webhook terpisah yang disetujui"],
    whatsapp: [
      "Penyedia resmi, nomor pengirim, template dan persetujuan penerima",
      "Adapter/webhook terverifikasi dan uji penerimaan",
    ],
    cctv: [
      "VMS/kamera dan akun dengan izin yang sesuai",
      "Adapter stream/events, pembatasan properti dan kebijakan retensi",
      "Uji kamera nyata dan penanganan gangguan koneksi",
    ],
    iot: [
      "Project/region Tuya serta inventaris dan capability perangkat",
      "Implementasi adapter live dan konfirmasi status perangkat",
      "Uji fisik check-in, pindah kamar, checkout dan pencabutan akses",
    ],
    ai: [
      "Penyedia/model dan persetujuan kebijakan data serta batas biaya",
      "Implementasi adapter model dengan timeout dan audit",
      "Evaluasi jawaban dan izin tindakan; LEO saat ini tetap berbasis aturan",
    ],
  };
  return {
    version: 1,
    mode: "OFFLINE_CONFIGURATION_REVIEW",
    liveAcceptance: "PENDING_EXTERNAL_SETUP",
    networkRequests: 0,
    application: {
      origin,
      worker,
      database,
      encryption,
      privateProofStorage: env.PROOF_STORAGE_DIR
        ? "EXPLICIT_PATH_UNVERIFIED"
        : "DEFAULT_PRIVATE_PATH_UNVERIFIED",
    },
    services: integrationReadiness(env).map((r) => ({
      ...r,
      liveVerified: false,
      requirements: requirements[r.key],
    })),
    releaseDependencies: [
      "Supervisi ketiga worker dan volume privat persisten",
      "Backup/restore UTF-8 dan kunci enkripsi yang sama",
      "Persetujuan kebijakan retensi dan UAT keamanan/izin",
      "Validasi layanan nyata sebelum mengganti label simulasi",
    ],
  };
}
