# Revisi Admin, Crew, Cabang, dan Store

> Ada revisi lanjutan: keterangan email read-only, event tanpa jadwal otomatis, dashboard dan payroll di dokumen ini telah digantikan oleh [ADMIN_EVENT_PAYROLL_OTP.md](ADMIN_EVENT_PAYROLL_OTP.md).

Revisi 31 Agustus 2026. Gunakan kode dalam ZIP ini bersama migrasi baru di bawah.

## Cara memasang pada proyek yang sudah berjalan

1. Cadangkan folder proyek dan database sebelum migrasi.
2. Hentikan terminal backend dan frontend dengan Ctrl+C.
3. Ekstrak ZIP terbaru dan salin perubahan ke proyek. Pertahankan file `backend/.env` dan `frontend/.env` Anda. ZIP tidak membawa kredensial.
4. Isi `VITE_GOOGLE_MAPS_API_KEY` di `frontend/.env` agar lokasi Event dan Store dapat dipilih melalui Google Maps. Aktifkan Maps JavaScript API dan batasi key ke domain frontend.
5. Buka Supabase Dashboard proyek FotoSnaps, lalu SQL Editor, New query.
6. Buka file `supabase/migrations/20260831110840_admin_branches_crew.sql`, salin seluruh isi, dan jalankan **sekali**. Migrasi 001 sampai 009 harus sudah terpasang. Jangan menjalankan ulang seluruh migrasi lama atau seed demo.
7. Jika SQL gagal, jangan lanjut menguji penyimpanan crew. Simpan pesan error, bukan kredensial. Migrasi dibungkus transaksi sehingga kegagalan tidak meninggalkan sebagian perubahan.
8. Dari folder backend jalankan `npm start`. Dari terminal terpisah, folder frontend, jalankan `npm run dev`.
9. Buka URL yang diberikan Vite, login ulang sebagai admin. Jika memakai hasil build statis, jalankan `npm run build` di frontend dan deploy hasil build baru.

Revisi ini tidak menambah dependency aplikasi. `npm install` hanya perlu bila dependency belum dipasang. Peringatan deprecated tidak berarti instalasi gagal, tetapi pembaruan keamanan dependency tetap perlu dikerjakan terpisah sebelum produksi.

Pemeriksaan SQL sesudah migrasi:

```sql
select code, name from public.branches order by name;
select employee_code, branch_id, deleted_at from public.crew limit 5;
```

Empat cabang awal berasal dari informasi pengguna: Jakarta, Yogyakarta, Bandung, Tasikmalaya. Nama maupun koordinat 10 store belum diberikan, sehingga tidak dibuat data store palsu.

## Mengisi cabang dan store asli

1. Admin → Kelola Crew → Cabang & Store.
2. Pilih Store, isi kode unik, nama Store, cabang, lalu cari atau klik lokasi melalui Google Maps. Atur radius absensi dan status. Simpan.
3. Masukkan dua Store Jakarta, empat Yogyakarta, dua Bandung, dan dua Tasikmalaya memakai lokasi sebenarnya.
4. Untuk cabang baru, pilih tab Cabang lalu masukkan kode dan nama. Tidak ada batas jumlah cabang atau jumlah store per cabang dalam antarmuka.
5. Store yang sudah ada dari versi lama ditampilkan dengan “Cabang belum ditetapkan”. Klik Edit untuk menghubungkannya ke cabang. Nama dan koordinat lama dipertahankan di form.

Lokasi yang sudah ditetapkan ke cabang tidak dapat dipindahkan ke cabang lain melalui direktori ini. Buat lokasi baru jika pindah cabang, agar riwayat penugasan tidak berubah diam-diam.

## Event dan penugasan crew

- Kelola Event membaca, membuat, dan mengedit event asli di database. Isikan kode, nama, tanggal, klien opsional, cabang, status.
- Event lama perlu dihubungkan ke cabang lewat Edit agar tersedia di pilihan penugasan.
- Tambah Crew: nama, **email untuk login**, password awal 8–128 karakter, nomor HP, nomor/kode karyawan, jenis crew, gaji pokok, status, cabang, serta Store hanya untuk Crew Store.
- Form memakai satu kolom Kode Karyawan. Kode otomatis memakai format cabang–Store–nomor (`BDG-GACOAN-1`) atau kode Event–nomor (`BDG-SMA1-1`) dan tetap dapat diedit sebelum disimpan.
- Crew Event memilih Event sebagai acuan kode. Pilihan ini tidak membuat penugasan. Penugasan serta posisi hanya diatur melalui Kelola Event → Detail → Crew.
- Crew Store wajib memilih Store aktif pada cabang yang dipilih. Backend memeriksa kesesuaiannya lagi.
- Cabang pada crew adalah kantor asal; penugasan memiliki cabang lokasinya sendiri. Mengedit kantor asal tidak memindahkan penugasan lama secara otomatis.
- Saat Edit Crew Store, Store baru mengakhiri penugasan Store aktif sebelumnya tanpa menghapus absensi. Edit Crew Event tidak mengubah penugasan event.
- Mengganti jenis CREW_STORE/CREW_EVENT memperbarui role dan mengakhiri penugasan aktif sebelumnya. Crew harus login ulang agar menu frontend mengikuti jenis baru.
- Kolom “Dari Store / Event” menampilkan penugasan aktif. “Jumlah Event” menghitung event unik sepanjang riwayat penugasan, bukan jumlah event hadir atau dibayar.
- Detail Crew menyediakan riwayat seluruh penugasan dan foto profil asli jika crew telah mengunggahnya. Tanpa foto, tampil inisial.

**Batas penting:** membuat store/event atau menugaskan crew belum membuat jadwal absensi otomatis. Event juga memerlukan koordinat di event_locations. Pengelolaan jadwal/koordinat event melalui UI dan pengujian absensi menyeluruh masih merupakan pekerjaan berikutnya. Tidak ada jadwal atau GPS yang dikarang pada revisi ini.

## Profil, email, password, dan hak akses

- Profil Saya memiliki susunan yang sama untuk admin dan crew terdaftar. Data selalu milik akun yang sedang login. Menu sidebar dan hak pengelolaan berbeda sesuai role.
- Mengedit Email Akun di Profil Saya tidak mengubah email crew lain. Alur konfirmasi email sebelumnya tetap dipakai.
- Email pada Edit Crew dibaca saja. Pemilik akun menggantinya melalui Profil Saya.
- Password lama tidak dapat dibaca atau ditampilkan di tabel. Kolom Password menunjukkan “Terlindungi”. Admin dapat mengatur password awal saat membuat crew atau memakai Detail → Atur Password.
- Password tidak disimpan dalam state permanen browser, tabel public, RPC, atau audit. Field dibersihkan setelah modal ditutup/penyimpanan berhasil. Sampaikan password awal/reset kepada pemilik akun melalui jalur pribadi.
- API crew/direktori admin, ringkasan admin, laporan, dan audit dibatasi untuk role admin. SUPER_ADMIN, ADMIN_STORE, dan EVENT_MANAGER pada arsitektur proyek saat ini merupakan pengelola lintas cabang, **belum admin yang dibatasi hanya satu cabang**.
- Nonaktifkan membuat status crew INACTIVE dan public.users.is_active=false. Login aplikasi serta permintaan API berikutnya ditolak, termasuk token lama yang masih valid di Supabase Auth. Akun Auth tidak dihapus; mengaktifkan kembali memulihkan akses aplikasi.
- Hapus meminta konfirmasi dan melakukan **arsip lunak**: crew dikeluarkan dari daftar, akun aplikasi dinonaktifkan, penugasan aktif diakhiri, tetapi Auth dan riwayat absensi dipertahankan. Tidak ada penghapusan permanen/cascade.
- Pemulihan crew yang diarsipkan belum memiliki tombol UI. Jika salah arsip, minta administrator database memulihkan secara terkontrol; jangan membuat akun duplikat dengan email sama.
- Migrasi mencegah pengguna authenticated memperbarui tabel users langsung melalui Data API. Semua edit profil aplikasi memakai API backend yang memvalidasi kolom dan identitas.

## Menu admin yang kembali tampil

| Menu | Isi revisi ini |
| --- | --- |
| Dashboard | Ringkasan jumlah crew aktif, catatan check-in/telat hari ini berdasarkan tanggal WIB, event berlangsung dari server. Angka check-in adalah jumlah catatan, bukan deduplikasi orang. |
| Kelola Crew | Akun, cabang, store/event, detail, edit, gaji awal 0, reset password, status, arsip. |
| Kelola Event | Daftar/form event asli, terkait cabang. Bukan workflow operasional event lengkap. |
| Absensi | Halaman versi sebelumnya dipertahankan. Tidak termasuk perbaikan seluruh alur review/guest pada revisi ini. |
| Payroll | Referensi gaji pokok asli, **bukan** gaji bersih, slip, atau pembayaran. Perhitungan payroll belum aktif. |
| Laporan | Catatan absensi server dengan rentang tanggal, maksimal 1.000 baris terbaru per permintaan. |
| Audit Log | Maksimal 200 aktivitas terbaru dari server. |

Halaman dummy lama masih menjadi arsip kode, tidak diimpor untuk menu baru tersebut. Revisi lanjutan kini menambahkan pengiriman guest ke server dan review admin. Untuk pemasangan migrasi baru dan sinkronisasi data guest lama, ikuti [ABSENSI_REVIEW_EXCEL.md](ABSENSI_REVIEW_EXCEL.md). Persetujuan guest belum otomatis mengaitkan akun/jadwal atau menghitung payroll.

## Verifikasi yang sudah dilakukan

- Frontend production build berhasil.
- TypeScript entry aplikasi aktif lolos pemeriksaan. Halaman arsip di luar jalur aktif tidak termasuk klaim ini.
- 10 tes sesi frontend, 9 tes profil backend, 5 tes validasi crew, 2 tes API/middleware, serta 1 tes integrasi PostgreSQL lokal berhasil.
- Tes SQL lokal meliputi pembuatan crew, deduplikasi penugasan, perubahan role, cabang tidak cocok, rollback, penolakan non-admin, status, arsip tanpa menghapus absensi, dan hak execute RPC.
- Browser otomatis dengan API tiruan menguji tujuh menu admin, tabel, filter lokasi berdasarkan cabang, input gaji 0/kosong/tanpa nol depan, create/edit, kegagalan simpan, detail, password, status, arsip, cabang, serta tema terang/gelap dan mobile.
- Regresi browser guest: menu profil/logout, isolasi notifikasi, profil guest, tema, dan navigasi mobile.
- Tidak terhubung ke Supabase atau Storage produksi Anda dalam pengujian ini. Tes browser memakai fixture, bukan bukti bahwa kredensial/database Anda sudah dikonfigurasi.

Perintah tes standar dari root proyek:

```sh
node --test backend/tests/profile.test.js backend/tests/crew.test.js backend/tests/crew-api.test.cjs
node --experimental-vm-modules --test frontend/tests/auth-session.test.mjs
```

Tes SQL opsional `backend/tests/crew-sql.test.cjs` memakai PostgreSQL lokal PGlite terpasang terpisah, ditunjuk oleh `PGLITE_MODULE`. Tanpa variabel itu, tes SQL ditandai skipped. Browser test di `frontend/tests/admin-browser.cjs` memerlukan Playwright, Chromium, dan folder output QA terpisah; bukan dependency runtime aplikasi.

## Uji wajib di komputer Anda

1. Pasang migrasi dan restart dua server.
2. Pastikan tujuh menu admin tampil. Coba Dashboard dan Audit Log tanpa error API.
3. Tambahkan satu store asli dan satu event asli, lalu pilih cabangnya.
4. Buat satu akun crew uji menggunakan email yang Anda kuasai dan gaji 0. Login sebagai crew itu dan pastikan profil menampilkan email crew, bukan admin.
5. Login admin lagi: periksa Detail, edit gaji, cabang, penugasan, dan nama. Refresh/login ulang, pastikan perubahan tetap ada.
6. Atur ulang password, lalu verifikasi login dengan password baru.
7. Nonaktifkan crew: login aplikasi harus ditolak. Aktifkan kembali dan uji ulang.
8. Uji Hapus hanya pada akun uji setelah memahami bahwa penghapusan ini berupa arsip.
9. Uji absensi setelah lokasi dan jadwal sebenarnya lengkap. Jangan menyebut sistem siap produksi sebelum pengujian perangkat nyata ini selesai.
