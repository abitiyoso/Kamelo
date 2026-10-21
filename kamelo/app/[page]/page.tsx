import { Header, Footer } from "@/components/brand";
import { IdentityScreen } from "@/components/identity/screens";
import { AccountSettings } from "@/components/identity/account-settings";
import { IdentityFrame } from "@/components/identity/frame";
import { sessionIdentity } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { notFound } from "next/navigation";
import { plans } from "@/lib/plans";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ page: string }>;
  searchParams: Promise<{ plan?: string }>;
}) {
  const { page } = await params;
  const query = await searchParams;
  const selectedPlan = plans.find((p) => p.id === query.plan)?.id;
  if (["verify-email", "invite", "workspaces", "account"].includes(page)) {
    if (["workspaces", "account"].includes(page)) {
      const s = await sessionIdentity();
      if (!s) redirect("/login");
      if (s.user.accountStatus === "PENDING" && page === "workspaces")
        redirect("/verify-email");
    }
    return page === "account" ? (
      <IdentityFrame>
        <AccountSettings />
      </IdentityFrame>
    ) : (
      <IdentityScreen mode={page} />
    );
  }
  if (
    [
      "login",
      "register",
      "invite-register",
      "forgot-password",
      "reset-password",
    ].includes(page)
  )
    return <AuthForm mode={page} selectedPlan={selectedPlan} />;
  if (!["privacy", "terms"].includes(page)) notFound();
  return (
    <>
      <Header />
      <main className="container legal">
        <span className="eyebrow">KAMELO BY ELENIO</span>
        <h1>{page === "privacy" ? "Kebijakan Privasi" : "Syarat Layanan"}</h1>
        <p className="notice">
          Draf untuk pengembangan. Dokumen final perlu ditinjau sebelum
          peluncuran komersial.
        </p>
        {(page === "privacy"
          ? [
              [
                "Data yang disimpan",
                "Kami menyimpan informasi akun, properti, kontak penghuni, reservasi, tagihan, dan pembayaran yang Anda masukkan untuk menyediakan layanan pengelolaan properti.",
              ],
              [
                "Akses dan penggunaan",
                "Pemilik bertanggung jawab atas dasar pengumpulan data penghuni. Akses staf dibatasi sesuai properti yang ditugaskan. Jangan masukkan dokumen identitas atau data sensitif yang tidak diperlukan.",
              ],
              [
                "Retensi dan permintaan",
                "Catatan keuangan tidak dihapus saat paket berubah. Hubungi ELENIO untuk permintaan akses, koreksi, penghapusan, dan kebijakan retensi.",
              ],
              ["Kontak", "WhatsApp 081933328899 · elenio.id"],
            ]
          : [
              [
                "Penggunaan layanan",
                "Kamelo by ELENIO membantu pencatatan operasional. Pengguna bertanggung jawab atas keakuratan data dan kewenangan mereka untuk mengelola properti.",
              ],
              [
                "Paket dan pembayaran",
                "Akun baru menggunakan paket Gratis. Harga awal merupakan hipotesis bisnis. Upgrade diproses oleh admin; pencatatan pembayaran tamu tidak memproses dana.",
              ],
              [
                "Integrasi opsional",
                "Smart IoT bersifat opsional. Simulasi tidak mengendalikan perangkat nyata. Integrasi live memerlukan verifikasi perangkat, izin, dan konfigurasi.",
              ],
              [
                "Ketersediaan",
                "Versi pengembangan belum ditujukan untuk data produksi. Hubungi ELENIO untuk dukungan dan ketentuan final.",
              ],
            ]
        ).map(([t, d]) => (
          <section key={t}>
            <h2>{t}</h2>
            <p>{d}</p>
          </section>
        ))}
      </main>
      <Footer />
    </>
  );
}
