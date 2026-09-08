# Revisi Absensi, Guest, Persetujuan, dan Excel

Revisi 31 Agustus 2026. Panduan ini melengkapi ADMIN_CREW_CABANG.md dan menggantikan keterangan lama bahwa pengajuan guest hanya disimpan di browser.

## Pemasangan pada proyek yang sudah berjalan

1. Cadangkan folder proyek dan database. Hentikan terminal backend/frontend dengan Ctrl+C.
2. Ekstrak ZIP terbaru ke folder proyek. Pertahankan `backend/.env` dan `frontend/.env` milik Anda. File rahasia tidak disertakan dalam ZIP.
3. Pastikan migrasi 001–009 dan `20260831110840_admin_branches_crew.sql` dari revisi sebelumnya sudah terpasang. Jangan menjalankan kembali migrasi lama yang sudah berhasil.
4. Buka Supabase → SQL Editor → New query. Salin seluruh isi `supabase/migrations/20260831121350_attendance_review_guest.sql`, lalu Run sekali. File ini menambahkan tabel guest privat, kolom catatan/persetujuan, serta fungsi review dan audit dalam satu transaksi. Tidak menghapus data absensi lama.
5. Dari folder `frontend`, jalankan `npm install` lalu `npm run dev`. Dependency ekspor XLSX `fflate` sekarang dicantumkan secara langsung. Dari terminal terpisah di folder `backend`, jalankan `npm start`.
6. Buka ulang aplikasi dan login admin. Untuk data guest lama, gunakan browser dan alamat aplikasi yang sama agar catatan lokal lama masih dapat dibaca.

Jika migrasi baru belum dijalankan, halaman absensi menampilkan pesan konfigurasi dan ekspor dinonaktifkan. Jangan mengubah ID `GST-...` secara manual menjadi UUID dan jangan membuat baris palsu di tabel crew.

## Perubahan

- Sidebar dan topbar memakai warna permukaan yang sama: putih pada tema terang, biru gelap pada tema gelap. Tulisan menu tidak lagi pucat pada latar putih.
- Pencarian mencakup nama, HP, email, kode crew, dan lokasi. Filter tanggal WIB, jenis, status, dan persetujuan bekerja bersamaan. Default semua tanggal; tombol Hari ini dan Reset filter tersedia.
- Ringkasan dan ekspor mengikuti hasil filter. Jumlah adalah jumlah catatan, bukan jumlah orang unik. Catatan Clock Out saja tidak dihitung sebagai Clock In.
- Ekspor menghasilkan berkas `.xlsx` asli, bukan CSV berganti nama. Nomor HP tetap teks, menit berupa angka, catatan diikutkan. Foto/base64 dan tautan foto privat tidak dimasukkan ke Excel. Teks yang diawali `=` tidak dieksekusi sebagai rumus.
- Kolom jadwal menampilkan jam mulai/selesai yang tersimpan pada jadwal penugasan. Bila tidak tersedia, ditulis “Belum ada jadwal”, bukan “Darurat (OTW)”.
- Kehadiran (tepat waktu/telat) dan keputusan admin adalah status berbeda. Menyetujui atau menolak tidak mengubah keterlambatan menjadi status buatan.
- Telat ditampilkan dalam menit. Perhitungan baru memakai WIB dan tidak mengikuti zona waktu server. Lembur dihitung per jam penuh setelah jadwal berakhir; 59 menit 59 detik belum menjadi 1 jam. Jadwal melewati tengah malam ditangani sebagai hari berikutnya. Data lama tidak dihitung ulang secara massal.
- Persetujuan lembur terpisah dari persetujuan pengajuan absensi. Pengajuan harus disetujui lebih dahulu jika memerlukan tinjauan. Potongan/bonus Rp10.000 yang dulu di-hardcode telah dihapus dari halaman dan ekspor ini; revisi ini tidak menetapkan aturan pembayaran payroll.
- Detail/review memuat foto Clock In dan Clock Out dari kolom yang berbeda. Bila belum ada tindakan pada salah satu sisi, foto sisi itu tidak ditampilkan. Catatan crew ditampilkan di sisi pengiriman yang sesuai, terpisah dari catatan admin. Form crew terdaftar juga menyediakan catatan masuk/pulang.
- Review memvalidasi UUID, role admin aktif, alasan penolakan, dan status sebelumnya. Keputusan dan audit disimpan dalam satu transaksi. Dua admin tidak dapat menimpa keputusan yang sudah berbeda. Retry keputusan sama tidak membuat audit ganda.

## Pengajuan guest baru

Guest memilih store/event aktif dari server, mengisi identitas, mengambil foto/GPS, lalu mengirim. Berhasil hanya ditampilkan setelah foto privat dan baris database tersimpan. Catatan baru tidak hanya disimpan di browser. Percobaan ulang dengan isi sama memakai kunci idempotensi untuk mencegah duplikasi saat respons jaringan terputus.

API publik tidak menyediakan daftar pengajuan, riwayat orang lain, atau foto. Riwayat/review hanya tersedia melalui API admin yang terautentikasi. Lokasi berdasarkan IP hanya perkiraan dan tidak boleh dipakai mengirim absensi. GPS browser dan watermark bukan bukti anti-pemalsuan; admin tetap perlu meninjau bukti.

Guest belum otomatis dicocokkan ke akun crew atau jadwal hanya dari nama/HP. Karena itu, keterlambatan dan lembur guest ditampilkan “Belum dapat dihitung”, termasuk sesudah disetujui. Persetujuan guest menyimpan keputusan dan audit, tetapi belum otomatis membentuk pasangan masuk/pulang, baris absensi crew terdaftar, atau pembayaran payroll. Pengaitan identitas, jadwal resmi, dan pasangan masuk/pulang perlu alur verifikasi tersendiri; sistem tidak mengarang waktu kerja.

## Menangani guest lama dengan ID GST-...

1. Di Admin → Absensi, temukan label “Guest lokal belum sinkron”.
2. Klik “Simpan & Tinjau”, periksa foto dan catatannya, lalu “Simpan data lama ke server”.
3. Apabila tanggal lama tidak terbaca, isi tanggal/jam sebenarnya dalam WIB. Waktu lama diberi penanda berasal dari perangkat, bukan waktu server.
4. Setelah tersimpan dengan UUID server, pilih Setujui atau isi alasan lalu Tolak Pengajuan.

Data asli di browser tidak dihapus; hanya diberi penanda sudah tersimpan. Impor yang sama tidak membuat baris baru berulang kali. Data lokal yang sudah terhapus dari browser tidak dapat dipulihkan oleh revisi ini. Untuk pindah komputer/alamat frontend, sinkronkan catatan lama terlebih dahulu.

## Verifikasi dan batas pengujian

Build produksi frontend dan pemeriksaan TypeScript pada jalur aplikasi aktif berhasil. Tes otomatis meliputi filter/tanggal/format XLSX, waktu WIB/shift malam/lembur, validasi API/foto, review PostgreSQL lokal, hak akses, konflik keputusan, pemisahan catatan/foto, dan regresi akun/crew. Tes browser menggunakan respons API uji, bukan kredensial/database Anda. File Excel hasil unduhan browser juga dibaca dengan pembaca XLSX terpisah.

Belum dilakukan pengujian end-to-end pada Supabase, Storage, kamera, dan perangkat milik Anda. Sebelum digunakan:

1. Uji satu guest Clock In dengan catatan. Pastikan muncul di admin perangkat lain, hanya punya foto masuk, dan catatan benar.
2. Uji guest Clock Out. Pastikan hanya punya foto pulang. Sistem tidak otomatis memasangkannya berdasarkan nama/HP.
3. Setujui satu pengajuan dan tolak pengajuan berbeda dengan alasan. Refresh admin: keputusan dan Audit Log harus tetap ada.
4. Uji filter nama + tanggal + jenis dan bandingkan baris tabel dengan Excel yang diunduh.
5. Uji crew terdaftar pada jadwal nyata, termasuk catatan masuk/pulang dan lembur; persetujuan tidak boleh mengubah jumlah menit telat.
6. Uji kedua tema, menu profil/logout, serta layar ponsel. Tabel absensi dapat digeser horizontal untuk melihat seluruh kolom.

Endpoint guest memiliki pembatasan per-IP dalam memori satu proses dan batas foto 5 MB. Sebelum membuka akses internet skala produksi, atur reverse proxy terpercaya, pembatasan terpusat/anti-bot, batas penyimpanan, serta kebijakan retensi foto. Revisi ini tidak mengklaim seluruh sistem siap produksi.

Tes lokal:

```sh
# Dari backend. PGLITE_MODULE menunjuk instalasi lokal @electric-sql/pglite
node --test tests/*.test.*
# Dari frontend
node --experimental-vm-modules --test tests/auth-session.test.mjs tests/attendance-data.test.mjs
npm run build
```

Tes SQL ditandai skipped bila `PGLITE_MODULE` belum tersedia. Tes browser `tests/attendance-browser.cjs` dan `tests/guest-submission-browser.cjs` memerlukan Playwright, `CODEX_PRIMARY_RUNTIME_NODE_MODULES`, serta `CHROMIUM_MODULE` menunjuk modul Chromium; alat QA bukan dependency runtime aplikasi. `QA_OUTPUT` dapat menunjuk folder keluaran uji terpisah. Jangan memasukkan fixture uji ke database produksi.
