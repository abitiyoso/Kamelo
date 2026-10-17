"use client";
import { useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Check,
  Clock3,
  ReceiptText,
  KeyRound,
  ClipboardCheck,
  Wrench,
} from "lucide-react";
import { demoProperty } from "@/lib/demo";
import { roomStatus } from "@/lib/domain.mjs";
import { rupiah } from "@/lib/plans";
import { Mascot } from "./mascot";
import { tenantDate } from "@/lib/tenant-types";
const workflows = [
  {
    id: "billing",
    label: "Tagihan belum masuk",
    icon: ReceiptText,
    title: "Dari tunggakan ke pengingat yang siap dikirim.",
    copy: "Lihat saldo, siapkan tindak lanjut, lalu verifikasi pembayaran yang benar-benar diterima.",
    image: "billing-preview.jpg",
    alt: "Halaman Tagihan Kamelo dengan pengingat dan antrean bukti bayar, data simulasi",
    steps: [
      ["Tersedia", "Saldo dan jatuh tempo tiap penghuni terlihat."],
      ["Tersedia", "Pengelola menyiapkan tautan tagihan dan pesan pengingat."],
      ["Manual", "Tinjau pesan, buka WhatsApp, lalu Anda yang mengirim."],
      [
        "Tersedia",
        "Penghuni unggah bukti; pemilik atau staf berizin memverifikasi dana.",
      ],
    ],
    pending:
      "Penyusunan pesan oleh AI Agent dan pengiriman otomatis: segera hadir; belum aktif.",
  },
  {
    id: "checkin",
    label: "Tamu check-in",
    icon: KeyRound,
    title: "Tamu datang. Masa tinggal dan akses jelas.",
    copy: "Konfirmasi check-in di reservasi, lalu bagikan tautan penghuni tanpa aplikasi tambahan.",
    image: "rooms-preview.jpg",
    alt: "Halaman Kamar dan Tamu Kamelo dengan reservasi hotel, data simulasi",
    steps: [
      ["Tersedia", "Pengelola memeriksa reservasi dan kesiapan kamar."],
      ["Tersedia", "Check-in dikonfirmasi oleh pengelola."],
      [
        "Tersedia",
        "Terbitkan tagihan, buat tautan penghuni, lalu bagikan secara manual.",
      ],
      [
        "Simulasi",
        "PIN akses hanya tampil saat masa tinggal aktif dan perangkat simulasi online.",
      ],
    ],
    pending:
      "Portal layanan, Wi-Fi QR dan komplain tersedia selama masa tinggal aktif. Kontrol kamar masih simulasi; kunci nyata memerlukan integrasi.",
  },
  {
    id: "checkout",
    label: "Kamar check-out",
    icon: ClipboardCheck,
    title: "Check-out tercatat. Kamar siap setelah diperiksa.",
    copy: "Pisahkan status reservasi dari kesiapan fisik kamar untuk tamu berikutnya.",
    image: "rooms-preview.jpg",
    alt: "Status kamar hotel dan kesiapan kamar pada aplikasi Kamelo",
    steps: [
      ["Tersedia", "Pengelola mengonfirmasi check-out."],
      ["Tersedia", "Kamar hotel masuk status perlu dibersihkan."],
      ["Manual", "Staf memeriksa kamar dan memastikan tidak ada penghuni."],
      [
        "Tersedia",
        "Staf memperbarui status kesiapan kamar setelah pemeriksaan.",
      ],
    ],
    pending:
      "Tiket kebersihan otomatis tersedia setelah check-out hotel. Otomasi listrik nyata perlu instalasi, verifikasi kamar kosong dan izin; tidak memutus sirkuit penting.",
  },
  {
    id: "maintenance",
    label: "Komplain penghuni",
    icon: Wrench,
    title: "Keluhan tercatat, progres bisa diikuti.",
    copy: "Penghuni mengirim permintaan, pengelola menugaskan staf, dan progres tercatat sampai selesai.",
    image: null,
    alt: "",
    steps: [
      ["Tersedia", "Penghuni membuat laporan masalah melalui portal."],
      ["Tersedia", "Tiket ditugaskan ke staf dengan status progres."],
      ["Tersedia", "Owner melihat pekerjaan yang belum selesai."],
      ["Tersedia", "Penghuni meninjau penyelesaiannya."],
    ],
    pending:
      "Tiket dan riwayat progres tersedia di aplikasi. Notifikasi WhatsApp otomatis belum terhubung.",
  },
] as const;
export function HomeWorkflows() {
  const [segment, setSegment] = useState<"kos" | "hotel">("kos");
  const [selected, setSelected] = useState(0);
  const item = workflows[selected];
  function selectWorkflow(index: number) {
    setSelected(index);
    if (index === 1 || index === 2) setSegment("hotel");
  }
  return (
    <section className="section workflow-section" id="cara-kerja">
      <div className="container">
        <div className="section-heading">
          <span className="eyebrow">DARI MASALAH KE TINDAKAN</span>
          <h2>Satu Masalah, Ada Cara Menanganinya.</h2>
          <p>
            Pilih keseharian properti Anda, lalu lihat alur yang sudah bisa
            dicoba.
          </p>
        </div>
        <div
          className="segment-selector"
          role="group"
          aria-label="Jenis properti"
        >
          <button
            aria-pressed={segment === "kos"}
            onClick={() => {
              setSegment("kos");
              setSelected(0);
            }}
          >
            Untuk Kos
          </button>
          <button
            aria-pressed={segment === "hotel"}
            onClick={() => {
              setSegment("hotel");
              setSelected(1);
            }}
          >
            Untuk Guest House & Hotel
          </button>
        </div>
        <p className="segment-copy">
          {segment === "kos"
            ? "Tagihan bulanan harus dikejar, penghuni sering chat langsung, dan kamar kosong belum cepat terisi? Mulai dari saldo tagihan, jatuh tempo per penghuni, dan ketersediaan kamar."
            : "Tamu sudah datang, kunci belum siap, Wi-Fi masih ditanyakan, dan kamar belum selesai diperiksa? Mulai dari reservasi, check-in/check-out dan kesiapan kamar. Smart Stay dikembangkan sebagai tahap berikutnya."}
        </p>
        <div className="portal-paths">
          <Link
            href={
              "/demo/owner" + (segment === "hotel" ? "?property=hotel" : "")
            }
          >
            <b>Untuk owner</b>
            <span>Coba siapkan pengingat →</span>
          </Link>
          <Link
            href={
              "/demo/tenant" + (segment === "hotel" ? "?property=hotel" : "")
            }
          >
            <b>Untuk penghuni</b>
            <span>Lihat contoh tautan tagihan →</span>
          </Link>
        </div>
        <div
          className="workflow-tabs"
          role="tablist"
          aria-label="Alur kerja Kamelo"
        >
          {workflows.map((w, index) => (
            <button
              key={w.id}
              role="tab"
              id={"workflow-tab-" + w.id}
              aria-selected={selected === index}
              aria-controls="workflow-content"
              tabIndex={selected === index ? 0 : -1}
              onClick={() => selectWorkflow(index)}
              onKeyDown={(event) => {
                if (
                  ["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)
                ) {
                  event.preventDefault();
                  const next =
                    event.key === "Home"
                      ? 0
                      : event.key === "End"
                        ? workflows.length - 1
                        : (index +
                            (event.key === "ArrowRight" ? 1 : -1) +
                            workflows.length) %
                          workflows.length;
                  selectWorkflow(next);
                  document
                    .getElementById("workflow-tab-" + workflows[next].id)
                    ?.focus();
                }
              }}
            >
              <w.icon size={18} />
              {w.label}
            </button>
          ))}
        </div>
        <div
          className="workflow-content"
          id="workflow-content"
          role="tabpanel"
          aria-labelledby={"workflow-tab-" + item.id}
        >
          <div>
            <h3>{item.title}</h3>
            <p>{item.copy}</p>
            <ol>
              {item.steps.map(([status, text], index) => (
                <li key={text}>
                  <span className="workflow-number">{index + 1}</span>
                  <div>
                    <span
                      className={
                        "capability-status " +
                        (status === "Tersedia" ? "available" : "beta")
                      }
                    >
                      {status === "Tersedia" ? (
                        <Check size={12} />
                      ) : (
                        <Clock3 size={12} />
                      )}{" "}
                      {status}
                    </span>
                    <p>{text}</p>
                  </div>
                </li>
              ))}
            </ol>
            <p className="workflow-limit">{item.pending}</p>
            {item.id !== "maintenance" && (
              <Link
                className="text-link"
                href={
                  "/demo?tab=" +
                  (item.id === "billing" ? "billing" : "rooms") +
                  (segment === "hotel" ? "&property=hotel" : "")
                }
              >
                Lihat contoh di aplikasi <ArrowUpRight size={16} />
              </Link>
            )}
          </div>
          <div className="workflow-product">
            {item.image ? (
              <>
                <img
                  src={"/images/features/" + item.image}
                  alt={item.alt}
                  loading="lazy"
                />
                <small>Tangkapan layar aplikasi aktual · data simulasi</small>
              </>
            ) : (
              <div className="workflow-coming">
                <Wrench size={42} />
                <span className="capability-status available">
                  Tersedia di aplikasi
                </span>
                <h3>Tiket komplain & tugas staf</h3>
                <p>
                  Buat tiket di Kamar & Tamu, tetapkan penanggung jawab, lalu
                  pantau progresnya. Laporan penghuni masuk dari portal layanan.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
const leoQuestions = [
  "Leo, siapa yang belum bayar bulan ini?",
  "Berapa uang sewa yang sudah masuk bulan ini?",
  "Kamar mana yang belum siap untuk tamu berikutnya?",
  "Siapkan pengingat untuk penghuni yang menunggak.",
  "Apa saja komplain yang belum selesai?",
];
export function LeoOperationsDemo() {
  const [question, setQuestion] = useState(0);
  const property = demoProperty(false);
  const issued = property.invoices.filter(
    (i) => !["DRAFT", "VOID"].includes(i.status),
  );
  const unpaid = issued
    .map((i) => ({
      ...i,
      balance: i.total - i.payments.reduce((s, p) => s + p.amount, 0),
    }))
    .filter((i) => i.balance > 0);
  const received = issued
    .flatMap((i) => i.payments)
    .filter((p) => p.date >= "2026-10-01" && p.date <= "2026-10-13")
    .reduce((s, p) => s + p.amount, 0);
  const notReady = property.rooms.filter((r) =>
    ["CLEANING", "MAINTENANCE"].includes(roomStatus(r, r.stays, "2026-10-13")),
  );
  const first = unpaid.find((i) => i.due < "2026-10-13");
  const answers = [
    {
      summary: unpaid.length + " tagihan masih bersaldo.",
      data: unpaid.map(
        (i) =>
          i.guest.name +
          " · Kamar " +
          i.room.number +
          " · " +
          rupiah(i.balance),
      ),
      next: "Pilih penghuni dan siapkan pengingat.",
      href: "#demo-owner",
      cta: "Coba siapkan pengingat",
    },
    {
      summary: rupiah(received) + " sudah tercatat.",
      data: [
        "1–13 Oktober 2026",
        "Termasuk pembayaran sebagian; bukan proyeksi.",
      ],
      next: "Tinjau transaksi pada dashboard contoh.",
      href: "/demo",
      cta: "Lihat contoh dashboard",
    },
    {
      summary: notReady.length + " kamar perlu penanganan kesiapan.",
      data: [
        "Kos Melati · 20 kamar",
        "Status pembersihan dan pemeliharaan; tidak menyimpulkan kondisi fisik.",
      ],
      next: "Periksa rincian kamar dan reservasi.",
      href: "/demo?tab=rooms",
      cta: "Lihat contoh kamar",
    },
    {
      summary: "Pengingat bisa Anda siapkan dan tinjau.",
      data: first
        ? [
            first.guest.name + " · Kamar " + first.room.number,
            "Saldo " +
              rupiah(first.balance) +
              " · Jatuh tempo " +
              tenantDate(first.due),
          ]
        : ["Tidak ada tunggakan pada contoh."],
      next: "Gunakan panel pengingat untuk membuat dan menyalin pesan.",
      href: "#demo-owner",
      cta: "Siapkan Pengingat di Demo",
    },
    {
      summary: "Tiket komplain tersedia di aplikasi owner.",
      data: [
        "Demo publik ini belum memiliki contoh komplain.",
        "LEO operasional dapat merangkum pekerjaan properti setelah Anda masuk.",
      ],
      next: "Masuk ke aplikasi untuk mengelola pekerjaan & komplain.",
      href: "/demo/tenant",
      cta: "Lihat Contoh Portal Penghuni",
    },
  ];
  const answer = answers[question];
  return (
    <section className="section container leo-operations" id="leo">
      <div>
        <span className="eyebrow">LEO · PRATINJAU BERBASIS ATURAN</span>
        <h2>
          Baca kondisi properti.
          <br />
          Siapkan langkah berikutnya.
        </h2>
        <p>
          LEO membantu membaca kondisi properti dan menyiapkan langkah
          berikutnya.
        </p>
        <span className="capability-status planned">
          Data demo · AI Agent segera hadir
        </span>
        <Mascot pose="help" size={115} />
      </div>
      <div className="leo-demo">
        <div className="leo-demo-heading">KOS MELATI · DATA SIMULASI</div>
        <div
          className="leo-prompts"
          role="group"
          aria-label="Contoh pertanyaan LEO"
        >
          {leoQuestions.map((q, i) => (
            <button
              key={q}
              aria-pressed={question === i}
              onClick={() => setQuestion(i)}
            >
              {q}
            </button>
          ))}
        </div>
        <div className="leo-answer" role="status">
          <small>RINGKASAN</small>
          <h3>{answer.summary}</h3>
          <ul aria-label="Data terkait">
            {answer.data.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
          <small>LANGKAH BERIKUTNYA</small>
          <p>{answer.next}</p>
          <Link href={answer.href} className="text-link">
            {answer.cta} <ArrowUpRight size={15} />
          </Link>
        </div>
      </div>
    </section>
  );
}
