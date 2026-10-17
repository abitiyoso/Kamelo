import Link from "next/link";
import Image from "next/image";
import {
  ArrowUpRight,
  Check,
  CheckCircle2,
  ChevronDown,
  KeyRound,
  Zap,
  Camera,
  Sparkles,
  MessageCircle,
  Play,
  UserRound,
  House,
  ReceiptText,
} from "lucide-react";
import { Header, Footer } from "@/components/brand";
import { ReminderDemo } from "@/components/reminder-demo";
import { LandingTasks } from "@/components/landing-tasks";
import { LandingPricing } from "@/components/landing-pricing";
import { smartConsultUrl, coreConsultUrl } from "@/lib/commercial";
import "./homepage.css";

export const metadata = {
  title:
    "Kamelo by ELENIO — Punya properti, tak harus mengurus semuanya sendiri.",
  description:
    "Kelola kos, guest house dan hotel kecil dari satu tempat. Tagihan, bukti bayar, tugas staf dan layanan penghuni. Mulai gratis hingga 5 kamar, tanpa kartu kredit.",
};

const primaryQuestions = [
  [
    "Apakah jatuh tempo setiap penghuni bisa berbeda?",
    "Bisa. Atur tanggal tagihan per penghuni kos. Tagihan berulang pada paket berbayar mengikuti tanggal tersebut; bulan pendek memakai tanggal terakhir. Owner perlu mengaktifkan otomasi dan layanan penjadwalan harus berjalan. Tagihan yang sudah terbit tidak berubah saat tanggal penghuni diperbarui.",
  ],
  [
    "Bagaimana proses bukti bayar dari penghuni?",
    "Pengelola membagikan tautan tagihan pribadi. Penghuni melihat rincian dan mengunggah bukti bayar, lalu pengelola memeriksa dana yang diterima sebelum menyetujui. Pengingat disiapkan aplikasi dan dikirim sendiri melalui WhatsApp. Kamelo mencatat pembayaran; aplikasi tidak memindahkan dana atau memproses transfer.",
  ],
  [
    "Apakah saya perlu perangkat pintar untuk menggunakan Kamelo?",
    "Tidak. Kamar, tagihan, pembayaran dan pekerjaan staf dapat dikelola cukup melalui browser. Kunci digital dan kontrol kamar saat ini berupa simulasi. Tuya/perangkat nyata, CCTV/Video Analytics, AI generatif dan WhatsApp otomatis belum terhubung. Perangkat, instalasi dan layanan tambahan dibahas terpisah.",
  ],
  [
    "Bagaimana cara mulai dan mengaktifkan paket?",
    "Daftar menggunakan nama, email, nomor WhatsApp dan kata sandi. Siapkan nama/lokasi properti, jenis kos atau hotel, jumlah kamar dan tarif. Akun baru dimulai di Gratis: 5 kamar total, 1 properti, 1 pengguna. Pilihan Starter/Plus dicatat sebagai permintaan upgrade; batas bertambah setelah admin mengaktifkan. Tidak ada pembayaran atau perpanjangan otomatis.",
  ],
];
const moreQuestions = [
  [
    "Apa yang bisa dicoba sebelum mendaftar?",
    "Demo pengingat dapat dicoba sampai menyalin pesan. Dashboard dan portal penghuni menggunakan data simulasi. Dashboard demo hanya-baca; unggahan bukti pada demo tetap lokal dan tidak menjadi pembayaran. Semua tombol demo di halaman ini menuju alur yang sudah tersedia.",
  ],
  [
    "Apakah penghuni perlu akun atau aplikasi tambahan?",
    "Tidak. Tautan tagihan pribadi dibuka lewat browser untuk melihat rincian dan mengunggah bukti. Tautan layanan masa tinggal dibagikan terpisah untuk Wi-Fi, panduan kamar, komplain dan progresnya. Tautan layanan berlaku selama masa tinggal aktif dan memiliki kedaluwarsa.",
  ],
  [
    "Bisakah saya membatasi akses staf?",
    "Bisa. Owner memilih properti yang dapat diakses staf, menugaskan tiket dan meninjau progres. Izin mencatat pembayaran serta mengendalikan perangkat diberikan secara terpisah. Akun staf mengikuti batas pengguna paket aktif.",
  ],
  [
    "Bagaimana jika data sudah ada di Excel atau kamar lebih dari 50?",
    "Masukkan data kamar dan penghuni secara bertahap. Impor massal Excel dan paket di atas 50 kamar belum tersedia untuk aktivasi mandiri. Hubungi ELENIO untuk membahas kesiapan migrasi dan kebutuhan lebih besar; pemindahan data otomatis belum tersedia.",
  ],
  [
    "Apakah layanan sudah siap untuk operasional produksi?",
    "Versi ini merupakan preview pengembangan lokal. Hosting publik, pencadangan, layanan email pemulihan serta ketentuan komersial final perlu disiapkan dan diuji sebelum penggunaan produksi. Konfirmasikan kesiapan layanan bersama ELENIO sebelum memasukkan data operasional nyata.",
  ],
];
function Question({ question, answer }: { question: string; answer: string }) {
  return (
    <details className="journal-question">
      <summary>
        {question}
        <ChevronDown size={18} />
      </summary>
      <p>{answer}</p>
    </details>
  );
}
function Photo({
  name,
  alt,
  className = "",
}: {
  name: string;
  alt: string;
  className?: string;
}) {
  return (
    <figure className={"journal-photo " + className}>
      <Image
        src={"/images/homepage/" + name + ".webp"}
        alt={alt}
        fill
        sizes="(max-width: 700px) 100vw, 46vw"
      />
      <figcaption>Foto ilustrasi AI</figcaption>
    </figure>
  );
}
export default function Home() {
  return (
    <>
      <Header home />
      <main className="hospitality-home journal-home" id="konten-utama">
        <section className="journal-hero" aria-labelledby="home-title">
          <Image
            className="journal-hero-image"
            src="/images/homepage/journal-hero-v1.webp"
            alt="Ilustrasi pengelola properti menggunakan tablet di courtyard yang hangat dan asri"
            fill
            priority
            quality={85}
            sizes="100vw"
          />
          <div className="container journal-hero-inner">
            <div className="journal-hero-copy">
              <span className="eyebrow">
                UNTUK OWNER KOS, GUEST HOUSE & HOTEL KECIL
              </span>
              <h1 id="home-title">
                Punya properti.
                <br />
                Bukan berarti harus mengurus semuanya <span>sendiri.</span>
              </h1>
              <p>
                Pantau tagihan, atur pekerjaan staf, dan kelola kamar dengan
                lebih rapi. Fokus pada tamu dan pengembangan properti, tanpa
                harus mengejar semuanya satu per satu.
              </p>
              <div className="journal-actions">
                <Link className="button" href="/register">
                  Mulai Gratis <ArrowUpRight size={17} />
                </Link>
                <Link className="button secondary" href="/demo/owner">
                  <Play size={16} /> Lihat Demo
                </Link>
              </div>
              <small className="journal-free">
                <Check size={17} /> Gratis hingga 5 kamar · Tanpa kartu kredit.
              </small>
            </div>
          </div>
          <span className="journal-hero-caption">
            Foto ilustrasi AI · bukan pelanggan
          </span>
        </section>

        <section
          className="journal-section journal-pains"
          id="fitur"
          aria-labelledby="pains-title"
        >
          <div className="container">
            <div className="journal-heading-split">
              <div>
                <span className="eyebrow">
                  TANTANGAN YANG SERING DIHADAPI OWNER
                </span>
                <h2 id="pains-title">
                  Operasional harian sering
                  <br />
                  menyita waktu dan energi.
                </h2>
              </div>
              <p>
                Kamelo membantu Anda menata hal-hal penting dengan lebih
                terarah, tanpa perlu terus mengingat semuanya secara manual.
              </p>
            </div>
            <div className="journal-pain-grid">
              <article>
                <div className="journal-pain-heading">
                  <span>01</span>
                  <div>
                    <h3>Tagihan membingungkan.</h3>
                    <p>
                      Tanggal jatuh tempo berbeda-beda. Lihat saldo, siapkan
                      pengingat, dan verifikasi bukti bayar.
                    </p>
                  </div>
                </div>
                <ReminderDemo compact />
                <Link
                  className="text-link journal-demo-link"
                  href="/demo/tenant"
                >
                  Coba unggah bukti bayar <ArrowUpRight size={15} />
                </Link>
              </article>
              <article>
                <div className="journal-pain-heading">
                  <span>02</span>
                  <div>
                    <h3>Staf sulit dipantau.</h3>
                    <p>
                      Pekerjaan kebersihan, perbaikan dan tugas lain bisa lebih
                      jelas penanggung jawabnya.
                    </p>
                  </div>
                </div>
                <LandingTasks />
                <Link
                  className="text-link journal-demo-link"
                  href="/demo?tab=tasks"
                >
                  Lihat contoh pekerjaan staf <ArrowUpRight size={15} />
                </Link>
              </article>
              <article>
                <div className="journal-pain-heading">
                  <span>03</span>
                  <div>
                    <h3>Kondisi kamar tak terkontrol.</h3>
                    <p>
                      Catat kesiapan kamar. Bahas kontrol listrik, AC dan akses
                      digital sesuai kebutuhan.
                    </p>
                  </div>
                </div>
                <Photo
                  name="journal-room-v1"
                  alt="Ilustrasi kamar kos tertata rapi dengan cahaya alami"
                  className="journal-room-preview"
                />
                <Link className="text-link journal-demo-link" href="#layanan">
                  Kenali Smart Property <ArrowUpRight size={15} />
                </Link>
              </article>
            </div>
          </div>
        </section>

        <section
          className="journal-section journal-properties"
          id="cara-kerja"
          aria-labelledby="property-title"
        >
          <div className="container">
            <div className="journal-heading-split">
              <div>
                <span className="eyebrow">
                  SESUAI CARA PROPERTI ANDA BERJALAN
                </span>
                <h2 id="property-title">
                  Satu tempat untuk
                  <br />
                  berbagai jenis properti.
                </h2>
                <p>
                  Kelola kos bulanan, guest house, atau hotel kecil dengan alur
                  yang sesuai kebutuhan.
                </p>
              </div>
              <a className="text-link journal-heading-link" href="#layanan">
                Lihat layanan tambahan <ArrowUpRight size={16} />
              </a>
            </div>
            <div className="journal-property-grid">
              <article>
                <Link
                  className="journal-photo-link"
                  href="/demo?tab=rooms"
                  aria-label="Lihat demo kos bulanan"
                >
                  <Photo
                    name="journal-room-v1"
                    alt="Ilustrasi kamar kos bulanan dengan meja kerja dan tanaman"
                  />
                </Link>
                <h3>Kos bulanan</h3>
                <p>
                  Penghuni jangka panjang, tanggal tagihan per penghuni, bukti
                  bayar dan pekerjaan staf yang tercatat.
                </p>
                <div className="journal-property-links">
                  <Link className="text-link" href="/demo?tab=rooms">
                    Lihat demo kos <ArrowUpRight size={16} />
                  </Link>
                  <Link href="/demo/tenant">
                    Sisi penghuni <ArrowUpRight size={15} />
                  </Link>
                </div>
              </article>
              <article>
                <Link
                  className="journal-photo-link"
                  href="/demo?property=hotel&tab=rooms"
                  aria-label="Lihat demo guest house dan hotel kecil"
                >
                  <Photo
                    name="journal-reception-v1"
                    alt="Ilustrasi tamu disambut resepsionis di guest house yang hangat"
                  />
                </Link>
                <h3>Guest house & hotel kecil</h3>
                <p>
                  Reservasi, check-in dan check-out, kesiapan kamar serta tugas
                  kebersihan untuk tamu berikutnya.
                </p>
                <div className="journal-property-links">
                  <Link
                    className="text-link"
                    href="/demo?property=hotel&tab=rooms"
                  >
                    Lihat demo guest house <ArrowUpRight size={16} />
                  </Link>
                  <Link href="/demo/tenant?property=hotel">
                    Sisi tamu <ArrowUpRight size={15} />
                  </Link>
                </div>
              </article>
            </div>
          </div>
        </section>

        <section
          className="journal-smart"
          id="layanan"
          aria-labelledby="smart-title"
        >
          <div className="container journal-smart-grid">
            <div className="journal-smart-copy">
              <span className="eyebrow">SMART PROPERTY · OPSIONAL</span>
              <h2 id="smart-title">
                Integrasi perangkat
                <br />
                untuk kontrol yang lebih baik.
              </h2>
              <p>
                Akses kamar digital, pemantauan AC/listrik, dan CCTV Video
                Analytics dapat dibahas sesuai kondisi properti Anda.
              </p>
              <a
                className="button secondary"
                href={smartConsultUrl}
                target="_blank"
                rel="noreferrer"
              >
                Diskusi Smart Property <ArrowUpRight size={17} />
              </a>
              <small>
                Perangkat, instalasi dan layanan tambahan terpisah dari paket
                Core.
              </small>
            </div>
            <Photo
              name="journal-lock-v1"
              alt="Ilustrasi kunci digital pada pintu kamar kayu; bukan perangkat yang terhubung"
              className="journal-lock-photo"
            />
            <ul className="journal-smart-status">
              {[
                [
                  KeyRound,
                  "Akses kamar digital",
                  "Perlu perangkat & integrasi",
                ],
                [Zap, "Pemantauan AC / listrik", "Perlu perangkat & integrasi"],
                [
                  Camera,
                  "CCTV Video Analytics",
                  "Perlu kamera & layanan analitik",
                ],
                [Sparkles, "AI generatif", "Belum terhubung"],
                [MessageCircle, "WhatsApp otomatis", "Belum terhubung"],
              ].map(([Icon, title, copy]) => {
                const C = Icon as typeof KeyRound;
                return (
                  <li key={String(title)}>
                    <C size={21} />
                    <div>
                      <b>{String(title)}</b>
                      <span>{String(copy)}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        <section
          className="journal-section journal-start"
          id="mulai"
          aria-labelledby="start-title"
        >
          <div className="container">
            <span className="eyebrow">CARA MULAI MENGGUNAKAN KAMELO</span>
            <h2 id="start-title">Siap dalam tiga langkah.</h2>
            <p>
              Cukup browser dan internet untuk fitur inti. Tidak perlu memasang
              perangkat pintar.
            </p>
            <ol className="journal-start-steps">
              {[
                [
                  UserRound,
                  "Buat akun owner",
                  "Daftar dengan nama, email, WhatsApp dan kata sandi. Akun dimulai di Gratis.",
                ],
                [
                  House,
                  "Siapkan properti & kamar",
                  "Pilih jenis properti, isi lokasi, jumlah kamar dan tarif sesuai paket aktif.",
                ],
                [
                  ReceiptText,
                  "Tambahkan penghuni & tagihan",
                  "Isi masa tinggal dan jatuh tempo, lalu bagikan tautan layanan pribadi.",
                ],
              ].map(([Icon, title, copy], i) => {
                const C = Icon as typeof House;
                return (
                  <li key={String(title)}>
                    <span className="journal-step-number">{i + 1}</span>
                    <C size={26} />
                    <div>
                      <h3>{String(title)}</h3>
                      <p>{String(copy)}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        </section>

        <LandingPricing />

        <section
          className="journal-section journal-faq"
          id="faq"
          aria-labelledby="faq-title"
        >
          <div className="container journal-faq-grid">
            <div>
              <span className="eyebrow">PERTANYAAN YANG SERING DITANYAKAN</span>
              <h2 id="faq-title">
                Masih ada
                <br />
                pertanyaan?
              </h2>
              <p>
                Kenali cara kerja, persiapan dan batas layanan sebelum
                memasukkan data properti.
              </p>
              <a
                className="text-link"
                href={coreConsultUrl}
                target="_blank"
                rel="noreferrer"
              >
                Tanya tim ELENIO <ArrowUpRight size={16} />
              </a>
            </div>
            <div>
              {primaryQuestions.map(([q, a]) => (
                <Question key={q} question={q} answer={a} />
              ))}
              <details className="journal-more-faq">
                <summary>
                  Pertanyaan lain: staf, akses penghuni & kesiapan layanan{" "}
                  <ChevronDown size={17} />
                </summary>
                <div>
                  {moreQuestions.map(([q, a]) => (
                    <Question key={q} question={q} answer={a} />
                  ))}
                </div>
              </details>
            </div>
          </div>
        </section>

        <section className="journal-final" aria-labelledby="final-title">
          <div className="journal-final-photo">
            <Image
              src="/images/homepage/journal-owner-coffee-v1.webp"
              alt="Ilustrasi owner menikmati waktu di properti dengan laptop dan secangkir kopi"
              fill
              sizes="(max-width: 700px) 100vw, 65vw"
            />
            <span className="journal-hero-caption">Foto ilustrasi AI</span>
          </div>
          <div className="container journal-final-inner">
            <div className="journal-final-copy">
              <span>Kelola properti dengan lebih tenang.</span>
              <h2 id="final-title">
                Properti berjalan.
                <br />
                <span>Anda punya waktu.</span>
              </h2>
              <div className="journal-actions">
                <Link className="button" href="/register">
                  Mulai Gratis <ArrowUpRight size={17} />
                </Link>
                <Link className="button secondary" href="/demo/owner">
                  <Play size={16} /> Lihat Demo
                </Link>
              </div>
              <small className="journal-free">
                <CheckCircle2 size={17} /> Gratis hingga 5 kamar · Tanpa kartu
                kredit.
              </small>
            </div>
          </div>
        </section>
      </main>
      <Footer home />
    </>
  );
}
