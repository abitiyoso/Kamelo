import Link from "next/link";
import { ArrowUpRight, Check, Info } from "lucide-react";
import { plans, rupiah } from "@/lib/plans";
import { PlanFinder } from "./home-acquisition";

export function LandingPricing() {
  return (
    <section
      className="journal-section journal-pricing"
      id="harga"
      aria-labelledby="pricing-title"
    >
      <div className="container">
        <div className="journal-heading-split">
          <div>
            <span className="eyebrow">PILIH PAKET YANG SESUAI</span>
            <h2 id="pricing-title">Mulai gratis, upgrade sesuai kebutuhan.</h2>
          </div>
          <p>
            Akun mulai di Gratis; paket berbayar menunggu aktivasi admin.
            Perangkat dan instalasi Smart Property terpisah dari paket ini.
          </p>
        </div>
        <div className="journal-pricing-grid">
          {plans.map((plan) => (
            <article
              className={
                "journal-plan " + (plan.id === "starter" ? "is-featured" : "")
              }
              key={plan.id}
            >
              {plan.id === "starter" && (
                <span className="journal-plan-featured">
                  UNTUK KOS YANG BERKEMBANG
                </span>
              )}
              <h3>{plan.name}</h3>
              <p>
                {plan.id === "free"
                  ? "Untuk memulai."
                  : plan.id === "starter"
                    ? "Untuk properti yang berkembang."
                    : "Untuk beberapa properti."}
              </p>
              <div className="journal-price">
                {rupiah(plan.price)}
                <small>/bulan</small>
              </div>
              <ul>
                {[
                  `${plan.rooms} kamar total`,
                  `${plan.properties} properti`,
                  `${plan.users} akun owner / staf`,
                  plan.recurring
                    ? "Tagihan bulanan berulang"
                    : "Tagihan & pengingat manual",
                ].map((text) => (
                  <li key={text}>
                    <Check size={16} />
                    {text}
                  </li>
                ))}
              </ul>
              <Link
                className={
                  "button " + (plan.id === "starter" ? "" : "secondary")
                }
                href={"/register?plan=" + plan.id}
              >
                {plan.id === "free" ? "Mulai Gratis" : "Ajukan " + plan.name}
                <ArrowUpRight size={16} />
              </Link>
            </article>
          ))}
          <PlanFinder compact />
        </div>
        <p className="journal-pricing-note">
          <Info size={18} />
          <span>
            Harga awal dapat berubah; aktivasi berbayar melalui admin, tanpa
            pembayaran otomatis. Ultimate belum tersedia.
          </span>
        </p>
      </div>
    </section>
  );
}
