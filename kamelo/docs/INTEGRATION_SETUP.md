# Konfigurasi dan penerimaan integrasi Kamelo

Pengguna sudah mengonfirmasi bahwa layanan AI, Tuya/perangkat dan CCTV belum tersedia. Kesiapan lokal bukan penerimaan layanan nyata. Lihat [laporan tahap 5](INTEGRATION_STAGE5.md) dan [lembar penerimaan](INTEGRATION_LIVE_ACCEPTANCE.md). Jangan mengirim kata sandi, API key atau kunci job di chat, repo atau variabel NEXT_PUBLIC.

## Pemeriksaan konfigurasi tanpa koneksi

`pnpm integration:preflight` menghasilkan JSON aman dari environment proses. Tidak membaca .env secara otomatis, tidak menghubungi provider, tidak mengakses database, tidak mengirim email dan tidak menjalankan perangkat. Bila menjalankan Node dengan file environment yang sudah disiapkan privat, gunakan `node --env-file=.env scripts/integration-preflight.mjs`. Laporan tidak memuat nilai kredensial, alamat penerima, endpoint privat atau direktori bukti.

Exit 0 hanya berarti laporan berhasil dibuat. `node scripts/integration-preflight.mjs --require-live` mengembalikan exit 2 selama penerimaan nyata belum tersedia. Pada implementasi sekarang laporan selalu menandai penerimaan nyata PENDING_EXTERNAL_SETUP; mengisi variabel atau menyalakan gate tidak dapat menjadikannya VERIFIED.

## Environment server yang digunakan

| Variabel                                            | Peran                                                                                                                                             |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| DATABASE_URL                                        | PostgreSQL aplikasi; tersedianya URL tidak membuktikan koneksi atau backup/restore                                                                |
| APP_URL                                             | Origin aplikasi; HTTPS untuk hosting. HTTP hanya localhost, 127.0.0.1 atau [::1] untuk worker lokal. Tanpa userinfo, path, query atau fragment    |
| DATA_ENCRYPTION_KEY                                 | Kunci 32 byte dalam 64 karakter hex. Simpan privat bersama backup; mengganti/menghilangkan kunci dapat membuat arsip terenkripsi tidak terbaca    |
| PROOF_STORAGE_DIR                                   | Volume privat persisten bukti bayar; default aplikasi juga privat. Keberadaan/backup/scanning volume tetap harus diuji                            |
| OPERATIONS_JOB_KEY                                  | Kunci server dan worker yang sama, minimal 64 karakter tanpa whitespace; dikirim hanya di header, bukan URL                                       |
| MAIL_DRIVER                                         | disabled (default), sink hanya loopback QA, smtp Hostinger, atau adapter legacy yang sudah disetujui                                              |
| MAIL_LIVE_ENABLED, MAIL_TEST_RECIPIENTS             | Kedua gate pengiriman nyata harus dipenuhi; jangan mengaktifkan atau memasukkan penerima tanpa persetujuan uji                                    |
| SMTP_USERNAME, SMTP_PASSWORD, SMTP_HOST, SMTP_PORT  | Hostinger transport yang sudah ada: smtp.hostinger.com, 465/TLS atau 587/STARTTLS, sertifikat diverifikasi. Konfigurasi bukan bukti koneksi/inbox |
| EMAIL_FROM_NAME, EMAIL_FROM_ADDRESS, EMAIL_REPLY_TO | Identitas pengirim/reply-to yang harus disetujui dan diverifikasi pada layanan                                                                    |
| MAIL_ENDPOINT, MAIL_API_KEY                         | Adapter HTTPS legacy opsional dengan gate pengiriman yang sama. Bukan persyaratan bila memakai Hostinger SMTP                                     |

Verifikasi akun, undangan, reset dan pesan keamanan sudah memakai outbox. Pengingat tagihan opsional juga memakai outbox dengan pemeriksaan ulang sebelum kirim. ACCEPTED berarti diterima provider, bukan masuk inbox/dibaca. UNKNOWN perlu pemeriksaan operator dan tidak boleh dikirim ulang otomatis. Sink QA tidak mengirim email nyata.

## Tiga worker

Server web saja tidak menjamin jadwal berjalan. Jalankan dan awasi tiga proses sesuai kebutuhan:

| Perintah              | Job                      | Fungsi                                                                                  |
| --------------------- | ------------------------ | --------------------------------------------------------------------------------------- |
| pnpm worker           | POST /api/jobs           | Penerbitan invoice berulang serta sinkronisasi akses MOCK yang sudah ada                |
| pnpm worker:reminders | POST /api/jobs/reminders | Jadwal portal/email per properti dengan cursor dan dedupe; tidak mengirim SMTP langsung |
| pnpm worker:mail      | POST /api/jobs/mail      | Drain outbox melalui transport/gate yang dikonfigurasi pada server                      |

Ketiganya memakai APP_URL dan OPERATIONS_JOB_KEY yang sama dengan server. Rute tetap, redirect ditolak, request dibatasi 55 detik, hasil divalidasi, putaran request tidak bertumpuk, dan penghentian membatalkan request serta timer berikutnya. Server dapat tetap menyelesaikan job setelah koneksi klien putus; locks dan idempotensi server tetap diperlukan. Tidak ada alamat pelanggan atau rahasia dalam log worker. Reminder cursor tidak boleh mundur/berulang.

Dockerfile kini menyertakan skrip dan helper worker. `docker-compose.workers.yml` adalah template opsional untuk image yang sudah direview, origin HTTPS dan kunci job privat. Template tidak dijalankan otomatis. Docker tidak tersedia pada mesin QA ini, sehingga build/run image dan supervisi container belum diuji. Worker tidak memerlukan kredensial SMTP/DB; provider dan database diakses oleh server. Jangan meluncurkan worker produksi sebelum migrasi, kebijakan dan penerimaan terkait disetujui.

`scripts/run-local.mjs` adalah convenience runner yang juga memigrasikan database lokal utama. Jangan gunakan untuk pemeriksaan read-only atau QA terisolasi. Pengujian tahap ini memakai preview 3001 dan database disposable 55432 secara eksplisit.

## Layanan yang memerlukan provider dan implementasi live

| Layanan                 | Perilaku sekarang                                          | Ketergantungan nyata                                                                                                      |
| ----------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Hostinger               | Transport/outbox/gate tersedia; sink teruji                | Mailbox/pengirim, konfigurasi DNS dari provider, persetujuan penerima, inbox/bounce dan gangguan koneksi                  |
| CCTV / analytics        | Sumber nyata belum tersambung; gambar pemasaran bukan feed | VMS, kamera/izin, adapter stream/event, autentikasi scope properti, retensi serta uji sumber nyata                        |
| Smart Room / kunci Tuya | MOCK teruji; semua operasi adapter live menolak            | Project/region/account linking, inventaris/capability, implementasi adapter, konfirmasi perangkat dan uji fisik lifecycle |
| LEO                     | RULE_BASED, tanpa model eksternal atau tindakan generatif  | Provider/model, privasi, biaya, timeout, audit, adapter serta evaluasi                                                    |
| WhatsApp / gateway      | Siapkan pesan/manual payment tetap tersedia                | Rencana integrasi terpisah, provider resmi, consent/template/webhook dan dedupe                                           |

Tidak ditambahkan variabel yang seolah mengaktifkan CCTV, Tuya atau AI yang belum diimplementasikan. Mengisi kredensial tidak mengganti label menjadi live. Tidak ada pesan, koneksi kamera, perintah perangkat atau model eksternal dalam preflight.

Wi-Fi QR dan layanan penghuni tetap memakai alur yang sudah ada: QR dibuat lokal, tautan layanan terpisah dari tautan invoice, akses diverifikasi ulang terhadap stay/grant/masa berlaku, dan checkout/pindah kamar mencabut akses sesuai lifecycle. Penerimaan kunci/perangkat nyata tetap memerlukan pengujian fisik, termasuk konfirmasi pencabutan yang gagal/offline.
