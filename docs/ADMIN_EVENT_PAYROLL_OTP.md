# Revisi Dashboard, Event, Email Crew, dan Payroll

Panduan ini menggantikan keterangan Dashboard, email Edit Crew, Event, dan Payroll pada panduan revisi sebelumnya. Tidak ada perubahan yang dijalankan pada database Supabase Anda oleh proses pengembangan ini.

## Memasang revisi

1. Cadangkan proyek dan database, lalu hentikan backend/frontend dengan Ctrl+C.
2. Ekstrak ZIP revisi. Pertahankan `backend/.env` dan `frontend/.env` milik Anda; ZIP tidak berisi key rahasia. Tidak ada dependency aplikasi baru pada revisi ini.
3. Tambahkan `VITE_GOOGLE_MAPS_API_KEY` ke `frontend/.env`. Aktifkan Maps JavaScript API pada Google Cloud dan batasi API key ke domain frontend Anda.
4. Pastikan migrasi 001–009 serta `20260831110840_admin_branches_crew.sql` dan `20260831121350_attendance_review_guest.sql` sudah terpasang, sesuai panduan sebelumnya.
5. Tinjau file `supabase/migrations/20260831194049_admin_event_workspace.sql`. Ini migrasi tambahan, bukan pengganti database atau seed.
6. Untuk alur SQL Editor yang selama ini dipakai: jalankan seluruh isi file baru tersebut sekali pada proyek Supabase yang benar. Jangan jalankan ulang migrasi lama atau seed demo. Simpan catatan migrasi yang sudah diterapkan. Jika memakai CLI, selaraskan dahulu riwayat migrasi CLI dengan migrasi yang pernah dijalankan manual; jangan langsung `db push` pada riwayat yang belum cocok.
7. Jika SQL gagal, hentikan pemasangan dan simpan pesan error. File dibungkus transaksi; jangan menghapus bagian pemeriksaan agar pemaksaan migrasi berhasil.
8. Jalankan `npm start` di terminal folder backend dan `npm run dev` pada terminal folder frontend. Untuk hosting statis, jalankan `npm run build` dan gunakan hasil build baru.

Pemeriksaan baca-saja sesudah pemasangan:

```sql
select event_code, event_name, start_time, end_time, pic_crew_id, updated_at
from public.events order by event_date desc limit 10;
```

## Dashboard

- Akses cepat dihapus dari halaman aktif.
- Kartu crew dan event, grafik event 6 bulan, check-in 7 hari, lembur disetujui 6 bulan, event terbaru, serta absensi hari ini membaca API server.
- Jumlah check-in adalah catatan, bukan otomatis orang unik. Guest belum termasuk grafik ini.
- Grafik kosong bernilai nol. Omzet dan payroll final ditandai belum tersedia, bukan diisi angka contoh.

## OTP crew dan email login

Pemeriksaan lokal dari folder backend:

```powershell
npm run check-email
```

Perintah ini memeriksa format konfigurasi dan menjelaskan apakah pengirim masih memakai `resend.dev`. Tidak mencetak API key, tidak mengirim email, dan tidak membuktikan domain/key sudah disetujui provider.

`OTP_EMAIL_FROM=FotoSnaps <onboarding@resend.dev>` adalah pengirim percobaan Resend. Pengiriman percobaan dibatasi ke alamat pemilik akun Resend. Untuk dua email crew lain, tambahkan/verifikasi domain milik Anda pada Resend, lalu gunakan alamat dari domain tersebut sebagai `OTP_EMAIL_FROM`. Contoh format saja: `FotoSnaps <otp@domain-anda.com>`. Jangan gunakan `noreply@gmail.com` atau domain orang lain. Pastikan API key mempunyai izin mengirim pada domain tersebut.

Rujukan: https://resend.com/docs/knowledge-base/403-error-resend-dev-domain

Sesudah mengubah konfigurasi, restart backend. Coba Lupa Sandi dengan email crew; periksa Resend Emails dan inbox/spam penerima. Backend kini membedakan kesalahan key/izin, domain, pembatasan pengirim percobaan, kuota, serta koneksi. Pengiriman gagal tidak dianggap sukses dan OTP gagal kirim diinvalidasi. Ulangi permintaan setelah konfigurasi diperbaiki. Jangan membagikan isi `.env` atau kode OTP.

Konfigurasi domain/key tidak bisa diperbaiki hanya dengan migrasi SQL. Pengiriman ke email crew sungguhan belum diuji dalam revisi ini. Sementara menyiapkan pengirim, admin dapat memakai Detail Crew → Atur Password dan menyerahkan password melalui saluran pribadi.

Email pada Detail Crew → Edit sekarang dapat diubah. Ketik email baru, klik **Perbarui email login**, lalu konfirmasi kepemilikan alamat. Backend memperbarui Supabase Auth dan profil, memeriksa konflik perubahan, mencoba rollback Auth bila pembaruan profil gagal, menginvalidasi OTP terkait, dan mencatat audit. Password lama tetap tidak ditampilkan. Setelah itu Simpan Crew untuk perubahan profil lain. Akun dengan role admin tidak boleh diubah melalui endpoint khusus crew ini. Profil Saya tetap memakai konfirmasi email milik pemilik akun.

## Event sebagai dasar absensi crew event

1. Buat cabang asli jika belum ada.
2. Tambah Event: kode unik, nama, tanggal, jam mulai/selesai WIB, cabang, alamat, latitude, longitude, radius GPS, status, klien opsional dan PIC opsional.
3. Gunakan SCHEDULED atau ONGOING untuk penugasan. DRAFT belum dapat digunakan absen.
4. Buka Detail → Crew, pilih crew event aktif pada cabang sama dan isi posisi/tugas. Simpan membuat penugasan serta jadwal absensi dalam transaksi. Menjadi PIC tidak otomatis berarti ditugaskan absen.
5. Akun Crew Event dibuat melalui Kelola Crew dengan memilih Event sebagai acuan kode. Contoh kode Event `BDG-SMA1` menghasilkan kode crew `BDG-SMA1-1`. Pilihan ini tidak membuat penugasan. Penugasan hanya dilakukan melalui Detail Event → Crew dan membuat jadwal bila event sudah memiliki jam/lokasi lengkap.
6. Login sebagai crew yang ditugaskan pada tanggal event; jadwal dan nama event menjadi konteks absensi. GPS, foto, serta otorisasi kepemilikan tetap diperiksa backend.
7. Detail → Absensi menampilkan catatan asli. Pemeriksaan foto/persetujuan tetap melalui Manajemen Absensi.

Batas revisi: satu lokasi dan satu tanggal per event, jam selesai setelah jam mulai pada tanggal yang sama, satu jadwal event aktif per crew per tanggal. Event beberapa hari, beberapa lokasi, atau melewati tengah malam belum dikelola oleh form ini. Konflik jadwal ditolak, bukan dipilih secara acak.

Jadwal/lokasi yang sudah dipakai absensi tidak boleh diubah lewat form. Penugasan dapat diakhiri tanpa menghapus riwayat. Cabang event yang sudah ditetapkan tidak bisa dipindahkan. Event lama dengan beberapa lokasi memerlukan pemeriksaan data, jangan menghapus lokasi secara sembarang.

Overview, Crew, Absensi dan Audit Log memakai data server. Tab Payroll membuka simulasi bulanan. Inventory, Operasional, Kertas, Keuangan dan Dokumentasi baru tersedia sebagai tab berstatus belum terhubung; belum merupakan workflow operasional lengkap.

## Payroll

- Tampilan kartu, filter periode/jenis/pencarian, tabel, detail perhitungan, serta ekspor XLSX dan PDF aktif.
- Gaji pokok diambil dari Kelola Crew. Default simulasi: Event per absensi lengkap sah, Store per bulan tanpa prorata. Dasar gaji dapat diganti untuk simulasi sesi itu.
- Tarif bonus/potongan awal Rp0; nilai Rp10.000 pada contoh gambar tidak ditetapkan sebagai kebijakan perusahaan. Isi tarif sesuai kebijakan yang sudah Anda setujui.
- Hanya absensi masuk/pulang lengkap berstatus PRESENT/LATE dengan review APPROVED/NOT_REQUIRED masuk perhitungan. Bonus lembur hanya memakai overtime APPROVED. Jam telat dibulatkan ke atas per catatan; lembur ke bawah per catatan.
- Pengajuan pending/ditolak/tidak lengkap tidak masuk. Guest belum termasuk payroll karena belum dipetakan ke akun dan dasar gaji yang disetujui.
- Rumus: gaji pokok sesuai unit + bonus lembur − potongan telat. Ini simulasi dengan data gaji/tarif saat ini, bukan penggajian historis atau slip pembayaran. Tidak menghitung pajak, BPJS, prorata, cuti, atau aturan ketenagakerjaan otomatis.
- Aturan simulasi tidak disimpan sebagai kebijakan payroll server. Ekspor mencantumkan periode, dasar gaji, unit, tarif, dan rincian perhitungan. Detail menampilkan tren lembur, bukan riwayat pembayaran palsu.

## Verifikasi

Build production dan pemeriksaan TypeScript entry aplikasi aktif berhasil. Tes otomatis backend/frontend mencakup migrasi PostgreSQL lokal, hak akses, sinkronisasi email/rollback, provider email tiruan, filter/perhitungan payroll, sesi, dan regresi absensi. Tes browser menggunakan API tiruan untuk dashboard, email, event, penugasan, catatan, payroll, ekspor dan tema/mobile. XLSX/PDF hasil unduhan diperiksa isinya.

Ini tidak menggantikan pengujian live setelah migrasi: login dua crew, OTP melalui provider, edit email lalu login ulang, buat event/penugasan, check-in/out GPS/foto di perangkat nyata, tinjau admin dan cocokkan rekap.

Perintah pengujian (PGlite/Playwright terpasang terpisah sebagai perangkat QA, bukan dependency runtime):

```sh
# Backend; PGLITE_MODULE menunjuk paket @electric-sql/pglite lokal untuk tes SQL.
node --test tests/*.js tests/*.cjs
# Frontend
node --experimental-vm-modules --test tests/*.test.mjs
npm run build
```

Tanpa `PGLITE_MODULE`, tes SQL ditandai skipped. Tes browser tersedia di `frontend/tests/*browser.cjs` dan memerlukan Playwright (`CODEX_PRIMARY_RUNTIME_NODE_MODULES`), Chromium (`CHROMIUM_MODULE`, opsi `CHROMIUM_EXECUTABLE`), serta direktori `QA_OUTPUT`.
