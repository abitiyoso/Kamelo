import { plans, rupiah } from "@/lib/plans";
import { Check, ArrowUpRight, ChevronDown } from "lucide-react";
import { smartConsultUrl } from "@/lib/commercial";
import { PlanFinder } from "./home-acquisition";
export function Pricing({ finder = false }: { finder?: boolean }) {
  return (
    <section className="section container" id="harga">
      <div className="section-heading">
        <span className="eyebrow">HARGA YANG MASUK AKAL</span>
        <h2>
          {finder ? "Mulai gratis." : "Mulai dari Kebutuhan Dasar."}
          <br />
          {finder
            ? "Tumbuh sesuai kebutuhan."
            : "Tambah Fitur Saat Dibutuhkan."}
        </h2>
        <p>
          Tidak perlu langsung memasang perangkat pintar. Mulai dari pengelolaan
          kamar dan pembayaran, lalu bahas Smart Room, CCTV, atau AI sesuai
          kebutuhan properti.
        </p>
      </div>
      <div className="pricing-grid">
        {plans.map((p) => (
          <article
            className={"price-card " + (p.id === "starter" ? "featured" : "")}
            key={p.id}
          >
            {p.id === "starter" && (
              <span className="recommended">UNTUK KOS YANG BERKEMBANG</span>
            )}
            <h3>{p.name}</h3>
            <p>
              {p.id === "free"
                ? "Langkah pertama yang lebih mudah."
                : p.id === "starter"
                  ? "Lebih rapi, lebih banyak kamar."
                  : "Beberapa lokasi, satu kendali."}
            </p>
            <div className="price">
              {rupiah(p.price)}
              <small>/bulan</small>
            </div>
            <a
              className={"button " + (p.id === "starter" ? "" : "secondary")}
              href={"/register?plan=" + p.id}
            >
              {p.id === "free" ? "Mulai Gratis" : "Daftar & Ajukan " + p.name}
              <ArrowUpRight size={17} />
            </a>
            <ul>
              {[
                `${p.rooms} kamar total`,
                `${p.properties} properti · ${p.users} akun pengguna`,
                "Kamar, penghuni & tagihan",
                "Catat pembayaran & dashboard",
                p.recurring
                  ? "Tagihan bulanan berulang"
                  : "Pengingat WhatsApp manual",
              ].map((v) => (
                <li key={v}>
                  <Check size={15} />
                  {v}
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
      {finder && <PlanFinder />}
      {finder ? (
        <details className="home-smart-pricing">
          <summary>
            <div>
              <span className="eyebrow">KAMELO ULTIMATE · SMART PROPERTY</span>
              <h3>Ingin kunci digital, kontrol AC, atau CCTV?</h3>
              <p>Lihat kesiapan layanan dan komponen biayanya.</p>
            </div>
            <ChevronDown size={22} />
          </summary>
          <div className="home-smart-pricing-body">
            <p>
              Paket Ultimate belum tersedia untuk aktivasi. Perangkat,
              kompatibilitas, cakupan layanan dan harga perlu dibahas sesuai
              kondisi properti.
            </p>
            <dl>
              <div>
                <dt>Software Core</dt>
                <dd>Langganan bulanan sesuai paket di atas.</dd>
              </div>
              <div>
                <dt>Perangkat & instalasi</dt>
                <dd>Biaya awal terpisah, sesuai hasil asesmen.</dd>
              </div>
              <div>
                <dt>Layanan Smart, CCTV & AI</dt>
                <dd>
                  Belum aktif. Biaya berulang, batas pemakaian dan kanal kamera
                  perlu ditetapkan; tidak termasuk paket Core.
                </dd>
              </div>
            </dl>
            <a className="text-link" href={smartConsultUrl}>
              Diskusi Smart Property <ArrowUpRight size={16} />
            </a>
          </div>
        </details>
      ) : (
        <aside className="smart-commercial">
          <div>
            <span className="eyebrow">KAMELO ULTIMATE — SMART PROPERTY</span>
            <h3>Operasional lebih terpantau, tumbuh bertahap.</h3>
            <p>
              Untuk pemilik yang ingin check-in lebih praktis dan pekerjaan
              harian dibantu AI. Paket Ultimate belum tersedia untuk aktivasi;
              cakupan dan harga menunggu validasi.
            </p>
            <a className="text-link" href={smartConsultUrl}>
              Diskusi Smart Property <ArrowUpRight size={16} />
            </a>
          </div>
          <dl>
            <div>
              <dt>Software Core</dt>
              <dd>Langganan bulanan sesuai paket di atas.</dd>
            </div>
            <div>
              <dt>Perangkat & instalasi</dt>
              <dd>Biaya awal terpisah, sesuai hasil asesmen.</dd>
            </div>
            <div>
              <dt>Layanan Smart, CCTV & AI</dt>
              <dd>
                Segera hadir. Biaya berulang, batas pemakaian serta kanal kamera
                perlu ditetapkan; tidak termasuk paket Core.
              </dd>
            </div>
          </dl>
        </aside>
      )}
      <p className="fine-print">
        Harga awal untuk validasi pasar, dapat berubah. Paket berbayar
        diaktifkan melalui permintaan upgrade kepada admin. Tanpa pembayaran
        otomatis.
      </p>
    </section>
  );
}
