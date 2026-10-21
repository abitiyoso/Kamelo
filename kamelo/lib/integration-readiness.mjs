import { emailConfig, smtpOptions } from "./email/transport.mjs";
export function integrationReadiness(env = process.env) {
  let mail = {
    key: "email",
    name: "Email transaksional",
    state: "DISABLED",
    description: "Pengiriman belum diaktifkan.",
  };
  try {
    const c = emailConfig(env);
    if (c.driver === "sink")
      mail = {
        ...mail,
        state: "LOCAL_ONLY",
        description: "Penampung QA lokal; tidak mengirim email nyata.",
      };
    else if (["smtp", "legacy"].includes(c.driver)) {
      if (c.driver === "smtp") smtpOptions(env);
      else {
        const endpoint = new URL(env.MAIL_ENDPOINT || "");
        if (
          !env.MAIL_API_KEY ||
          (endpoint.protocol !== "https:" &&
            !["localhost", "127.0.0.1"].includes(endpoint.hostname))
        )
          throw Error("Invalid mail adapter");
      }
      mail = {
        ...mail,
        state: c.live && c.allowlist.length ? "UNVERIFIED" : "BLOCKED",
        description:
          c.live && c.allowlist.length
            ? "Konfigurasi dan gate tersedia; koneksi, DNS serta penerimaan inbox belum diverifikasi."
            : "Konfigurasi tersedia; gate pengiriman atau daftar penerima uji belum diaktifkan.",
      };
    } else if (c.driver !== "disabled") throw Error("Unsupported driver");
  } catch {
    mail = {
      ...mail,
      state: "NEEDS_SETUP",
      description:
        "Konfigurasi email belum valid. Periksa konfigurasi server secara privat.",
    };
  }
  return [
    mail,
    {
      key: "payment",
      name: "Payment gateway",
      state: "NOT_CONNECTED",
      description:
        "Pencatatan pembayaran manual tersedia; webhook dan gateway belum terhubung.",
    },
    {
      key: "whatsapp",
      name: "WhatsApp Business",
      state: "NOT_CONNECTED",
      description:
        "Tautan dan salin pesan tersedia; pengiriman otomatis dan webhook belum terhubung.",
    },
    {
      key: "cctv",
      name: "CCTV / VMS",
      state: "NOT_CONNECTED",
      description:
        "Sumber kamera dan analytics belum terhubung. Tidak ada feed pelanggan pada panel ini.",
    },
    {
      key: "iot",
      name: "IoT Gateway / Smart Room",
      state: "SIMULATION_ONLY",
      description:
        "Adaptor MOCK tersedia untuk pengujian; Tuya dan perangkat fisik belum terhubung.",
    },
    {
      key: "ai",
      name: "LEO / AI",
      state: "RULE_BASED",
      description:
        "Ringkasan berbasis aturan tersedia; model AI generatif belum terhubung.",
    },
  ];
}
