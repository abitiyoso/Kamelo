# Konfigurasi integrasi Kamelo

User mengonfirmasi bahwa layanan AI, Tuya/perangkat, dan CCTV belum tersedia. Fitur aplikasi tetap berjalan tanpa layanan tersebut. Jangan masukkan kredensial ke chat, kode, atau variabel `NEXT_PUBLIC_*`.

## Konfigurasi yang sudah digunakan aplikasi

Salin `.env.example` ke `.env` untuk menjalankan Next/Prisma. Untuk skrip Node langsung, ekspor variabel lingkungan pada proses yang sama.

| Variabel                        | Kebutuhan                                                                                                                                                                                           |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                  | PostgreSQL aplikasi.                                                                                                                                                                                |
| `APP_URL`                       | Origin aplikasi yang sama persis dengan browser. HTTPS untuk hosting.                                                                                                                               |
| `DATA_ENCRYPTION_KEY`           | 32 byte acak dalam 64 karakter hex. Digunakan untuk kata sandi Wi-Fi dan PIN simulasi. Simpan bersama backup secara privat. Loopback lokal dapat memakai kunci persisten `.local-secrets/data-key`. |
| `PROOF_STORAGE_DIR`             | Volume privat persisten untuk bukti bayar, di luar `public/`.                                                                                                                                       |
| `OPERATIONS_JOB_KEY`            | Rahasia acak minimal 64 karakter, sama pada server dan worker. Mengamankan `POST /api/jobs`.                                                                                                        |
| `MAIL_ENDPOINT`, `MAIL_API_KEY` | Endpoint pengiriman email tepercaya untuk pemulihan akun. Belum disediakan user; reset email tetap dinonaktifkan.                                                                                   |

`node scripts/run-local.mjs` menjalankan database, migrasi, server dan worker. Kunci job acak diteruskan kepada server/worker sebagai environment; tidak ditampilkan. Untuk mode produksi lokal, gunakan `node scripts/run-local.mjs --production` setelah `pnpm build`.

Jika database/server sudah dijalankan terpisah, set `OPERATIONS_JOB_KEY` yang sama di kedua terminal, lalu jalankan `pnpm worker`. Worker mengirim job setiap 60 detik, tanpa tumpang tindih, dan mencoba lagi ketika server belum siap. Worker harus tetap berjalan. Pada hosting, jalankan worker sebagai service yang diawasi, atau panggil endpoint job dari scheduler tepercaya dengan header `Authorization: Bearer <OPERATIONS_JOB_KEY>`. Menjalankan web server saja tidak menjamin jadwal otomatis diproses. Dockerfile existing hanya menjalankan web server; supervisor/worker dan volume hosting masih perlu disiapkan dan diuji.

Di Pengaturan, owner mengaktifkan penerbitan otomatis untuk kos pada paket berbayar. Job menerbitkan tagihan periode bulan berjalan setelah jatuh tempo masing-masing penghuni, mengunci organisasi dan memeriksa keunikan penghuni/periode. Tidak melakukan backfill bulan sebelumnya, menerbitkan ulang tagihan VOID, membebankan biaya tambahan, mencatat pembayaran, atau mengirim WhatsApp. Owner dapat menjalankan proses secara manual. Waktu proses terakhir ditampilkan. Simulasi akses kamar juga disinkronkan oleh job; kegagalan/offline tidak boleh ditampilkan sebagai akses terkonfirmasi.

## Integrasi eksternal yang perlu layanan dan implementasi lanjutan

| Integrasi             | Yang harus disiapkan sebelum aktivasi                                                                                                                          | Perilaku saat ini                                                                                                                                                                           |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AI generatif          | Pilih penyedia/model, kredensial server, batas biaya, kebijakan data, timeouts dan audit tool.                                                                 | LEO operasional menggunakan pertanyaan terstruktur dan perhitungan server berdasarkan properti berizin. Mode `RULE_BASED`; tidak menghubungi model dan tidak menjalankan tindakan otomatis. |
| WhatsApp otomatis     | Penyedia resmi, nomor pengirim, template/izin penerima, webhook terverifikasi, retry dan deduplikasi.                                                          | Pesan/tautan disiapkan aplikasi; pengelola meninjau dan mengirim secara manual. Tidak ada pengiriman massal atau terjadwal.                                                                 |
| Tuya/perangkat        | Project/region dan layanan yang diizinkan, account linking, inventaris perangkat, fungsi aktual, callback/konfirmasi, keamanan kredensial dan pengujian fisik. | `MOCK` berfungsi dengan validasi capability. Cloud adapter menolak perintah. Mengisi file konfigurasi tidak membuka pintu atau mengaktifkan perangkat nyata.                                |
| CCTV Live / Analytics | Kamera dan izin akses, layanan stream aman, autentikasi/retensi, penyedia inference, biaya dan batas penggunaan.                                               | Belum ada koneksi kamera, rekaman, atau inference. Tidak menampilkan data CCTV rekaan sebagai hasil aktual.                                                                                 |

Tidak ada kredensial eksternal yang disimpan di repo ini. Setelah penyedia dan perangkat dipilih, adapter serta pengujian fisik masih diperlukan; jangan mengubah label simulasi hanya karena kredensial sudah tersedia.

## Layanan penghuni

Owner mengisi Wi-Fi, panduan dan nomor bantuan di Pengaturan. Wi-Fi QR dibuat lokal oleh pustaka `qrcode`, tanpa mengirim kata sandi ke layanan QR pihak ketiga. QR menggunakan format Wi-Fi WPA/WPA2 atau jaringan terbuka; karakter khusus di-escape. Referensi: [node-qrcode](https://github.com/soldair/node-qrcode), [ZXing Wi-Fi contents](https://github.com/zxing/zxing/wiki/Barcode-Contents).

Dari detail kamar aktif, pengelola membuat tautan `/stay/[token]`. Token acak disimpan sebagai hash, maksimal 14 hari atau akhir masa tinggal. Pembuatan ulang mencabut tautan sebelumnya. Setiap permintaan memeriksa ulang masa tinggal, pencabutan dan kedaluwarsa. Check-out menutup layanan meskipun tanggal kedaluwarsa tautan belum tercapai.

Portal tagihan `/tenant/[token]` tetap terpisah sehingga bukti bayar/tagihan historis tetap mengikuti kebijakan link tagihan. Portal layanan hanya menampilkan Wi-Fi, panduan, tiket masa tinggal itu, serta perangkat MOCK non-kunci yang dipetakan ke kamar dan diizinkan owner. Kontrol kamar tidak memberi izin ke perangkat kamar lain. Catatan progres tiket terkait penghuni terlihat di portalnya; jangan menulis catatan internal rahasia pada kolom tersebut.
