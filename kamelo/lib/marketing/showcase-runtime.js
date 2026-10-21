// Approved v6/v7 isolated fixture renderer. No operational API or persistence.
import KAMELO_IMAGES from "./assets.json";
export function initializeShowcase(root) {
  const initialMarkup = root.innerHTML;
  const listeners = [];
  const listenToWindow = (...args) => {
    window.addEventListener(...args);
    listeners.push(args);
  };
  const document = {
    getElementById: (id) => root.querySelector("#" + id),
    querySelector: (selector) => root.querySelector(selector),
    querySelectorAll: (selector) => root.querySelectorAll(selector),
  };

  const burger = document.getElementById("burger");
  const menu = document.getElementById("mobileMenu");
  burger?.addEventListener("click", () => {
    const open = menu.classList.toggle("open");
    burger.setAttribute("aria-expanded", String(open));
    burger.textContent = open ? "✕" : "☰";
  });
  menu?.querySelectorAll("a").forEach((a) =>
    a.addEventListener("click", () => {
      menu.classList.remove("open");
      burger.setAttribute("aria-expanded", "false");
      burger.textContent = "☰";
    }),
  );
  listenToWindow(
    "scroll",
    () =>
      document
        .querySelector(".header")
        ?.classList.toggle("is-scrolled", window.scrollY > 12),
    { passive: true },
  );
  const modules = {
    owner: [
      [
        "overview",
        "Ringkasan",
        "Bisnis lebih mudah dipantau.",
        "Pendapatan, tingkat hunian, tagihan, dan pekerjaan yang perlu ditangani tersedia dalam satu dashboard.",
      ],
      [
        "rooms",
        "Properti & Kamar",
        "Status setiap kamar lebih jelas.",
        "Kelola inventaris kamar, status hunian dan kesiapan unit.",
      ],
      [
        "customers",
        "Database Penghuni",
        "Riwayat penghuni terhubung dalam satu profil.",
        "Hubungkan data penghuni, masa tinggal, layanan dan transaksi.",
      ],
      [
        "leads",
        "Prospek Sewa",
        "Calon penghuni tidak lagi tercecer.",
        "Pantau pertanyaan masuk, survei kamar, penawaran, dan tindak lanjut.",
      ],
      [
        "contracts",
        "Kontrak & Deposit",
        "Masa tinggal dan deposit lebih tertata.",
        "Tinjau perpanjangan kontrak, deposit, dan riwayat masa tinggal.",
      ],
      [
        "billing",
        "Tagihan & Pembayaran",
        "Penagihan tidak perlu tercecer.",
        "Pantau pembayaran, tagihan jatuh tempo, dan proses verifikasi.",
      ],
      [
        "work",
        "Pekerjaan",
        "Operasional harian lebih terarah.",
        "Kelola tugas perbaikan, pembersihan, dan penanggung jawab.",
      ],
      [
        "inbox",
        "Kotak Masuk",
        "Komunikasi penghuni lebih terkelola.",
        "Lihat pesan dan permintaan yang perlu ditindaklanjuti.",
      ],
      [
        "visitors",
        "Tamu & Paket",
        "Kunjungan dan kiriman tercatat.",
        "Pantau tamu, paket, dan tindak lanjut front desk.",
      ],
      [
        "cctv",
        "CCTV & AI",
        "Temuan CCTV dapat ditindaklanjuti.",
        "Pantau area bersama, aktivitas pengunjung dan kejadian penting.",
      ],
      [
        "smart",
        "Smart Room",
        "Kontrol perangkat lebih terkelola.",
        "Pantau perangkat kamar dan kondisi operasional.",
      ],
      [
        "leo",
        "LEO Insights",
        "Prioritas hari ini lebih mudah diketahui.",
        "Dapatkan ringkasan operasional dari data yang relevan.",
      ],
      [
        "finance",
        "Keuangan",
        "Arus kas properti lebih transparan.",
        "Pantau penerimaan, biaya, dan sisa kas.",
      ],
      [
        "team",
        "Tim & Akses",
        "Akses tim terkelola sesuai tanggung jawab.",
        "Undangan staf, area penugasan dan izin pengguna.",
      ],
    ],
    staff: [
      [
        "tasks",
        "Tugas Hari Ini",
        "Tugas jelas, pekerjaan lebih terarah.",
        "Lihat pekerjaan prioritas, tenggat, dan penanggung jawab.",
      ],
      [
        "readiness",
        "Kesiapan Kamar",
        "Kamar siap sebelum penghuni datang.",
        "Koordinasikan pembersihan dan pemeriksaan kamar.",
      ],
      [
        "alerts",
        "Insiden",
        "Setiap laporan punya tindak lanjut.",
        "Tinjau tiket dan kejadian area bersama sesuai penugasan.",
      ],
      [
        "messages",
        "Pesan",
        "Komunikasi operasional lebih rapi.",
        "Tanggapi pesan yang ditugaskan.",
      ],
      [
        "shift",
        "Jadwal Shift",
        "Pembagian jadwal lebih jelas.",
        "Lihat tugas, pergantian shift, dan handover.",
      ],
      [
        "frontdesk",
        "Tamu & Paket",
        "Kedatangan tamu lebih terkoordinasi.",
        "Catat kunjungan, paket, dan notifikasi.",
      ],
      [
        "maintenance",
        "Maintenance",
        "Perbaikan bisa diikuti sampai selesai.",
        "Pantau progres, sparepart, dan bukti pekerjaan.",
      ],
    ],
    tenant: [
      [
        "home",
        "Beranda",
        "Semua kebutuhan tinggal dalam satu tempat.",
        "Cek kamar, tagihan, layanan, dan pengumuman.",
      ],
      [
        "invoices",
        "Tagihan",
        "Tagihan lebih mudah dipahami.",
        "Cek jumlah, jatuh tempo dan riwayat pembayaran.",
      ],
      [
        "services",
        "Layanan",
        "Lapor kebutuhan kamar lebih praktis.",
        "Ajukan bantuan dan pantau statusnya.",
      ],
      [
        "myroom",
        "Kamar Saya",
        "Informasi dan kontrol kamar dalam satu portal.",
        "Lihat masa tinggal, akses, dan perangkat yang tersedia.",
      ],
      [
        "access",
        "Akses Kamar",
        "Akses digital sesuai izin tinggal.",
        "Pantau akses pintu dan informasi Wi-Fi kamar.",
      ],
      [
        "facilities",
        "Fasilitas",
        "Pesan fasilitas tanpa chat berulang.",
        "Lihat fasilitas bersama dan jadwal pemesanan.",
      ],
      [
        "tenantmessages",
        "Pesan",
        "Tetap terhubung dengan pengelola.",
        "Lihat percakapan dan pengumuman yang relevan.",
      ],
    ],
  };
  const topModules = {
    owner: [
      "overview",
      "rooms",
      "customers",
      "billing",
      "contracts",
      "work",
      "cctv",
      "smart",
    ],
    staff: [
      "tasks",
      "readiness",
      "alerts",
      "messages",
      "shift",
      "frontdesk",
      "maintenance",
    ],
    tenant: [
      "home",
      "invoices",
      "services",
      "myroom",
      "access",
      "facilities",
      "tenantmessages",
    ],
  };
  const labels = { owner: "Pemilik", staff: "Staf", tenant: "Penghuni" };
  let activeRole = "owner";
  let activeModule = "overview";
  let billingFilter = "all";
  const bar = document.getElementById("ksModulebar");
  const app = document.getElementById("ksApp");
  const dlg = document.getElementById("ksDetail");
  const detailData = {
    "invoice-andi": [
      "Tagihan Andi Pratama",
      "Rp1.800.000 · Kamar A-12 · Belum dibayar",
      [
        "Jatuh tempo 25 Oktober 2026",
        "Pengingat penagihan tersedia",
        "Riwayat pembayaran dapat diperiksa",
      ],
    ],
    "invoice-siti": [
      "Tagihan Siti Rahmawati",
      "Rp1.800.000 · Kamar B-07 · Menunggu verifikasi",
      [
        "Bukti transfer telah diterima",
        "Pembayaran perlu direkonsiliasi",
        "Status belum berubah menjadi lunas",
      ],
    ],
    "contract-a12": [
      "Kontrak Kamar A-12",
      "Andi Pratama · 25 April–25 Oktober 2026",
      [
        "Perpanjangan dapat diajukan",
        "Deposit tercatat Rp1.000.000",
        "Riwayat kontrak sebelumnya tetap tersimpan",
      ],
    ],
    "contract-b07": [
      "Kontrak Kamar B-07",
      "Siti Rahmawati · 1 Agustus 2026–31 Juli 2027",
      [
        "Sewa bulanan Rp1.800.000",
        "Deposit diterima",
        "Akses penghuni sesuai masa tinggal",
      ],
    ],
    "task-ac": [
      "Perbaikan AC A-12",
      "Keluhan AC kurang dingin · Penanggung jawab Agus",
      [
        "Prioritas tinggi",
        "Dalam antrean teknisi",
        "Foto dan hasil pengecekan dapat dilampirkan",
      ],
    ],
    "task-clean": [
      "Pembersihan Kamar B-17",
      "Kamar perlu dibersihkan sebelum check-in",
      [
        "Ditugaskan ke tim housekeeping",
        "Pemeriksaan kamar setelah pembersihan",
        "Status kamar berubah setelah diverifikasi",
      ],
    ],
    "task-pipe": [
      "Keran kamar B-02 bocor",
      "Laporan penghuni sedang ditangani",
      [
        "Status: dalam pengerjaan",
        "Dibutuhkan pengecekan saluran air",
        "Catatan penyelesaian tersimpan",
      ],
    ],
    "alert-corridor": [
      "Aktivitas tidak biasa di koridor",
      "Pergerakan terdeteksi di koridor A lantai 2",
      [
        "Periksa rekaman kamera area bersama",
        "Konfirmasi kejadian sebelum eskalasi",
        "Teruskan ke petugas keamanan bila diperlukan",
      ],
    ],
    "alert-parking": [
      "Aktivitas parkir",
      "Kendaraan berada di area parkir samping",
      [
        "Periksa durasi dan lokasi kendaraan",
        "Validasi aturan parkir properti",
        "Tugaskan petugas bila perlu",
      ],
    ],
    "room-A12": [
      "Kamar A-12",
      "Terisi · Andi Pratama · Rp1.800.000/bulan",
      [
        "Kontrak sampai 25 Oktober 2026",
        "Tagihan bulan ini belum dibayar",
        "Akses Smart Room sesuai izin penghuni",
      ],
    ],
    "room-B07": [
      "Kamar B-07",
      "Terisi · Siti Rahmawati · Rp1.800.000/bulan",
      [
        "Kontrak masih aktif",
        "Tagihan menunggu verifikasi",
        "Tidak ada tiket terbuka",
      ],
    ],
    "room-B17": [
      "Kamar B-17",
      "Kosong · Siap dibersihkan",
      [
        "Belum ada penghuni aktif",
        "Pembersihan ditugaskan",
        "Dapat dipasarkan setelah siap",
      ],
    ],
    "room-C03": [
      "Kamar C-03",
      "Kosong · Siap huni",
      [
        "Kamar sudah diperiksa",
        "Tidak ada pekerjaan tertunda",
        "Dapat menerima penghuni baru",
      ],
    ],
    "room-B09": [
      "Kamar B-09",
      "Terisi · Rina Permata · Rp1.700.000/bulan",
      [
        "Kontrak aktif",
        "Pembayaran bulan berjalan tercatat",
        "Tidak ada pekerjaan tertunda",
      ],
    ],
    "room-C11": [
      "Kamar C-11",
      "Kosong · Menunggu pemeriksaan kamar",
      [
        "Perlu pengecekan fasilitas",
        "Belum dapat menerima penghuni baru",
        "Hasil pemeriksaan dicatat oleh staf",
      ],
    ],
    "service-ac": [
      "Permintaan perbaikan AC",
      "Kamar A-12 · Dilaporkan Andi Pratama",
      [
        "Permintaan sudah dicatat",
        "Tugas diteruskan ke tim operasional",
        "Pembaruan progres tersedia di portal penghuni",
      ],
    ],
    "service-wifi": [
      "Bantuan Wi-Fi",
      "Permintaan bantuan koneksi internet",
      [
        "Pengelola akan meninjau laporan",
        "Status bantuan dapat dipantau",
        "Tidak perlu mengirim ulang melalui chat",
      ],
    ],
    "message-and": [
      "Pesan Andi Pratama",
      "Permintaan pengecekan AC di kamar A-12",
      [
        "Pesan terkait tiket perbaikan AC",
        "Riwayat komunikasi tersimpan",
        "Balasan hanya dapat dikirim petugas berwenang",
      ],
    ],
    "message-siti": [
      "Pesan Siti Rahmawati",
      "Bukti transfer pembayaran telah dikirim",
      [
        "Bukti pembayaran menunggu pemeriksaan",
        "Catatan percakapan terkait invoice",
        "Status diperbarui sesudah konfirmasi",
      ],
    ],
    "room-key": [
      "Akses Kamar A-12",
      "Kunci digital tersedia sesuai paket perangkat",
      [
        "Hak akses dibatasi pada masa tinggal",
        "Riwayat akses tersimpan bila didukung perangkat",
        "Kontrol hanya untuk penghuni berizin",
      ],
    ],
    "smart-ac": [
      "Smart Room A-12",
      "AC · Status online · Setelan 24°C",
      [
        "Kontrol perangkat bergantung pada koneksi gateway",
        "Perintah harus dikonfirmasi perangkat",
        "Aturan penghematan dikelola oleh pengelola",
      ],
    ],
    "smart-light": [
      "Smart Room A-12",
      "Lampu kamar · Status aktif",
      [
        "Kontrol sesuai izin penghuni",
        "Otomasi dapat dijalankan saat kamar kosong",
        "Status perangkat mengikuti konfirmasi aktual",
      ],
    ],
  };
  Object.assign(detailData, {
    "customer-rina": [
      "Profil Rina Permata",
      "Penghuni kamar B-09 · Status aktif",
      [
        "Kontak terverifikasi",
        "Kontrak tahunan tersimpan",
        "Layanan dan pembayaran terhubung",
      ],
    ],
    "customer-dimas": [
      "Profil Dimas Putra",
      "Penghuni kamar C-01",
      [
        "Kontak diperbarui",
        "Riwayat pembayaran tersedia",
        "Informasi kontrak tersimpan",
      ],
    ],
    "customer-update": [
      "Pembaruan profil",
      "Data kontak perlu validasi",
      [
        "Verifikasi perubahan nomor ponsel",
        "Pembaruan tercatat pada histori akun",
        "Akses tetap mengikuti izin",
      ],
    ],
    "invite-andi": [
      "Undangan penghuni",
      "Andi Pratama · Portal penghuni",
      [
        "Undangan belum diterima",
        "Tautan undangan dapat dikirim ulang",
        "Akses aktif setelah verifikasi",
      ],
    ],
    "lead-nadia": [
      "Prospek Nadia Putri",
      "Survei kamar C-03 · Senin 10.00",
      ["Minat sewa bulanan", "Kamar tersedia", "Follow-up sesudah kunjungan"],
    ],
    "lead-reza": [
      "Prospek Reza Akbar",
      "Menunggu penawaran harga",
      [
        "Permintaan guest house",
        "Informasi kapasitas kamar tersedia",
        "Tindak lanjut pengelola",
      ],
    ],
    "lead-putri": [
      "Prospek Putri Rani",
      "Minat kamar B-17",
      [
        "Meminta detail fasilitas",
        "Kamar menunggu cleaning",
        "Jadwal survei dapat disiapkan",
      ],
    ],
    "message-rina": [
      "Pesan Rina Permata",
      "Permintaan akses laundry",
      [
        "Terhubung ke akun Rina",
        "Jadwal fasilitas bisa dicek",
        "Balasan tercatat di percakapan",
      ],
    ],
    "notice-lift": [
      "Pengumuman perawatan lift",
      "Pemeriksaan berkala fasilitas bersama",
      [
        "Waktu pelaksanaan tersedia",
        "Notifikasi untuk penghuni",
        "Catatan pengelola tersimpan",
      ],
    ],
    "package-andi": [
      "Paket Andi Pratama",
      "Paket diterima di front desk",
      [
        "Waktu penerimaan 10.40",
        "Penerima yang dituju Andi",
        "Status pengambilan menunggu konfirmasi",
      ],
    ],
    "package-rina": [
      "Paket Rina Permata",
      "Menunggu pengambilan",
      [
        "Penerima terkonfirmasi",
        "Lokasi front desk",
        "Notifikasi penghuni tersedia",
      ],
    ],
    "visitor-siti": [
      "Kunjungan untuk Siti",
      "Tamu datang 12.15",
      [
        "Tercatat di front desk",
        "Tujuan kunjungan terverifikasi",
        "Riwayat kunjungan tersedia",
      ],
    ],
    "finance-power": [
      "Biaya listrik",
      "Oktober · Rp4.200.000",
      [
        "Terhubung ke laporan biaya",
        "Pencatatan vendor dan tanggal",
        "Lampiran bukti pengeluaran",
      ],
    ],
    "finance-ac": [
      "Biaya perawatan AC",
      "Oktober · Rp780.000",
      [
        "Pekerjaan maintenance terkait",
        "Biaya tercatat",
        "Riwayat pemeriksaan tersimpan",
      ],
    ],
    "finance-room": [
      "Perlengkapan kamar",
      "Oktober · Rp1.250.000",
      [
        "Biaya operasional properti",
        "Bukti transaksi tersimpan",
        "Dapat dilihat dalam laporan",
      ],
    ],
    "team-budi": [
      "Budi Santoso",
      "Owner · Kos Melati Signature",
      [
        "Akses seluruh properti miliknya",
        "Memiliki izin pengelolaan anggota",
        "Perubahan izin diaudit",
      ],
    ],
    "team-agus": [
      "Agus Haryanto",
      "Maintenance · Gedung A",
      [
        "Tugas perbaikan kamar",
        "Akses CCTV sesuai penugasan saja",
        "Tidak memiliki akses ke keuangan",
      ],
    ],
    "team-rina": [
      "Rina Lestari",
      "Housekeeping · Gedung B",
      [
        "Kesiapan kamar dan tugas cleaning",
        "Tidak mengelola tagihan",
        "Akses sesuai penugasan",
      ],
    ],
    "team-deni": [
      "Deni Saputra",
      "Security · Area bersama",
      [
        "Review alert CCTV area umum",
        "Riwayat penyelesaian insiden",
        "Tidak melihat data keuangan",
      ],
    ],
    "team-invite": [
      "Undangan staf",
      "Akses admin keuangan",
      [
        "Menunggu penerima verifikasi akun",
        "Izin terbatas sesuai properti",
        "Undangan dapat dicabut",
      ],
    ],
    "team-policy": [
      "Pengaturan izin staf",
      "Akses sesuai tanggung jawab",
      [
        "Cakupan properti dan area",
        "Perubahan role tercatat",
        "Akses dapat dicabut kapan saja",
      ],
    ],
    "team-audit": [
      "Audit akses",
      "Riwayat perubahan izin",
      [
        "Perubahan memiliki pelaku dan waktu",
        "Pemeriksaan dari platform admin terbatas",
        "Pencabutan akses tercatat",
      ],
    ],
    "maintenance-light": [
      "Perbaikan lampu koridor",
      "Koridor lantai 2",
      [
        "Menunggu penggantian komponen",
        "Ditugaskan kepada teknisi",
        "Hasil pemasangan perlu diverifikasi",
      ],
    ],
    "access-history": [
      "Riwayat akses",
      "Kamar A-12",
      [
        "Catatan sesuai dukungan smart lock",
        "Hak akses terkait masa tinggal",
        "Tidak dibagikan ke penghuni lain",
      ],
    ],
    "access-guide": [
      "Panduan kunci digital",
      "Kamar A-12",
      [
        "Aktifkan akses dari portal",
        "Gunakan kode hanya untuk penghuni berizin",
        "Hubungi pengelola jika pintu bermasalah",
      ],
    ],
    "facility-guide": [
      "Panduan fasilitas",
      "Area bersama properti",
      [
        "Peraturan jam penggunaan",
        "Reservasi menurut ketersediaan",
        "Kontak pengelola properti",
      ],
    ],
    "facility-laundry": [
      "Laundry",
      "Fasilitas bersama",
      [
        "Slot malam tersedia",
        "Reservasi tersimpan di portal",
        "Perubahan jadwal melalui pengelola",
      ],
    ],
    "facility-study": [
      "Ruang belajar",
      "Fasilitas bersama",
      [
        "Jadwal ketersediaan ditampilkan",
        "Gunakan fasilitas sesuai aturan",
        "Reservasi dapat diperiksa",
      ],
    ],
    "facility-lounge": [
      "Ruang tamu",
      "Fasilitas bersama",
      [
        "Jam kunjungan terbatas",
        "Tamu perlu didaftarkan",
        "Pengumuman pengelola berlaku",
      ],
    ],
    "facility-parking": [
      "Parkir",
      "Alokasi parkir penghuni",
      [
        "Akses kendaraan sesuai kamar",
        "Peraturan parkir tertera",
        "Perubahan data kendaraan melalui pengelola",
      ],
    ],
  });
  function detail(key) {
    const d = detailData[key];
    if (!d) return;
    document.getElementById("ksDetailTitle").textContent = d[0];
    document.getElementById("ksDetailText").textContent = d[1];
    document.getElementById("ksDetailPoints").innerHTML = d[2]
      .map((x) => '<div class="ks-detail-point">' + x + "</div>")
      .join("");
    if (typeof dlg.showModal === "function") dlg.showModal();
  }
  document
    .getElementById("ksDetailClose")
    ?.addEventListener("click", () => dlg.close());
  dlg?.addEventListener("click", (e) => {
    if (e.target === dlg) dlg.close();
  });
  const badge = (s, kind = "") => `<span class="ks-label ${kind}">${s}</span>`;
  const button = (title, subtitle, key, tag = "Buka") =>
    `<button class="ks-line" data-ks-detail="${key}"><span><b>${title}</b><small>${subtitle}</small></span><span class="ks-go">${tag}</span></button>`;
  const stat = (label, value, sub = "") =>
    `<div class="ks-stat"><small>${label}</small><strong>${value}</strong><em>${sub}</em></div>`;
  const panel = (title, content, desc = "") =>
    `<div class="ks-panel"><h4>${title}</h4>${desc ? `<p>${desc}</p>` : ""}${content}</div>`;
  const room = (id, name, status, kind) =>
    `<button class="ks-room" data-ks-detail="room-${id}"><strong>${id}</strong><small>${name}</small>${badge(status, kind)}</button>`;
  const rows = (arr) =>
    `<div class="ks-tbl"><div class="ks-tblhead"><span>Nama</span><span>Informasi</span><span>Status</span><span>Detail</span></div>${arr.map((a) => `<button class="ks-tblrow" data-ks-detail="${a[3]}"><b>${a[0]}</b><span>${a[1]}</span><span>${a[2]}</span><span class="ks-go">Lihat →</span></button>`).join("")}</div>`;
  function overview() {
    return `
    <div class="ks-stats">${stat("Pembayaran diterima", "Rp52,2 jt", "29 tagihan tercatat")}${stat("Belum tertagih", "Rp5,4 jt", "3 tagihan perlu ditindak")}${stat("Kamar terisi", "32 / 36", "Okupansi 89%")}${stat("Surplus kas", "Rp36,8 jt", "Setelah biaya tercatat")}</div>
    <div class="ks-columns"><div class="ks-hero-card"><img src="${KAMELO_IMAGES.im1}" alt="Properti kos modern"><div class="ks-hero-copy"><small>Kos Melati Signature · Jakarta</small><strong>Operasional properti lebih terkendali.</strong><span>Kamar, penghuni, keuangan, dan pekerjaan tersusun rapi.</span></div></div>${panel("Prioritas hari ini", `<div class="ks-lines">${button("Tagihan Andi Pratama", "Rp1.800.000 · perlu ditagih", "invoice-andi", "Tinjau")}${button("Kontrak A-12 berakhir", "Perlu ditinjau untuk perpanjangan", "contract-a12", "Tinjau")}${button("Perbaikan AC", "Tugas teknisi menunggu penanganan", "task-ac", "Buka")}</div>`, "Pekerjaan yang perlu perhatian pengelola")}</div>
    <div class="ks-grid2 ks-gap">${panel("Penerimaan & tunggakan", `<div class="ks-bars">${[42, 50, 58, 53, 66, 79].map((n, i) => `<div class="ks-barcol"><div class="ks-barpair"><i class="ks-bar" style="height:${n}%"></i><i class="ks-bar alt" style="height:${Math.max(16, 80 - n)}%"></i></div><small>${["Mei", "Jun", "Jul", "Agu", "Sep", "Okt"][i]}</small></div>`).join("")}</div>`, "Ringkasan enam bulan")}${panel("ELENIO Intelligence", `<div class="ks-lines">${button("Aktivitas koridor perlu review", "Temuan dari CCTV area bersama", "alert-corridor", "Tinjau")}${button("Smart Room A-12", "Perangkat dapat dipantau pengelola", "smart-ac", "Lihat")}</div>`, "Temuan yang terkait operasional")}</div>`;
  }
  function rooms() {
    return `<div class="ks-stats">${stat("Total kamar", "36", "2 gedung")}${stat("Terisi", "32", "89% okupansi")}${stat("Kosong", "4", "2 siap huni")}${stat("Perlu tindakan", "2", "Pembersihan & perbaikan")}</div>${panel("Inventaris kamar", `<div class="ks-roomgrid">${room("A12", "Andi Pratama", "Terisi")}${room("B07", "Siti Rahmawati", "Terisi")}${room("B17", "Menunggu pembersihan", "Perlu dibersihkan", "warn")}${room("C03", "Tersedia", "Siap huni")}${room("B09", "Rina Permata", "Terisi")}${room("C11", "Menunggu pemeriksaan", "Perlu dicek", "warn")}</div>`, "Pilih kamar untuk melihat data penghuni dan status operasional")}`;
  }
  function billing() {
    const arr = [
      ["Andi Pratama", "Rp1.800.000 · 25 Okt", "Belum bayar", "invoice-andi"],
      [
        "Siti Rahmawati",
        "Rp1.800.000 · 25 Okt",
        "Perlu verifikasi",
        "invoice-siti",
      ],
      ["Kamar B-07", "Rp1.800.000 · Sep", "Lunas", "invoice-siti"],
    ];
    const list =
      billingFilter === "pending" ? arr.filter((a) => a[2] !== "Lunas") : arr;
    return `<div class="ks-stats">${stat("Tagihan bulan ini", "Rp57,6 jt", "32 invoice")}${stat("Sudah dibayar", "Rp52,2 jt", "29 invoice")}${stat("Belum dibayar", "Rp3,6 jt", "2 invoice")}${stat("Perlu verifikasi", "Rp1,8 jt", "1 transfer")}</div><div class="ks-app-top"><div><strong style="color:#1e4933;font-size:15px">Daftar pembayaran</strong><p style="font-size:12px;margin:4px 0 0">Pantau status yang perlu ditindaklanjuti.</p></div><div class="ks-app-top-actions"><button class="ks-mini-btn" data-ks-filter="all">Semua</button><button class="ks-mini-btn" data-ks-filter="pending">Perlu tindakan</button></div></div>${rows(list)}`;
  }
  function contracts() {
    return `<div class="ks-stats">${stat("Kontrak aktif", "32", "Sesuai masa tinggal")}${stat("Segera berakhir", "3", "Perlu ditinjau")}${stat("Deposit tercatat", "Rp26 jt", "Dikelola per kontrak")}${stat("Perpanjangan", "2", "Permintaan berjalan")}</div>${panel(
      "Masa tinggal dan deposit",
      rows([
        ["Andi Pratama", "Kamar A-12", "25 Okt 2026", "contract-a12"],
        ["Siti Rahmawati", "Kamar B-07", "31 Jul 2027", "contract-b07"],
        [
          "A-12 — Renewal",
          "Menunggu pengajuan",
          "Perlu review",
          "contract-a12",
        ],
      ]),
      "Semua perubahan tercatat dalam riwayat kontrak",
    )}`;
  }
  function cctv() {
    return `<div class="ks-stats">${stat("Kamera area bersama", "4", "Lobby, parkir & koridor")}${stat("AI event", "7", "Perlu pemeriksaan")}${stat("Pengunjung lobby", "18", "Tercatat hari ini")}${stat("Kamera perlu cek", "1", "Kualitas jaringan")}</div><div class="ks-grid2"><div class="ks-camera"><img src="${KAMELO_IMAGES.im5}" alt="Kamera area lobby dengan marker analitik"><span>Lobby · Video Analytics</span></div><div class="ks-camera"><img src="${KAMELO_IMAGES.im6}" alt="Kamera parkir dengan marker analitik"><span>Parkir · Video Analytics</span></div></div><div class="ks-grid2 ks-gap">${panel("Temuan video analytics", `<div class="ks-lines">${button("Aktivitas koridor", "Perlu pemeriksaan petugas", "alert-corridor", "Tinjau")}${button("Aktivitas parkir", "Perlu validasi pengelola", "alert-parking", "Tinjau")}</div>`)}${panel("Insight area bersama", `<div class="ks-activity"><div class="ks-activity-row"><strong>18 tamu berkunjung</strong>Pemantauan arus kunjungan area lobby</div><div class="ks-activity-row"><strong>1 kejadian perlu review</strong>Verifikasi oleh petugas keamanan</div><div class="ks-activity-row"><strong>Status kamera</strong>Pemeriksaan konektivitas berkala</div></div>`)}</div>`;
  }
  function smart() {
    return `<div class="ks-stats">${stat("Perangkat terhubung", "18", "Pada kamar berizin")}${stat("Smart lock", "6", "Status online")}${stat("Otomasi aktif", "4", "Sesuai aturan")}${stat("Perlu pengecekan", "1", "Kamera/gateway")}</div><div class="ks-columns">${panel("Smart Room A-12", `<div class="ks-device"><div><strong>AC</strong><br><small>24°C · cooling</small></div><button class="ks-mini-btn" data-ks-detail="smart-ac">Detail →</button></div><div class="ks-device"><div><strong>Lighting</strong><br><small>Lampu utama</small></div><span class="ks-on">Aktif</span></div><div class="ks-device"><div><strong>Digital lock</strong><br><small>Akses sesuai kontrak</small></div><button class="ks-mini-btn" data-ks-detail="room-key">Akses →</button></div>`, "Kontrol mengikuti izin dan konektivitas perangkat")}<div class="ks-hero-card"><img src="${KAMELO_IMAGES.im8}" alt="Kamar dengan smart lock dan perangkat terhubung"><div class="ks-hero-copy"><small>Smart Room by ELENIO</small><strong>Kamar nyaman, operasional tertata.</strong><span>Kelola perangkat yang terhubung dalam satu aplikasi.</span></div></div></div>`;
  }
  function tasks() {
    return `<div class="ks-stats">${stat("Tugas hari ini", "11", "Dari pengelola")}${stat("Sedang berjalan", "4", "Dikerjakan tim")}${stat("Prioritas tinggi", "2", "Perlu perhatian")}${stat("Selesai", "5", "Sudah ditutup")}</div>${panel("Daftar tugas hari ini", `<div class="ks-lines">${button("Perbaikan AC · A-12", "Prioritas tinggi · Agus", "task-ac", "Buka")}${button("Pembersihan kamar · B-17", "Menunggu housekeeping", "task-clean", "Buka")}${button("Keran kamar B-02", "Dalam pengerjaan", "task-pipe", "Buka")}</div>`, "Setiap pekerjaan memiliki penanggung jawab dan status")}<div class="ks-grid2 ks-gap">${panel("Jadwal hari ini", '<div class="ks-activity"><div class="ks-activity-row"><strong>09.00 · Pemeriksaan AC</strong>Kamar A-12</div><div class="ks-activity-row"><strong>11.00 · Housekeeping</strong>Kamar B-17</div><div class="ks-activity-row"><strong>14.00 · Pemeriksaan ulang</strong>Kamar B-02</div></div>')}${panel("Catatan pengelola", '<div class="ks-lines">' + button("Area parkir", "Mohon ditinjau sebelum malam", "alert-parking", "Buka") + button("Koridor lantai 2", "Pemeriksaan kamera diperlukan", "alert-corridor", "Buka") + "</div>")}</div>`;
  }
  function readiness() {
    return `<div class="ks-stats">${stat("Kamar siap", "4", "Sudah diverifikasi")}${stat("Cleaning", "2", "Sedang dikerjakan")}${stat("Maintenance", "1", "Menunggu teknisi")}${stat("Check-in", "3", "Jadwal hari ini")}</div>${panel("Kesiapan kamar", `<div class="ks-roomgrid">${room("C03", "Siap untuk penghuni baru", "Siap huni")}${room("B17", "Jadwal pembersihan", "Cleaning", "warn")}${room("A12", "Perbaikan AC berjalan", "Maintenance", "warn")}${room("B07", "Sudah ditempati", "Terisi")}</div>`, "Pilih kamar untuk melihat informasi statusnya")}`;
  }
  function alerts() {
    return `<div class="ks-stats">${stat("Insiden terbuka", "3", "Perlu tindak lanjut")}${stat("Ditugaskan", "2", "Staf bertanggung jawab")}${stat("Selesai", "6", "Sudah diverifikasi")}${stat("Prioritas tinggi", "1", "Tindak cepat")}</div>${panel("Antrean insiden", `<div class="ks-lines">${button("Aktivitas tidak biasa di koridor", "Temuan CCTV · perlu pemeriksaan", "alert-corridor", "Tinjau")}${button("Keluhan AC penghuni", "Kamar A-12 · ditugaskan", "task-ac", "Buka")}${button("Area parkir", "Perlu validasi petugas", "alert-parking", "Tinjau")}</div>`, "Setiap insiden dilengkapi status dan penanggung jawab")}`;
  }
  function messages() {
    return `<div class="ks-stats">${stat("Pesan baru", "3", "Belum ditanggapi")}${stat("Tiket terkait", "2", "Perlu pekerjaan")}${stat("Informasi properti", "4", "Pengumuman berjalan")}${stat("Balasan selesai", "12", "Riwayat tersimpan")}</div>${panel("Kotak masuk staf", `<div class="ks-lines">${button("Andi Pratama", "AC kamar A-12 kurang dingin", "message-and", "Baca")}${button("Siti Rahmawati", "Pengiriman bukti pembayaran", "message-siti", "Baca")}${button("Pengelola", "Jadwal pembersihan kamar B-17", "task-clean", "Buka")}</div>`, "Balasan dan tindakan mengikuti penugasan")}`;
  }
  function home() {
    return `<div class="ks-columns"><div class="ks-hero-card"><img src="${KAMELO_IMAGES.im8}" alt="Kamar penghuni"><div class="ks-hero-copy"><small>Kos Melati Signature</small><strong>Selamat datang, Andi.</strong><span>Kamar A-12 · Masa tinggal aktif</span></div></div>${panel("Tagihan berikutnya", `<div style="font-size:27px;font-weight:800;color:#123d31;margin:12px 0 3px">Rp1.800.000</div><p>Jatuh tempo 25 Oktober 2026</p><div style="margin-top:18px"><button class="ks-mini-btn" data-ks-detail="invoice-andi">Lihat rincian →</button></div>`, "Sewa Oktober 2026")}</div><div class="ks-grid3 ks-gap">${panel("Kamar Saya", `<div style="margin-top:12px"><button class="ks-mini-btn" data-ks-module="myroom">Buka informasi kamar →</button></div>`, "Akses dan perangkat kamar")}${panel("Layanan Penghuni", `<div style="margin-top:12px"><button class="ks-mini-btn" data-ks-module="services">Lihat permintaan →</button></div>`, "Status bantuan dan perbaikan")}${panel("Pengumuman", `<p style="margin-top:12px">Pemeriksaan area umum dijadwalkan Jumat pukul 09.00.</p>`, "Informasi pengelola")}</div>`;
  }
  function invoices() {
    return `<div class="ks-stats">${stat("Tagihan berikutnya", "Rp1,8 jt", "25 Oktober 2026")}${stat("Sudah dibayar", "Rp3,6 jt", "Riwayat dua bulan")}${stat("Bukti pembayaran", "0", "Menunggu kiriman")}${stat("Status akun", "Aktif", "Kamar A-12")}</div>${panel(
      "Tagihan saya",
      rows([
        ["Sewa Oktober 2026", "Rp1.800.000", "Belum dibayar", "invoice-andi"],
        ["Sewa September 2026", "Rp1.800.000", "Lunas", "invoice-andi"],
        ["Sewa Agustus 2026", "Rp1.800.000", "Lunas", "invoice-andi"],
      ]),
      "Pilih tagihan untuk melihat rinciannya",
    )}`;
  }
  function services() {
    return `<div class="ks-stats">${stat("Permintaan aktif", "1", "Sedang ditangani")}${stat("Selesai", "3", "Riwayat layanan")}${stat("Informasi baru", "1", "Pengumuman")}${stat("Kamar", "A-12", "Masa tinggal aktif")}</div>${panel("Layanan & bantuan", `<div class="ks-lines">${button("AC kamar kurang dingin", "Permintaan sudah diteruskan", "service-ac", "Lacak")}${button("Bantuan Wi-Fi", "Panduan layanan penghuni", "service-wifi", "Buka")}${button("Jadwal housekeeping", "Informasi layanan kamar", "task-clean", "Lihat")}</div>`, "Semua permintaan tersimpan dan dapat dipantau")}`;
  }
  function myroom() {
    return `<div class="ks-columns"><div class="ks-hero-card"><img src="${KAMELO_IMAGES.im8}" alt="Interior kamar modern"><div class="ks-hero-copy"><small>Kos Melati Signature</small><strong>Kamar A-12</strong><span>Masa tinggal hingga 25 Oktober 2026</span></div></div>${panel("Perangkat kamar", `<div class="ks-device"><div><strong>AC</strong><br><small>Setelan 24°C</small></div><button class="ks-mini-btn" data-ks-detail="smart-ac">Lihat →</button></div><div class="ks-device"><div><strong>Lampu</strong><br><small>Perangkat tersedia</small></div><button class="ks-mini-btn" data-ks-detail="smart-light">Lihat →</button></div><div class="ks-device"><div><strong>Akses pintu</strong><br><small>Izin kamar A-12</small></div><button class="ks-mini-btn" data-ks-detail="room-key">Akses →</button></div>`, "Perangkat mengikuti fasilitas kamar dan izin penghuni")}</div>`;
  }

  // Additional, role-specific workspaces in the product tour.
  function customers() {
    return `<div class="ks-stats">${stat("Penghuni aktif", "32", "27 profil utama")}${stat("Menunggu aktivasi", "3", "Undangan akun")}${stat("Kontrak selesai", "11", "Riwayat tersimpan")}${stat("Perlu follow-up", "2", "Data belum lengkap")}</div><div class="ks-grid2">${panel("Database penghuni", `<div class="ks-lines">${button("Andi Pratama · A-12", "Kontrak berakhir 25 Oktober", "contract-a12", "Profil")}${button("Siti Rahmawati · B-07", "Pembayaran menunggu verifikasi", "invoice-siti", "Profil")}${button("Rina Permata · B-09", "Penghuni aktif · kontrak tahunan", "customer-rina", "Profil")}${button("Dimas Putra · C-01", "Data kontak baru diperbarui", "customer-dimas", "Profil")}</div>`, "Riwayat orang tetap tersimpan saat pindah kamar")}${panel("Tindakan pelanggan", `<div class="ks-lines">${button("Undangan akun Andi", "Belum mengaktifkan akses portal", "invite-andi", "Tinjau")}${button("Perpanjangan A-12", "Kontrak mendekati akhir", "contract-a12", "Tinjau")}${button("Pembaruan profil", "2 nomor kontak perlu konfirmasi", "customer-update", "Lihat")}</div>`, "Satu orang, satu profil pelanggan")}</div>${panel(
      "Riwayat masa tinggal",
      rows([
        ["Andi Pratama", "A-12 · 6 bulan", "Aktif", "contract-a12"],
        ["Siti Rahmawati", "B-07 · 3 bulan", "Aktif", "contract-b07"],
        ["Rina Permata", "B-09 · 12 bulan", "Aktif", "customer-rina"],
      ]),
      "Data pelanggan terhubung ke kamar, kontrak dan tagihan",
    )}`;
  }
  function leads() {
    return `<div class="ks-stats">${stat("Prospek baru", "8", "30 hari terakhir")}${stat("Jadwal survei", "3", "Minggu ini")}${stat("Negosiasi", "2", "Penawaran berjalan")}${stat("Kamar tersedia", "4", "Dapat ditawarkan")}</div><div class="ks-grid2">${panel("Pipeline prospek", `<div class="ks-lines">${button("Nadia Putri", "Minat kamar C-03 · jadwal survei", "lead-nadia", "Buka")}${button("Reza Akbar", "Menunggu penawaran sewa", "lead-reza", "Buka")}${button("Putri Rani", "Meminta detail fasilitas B-17", "lead-putri", "Buka")}</div>`, "Prospek tersusun menurut tindak lanjut")}${panel("Jadwal kunjungan", `<div class="ks-activity"><div class="ks-activity-row"><strong>Senin · 10.00</strong>Survei kamar C-03 — Nadia</div><div class="ks-activity-row"><strong>Selasa · 14.30</strong>Survei guest house — Reza</div><div class="ks-activity-row"><strong>Rabu · 11.00</strong>Diskusi fasilitas — Putri</div></div>`)}</div>${panel("Unit yang dapat ditawarkan", `<div class="ks-roomgrid">${room("C03", "Siap huni", "Tersedia")}${room("B17", "Menunggu cleaning", "Persiapan", "warn")}${room("C11", "Perlu inspeksi", "Persiapan", "warn")}</div>`)}`;
  }
  function work() {
    return `<div class="ks-stats">${stat("Tugas terbuka", "7", "Perlu ditangani")}${stat("Sedang dikerjakan", "4", "Tim bertugas")}${stat("Prioritas tinggi", "2", "Hari ini")}${stat("Selesai", "16", "Bulan berjalan")}</div><div class="ks-grid2">${panel("Pekerjaan prioritas", `<div class="ks-lines">${button("Perbaikan AC A-12", "Agus · Prioritas tinggi", "task-ac", "Buka")}${button("Pembersihan B-17", "Rina · Proses cleaning", "task-clean", "Buka")}${button("Keran B-02 bocor", "Deni · Dalam pengerjaan", "task-pipe", "Buka")}${button("Periksa koridor A2", "Security · Menunggu verifikasi", "alert-corridor", "Buka")}</div>`)}${panel("Distribusi pekerjaan", `<div class="ks-activity"><div class="ks-activity-row"><strong>Maintenance · 4 tugas</strong>Perbaikan AC, lampu dan air</div><div class="ks-activity-row"><strong>Housekeeping · 5 tugas</strong>Pembersihan kamar dan area umum</div><div class="ks-activity-row"><strong>Security · 2 tugas</strong>Review CCTV dan pemeriksaan area</div></div>`)}</div>${panel("Kesiapan kamar", `<div class="ks-roomgrid">${room("B17", "Cleaning", "Dalam proses", "warn")}${room("C03", "Sudah dicek", "Siap huni")}${room("A12", "Perbaikan AC", "Maintenance", "warn")}</div>`)}`;
  }
  function inbox() {
    return `<div class="ks-stats">${stat("Pesan baru", "5", "Butuh balasan")}${stat("Komplain aktif", "2", "Tiket berjalan")}${stat("Informasi umum", "3", "Pengumuman")}${stat("Sudah dibalas", "24", "Minggu ini")}</div><div class="ks-grid2">${panel("Percakapan penghuni", `<div class="ks-lines">${button("Andi Pratama", "AC A-12 kurang dingin", "message-and", "Baca")}${button("Siti Rahmawati", "Konfirmasi pembayaran sewa", "message-siti", "Baca")}${button("Rina Permata", "Permintaan akses laundry", "message-rina", "Baca")}${button("Pengelola", "Jadwal perawatan lift", "notice-lift", "Baca")}</div>`)}${panel("Butuh keputusan", `<div class="ks-lines">${button("Komplain AC", "Tiket ditugaskan ke teknisi", "service-ac", "Tinjau")}${button("Bukti transfer", "Pemeriksaan pembayaran", "invoice-siti", "Tinjau")}${button("Pengumuman akhir pekan", "Perlu persetujuan pengelola", "notice-lift", "Tinjau")}</div>`)}</div>`;
  }
  function visitors() {
    return `<div class="ks-stats">${stat("Tamu hari ini", "18", "Area penerimaan")}${stat("Paket diterima", "6", "4 telah diambil")}${stat("Menunggu diambil", "2", "Perlu notifikasi")}${stat("Kunjungan terjadwal", "3", "Besok")}</div><div class="ks-grid2">${panel("Aktivitas hari ini", `<div class="ks-lines">${button("Paket atas nama Andi", "Paket diterima 10.40 · resepsionis", "package-andi", "Detail")}${button("Kunjungan Siti", "Tamu check-in 12.15 · lobby", "visitor-siti", "Detail")}${button("Paket untuk Rina", "Belum diambil · meja front desk", "package-rina", "Detail")}</div>`)}${panel("Informasi front desk", `<div class="ks-activity"><div class="ks-activity-row"><strong>09.10 · Kurir tiba</strong>2 paket tercatat</div><div class="ks-activity-row"><strong>12.15 · Kunjungan</strong>Tamu Siti terkonfirmasi</div><div class="ks-activity-row"><strong>16.00 · Pengambilan paket</strong>Penghuni B-09 terjadwal</div></div>`)}</div>`;
  }
  function leo() {
    return `<div class="ks-stats">${stat("Perlu tindakan", "5", "Prioritas hari ini")}${stat("CCTV review", "2", "Menunggu validasi")}${stat("Tagihan", "3", "Perlu ditagih")}${stat("Perangkat", "1", "Perlu pengecekan")}</div><div class="ks-columns"><div class="ks-hero-card"><img src="${KAMELO_IMAGES.im1}" alt="Properti Kos Melati"><div class="ks-hero-copy"><small>LEO · Operational Brief</small><strong>Prioritas operasional dalam satu ringkasan.</strong><span>Tagihan, tugas, CCTV, dan perangkat.</span></div></div>${panel("Ringkasan hari ini", `<div class="ks-lines">${button("3 tagihan menunggu penagihan", "Total Rp5.400.000", "invoice-andi", "Tinjau")}${button("2 CCTV alert belum diverifikasi", "Koridor dan parkir", "alert-corridor", "Tinjau")}${button("AC kamar A-12 perlu tindak lanjut", "Teknisi ditugaskan", "task-ac", "Tinjau")}</div>`)}</div><div class="ks-grid2 ks-gap">${panel("Topik paling relevan", `<div class="ks-lines">${button("Kamar kosong minggu ini", "2 unit siap ditawarkan", "room-C03", "Lihat")}${button("Perpanjangan kontrak", "A-12 mendekati jatuh tempo", "contract-a12", "Lihat")}</div>`)}${panel("Sumber data", `<div class="ks-activity"><div class="ks-activity-row"><strong>Keuangan</strong>Tagihan dan status pembayaran</div><div class="ks-activity-row"><strong>CCTV & AI</strong>Event area bersama yang perlu validasi</div><div class="ks-activity-row"><strong>IoT</strong>Kondisi perangkat yang terhubung</div></div>`)}</div>`;
  }
  function finance() {
    return `<div class="ks-stats">${stat("Penerimaan", "Rp52,2 jt", "Bulan ini")}${stat("Biaya tercatat", "Rp15,4 jt", "Operasional")}${stat("Surplus kas", "Rp36,8 jt", "Setelah biaya")}${stat("Belum tertagih", "Rp5,4 jt", "Perlu ditindak")}</div><div class="ks-grid2">${panel("Arus kas 6 bulan", `<div class="ks-bars">${[39, 48, 55, 61, 68, 81].map((n, i) => `<div class="ks-barcol"><div class="ks-barpair"><i class="ks-bar" style="height:${n}%"></i><i class="ks-bar alt" style="height:${Math.max(20, n * 0.45)}%"></i></div><small>${["Mei", "Jun", "Jul", "Agu", "Sep", "Okt"][i]}</small></div>`).join("")}</div>`, "Penerimaan dan biaya")}${panel("Pengeluaran terakhir", `<div class="ks-lines">${button("Tagihan listrik", "Rp4.200.000 · Oktober", "finance-power", "Detail")}${button("Maintenance AC", "Rp780.000 · Oktober", "finance-ac", "Detail")}${button("Perlengkapan kamar", "Rp1.250.000 · Oktober", "finance-room", "Detail")}</div>`)}</div>${panel(
      "Rekonsiliasi",
      rows([
        ["Transfer sewa", "Rp1.800.000", "Menunggu verifikasi", "invoice-siti"],
        ["Operasional listrik", "Rp4.200.000", "Tercatat", "finance-power"],
        ["Biaya perawatan", "Rp780.000", "Tercatat", "finance-ac"],
      ]),
    )}`;
  }
  function team() {
    return `<div class="ks-stats">${stat("Pengguna aktif", "5", "Akses properti")}${stat("Undangan terkirim", "2", "Menunggu aktivasi")}${stat("Manager", "1", "Hak akses operasional")}${stat("Staf", "3", "Akses sesuai tugas")}</div><div class="ks-grid2">${panel("Tim pengelola", `<div class="ks-lines">${button("Budi Santoso", "Owner · Semua properti", "team-budi", "Detail")}${button("Agus Haryanto", "Maintenance · Gedung A", "team-agus", "Detail")}${button("Rina Lestari", "Housekeeping · Gedung B", "team-rina", "Detail")}${button("Deni Saputra", "Security · Area bersama", "team-deni", "Detail")}</div>`)}${panel("Undangan & akses", `<div class="ks-lines">${button("Undangan admin keuangan", "Menunggu aktivasi", "team-invite", "Tinjau")}${button("Akses staf kontrak", "Pembatasan properti tersedia", "team-policy", "Lihat")}${button("Audit perubahan izin", "Catatan perubahan anggota", "team-audit", "Lihat")}</div>`)}</div>`;
  }
  function shift() {
    return `<div class="ks-stats">${stat("Shift hari ini", "Pagi", "08.00–16.00")}${stat("Tim hadir", "4", "Dari 5 staf")}${stat("Tugas aktif", "7", "Dalam penugasan")}${stat("Handover", "2", "Perlu konfirmasi")}</div><div class="ks-grid2">${panel("Tim bertugas", `<div class="ks-lines">${button("Agus · Maintenance", "08.00–16.00 · Gedung A", "team-agus", "Detail")}${button("Rina · Housekeeping", "08.00–16.00 · Gedung B", "team-rina", "Detail")}${button("Deni · Security", "14.00–22.00 · Area umum", "team-deni", "Detail")}</div>`)}${panel("Catatan handover", `<div class="ks-lines">${button("Perbaikan AC A-12", "Menunggu inspeksi akhir", "task-ac", "Lihat")}${button("B-17 siap cleaning", "Shift sore mengambil alih", "task-clean", "Lihat")}</div>`)}</div>`;
  }
  function frontdesk() {
    return `<div class="ks-stats">${stat("Check-in tamu", "3", "Hari ini")}${stat("Paket baru", "6", "2 belum diambil")}${stat("Konfirmasi akses", "2", "Perlu pemeriksaan")}${stat("Pengumuman", "1", "Untuk penghuni")}</div><div class="ks-grid2">${panel("Daftar kunjungan", `<div class="ks-lines">${button("Tamu Siti · Lobby", "Tiba 12.15", "visitor-siti", "Lihat")}${button("Kurir untuk Andi", "Paket di front desk", "package-andi", "Lihat")}${button("Pengambilan paket Rina", "Terjadwal 16.00", "package-rina", "Lihat")}</div>`)}${panel("Tugas resepsionis", `<div class="ks-lines">${button("Verifikasi paket", "2 menunggu konfirmasi", "package-rina", "Buka")}${button("Cek kesiapan B-17", "Jadwal check-in sore", "task-clean", "Buka")}</div>`)}</div>`;
  }
  function maintenance() {
    return `<div class="ks-stats">${stat("Pekerjaan aktif", "4", "Prioritas saat ini")}${stat("Perlu sparepart", "1", "Pengadaan")}${stat("Selesai", "9", "Bulan ini")}${stat("Verifikasi", "2", "Perlu pemeriksaan")}</div><div class="ks-grid2">${panel("Daftar perbaikan", `<div class="ks-lines">${button("AC A-12 kurang dingin", "Agus · Prioritas tinggi", "task-ac", "Buka")}${button("Keran B-02 bocor", "Deni · Dalam proses", "task-pipe", "Buka")}${button("Lampu koridor lantai 2", "Menunggu penggantian", "maintenance-light", "Buka")}</div>`)}${panel("Riwayat pekerjaan", `<div class="ks-activity"><div class="ks-activity-row"><strong>09.10 · AC diperiksa</strong>Kamar A-12</div><div class="ks-activity-row"><strong>10.30 · Sparepart dicatat</strong>Keran B-02</div><div class="ks-activity-row"><strong>13.00 · Inspeksi ulang</strong>Kamar B-17</div></div>`)}</div>`;
  }
  function access() {
    return `<div class="ks-stats">${stat("Kamar", "A-12", "Status tinggal aktif")}${stat("Akses digital", "Aktif", "Sesuai kontrak")}${stat("Wi-Fi", "Tersedia", "Kos Melati Guest")}${stat("Berlaku sampai", "25 Okt", "Masa tinggal")}</div><div class="ks-grid2">${panel("Akses kamar", `<div class="ks-lines">${button("Digital key A-12", "Hanya untuk penghuni berizin", "room-key", "Lihat")}${button("Riwayat akses", "Terikat masa tinggal", "access-history", "Buka")}${button("Panduan pintu", "Cara menggunakan kunci digital", "access-guide", "Buka")}</div>`)}${panel("Internet & bantuan", `<div class="ks-lines">${button("Jaringan Wi-Fi", "Kos Melati Guest", "service-wifi", "Lihat")}${button("Bantuan koneksi", "Hubungi tim pengelola", "service-wifi", "Buka")}${button("Petunjuk area umum", "Panduan fasilitas gedung", "facility-guide", "Buka")}</div>`)}</div>`;
  }
  function facilities() {
    return `<div class="ks-stats">${stat("Fasilitas", "4", "Dapat digunakan")}${stat("Reservasi saya", "1", "Laundry hari ini")}${stat("Slot tersedia", "3", "Hari ini")}${stat("Pengumuman", "1", "Area umum")}</div><div class="ks-grid2">${panel("Fasilitas bersama", `<div class="ks-lines">${button("Laundry", "Slot 19.00 tersedia", "facility-laundry", "Detail")}${button("Ruang belajar", "Tersedia 18.00–20.00", "facility-study", "Detail")}${button("Ruang tamu", "Perlu jadwal kunjungan", "facility-lounge", "Detail")}${button("Parkir", "Sesuai alokasi kamar", "facility-parking", "Detail")}</div>`)}${panel("Reservasi & jadwal", `<div class="ks-activity"><div class="ks-activity-row"><strong>Hari ini · 19.00</strong>Laundry · Booking Andi</div><div class="ks-activity-row"><strong>Besok · 18.00</strong>Ruang belajar tersedia</div><div class="ks-activity-row"><strong>Sabtu · 10.00</strong>Pembersihan area umum</div></div>`)}</div>`;
  }
  function tenantmessages() {
    return `<div class="ks-stats">${stat("Pesan baru", "1", "Dari pengelola")}${stat("Permintaan aktif", "1", "Dalam penanganan")}${stat("Pengumuman", "2", "Belum dibaca")}${stat("Riwayat", "12", "Percakapan tersimpan")}</div><div class="ks-grid2">${panel("Pesan saya", `<div class="ks-lines">${button("Pengelola Kos Melati", "Jadwal servis AC kamar A-12", "service-ac", "Baca")}${button("Front desk", "Paket Anda sudah tersedia", "package-andi", "Baca")}${button("Informasi Gedung", "Jadwal perawatan lift", "notice-lift", "Baca")}</div>`)}${panel("Status bantuan", `<div class="ks-lines">${button("Perbaikan AC kamar", "Petugas dijadwalkan", "service-ac", "Lacak")}${button("Informasi Wi-Fi", "Panduan jaringan tersedia", "service-wifi", "Buka")}</div>`)}</div>`;
  }
  const screens = {
    overview,
    rooms,
    customers,
    leads,
    contracts,
    billing,
    work,
    inbox,
    visitors,
    cctv,
    smart,
    leo,
    finance,
    team,
    tasks,
    readiness,
    alerts,
    messages,
    shift,
    frontdesk,
    maintenance,
    home,
    invoices,
    services,
    myroom,
    access,
    facilities,
    tenantmessages,
  };
  function render() {
    const available = modules[activeRole];
    const active = available.find((m) => m[0] === activeModule) || available[0];
    document.querySelectorAll("[data-ks-role]").forEach((el) => {
      const on = el.dataset.ksRole === activeRole;
      el.classList.toggle("active", on);
      el.setAttribute("aria-selected", String(on));
    });
    const primary = available.filter((m) =>
      topModules[activeRole].includes(m[0]),
    );
    bar.innerHTML = primary
      .map(
        (m, i) =>
          `<button class="ks-module ${m[0] === activeModule ? "active" : ""}" type="button" role="tab" aria-selected="${m[0] === activeModule}" data-ks-module="${m[0]}"><span class="ks-num">${String(i + 1).padStart(2, "0")}</span> ${m[1]}</button>`,
      )
      .join("");
    document.getElementById("ksEyebrow").textContent =
      labels[activeRole].toUpperCase() + " · " + active[1].toUpperCase();
    document.getElementById("ksHeading").textContent = active[2];
    document.getElementById("ksSubheading").textContent = active[3];
    const image = KAMELO_IMAGES.im0;
    const nav = available
      .map(
        (m, i) =>
          `<button type="button" data-ks-module="${m[0]}" class="${m[0] === activeModule ? "active" : ""}"><span class="ks-nav-icon">${["⌂", "▦", "◈", "◇", "▤", "▧", "✓", "✉", "▣", "◉", "⚡", "✦", "▥", "♧"][i % 14]}</span>${m[1]}</button>`,
      )
      .join("");
    const asideFoot =
      activeRole === "owner"
        ? "<strong>Kos Melati Signature</strong><span>36 kamar · 2 gedung</span>"
        : activeRole === "staff"
          ? "<strong>Shift aktif</strong><span>08.00–16.00 · 7 pekerjaan</span>"
          : "<strong>Kamar A-12</strong><span>Masa tinggal aktif</span>";
    app.innerHTML = `<div class="ks-aside"><div class="ks-aside-brand"><img src="${image}" alt="Kamelo by ELENIO"></div><div class="ks-aside-kicker">${labels[activeRole]} · ${activeRole === "tenant" ? "Kamar A-12" : "Kos Melati Signature"}</div><div class="ks-aside-menu">${nav}</div><div class="ks-aside-foot">${asideFoot}</div></div><div class="ks-app-main"><div class="ks-app-top"><div class="ks-app-top-title">Kamelo / ${labels[activeRole]}<b>${active[1]}</b></div><div class="ks-app-top-actions"><span class="ks-chip">Kos Melati Signature</span><span class="ks-chip">${labels[activeRole]}</span></div></div>${screens[active[0]]()}</div>`;
    document.getElementById("ksSalesTag").textContent =
      labels[activeRole].toUpperCase() + " / " + active[1].toUpperCase();
    document.getElementById("ksSalesTitle").textContent = active[2];
    document.getElementById("ksSalesDesc").textContent = active[3];
    const benefitMap = {
      overview: [
        "Ringkasan bisnis dalam satu layar",
        "Data penghuni dan tagihan terhubung",
        "Prioritas pekerjaan terlihat jelas",
      ],
      rooms: [
        "Status kamar dan unit yang tersedia",
        "Penghuni dan riwayat masa tinggal",
        "Pekerjaan kamar lebih mudah ditinjau",
      ],
      cctv: [
        "Pemantauan kamera area bersama",
        "Temuan video analytics",
        "Tindak lanjut insiden operasional",
      ],
      smart: [
        "Kondisi perangkat kamar",
        "Akses sesuai izin penghuni",
        "Perintah dan otomasi perangkat",
      ],
    };
    const benefits =
      benefitMap[activeModule] ||
      (activeRole === "owner"
        ? [
            "Data operasional tersusun rapi",
            "Tindak lanjut lebih mudah dipantau",
            "Riwayat tersimpan per properti",
          ]
        : activeRole === "staff"
          ? [
              "Tugas sesuai penugasan",
              "Status dan prioritas pekerjaan",
              "Kolaborasi staf lebih teratur",
            ]
          : [
              "Informasi pribadi dan kamar",
              "Layanan serta status bantuan",
              "Akses sesuai masa tinggal",
            ]);
    document.getElementById("ksSalesChecks").innerHTML = benefits
      .map((t) => `<div><span class="ks-sales-tick">✓</span>${t}</div>`)
      .join("");
    const next =
      available[
        (available.findIndex((m) => m[0] === activeModule) + 1) %
          available.length
      ];
    document.getElementById("ksNextModule").innerHTML =
      next[1] + " <span>→</span>";
    document.getElementById("ksNextModule").dataset.ksNext = next[0];
  }
  function setRole(role) {
    if (!modules[role]) return;
    activeRole = role;
    activeModule = modules[role][0][0];
    billingFilter = "all";
    render();
  }
  document
    .querySelectorAll("[data-ks-role]")
    .forEach((btn) =>
      btn.addEventListener("click", () => setRole(btn.dataset.ksRole)),
    );
  document.getElementById("ksNextModule").addEventListener("click", (e) => {
    activeModule = e.currentTarget.dataset.ksNext;
    render();
  });
  bar.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-ks-module]");
    if (!btn) return;
    activeModule = btn.dataset.ksModule;
    billingFilter = "all";
    render();
  });
  app.addEventListener("click", (e) => {
    const btn = e.target.closest(
      "[data-ks-detail],[data-ks-module],[data-ks-filter]",
    );
    if (!btn) return;
    if (btn.dataset.ksModule) {
      activeModule = btn.dataset.ksModule;
      render();
      return;
    }
    if (btn.dataset.ksDetail) {
      detail(btn.dataset.ksDetail);
      return;
    }
    if (btn.dataset.ksFilter) {
      billingFilter = btn.dataset.ksFilter;
      render();
      return;
    }
  });
  render();
  // Existing CCTV marketing gallery, with value cards and no dashboard screenshot.
  const camMap = {
    lobby: {
      name: "Lobby · Area bersama",
      img: KAMELO_IMAGES.im5,
      caption:
        "Deteksi aktivitas area masuk dan area bersama membantu pengelola meninjau hal yang perlu diperhatikan lebih cepat.",
      metrics: [
        ["2", "Orang mencurigakan terdeteksi", "Perlu review oleh pengelola"],
        ["18", "Tamu berkunjung hari ini", "Traffic area lobby"],
        [
          "1",
          "Kejadian perlu tindak lanjut",
          "Terhubung ke alur kerja operasional",
        ],
      ],
    },
    parking: {
      name: "Parkir · Area bersama",
      img: KAMELO_IMAGES.im6,
      caption:
        "Pantau akses kendaraan dan aktivitas tidak biasa di area parkir properti dari tampilan yang lebih terstruktur.",
      metrics: [
        ["27", "Kendaraan tercatat hari ini", "Akses masuk dan keluar"],
        ["1", "Aktivitas mencurigakan", "Perlu verifikasi pengelola"],
        ["3", "Area parkir terisi", "Pemantauan kapasitas area"],
      ],
    },
  };
  function setCam(key) {
    const d = camMap[key];
    const main = document.getElementById("camMain");
    if (!main) return;
    main.src = d.img;
    main.alt = d.name;
    document.getElementById("camName").textContent = d.name;
    document.getElementById("camCaption").textContent = d.caption;
    ["1", "2", "3"].forEach((n, i) => {
      document.getElementById("camMetric" + n).textContent = d.metrics[i][0];
      document.getElementById("camMetricLabel" + n).textContent =
        d.metrics[i][1];
      document.getElementById("camMetricSub" + n).textContent = d.metrics[i][2];
    });
    document.querySelectorAll("[data-cam]").forEach((x) => {
      const on = x.dataset.cam === key;
      x.classList.toggle("active", on);
      x.setAttribute("aria-pressed", String(on));
    });
  }
  document
    .querySelectorAll("[data-cam]")
    .forEach((btn) =>
      btn.addEventListener("click", () => setCam(btn.dataset.cam)),
    );
  setCam("lobby");

  return () => {
    for (const args of listeners) window.removeEventListener(...args);
    root.innerHTML = initialMarkup;
  };
}
