# Kamelo — fungsi aplikasi dan dashboard

13 Oktober 2026. Kelanjutan repository existing, tanpa reset data, penggantian logo, foto, atau maskot. User mengonfirmasi layanan/perangkat eksternal belum tersedia.

## Implementasi

- Dashboard ELENIO navy/blue/white: empat KPI, pembanding pemasukan pada tanggal setara, grafik enam bulan, antrean prioritas, status kamar dengan lima warna, pelunasan dan tagihan terbaru. Semua angka akun berasal dari database; demo memakai fixture existing.
- Tampilan sekunder Kamar & penghuni / Pekerjaan & komplain, tetap lima modul utama. Tiket memiliki kategori, prioritas, penanggung jawab, status dan riwayat. Staf dapat mengambil tugas belum ditugaskan atau memperbarui tugasnya; tidak dapat mengambil tugas milik orang lain. Owner memilih anggota yang berizin pada properti tersebut.
- Portal layanan `/stay/[token]`: Wi-Fi QR, panduan, kontak bantuan, komplain dan progres, akses digital simulasi serta kontrol perangkat MOCK yang diizinkan owner. Tautan berizin masa tinggal aktif, hash token, rotasi, kedaluwarsa dan pencabutan check-out. Kata sandi Wi-Fi terenkripsi dan tidak dikirim dalam API owner.
- Check-out hotel menandai kamar CLEANING dan membuat satu tugas kebersihan. Staf tetap memeriksa kamar sebelum menandai siap. Check-out kos sebelum masa tinggal dimulai ditolak; masa tinggal mendatang dapat dibatalkan.
- LEO operasional menjawab briefing/pemasukan/tunggakan/kamar/pekerjaan dari data server berizin. Mode berbasis aturan dinyatakan jelas. Hasil direset saat properti berganti.
- Otomasi tagihan kos: opt-in owner, paket berbayar, jatuh tempo individu, tanggal akhir bulan, idempotensi periode dan lock organisasi. Worker setiap menit memproses tagihan dan akses MOCK, tanpa mengirim pesan atau mencatat pembayaran. Pengaturan menampilkan waktu proses terakhir dan aksi manual.
- Error konfirmasi perintah perangkat kini ditampilkan sebagai gagal, bukan sukses. Kontrol simulasi tidak mengklaim efek pada perangkat nyata.
- Label halaman depan diperbarui mengikuti ketersediaan tiket dan Wi-Fi; AI generatif, CCTV, WhatsApp otomatis dan perangkat nyata tetap belum terhubung.

## Validasi

- Production build dan TypeScript lulus.
- 10 unit test domain/file bukti lulus.
- 15 kelompok regresi API/database dan enam kelompok tenant/smart lulus.
- Tujuh kelompok tambahan pada `tests/operations.integration.mjs` lulus: tautan/Wi-Fi privat; komplain/penugasan/riwayat; izin kontrol perangkat/offline; otomasi/idempotensi/paket/job; LEO/origin/check-out; hotel/tugas kebersihan; masa tinggal kos mendatang.
- Browser: login akun sintetis, pergantian properti, ringkasan LEO, pembuatan dan progres tiket, pengiriman komplain penghuni, QR Wi-Fi, desktop serta mobile 390 px. Tidak ada overflow horizontal pada dashboard/portal layanan. Data uji disimpan terpisah; tidak mengirim WhatsApp atau mengendalikan perangkat fisik.

## Batas yang tetap berlaku

Belum merupakan penerimaan seluruh Master PRD atau peluncuran produksi. AI generatif, kamera/analytics, perangkat Tuya nyata, WhatsApp otomatis dan reset email memerlukan penyedia/konfigurasi serta pengujian tambahan. Analisis energi tidak dapat dihitung tanpa data meter/perangkat. Pembukuan lengkap, refund, gateway dan forecasting belum diimplementasikan. Harga dan batas Free/Starter/Plus tidak diubah; Ultimate belum aktif.

Panduan konfigurasi: [INTEGRATION_SETUP.md](INTEGRATION_SETUP.md). Worker lokal harus tetap berjalan; hosting perlu service/scheduler dan backup volume/kunci yang teruji.

## Bukti tampilan final

- [Dashboard desktop](../artifacts/kamelo-dashboard-final-desktop.jpg)
- [Dashboard mobile](../artifacts/kamelo-dashboard-final-mobile.jpg)
- [Portal layanan mobile — data sintetis](../artifacts/kamelo-stay-final-mobile.jpg)

Preview produksi lokal: http://127.0.0.1:3000/demo. Demo publik bersifat hanya-baca; penyimpanan dan fungsi operasional tersedia pada akun owner. Pada verifikasi akhir, komplain penghuni yang dikirim melalui UI terlihat di antrean owner, dapat diselesaikan, dan catatan penyelesaiannya terlihat kembali di portal penghuni. Konsol browser tidak mencatat error. Logo resmi terverifikasi dengan SHA256 yang sama: `00E7CB514B48A4E5E52DB62552397263B6AEF2B914595AFC714EA13711ECB254`.
