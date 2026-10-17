Lanjutkan website Kamelo by ELENIO yang sudah berjalan di http://127.0.0.1:3000/. Kerjakan revisi langsung pada repository existing, bukan membangun ulang.

TUJUAN
Buat landing page terasa sebagai produk nyata yang membantu owner kos, guest house, dan hotel kecil menyelesaikan pekerjaan harian. Utamakan masalah owner, bukti produk yang terbaca, dan interaksi yang memberi hasil.

ATURAN WAJIB
- Periksa implementasi, komponen, route, dan aset existing sebelum mengedit.
- Pertahankan stack, fitur, autentikasi, data, serta route yang sudah bekerja.
- Jangan mengganti, menggambar ulang, mengetik ulang, atau memodifikasi logo ELENIO.
- Gunakan aset logo resmi existing dengan proporsi asli.
- Ikuti referensi Social & Identity dan Visual Language ELENIO yang tersedia.
- Jangan generate atau mengganti aset foto dan maskot. Optimalkan crop, ukuran, dan penempatan aset existing.
- Jangan membuat testimoni, jumlah pelanggan, hasil penghematan, atau klaim integrasi palsu.
- Bedakan fitur tersedia, simulasi, dan segera hadir secara jelas.
- Selesaikan implementasi dan validasi; jangan berhenti di rencana.

TEMUAN YANG HARUS DIPERBAIKI
Landing sekarang terlalu panjang dan mengulang masalah/manfaat dalam banyak section. Pada mobile 390 × 844, tinggi halaman sekitar 15.932 px. Screenshot produk di hero sulit dibaca. Navigasi section hilang di mobile. Tab dan LEO sudah bisa diklik, tetapi kebanyakan hanya mengganti teks. CTA “Coba alur di aplikasi” mengarah ke demo hanya-baca dengan aksi penting dinonaktifkan. Jalur owner terlihat, tetapi contoh portal penghuni belum jelas.

1. PERBAIKI HERO
Gunakan copy berikut sebagai arah utama:

Headline:
“Tagihan belum masuk. Kamar kosong.
Semua masih menunggu Anda?”

Deskripsi:
“Lihat saldo tagihan, status kamar, dan pembayaran dari satu tempat. Mulai dari pekerjaan yang paling sering menyita waktu Anda.”

CTA utama: “Coba Demo Owner”
CTA kedua: “Mulai Gratis”
Microcopy: “Gratis hingga 5 kamar. Tanpa kartu kredit.”

Jangan menumpuk tiga CTA dengan bobot yang sama. Letakkan konsultasi Smart Property pada section yang relevan.

Ganti dominasi screenshot dashboard kecil dengan panel produk interaktif yang terbaca. Foto existing tetap dapat menjadi konteks visual pendukung.

2. BUAT SATU INTERAKSI YANG TUNTAS
Gunakan skenario “Tagihan perlu ditindaklanjuti”:
- Tampilkan tiga tagihan dari data demo existing, tanpa mencampur data pelanggan.
- Pengunjung memilih salah satu penghuni.
- Panel menampilkan saldo dan jatuh tempo.
- Tombol “Siapkan Pengingat” membuka pratinjau pesan yang relevan.
- Sediakan “Salin Pesan”, feedback berhasil, dan “Ulangi Demo”.
- Tidak mengirim pesan, mengubah pembayaran, atau menyimpan perubahan ke backend.
- Beri label “Simulasi · tidak mengirim pesan”.
- Gunakan state lokal dan komponen existing bila memungkinkan.

Jangan memberi kesan bahwa AI atau pengiriman otomatis sudah aktif.
Jika data demo tidak tersedia untuk komponen landing, gunakan fixture existing atau contoh lokal yang diberi label simulasi dengan jelas.

3. RINGKAS ALUR LANDING
Susun menjadi:
A. Hero + simulasi singkat
B. Tiga masalah owner utama yang terhubung ke solusi
C. Cara kerja + jalur owner dan penghuni
D. LEO
E. Smart Stay + Smart Room
F. Harga
G. FAQ + CTA penutup

Gabungkan atau hapus pengulangan pada section dampak, pembeda, dan pengembangan opsional. Setiap section harus menambah informasi baru. Batasi teks awal tiap section menjadi judul dan satu paragraf pendek.

4. PERJELAS OWNER DAN PENGHUNI
- Ubah label “Masuk” menjadi “Masuk Owner” atau “Masuk Pengelola”, sesuai sistem existing.
- Tambahkan “Lihat Contoh Portal Penghuni” menggunakan route demo yang memang tersedia.
- Jika route belum tersedia, buat preview lokal dari komponen portal existing dengan data simulasi.
- Jangan membuka portal pelanggan nyata atau mengekspos token akses.
- Jelaskan bahwa penghuni menerima tautan dari pengelola; jangan membuat alur pendaftaran penghuni jika produk tidak mendukungnya.

5. BENAHI LEO
Pertahankan interaksi pertanyaan existing, tetapi buat hasilnya lebih mudah dipindai:
- Ringkasan singkat.
- Data terkait.
- Langkah berikutnya dengan CTA relevan.

Gunakan copy sesuai kemampuan aktual, misalnya:
“LEO membantu membaca kondisi properti dan menyiapkan langkah berikutnya.”

Hindari headline yang menjanjikan eksekusi pekerjaan jika implementasinya masih berbasis aturan. Status pratinjau harus terlihat tanpa paragraf disclaimer yang mendominasi.

6. SMART STAY DAN SMART ROOM
Tampilkan perjalanan yang jelas:
Pengelola konfirmasi check-in → penghuni menerima link → melihat kebutuhan kamar → masa tinggal berakhir → pengelola memeriksa kamar.

Gunakan preview portal HP yang terbaca, memakai komponen/aset existing.
Bedakan:
- Tagihan dan unggah bukti: sesuai fitur aktual.
- Akses digital: simulasi jika belum terhubung.
- Wi-Fi, kontrol perangkat, dan otomasi: segera hadir jika belum tersedia.

Tombol simulasi perangkat hanya boleh mengubah state demo. Jangan menghubungkan kontrol landing ke perangkat nyata.

7. PERKUAT VISUAL ELENIO
- Gunakan navy, biru utama, putih, dan motif panel dari referensi resmi.
- Terapkan kedalaman dan aksen transparan secara terukur, terutama pada hero dan transisi penting.
- Variasikan komposisi: panel produk, baris editorial, dan preview portal; jangan semua informasi dibungkus kartu identik.
- Perbaiki hierarki tipografi, kontras teks sekunder, dan keterbacaan angka.
- Foto harus tetap diberi konteks ilustrasi bila bukan properti pelanggan.
- Jangan menambahkan animasi dekoratif berlebihan atau parallax yang mengganggu.

8. MOBILE
Validasi pada lebar 390 px:
- Sediakan menu mobile menuju Solusi, Demo, dan Harga.
- Pertahankan CTA yang mudah ditemukan.
- Pendekkan area teks hero agar preview produk muncul lebih awal.
- Pastikan tab, tombol, dan panel tidak terpotong atau menimbulkan horizontal overflow.
- Kurangi padding dan tinggi kartu yang tidak perlu.
- Pastikan sticky header tidak menutupi judul ketika anchor dibuka.
- Targetkan pengurangan panjang halaman sekitar 35–45% melalui penghapusan pengulangan, bukan mengecilkan font.

9. SELARASKAN CTA DAN TUJUAN
- “Coba Demo” harus membuka pengalaman yang bisa dicoba.
- Jika tujuan hanya-baca, gunakan “Lihat Contoh”.
- Pertahankan parameter deep link existing.
- Pastikan pilihan jenis properti konsisten dengan konteks demo yang dibuka.
- Konsultasi WhatsApp hanya dibuka melalui klik pengguna, tanpa pengiriman otomatis.

10. VALIDASI SEBELUM SELESAI
Jalankan build/lint dan pemeriksaan relevan yang tersedia.
Uji langsung:
- Desktop dan mobile.
- Menu mobile dan anchor.
- Pilihan properti serta seluruh tab workflow.
- Pilihan penghuni → pratinjau pengingat → salin pesan → reset.
- Pertanyaan LEO dan CTA lanjutannya.
- FAQ.
- Route demo owner, preview penghuni, login, dan register.
- Navigasi keyboard, focus terlihat, serta reduced motion.
- Tidak ada error console baru atau horizontal overflow.

Laporkan:
1. Perubahan yang selesai.
2. File yang diubah.
3. Hasil validasi.
4. Screenshot desktop dan mobile.
5. Keterbatasan yang masih ada.

Fokus pada perubahan terarah yang meningkatkan kejelasan dan pengalaman mencoba. Pertahankan fondasi website, logo, dan aset existing.